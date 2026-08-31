#!/usr/bin/env python3
"""Etapa 8 — gate humano leve para `apostila_comentada`.

Cebraspe publica quando casa com o gabarito definitivo da banca (regra 3 do
CLAUDE.md). Apostila comentada de terceiro não tem "definitivo da banca" para
casar — a exceção temporária (CLAUDE.md, 2026-08-31) troca isso por
`revisado_humano = true`, marcado aqui, nunca automaticamente pela ingestão.

Sem flag: mostra uma amostra (3 primeiras questões) do `classificado` de um
sub-slug para o dono conferir contra o PDF original — enunciado, gabarito
extraído, início do comentário.

Com `--aprovar`: marca `revisado_humano = true` em toda questão NÃO anulada
e regrava `data/06_classificado/{sub_slug}.json`. Depois disso,
`7_publicar.py <sub_slug>` (ou `run.py` de novo) publica de verdade.

    python scripts/ingest/8_revisar.py apostila_auditoria_amostragem_ce
    python scripts/ingest/8_revisar.py apostila_auditoria_amostragem_ce --aprovar
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest.lib import caminhos, modelos  # noqa: E402

AMOSTRA = 3


def mostrar_amostra(dados: dict) -> None:
    prova = dados.get("prova", {})
    print(f"{dados.get('slug', prova.get('slug'))}: {prova.get('autor_fonte')} — {prova.get('titulo_fonte')}")
    print(f"  formato: {prova.get('formato')} | status: {dados.get('status')}")
    questoes = dados.get("questoes", [])
    for q in questoes[:AMOSTRA]:
        print(f"\n  questão {q.get('numero')} ({q.get('tipo')}) — gabarito: {q.get('gabarito')!r}"
              f" | anulada: {q.get('anulada')} | revisado_humano: {q.get('revisado_humano')}")
        print(f"    enunciado: {q.get('enunciado', '')[:300]}")
        for alt in q.get("alternativas", []):
            print(f"      {alt['letra']}) {alt['texto'][:150]}")
        comentario = q.get("comentario") or "(sem comentário)"
        print(f"    comentário: {comentario[:300]}")
    if len(questoes) > AMOSTRA:
        print(f"\n  … e mais {len(questoes) - AMOSTRA} questão(ões)")


def executar(slug: str, *, aprovar: bool = False) -> dict:
    c = caminhos.Caminhos(slug)
    if not c.classificado.exists():
        raise SystemExit(
            f"{slug}: não existe {caminhos.relativo(c.classificado)} — "
            f"rode `python scripts/ingest/run.py <slug_base>` primeiro."
        )
    dados = modelos.ler_json(c.classificado)

    if not aprovar:
        mostrar_amostra(dados)
        return dados

    marcadas = 0
    for q in dados.get("questoes", []):
        if q.get("anulada"):
            continue
        if not q.get("revisado_humano"):
            marcadas += 1
        q["revisado_humano"] = True

    modelos.escrever_json(c.classificado, dados)
    print(f"{slug}: revisado_humano=true em {marcadas} questão(ões) — {caminhos.relativo(c.classificado)} regravado")
    return dados


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slug", help="sub-slug já classificado (ex.: apostila_auditoria_amostragem_ce)")
    ap.add_argument("--aprovar", action="store_true", help="marca revisado_humano=true e regrava")
    args = ap.parse_args()

    executar(args.slug, aprovar=args.aprovar)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
