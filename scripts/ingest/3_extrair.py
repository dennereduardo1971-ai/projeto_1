#!/usr/bin/env python3
"""Etapa 3 — PDF em palavras com coordenadas.

Não produz "texto": produz palavras com `(x0, top, x1, bottom)`, que é o que
permite reordenar colunas, descartar cabeçalho por faixa de y e recortar a
região de uma tabela. Texto puro perde tudo isso.

OCR está fora da v1: página com pouquíssimo caractere é marcada `precisa_ocr` e
a prova inteira é recusada mais adiante, em vez de entrar com texto adivinhado.

Saída: `data/03_texto/{slug}/paginas.json`
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pdfplumber  # noqa: E402

from ingest.lib import cache, caminhos, modelos, perfil as perfil_lib  # noqa: E402

VERSAO = "1.0"


def _linhas(palavras: list[dict], tolerancia: float) -> list[dict]:
    """Agrupa palavras em linhas por proximidade de `top`."""
    linhas: list[dict] = []
    for p in sorted(palavras, key=lambda w: (round(w["top"], 1), w["x0"])):
        alvo = next(
            (l for l in linhas if abs(l["top"] - p["top"]) <= tolerancia),
            None,
        )
        if alvo is None:
            linhas.append({"top": p["top"], "bottom": p["bottom"], "palavras": [p]})
        else:
            alvo["palavras"].append(p)
            alvo["bottom"] = max(alvo["bottom"], p["bottom"])
    for l in linhas:
        l["palavras"].sort(key=lambda w: w["x0"])
        l["texto"] = " ".join(w["text"] for w in l["palavras"])
        l["x0"] = min(w["x0"] for w in l["palavras"])
        l["x1"] = max(w["x1"] for w in l["palavras"])
    return sorted(linhas, key=lambda l: l["top"])


def _achar_calha(palavras: list[dict], largura: float, gap_min: float) -> float | None:
    """Acha o x de uma calha vertical vazia perto do meio da página.

    Decide por PALAVRA, não por linha já agrupada — agrupar em linha primeiro
    e só depois repartir em colunas é o bug que isto substitui: duas colunas na
    mesma altura viram uma linha só, com o fim da esquerda colado no começo da
    direita (ex.: "TECNOLOGIA DA INFORMAÇÃO... Questão 4" quando "Questão 4" é
    na verdade o topo da coluna da direita, não continuação do título).

    Procura o maior vão entre centros de palavra na faixa central da página
    (30%–70% da largura) para não confundir com a margem das bordas. Sem vão
    largo o bastante ali, a página é de 1 coluna.
    """
    if not palavras:
        return None
    lo, hi = largura * 0.3, largura * 0.7
    centros = sorted(c for c in ((w["x0"] + w["x1"]) / 2 for w in palavras) if lo <= c <= hi)
    if len(centros) < 2:
        return None
    maior_gap, corte = 0.0, None
    for a, b in zip(centros, centros[1:]):
        if b - a > maior_gap:
            maior_gap, corte = b - a, (a + b) / 2
    return corte if maior_gap >= gap_min else None


def executar(slug: str, *, nome_perfil: str | None = None, forcar: bool = False) -> dict:
    c = caminhos.Caminhos(slug)
    c.preparar()
    fontes = modelos.ler_json(c.fontes)
    p = perfil_lib.resolver(slug, nome_perfil)

    caderno = next(
        (f for f in fontes["fontes"] if f["classe"] == "caderno_com_justificativa"),
        None,
    ) or next((f for f in fontes["fontes"] if f["classe"] == "caderno"), None)
    if caderno is None:
        raise SystemExit(f"{slug}: nenhum caderno de provas entre as fontes")

    pdf_path = caminhos.RAIZ / caderno["local"]
    man = cache.Manifesto.abrir(c.cache, slug)
    if not forcar and man.em_dia("3_extrair", [pdf_path], [c.texto], VERSAO, extra=p.nome):
        return modelos.ler_json(c.texto)

    min_chars = int(p.ocr.get("min_chars_por_pagina", 120))
    tolerancia = float(p.layout.get("tolerancia_linha", 2.5))
    gap_min = float(p.layout.get("gap_coluna_min", 24))
    topo_frac = float(p.layout.get("margem_topo_frac", 0.06))
    rodape_frac = float(p.layout.get("margem_rodape_frac", 0.05))
    colunas_cfg = p.layout.get("colunas", "auto")

    paginas = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, pagina in enumerate(pdf.pages, start=1):
            palavras = pagina.extract_words(keep_blank_chars=False, use_text_flow=False)
            chars = sum(len(w["text"]) for w in palavras)
            corte_topo = pagina.height * topo_frac
            corte_rodape = pagina.height * (1 - rodape_frac)

            miolo = [w for w in palavras if corte_topo <= w["top"] <= corte_rodape]

            # A calha entre colunas precisa ser achada ANTES de agrupar em
            # linha: agrupar primeiro e repartir depois mistura, na mesma
            # linha, o fim de uma coluna com o começo da outra.
            if colunas_cfg == "auto":
                calha = _achar_calha(miolo, pagina.width, gap_min)
            elif int(colunas_cfg) == 2:
                calha = _achar_calha(miolo, pagina.width, gap_min) or pagina.width / 2
            else:
                calha = None

            if calha is None:
                colunas = 1
                linhas = _linhas(miolo, tolerancia)
            else:
                colunas = 2
                esquerda = [w for w in miolo if (w["x0"] + w["x1"]) / 2 <= calha]
                direita = [w for w in miolo if (w["x0"] + w["x1"]) / 2 > calha]
                linhas = _linhas(esquerda, tolerancia) + _linhas(direita, tolerancia)

            paginas.append(
                {
                    "numero": i,
                    "largura": round(pagina.width, 2),
                    "altura": round(pagina.height, 2),
                    "colunas": colunas,
                    "precisa_ocr": chars < min_chars,
                    "chars": chars,
                    "linhas": [
                        {
                            "texto": l["texto"],
                            "top": round(l["top"], 2),
                            "bottom": round(l["bottom"], 2),
                            "x0": round(l["x0"], 2),
                            "x1": round(l["x1"], 2),
                        }
                        for l in linhas
                    ],
                }
            )

    doc = {
        "slug": slug,
        "perfil": p.nome,
        "pdf": caderno["local"],
        "sha256_pdf": caderno.get("sha256"),
        "url_pdf": caderno["url"],
        "paginas": paginas,
    }
    modelos.escrever_json(c.texto, doc)
    man.registrar("3_extrair", [pdf_path], [c.texto], VERSAO, extra=p.nome)
    return doc


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slug")
    ap.add_argument("--perfil")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    doc = executar(args.slug, nome_perfil=args.perfil, forcar=args.force)
    sem_texto = [p["numero"] for p in doc["paginas"] if p["precisa_ocr"]]
    linhas = sum(len(p["linhas"]) for p in doc["paginas"])
    print(f"{args.slug}: {len(doc['paginas'])} páginas, {linhas} linhas, perfil {doc['perfil']}")
    if sem_texto:
        print(f"  ! sem camada de texto nas páginas {sem_texto} — OCR está fora da v1")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
