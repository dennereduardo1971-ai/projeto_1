#!/usr/bin/env python3
"""Etapa 7 — validar e publicar o artefato.

"Publicar" hoje significa **gravar em `acervo/provas/{slug}.json`**, que é
versionado no git e auditável. O envio para o Supabase fica atrás de `--banco`
e falha com mensagem clara enquanto não houver banco — não há projeto Supabase
neste momento do projeto, por decisão do dono.

Nada é publicado sem passar por `lib/validador.py`, e a validação de publicação
é a estrita: gabarito definitivo casado, atribuição completa, classificação
acima do limiar e **nenhum texto de justificativa da banca dentro do artefato**.

Saída: `acervo/provas/{slug}.json`
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest.lib import caminhos, modelos, validador  # noqa: E402
from ingest.lib.modelos import STATUS_PUBLICAVEL  # noqa: E402

VERSAO = "1.0"


def executar(slug: str, *, so_validar: bool = False, para_banco: bool = False) -> dict:
    c = caminhos.Caminhos(slug)
    c.preparar()
    origem = c.classificado if c.classificado.exists() else c.com_gabarito
    if not origem.exists():
        raise SystemExit(f"{slug}: nada para publicar — rode as etapas anteriores primeiro")
    dados = modelos.ler_json(origem)

    # Telemetria das etapas não é parte do artefato: o acervo guarda a prova,
    # não o relatório de como ela foi processada.
    for chave in ("resumo_gabarito", "resumo_classificacao"):
        dados.pop(chave, None)

    publicavel = dados.get("status") == STATUS_PUBLICAVEL
    problemas = validador.validar(dados, para_publicar=publicavel)

    resultado = {
        "slug": slug,
        "status": dados.get("status"),
        "problemas": problemas,
        "publicado": False,
        "questoes": len(dados.get("questoes", [])),
    }

    if problemas:
        return resultado
    if so_validar:
        return resultado
    if not publicavel:
        # Íntegro, mas ainda não publicável (falta gabarito, ou está na fila de
        # revisão). Não é erro: é o pipeline fazendo o que foi mandado fazer.
        return resultado

    modelos.escrever_json(c.artefato, dados)
    resultado["publicado"] = True
    resultado["arquivo"] = caminhos.relativo(c.artefato)

    if para_banco:
        raise SystemExit(
            "--banco não está ligado: não há projeto Supabase neste momento do projeto.\n"
            "As migrations estão versionadas em supabase/migrations/. Quando houver banco, "
            "aplique-as, configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY e reative este caminho."
        )
    return resultado


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slug")
    ap.add_argument("--dry-run", action="store_true", help="só validar, não gravar")
    ap.add_argument("--banco", action="store_true", help="enviar ao Supabase (desligado)")
    args = ap.parse_args()

    r = executar(args.slug, so_validar=args.dry_run, para_banco=args.banco)
    if r["problemas"]:
        print(f"{args.slug}: {len(r['problemas'])} problema(s) — nada publicado")
        for p in r["problemas"][:30]:
            print(f"  ✕ {p}")
        if len(r["problemas"]) > 30:
            print(f"  … e mais {len(r['problemas']) - 30}")
        return 1
    if r["publicado"]:
        print(f"{args.slug}: {r['questoes']} questões publicadas em {r['arquivo']}")
    else:
        print(f"{args.slug}: artefato íntegro, status '{r['status']}' — ainda não publicável")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
