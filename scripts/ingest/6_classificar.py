#!/usr/bin/env python3
"""Etapa 6 — classificar cada questão por disciplina/assunto.

Decisão do dono (2026-08-20): **duas passadas independentes**. Uma questão só é
publicada se as duas concordarem no assunto E a confiança média for >= 0,80.
Qualquer divergência vai para a fila de revisão humana — não para o ar.

O classificador nunca inventa nó de taxonomia: escolhe entre os slugs que já
existem em `seeds/taxonomia.json`. Assunto que a prova revela e a taxonomia não
tem vira pendência sua, não um nó criado às escondidas.

O cliente de LLM fica atrás de uma interface. Sem chave configurada, o pipeline
usa o `ClassificadorStub` (respostas gravadas), que é o que roda nos testes.

Saída: `data/06_classificado/{slug}.json` + `acervo/fila_revisao/{slug}.json`
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest.lib import cache, caminhos, modelos  # noqa: E402
from ingest.lib.modelos import (  # noqa: E402
    LIMIAR_CONFIANCA, STATUS_PENDENTE_CLASSIFICACAO, STATUS_PUBLICAVEL, normalizar,
)

VERSAO = "1.0"
SEEDS = caminhos.RAIZ / "seeds" / "taxonomia.json"


@dataclass(frozen=True)
class Palpite:
    disciplina: str
    assunto: str
    confianca: float


class Classificador(Protocol):
    nome: str

    def classificar(self, enunciado: str, opcoes: list[dict], passada: int) -> Palpite: ...


class ClassificadorStub:
    """Sem LLM: respostas gravadas por hash do enunciado.

    Existe para o pipeline rodar ponta a ponta em teste sem gastar API e sem
    inventar classificação. Enunciado desconhecido devolve confiança 0 — e cai
    na fila de revisão, que é o comportamento honesto.
    """

    nome = "stub"

    def __init__(self, gravadas: dict[str, dict] | None = None) -> None:
        self.gravadas = gravadas or {}

    def classificar(self, enunciado: str, opcoes: list[dict], passada: int) -> Palpite:
        chave = cache.sha256_texto(normalizar(enunciado))
        registro = self.gravadas.get(chave) or self.gravadas.get(normalizar(enunciado))
        if not registro:
            return Palpite(disciplina="", assunto="", confianca=0.0)
        return Palpite(
            disciplina=registro["disciplina"],
            assunto=registro[f"assunto_{passada}"] if f"assunto_{passada}" in registro else registro["assunto"],
            confianca=float(registro.get("confianca", 0.9)),
        )


class ClassificadorNulo:
    """Não classifica de propósito: publica com assunto/disciplina nulos.

    Decisão do dono (2026-08-26): não gastar em LLM agora. A questão fica
    utilizável (resolver, gabarito, caderno de erros) sem entrar na fila de
    revisão — "assunto: null" é visível no dado, não escondido. Classificar
    depois (manual ou com IA) não precisa reprocessar o resto do pipeline.
    """

    nome = "nulo"

    def classificar(self, enunciado: str, opcoes: list[dict], passada: int) -> Palpite:
        return Palpite(disciplina="", assunto="", confianca=0.0)


class ClassificadorLLM:
    """Cliente real. Só é instanciado quando há chave no ambiente."""

    nome = "llm"

    def __init__(self, modelo: str) -> None:
        try:
            import anthropic  # noqa: F401
        except ImportError as erro:  # pragma: no cover - depende de dependência opcional
            raise SystemExit(
                "6_classificar precisa do pacote `anthropic` para usar LLM.\n"
                "Instale com: pip install anthropic — ou rode com --stub."
            ) from erro
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise SystemExit("ANTHROPIC_API_KEY não está no ambiente. Rode com --stub para testar.")
        self.modelo = modelo

    def classificar(self, enunciado: str, opcoes: list[dict], passada: int) -> Palpite:  # pragma: no cover
        import anthropic

        cliente = anthropic.Anthropic()
        catalogo = "\n".join(f"- {o['slug']} — {o['disciplina']} › {o['nome']}" for o in opcoes)
        resposta = cliente.messages.create(
            model=self.modelo,
            max_tokens=300,
            system=(
                "Você classifica questões de concurso por assunto. Escolha EXATAMENTE um slug "
                "da lista fornecida. Nunca invente slug. Responda só com JSON: "
                '{"slug": "...", "confianca": 0.0}'
            ),
            messages=[{"role": "user", "content": f"Assuntos disponíveis:\n{catalogo}\n\nQuestão:\n{enunciado}"}],
        )
        bruto = resposta.content[0].text.strip()
        dado = json.loads(bruto[bruto.find("{") : bruto.rfind("}") + 1])
        opcao = next((o for o in opcoes if o["slug"] == dado["slug"]), None)
        if opcao is None:
            return Palpite(disciplina="", assunto="", confianca=0.0)
        return Palpite(
            disciplina=opcao["disciplina"], assunto=opcao["nome"], confianca=float(dado["confianca"])
        )


def carregar_opcoes() -> list[dict]:
    if not SEEDS.exists():
        raise SystemExit(f"taxonomia não encontrada em {caminhos.relativo(SEEDS)}")
    dados = json.loads(SEEDS.read_text(encoding="utf-8"))
    opcoes = []
    for disciplina in dados["disciplinas"]:
        for assunto in disciplina["assuntos"]:
            opcoes.append(
                {"slug": assunto["slug"], "nome": assunto["nome"], "disciplina": disciplina["nome"]}
            )
    return opcoes


def executar(
    slug: str,
    *,
    classificador: Classificador | None = None,
    forcar: bool = False,
) -> dict:
    c = caminhos.Caminhos(slug)
    c.preparar()
    dados = modelos.ler_json(c.com_gabarito)

    man = cache.Manifesto.abrir(c.cache, slug)
    clf = classificador or ClassificadorStub()
    if not forcar and man.em_dia("6_classificar", [c.com_gabarito], [c.classificado], VERSAO, extra=clf.nome):
        return modelos.ler_json(c.classificado)

    opcoes = carregar_opcoes()
    fila: list[dict] = []
    publicaveis = 0

    for q in dados["questoes"]:
        enunciado = q["enunciado"]

        if clf.nome == "nulo":
            q["classificacao_metodo"] = "nulo"
            q["disciplina"] = None
            q["assunto"] = None
            q["classificacao_confianca"] = None
            publicaveis += 1
            continue

        a = clf.classificar(enunciado, opcoes, 1)
        b = clf.classificar(enunciado, opcoes, 2)
        concordam = a.assunto == b.assunto and bool(a.assunto)
        confianca = round(min(a.confianca, b.confianca), 3)

        q["classificacao_metodo"] = f"{clf.nome}:2-passadas"
        if concordam and confianca >= LIMIAR_CONFIANCA:
            q["disciplina"] = a.disciplina
            q["assunto"] = a.assunto
            q["classificacao_confianca"] = confianca
            publicaveis += 1
        else:
            q["disciplina"] = None
            q["assunto"] = None
            q["classificacao_confianca"] = confianca
            fila.append(
                {
                    "numero": q["numero"],
                    "enunciado": enunciado[:400],
                    "motivo": "divergência entre as passadas" if not concordam else "confiança abaixo do limiar",
                    "passada_1": {"disciplina": a.disciplina, "assunto": a.assunto, "confianca": a.confianca},
                    "passada_2": {"disciplina": b.disciplina, "assunto": b.assunto, "confianca": b.confianca},
                }
            )

    avisos = list(dados.get("avisos", []))
    if fila:
        avisos.append(f"{len(fila)} questões foram para a fila de revisão humana")
        modelos.escrever_json(c.fila_revisao, {"slug": slug, "itens": fila})
    elif c.fila_revisao.exists():
        c.fila_revisao.unlink()

    if dados["status"] == STATUS_PENDENTE_CLASSIFICACAO and not fila:
        dados["status"] = STATUS_PUBLICAVEL

    dados["avisos"] = avisos
    dados["resumo_classificacao"] = {
        "classificadas": publicaveis,
        "em_revisao": len(fila),
        "limiar": LIMIAR_CONFIANCA,
    }
    modelos.escrever_json(c.classificado, dados)
    man.registrar("6_classificar", [c.com_gabarito], [c.classificado], VERSAO, extra=clf.nome)
    return dados


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slug")
    ap.add_argument("--stub", action="store_true", help="não chamar LLM (padrão quando não há chave)")
    ap.add_argument(
        "--sem-classificacao", action="store_true",
        help="publica com assunto/disciplina nulos, sem chamar LLM nem usar a fila de revisão",
    )
    ap.add_argument("--modelo", default="claude-sonnet-5")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    clf: Classificador
    if args.sem_classificacao:
        clf = ClassificadorNulo()
    elif args.stub or not os.environ.get("ANTHROPIC_API_KEY"):
        clf = ClassificadorStub()
    else:
        clf = ClassificadorLLM(args.modelo)

    d = executar(args.slug, classificador=clf, forcar=args.force)
    r = d.get("resumo_classificacao", {})
    print(
        f"{args.slug}: {r.get('classificadas', 0)} classificadas, "
        f"{r.get('em_revisao', 0)} na fila de revisão — status {d['status']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
