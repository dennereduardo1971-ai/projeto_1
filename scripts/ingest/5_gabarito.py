#!/usr/bin/env python3
"""Etapa 5 — casar cada item com o gabarito DEFINITIVO.

Regra 3 do projeto, aplicada ao pé da letra: sem casamento com o definitivo, a
prova para em `pendente_definitivo` e **não publica**. Gabarito preliminar não
serve — a banca altera item depois dos recursos, e um gabarito errado no app é o
pior defeito possível deste produto.

Anulada entra marcada: serve para estudo, nunca para estatística.

Saída: `data/05_gabarito/{slug}.json`
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pdfplumber  # noqa: E402

from ingest.lib import cache, caminhos, modelos  # noqa: E402
from ingest.lib.modelos import STATUS_PENDENTE_CLASSIFICACAO, STATUS_PENDENTE_DEFINITIVO  # noqa: E402

VERSAO = "1.0"

# CALIBRAR: a grade do gabarito definitivo do Cebraspe é uma tabela; o texto
# extraído costuma sair como "12 C" ou "12 ANULADO". Estes três padrões cobrem
# o que se espera; confira contra o primeiro PDF real e acrescente aqui.
PADROES = (
    re.compile(r"\b(?P<numero>\d{1,3})\s*[-–—:.]?\s*(?P<letra>[A-E])\b(?![\w])"),
    re.compile(r"\b(?P<numero>\d{1,3})\s*[-–—:.]?\s*(?P<anulado>ANULAD[OA])\b", re.I),
    re.compile(r"\b(?P<numero>\d{1,3})\s*[-–—:.]?\s*(?P<deferido>DEFERIDO\s+C/?\s*ALTERA)", re.I),
)


RE_LINHA_QUESTAO = re.compile(r"(?i)^quest[ãa]o\s+(?P<nums>[\d\s]+)$")
RE_LINHA_GABARITO = re.compile(r"(?i)^gabarito\s+(?P<vals>[A-EX?\s]+)$")


def _ler_grade_tabela(texto: str) -> dict[int, dict]:
    """Formato observado no gabarito definitivo real (grade em duas linhas):

        Questão 1 2 3 4 5 6 7 8 9 10 ...
        Gabarito A C B C A E A B A D ...

    "X" marca item anulado. Cada bloco de 20 colunas se repete até o fim da
    prova — a linha `Questão` seguinte sempre é seguida pela `Gabarito`
    correspondente, então basta emparelhar a última pendente.
    """
    grade: dict[int, dict] = {}
    pendentes: list[int] | None = None
    for linha in texto.splitlines():
        bruto = linha.strip()
        if m := RE_LINHA_QUESTAO.match(bruto):
            pendentes = [int(x) for x in m.group("nums").split()]
            continue
        if pendentes and (m := RE_LINHA_GABARITO.match(bruto)):
            for numero, val in zip(pendentes, m.group("vals").split()):
                v = val.upper()
                if v == "X":
                    grade[numero] = {"gabarito": None, "anulada": True}
                elif v in "ABCDE":
                    grade.setdefault(numero, {"gabarito": v, "anulada": False})
            pendentes = None
    return grade


def ler_grade(pdf_path: Path) -> dict[int, dict]:
    """Extrai {numero: {gabarito|anulada}} do PDF do gabarito definitivo."""
    grade: dict[int, dict] = {}
    with pdfplumber.open(pdf_path) as pdf:
        for pagina in pdf.pages:
            texto = pagina.extract_text() or ""
            for linha in texto.splitlines():
                for padrao in PADROES:
                    for m in padrao.finditer(linha):
                        numero = int(m.group("numero"))
                        grupos = m.groupdict()
                        if grupos.get("anulado"):
                            grade[numero] = {"gabarito": None, "anulada": True}
                        elif grupos.get("letra"):
                            grade.setdefault(numero, {"gabarito": grupos["letra"], "anulada": False})
            if not grade:
                grade.update(_ler_grade_tabela(texto))
    return grade


def executar(slug: str, *, forcar: bool = False) -> dict:
    c = caminhos.Caminhos(slug)
    c.preparar()
    dados = modelos.ler_json(c.segmentado)
    fontes = modelos.ler_json(c.fontes)

    definitivo = next((f for f in fontes["fontes"] if f["classe"] == "gabarito_definitivo"), None)
    preliminar = next((f for f in fontes["fontes"] if f["classe"] == "gabarito_preliminar"), None)

    man = cache.Manifesto.abrir(c.cache, slug)
    entradas = [c.segmentado] + ([caminhos.RAIZ / definitivo["local"]] if definitivo else [])
    if not forcar and man.em_dia("5_gabarito", entradas, [c.com_gabarito], VERSAO):
        return modelos.ler_json(c.com_gabarito)

    avisos = list(dados.get("avisos", []))

    if definitivo is None:
        dados["status"] = STATUS_PENDENTE_DEFINITIVO
        if preliminar:
            avisos.append(
                "existe gabarito PRELIMINAR entre as fontes, mas ele não é usado: "
                "a banca altera item depois dos recursos"
            )
        avisos.append(
            "sem gabarito definitivo — a prova não publica. Baixe o "
            "Gab_Definitivo_*.pdf e rode de novo."
        )
        dados["avisos"] = avisos
        modelos.escrever_json(c.com_gabarito, dados)
        return dados

    grade = ler_grade(caminhos.RAIZ / definitivo["local"])
    if not grade:
        raise SystemExit(
            f"{slug}: não consegui ler nenhum item do gabarito "
            f"{definitivo['arquivo']}. Ajuste PADROES em 5_gabarito.py."
        )

    casadas = anuladas = 0
    sem_gabarito: list[int] = []
    for q in dados["questoes"]:
        entrada = grade.get(q["numero"])
        if entrada is None:
            sem_gabarito.append(q["numero"])
            continue
        if entrada["anulada"]:
            q["anulada"] = True
            q["gabarito"] = None
            anuladas += 1
        else:
            q["gabarito"] = entrada["gabarito"]
            casadas += 1

    fora_do_caderno = sorted(set(grade) - {q["numero"] for q in dados["questoes"]})
    if fora_do_caderno:
        avisos.append(
            f"gabarito traz itens que o caderno não tem: {fora_do_caderno[:20]} — "
            "conferir se o tipo de caderno bate com o do gabarito"
        )

    if sem_gabarito:
        dados["status"] = STATUS_PENDENTE_DEFINITIVO
        avisos.append(f"itens sem casamento no gabarito definitivo: {sem_gabarito[:20]}")
    elif dados["status"] not in {"precisa_ocr"}:
        dados["status"] = STATUS_PENDENTE_CLASSIFICACAO

    dados["prova"]["fonte_gabarito"] = definitivo["url"]
    dados["prova"]["sha256_gabarito"] = definitivo.get("sha256")
    dados["avisos"] = avisos
    dados["resumo_gabarito"] = {
        "casadas": casadas,
        "anuladas": anuladas,
        "sem_gabarito": len(sem_gabarito),
    }
    modelos.escrever_json(c.com_gabarito, dados)
    man.registrar("5_gabarito", entradas, [c.com_gabarito], VERSAO)
    return dados


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slug")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    d = executar(args.slug, forcar=args.force)
    r = d.get("resumo_gabarito", {})
    print(
        f"{args.slug}: {r.get('casadas', 0)} casadas, {r.get('anuladas', 0)} anuladas, "
        f"{r.get('sem_gabarito', 0)} sem gabarito — status {d['status']}"
    )
    for aviso in d.get("avisos", []):
        print(f"  ! {aviso}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
