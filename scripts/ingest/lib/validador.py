"""Validação do artefato de uma prova.

Duas camadas, de propósito:

1. **JSON Schema** (`schema/prova.schema.json`) — forma: tipos, campos
   obrigatórios, enums.
2. **Regras** — o que o schema não alcança: referências cruzadas, a barreira
   anti-justificativa e as regras do `CLAUDE.md` que decidem se a prova pode ser
   publicada.

Toda regra abaixo é um "não publica". Aviso que não impede publicação vive em
`Artefato.avisos`, não aqui.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from . import modelos
from .modelos import (
    CAMPOS_JUSTIFICATIVA_REF,
    CAMPOS_LIBERADOS_APOSTILA,
    CAMPOS_PROIBIDOS,
    FORMATOS,
    GABARITO_CE,
    GABARITO_MULTIPLA,
    LIMIAR_CONFIANCA,
    ORIGENS_FONTE,
    STATUS_PUBLICAVEL,
    STATUS_VALIDOS,
    normalizar,
)

DIR_SCHEMA = Path(__file__).resolve().parents[1] / "schema"


class Invalido(Exception):
    """Levantada com a lista completa de problemas — nunca só o primeiro."""

    def __init__(self, problemas: list[str]) -> None:
        self.problemas = problemas
        super().__init__(f"{len(problemas)} problema(s): " + "; ".join(problemas[:5]))


# ── camada 1: schema ─────────────────────────────────────────────────────────
_validador_cache: Draft202012Validator | None = None


def _validador() -> Draft202012Validator:
    global _validador_cache
    if _validador_cache is None:
        schema = json.loads((DIR_SCHEMA / "prova.schema.json").read_text(encoding="utf-8"))
        _validador_cache = Draft202012Validator(schema)
    return _validador_cache


def problemas_de_schema(dados: dict) -> list[str]:
    saida = []
    for erro in sorted(_validador().iter_errors(dados), key=lambda e: list(e.path)):
        onde = "/".join(str(p) for p in erro.path) or "(raiz)"
        saida.append(f"schema[{onde}]: {erro.message}")
    return saida


# ── camada 2: barreira anti-justificativa ────────────────────────────────────
def _dados_para_barreira(dados: dict) -> dict:
    """Cópia usada só pela barreira anti-justificativa.

    Pivô 2026-08-31 (CLAUDE.md, regra 5, exceção temporária): quando a prova é
    uma `apostila_comentada` com `autor_fonte` preenchido, o comentário do
    PRÓPRIO autor deixa de ser barrado. Para `prova_oficial` (padrão) nada
    muda — a barreira contra a justificativa da banca continua sem exceção.
    """
    prova = dados.get("prova", {})
    liberado = prova.get("origem_fonte") == "apostila_comentada" and bool(prova.get("autor_fonte"))
    if not liberado:
        return dados
    questoes = [
        {k: v for k, v in q.items() if k not in CAMPOS_LIBERADOS_APOSTILA}
        for q in dados.get("questoes", [])
    ]
    return {**dados, "questoes": questoes}


def _varrer_campos_proibidos(no: Any, caminho: str = "") -> list[str]:
    """Procura texto autoral da banca em QUALQUER nível do artefato.

    Só existe uma porta legítima para a justificativa: `justificativa_ref`, que
    guarda ponteiro (sha256, pagina, url) e nada mais. Ver CLAUDE.md, regra 5.
    """
    problemas: list[str] = []
    if isinstance(no, dict):
        for chave, valor in no.items():
            onde = f"{caminho}/{chave}" if caminho else chave
            if chave.lower() in CAMPOS_PROIBIDOS:
                problemas.append(
                    f"justificativa[{onde}]: campo proibido no artefato — "
                    "texto autoral da banca fica em data/justificativas/, fora do git"
                )
            if chave == "justificativa_ref" and isinstance(valor, dict):
                extras = set(valor) - CAMPOS_JUSTIFICATIVA_REF
                if extras:
                    problemas.append(
                        f"justificativa[{onde}]: só {sorted(CAMPOS_JUSTIFICATIVA_REF)} "
                        f"são permitidos; veio também {sorted(extras)}"
                    )
                continue
            problemas.extend(_varrer_campos_proibidos(valor, onde))
    elif isinstance(no, list):
        for i, item in enumerate(no):
            problemas.extend(_varrer_campos_proibidos(item, f"{caminho}[{i}]"))
    return problemas


# ── camada 2: regras de domínio ──────────────────────────────────────────────
def problemas_de_regra(dados: dict, *, para_publicar: bool) -> list[str]:
    problemas: list[str] = []
    prova = dados.get("prova", {})
    questoes = dados.get("questoes", [])
    status = dados.get("status")

    if status not in STATUS_VALIDOS:
        problemas.append(f"prova: status desconhecido '{status}'")

    # Pivô 2026-08-31 (CLAUDE.md regras 3-5): a atribuição exigida depende da
    # origem. Ausente = 'prova_oficial', para não quebrar artefato antigo.
    origem = prova.get("origem_fonte", "prova_oficial")
    if origem not in ORIGENS_FONTE:
        problemas.append(f"prova: origem_fonte desconhecida '{origem}'")
    oficial = origem == "prova_oficial"

    formato = prova.get("formato")
    if formato not in FORMATOS:
        problemas.append(f"prova: formato inválido '{formato}'")
    if formato == "ce" and prova.get("penalidade_por_erro") is not True:
        problemas.append(
            "prova: caderno Certo/Errado do Cebraspe pune o erro — "
            "penalidade_por_erro não pode ser falsa"
        )
    if oficial:
        if not str(prova.get("banca", "")).strip():
            problemas.append("prova: banca é obrigatória (é dado, não premissa)")
    else:
        if not str(prova.get("autor_fonte", "")).strip():
            problemas.append("prova: autor_fonte é obrigatório para apostila_comentada (regra 4)")
        if not str(prova.get("titulo_fonte", "")).strip():
            problemas.append("prova: titulo_fonte é obrigatório para apostila_comentada (regra 4)")

    # ── textos de apoio: amarrados por referência, nunca duplicados ──────────
    ids_apoio = {t["id"] for t in dados.get("textos_apoio", [])}
    usados: set[str] = set()

    numeros: list[int] = []
    for q in questoes:
        n = q.get("numero")
        rot = f"questao {n}"
        numeros.append(n)

        # atribuição obrigatória (CLAUDE.md, regra 4) — só para prova_oficial;
        # apostila_comentada carrega a atribuição na PROVA (autor_fonte/titulo_fonte).
        if oficial:
            atr = q.get("atribuicao") or {}
            for campo in ("banca", "ano", "orgao", "cargo", "numero_original", "url_pdf"):
                if not atr.get(campo):
                    problemas.append(f"{rot}: atribuicao.{campo} ausente")
            if atr.get("numero_original") not in (None, n):
                problemas.append(f"{rot}: numero_original diverge do numero da questão")

        # tipo × alternativas × gabarito
        tipo = q.get("tipo")
        alternativas = q.get("alternativas") or []
        if tipo == "ce":
            if alternativas:
                problemas.append(f"{rot}: item Certo/Errado não tem alternativas")
            if q.get("gabarito") not in (None, *GABARITO_CE):
                problemas.append(f"{rot}: gabarito '{q.get('gabarito')}' não é C nem E")
        elif tipo == "multipla":
            letras = [a.get("letra") for a in alternativas]
            if len(alternativas) < 2:
                problemas.append(f"{rot}: múltipla escolha com menos de 2 alternativas")
            if len(set(letras)) != len(letras):
                problemas.append(f"{rot}: letras de alternativa repetidas")
            if q.get("gabarito") not in (None, *GABARITO_MULTIPLA):
                problemas.append(f"{rot}: gabarito '{q.get('gabarito')}' fora de A–E")
            if q.get("gabarito") and q["gabarito"] not in letras and not q.get("anulada"):
                problemas.append(f"{rot}: gabarito aponta para alternativa inexistente")
        else:
            problemas.append(f"{rot}: tipo inválido '{tipo}'")

        # anulada: entra para estudo, nunca para estatística (CLAUDE.md, regra 3)
        if q.get("anulada") and q.get("gabarito"):
            problemas.append(f"{rot}: questão anulada não carrega letra de gabarito")

        apoio = q.get("texto_apoio_id")
        if apoio:
            usados.add(apoio)
            if apoio not in ids_apoio:
                problemas.append(f"{rot}: texto_apoio_id '{apoio}' não existe")

    repetidos = sorted({n for n in numeros if numeros.count(n) > 1})
    if repetidos:
        problemas.append(f"prova: número de questão repetido {repetidos}")

    orfaos = sorted(ids_apoio - usados)
    if orfaos:
        problemas.append(f"prova: texto de apoio sem nenhuma questão apontando: {orfaos}")

    # ── enunciado duplicado: caderno de cor trocada ──────────────────────────
    vistos: dict[str, int] = {}
    for q in questoes:
        chave = normalizar(q.get("enunciado", ""))
        if not chave:
            continue
        if chave in vistos:
            problemas.append(
                f"questao {q.get('numero')}: enunciado idêntico ao da questão {vistos[chave]} "
                "— provável mistura de tipos de caderno"
            )
        else:
            vistos[chave] = q.get("numero")

    if not para_publicar:
        return problemas

    # ── o que só é exigido na hora de publicar ───────────────────────────────
    if status != STATUS_PUBLICAVEL:
        problemas.append(f"prova: status '{status}' não é publicável")
    for q in questoes:
        rot = f"questao {q.get('numero')}"
        if not q.get("anulada"):
            # prova_oficial precisa do casamento com o gabarito definitivo da
            # banca; apostila_comentada não tem banca — usa gabarito próprio
            # + revisão humana (CLAUDE.md regra 3, exceção temporária de
            # 2026-08-31).
            if oficial:
                if not q.get("gabarito"):
                    problemas.append(f"{rot}: sem gabarito definitivo casado — não publica")
            else:
                if not q.get("gabarito"):
                    problemas.append(f"{rot}: sem gabarito — não publica")
                if not q.get("revisado_humano"):
                    problemas.append(f"{rot}: falta revisão humana (revisado_humano) — não publica")
        classificacao = q.get("classificacao_confianca")
        if not q.get("assunto"):
            problemas.append(f"{rot}: sem assunto classificado")
        elif classificacao is not None and classificacao < LIMIAR_CONFIANCA:
            problemas.append(
                f"{rot}: confiança {classificacao:.2f} abaixo de {LIMIAR_CONFIANCA:.2f} "
                "— vai para a fila de revisão, não para o ar"
            )
    if oficial and not prova.get("fonte_gabarito"):
        problemas.append("prova: sem URL do gabarito definitivo")
    return problemas


# ── entrada pública ──────────────────────────────────────────────────────────
def validar(dados: dict, *, para_publicar: bool = False) -> list[str]:
    """Devolve TODOS os problemas. Lista vazia = artefato íntegro."""
    problemas = problemas_de_schema(dados)
    problemas += _varrer_campos_proibidos(_dados_para_barreira(dados))
    problemas += problemas_de_regra(dados, para_publicar=para_publicar)
    return problemas


def exigir(dados: dict, *, para_publicar: bool = False) -> None:
    problemas = validar(dados, para_publicar=para_publicar)
    if problemas:
        raise Invalido(problemas)


def validar_artefato(artefato: "modelos.Artefato", *, para_publicar: bool = False) -> list[str]:
    return validar(modelos.para_dict(artefato), para_publicar=para_publicar)
