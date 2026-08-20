#!/usr/bin/env python3
"""Etapa 2 — colocar os PDFs no cache, com hash.

Arquivo que veio pela pasta manual é **copiado**, nunca rebaixado. Arquivo que
só existe como URL é baixado com User-Agent identificável e 1 requisição a cada
2 segundos (ver `lib/rede.py`). O cache é por sha256 do conteúdo: reprocessar
uma prova não baixa nada de novo.

Saída: `data/02_pdfs/{slug}/` + `fontes.json` enriquecido com sha256 e tamanho.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest.lib import cache, caminhos, modelos, rede  # noqa: E402

VERSAO = "1.0"


def executar(slug: str, *, forcar: bool = False) -> dict:
    c = caminhos.Caminhos(slug)
    c.preparar()
    doc = modelos.ler_json(c.fontes)

    sessao: rede.Sessao | None = None
    for fonte in doc["fontes"]:
        destino = c.pdfs / fonte["arquivo"]
        if destino.exists() and not forcar:
            fonte["sha256"] = cache.sha256_arquivo(destino)
            fonte["bytes"] = destino.stat().st_size
            fonte["local"] = caminhos.relativo(destino)
            continue

        origem_local = Path(caminhos.RAIZ / fonte["local"]) if fonte.get("local") else None
        if origem_local and origem_local.exists():
            shutil.copy2(origem_local, destino)
        else:
            sessao = sessao or rede.Sessao()
            sessao.baixar(fonte["url"], destino)

        fonte["sha256"] = cache.sha256_arquivo(destino)
        fonte["bytes"] = destino.stat().st_size
        fonte["local"] = caminhos.relativo(destino)

    modelos.escrever_json(c.fontes, doc)
    return doc


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slug")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    doc = executar(args.slug, forcar=args.force)
    total = sum(f.get("bytes", 0) for f in doc["fontes"])
    print(f"{args.slug}: {len(doc['fontes'])} arquivo(s) no cache, {total / 1_048_576:.1f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
