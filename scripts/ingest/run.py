#!/usr/bin/env python3
"""Orquestrador do pipeline: `python scripts/ingest/run.py <slug>`.

Roda as sete etapas em ordem, respeitando o cache — reprocessar uma prova não
refaz o que não mudou. Cada etapa que falha para o pipeline com uma mensagem
que diz o que fazer, em vez de seguir com dado pela metade.

    python scripts/ingest/run.py tcu_25_aufc
    python scripts/ingest/run.py tcu_25_aufc --ate 5     # para antes da IA
    python scripts/ingest/run.py --check                 # confere o ambiente
"""
from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent))

from ingest.lib import caminhos  # noqa: E402

ETAPAS = [
    (1, "1_descobrir", "descobrir os arquivos"),
    (2, "2_baixar", "colocar os PDFs no cache"),
    (3, "3_extrair", "extrair palavras com coordenadas"),
    (4, "4_segmentar", "segmentar em itens e textos de apoio"),
    (5, "5_gabarito", "casar com o gabarito definitivo"),
    (6, "6_classificar", "classificar por assunto"),
    (7, "7_publicar", "validar e publicar"),
]


def carregar(nome: str):
    """Importa um script cujo nome começa com dígito (import normal não aceita)."""
    spec = importlib.util.spec_from_file_location(f"etapa_{nome}", AQUI / f"{nome}.py")
    modulo = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    # Registrar em sys.modules antes de executar: sem isso, dataclass com
    # `from __future__ import annotations` não acha o próprio módulo.
    sys.modules[spec.name] = modulo
    spec.loader.exec_module(modulo)
    return modulo


def checar_ambiente() -> int:
    faltando = []
    for pacote in ("pdfplumber", "yaml", "jsonschema", "requests"):
        try:
            __import__(pacote)
        except ImportError:
            faltando.append(pacote)
    if faltando:
        print("faltam dependências:", ", ".join(faltando))
        print("instale com: python3 -m pip install -r requirements.txt")
        return 1
    print("dependências: ok")
    print(f"pasta para largar os PDFs: {caminhos.relativo(caminhos.DATA / '00_manual')}/<slug>/")
    print(f"artefatos publicados vão para: {caminhos.relativo(caminhos.ACERVO / 'provas')}/")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--ate", type=int, default=7, help="parar depois desta etapa (1 a 7)")
    ap.add_argument("--de", type=int, default=1, help="começar nesta etapa")
    ap.add_argument("--perfil", help="forçar um perfil de parser")
    ap.add_argument("--online", action="store_true", help="etapa 1 abre a página do concurso")
    ap.add_argument("--stub", action="store_true", help="etapa 6 sem LLM")
    ap.add_argument("--force", action="store_true", help="ignorar o cache")
    ap.add_argument("--check", action="store_true", help="conferir o ambiente e sair")
    args = ap.parse_args()

    if args.check:
        return checar_ambiente()
    if not args.slug:
        ap.error("informe o slug da prova (ex.: tcu_25_aufc) ou use --check")

    slug = args.slug
    for numero, nome, descricao in ETAPAS:
        if numero < args.de or numero > args.ate:
            continue
        print(f"\n── etapa {numero}: {descricao}")
        modulo = carregar(nome)
        # 7_publicar não tem cache (não é reprocessamento caro) — não aceita `forcar`.
        kwargs: dict = {} if nome == "7_publicar" else {"forcar": args.force}
        if nome == "1_descobrir":
            kwargs["usar_rede"] = args.online
        if nome in {"3_extrair", "4_segmentar"} and args.perfil:
            kwargs["nome_perfil"] = args.perfil
        if nome == "6_classificar" and args.stub:
            kwargs["classificador"] = modulo.ClassificadorStub()

        try:
            resultado = modulo.executar(slug, **kwargs)
        except SystemExit as erro:
            print(f"  ✕ {erro}")
            return 1

        if nome == "7_publicar":
            if resultado["problemas"]:
                print(f"  ✕ {len(resultado['problemas'])} problema(s):")
                for p in resultado["problemas"][:15]:
                    print(f"     {p}")
                return 1
            estado = "publicado" if resultado["publicado"] else f"status {resultado['status']}"
            print(f"  {resultado['questoes']} questões — {estado}")
        elif isinstance(resultado, dict) and "questoes" in resultado:
            print(f"  {len(resultado['questoes'])} itens — status {resultado.get('status')}")
            for aviso in resultado.get("avisos", [])[:10]:
                print(f"  ! {aviso}")
        else:
            print("  ok")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
