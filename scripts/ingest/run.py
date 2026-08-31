#!/usr/bin/env python3
"""Orquestrador do pipeline: `python scripts/ingest/run.py <slug>`.

Roda as sete etapas em ordem, respeitando o cache — reprocessar uma prova não
refaz o que não mudou. Cada etapa que falha para o pipeline com uma mensagem
que diz o que fazer, em vez de seguir com dado pela metade.

    python scripts/ingest/run.py tcu_25_aufc
    python scripts/ingest/run.py tcu_25_aufc --ate 5     # para antes da IA
    python scripts/ingest/run.py --check                 # confere o ambiente

Apostila comentada de terceiro (pivô 2026-08-31, `perfis/apostila_*.yaml`
com `origem_fonte: apostila_comentada`): fluxo DIFERENTE, detectado automa-
ticamente pelo perfil da prova. Etapas 1-3 rodam normais (descobrir, baixar,
extrair palavras); não há gabarito de banca para casar nem prova/gabarito em
arquivos separados, então as etapas 4 (segmentar) e 5 (casar gabarito) são
substituídas por `lib/apostila.py`, que já devolve o equivalente aos dois de
uma vez, classificado (a apostila é monotemática, confiança 1.0 direto — sem
custo de LLM). O resultado vira DUAS provas (`{slug}_ce`/`{slug}_multipla`,
uma para cada tipo de item que o PDF misturar) e a etapa 7 roda em cada uma.
**`--ate`/`--de` não têm efeito nesse fluxo** — ele sempre vai do começo ao
fim. Publicar de verdade ainda exige o gate humano: rode
`python scripts/ingest/8_revisar.py <slug>_ce --aprovar` (e o mesmo para
`_multipla`) e rode `run.py`/`7_publicar.py` de novo.
"""
from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent))

from ingest.lib import cache, caminhos, modelos, perfil as perfil_lib  # noqa: E402
from ingest.lib.apostila import processar as processar_apostila  # noqa: E402

VERSAO_APOSTILA = "1.0"

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


def _publicar(sub_slug: str) -> dict:
    modulo = carregar("7_publicar")
    print(f"\n── etapa 7: validar e publicar ({sub_slug})")
    resultado = modulo.executar(sub_slug)
    if resultado["problemas"]:
        print(f"  ✕ {len(resultado['problemas'])} problema(s):")
        for p in resultado["problemas"][:15]:
            print(f"     {p}")
    else:
        estado = "publicado" if resultado["publicado"] else f"status {resultado['status']}"
        print(f"  {resultado['questoes']} questões — {estado}")
    return resultado


def executar_apostila(slug_base: str, *, args: argparse.Namespace) -> int:
    """Etapas 1-3 normais; `lib.apostila.processar` substitui 4/5/6; 7 roda
    em cada sub-slug (`{slug_base}_ce` / `{slug_base}_multipla`)."""
    for numero, nome, descricao in ETAPAS[:3]:
        print(f"\n── etapa {numero}: {descricao}")
        modulo = carregar(nome)
        kwargs: dict = {"forcar": args.force}
        if nome == "1_descobrir":
            kwargs["usar_rede"] = args.online
        if nome == "3_extrair" and args.perfil:
            kwargs["nome_perfil"] = args.perfil
        try:
            resultado = modulo.executar(slug_base, **kwargs)
        except SystemExit as erro:
            print(f"  ✕ {erro}")
            return 1
        if isinstance(resultado, dict) and "paginas" in resultado:
            print(f"  {len(resultado['paginas'])} páginas, perfil {resultado.get('perfil')}")
        else:
            print("  ok")

    c = caminhos.Caminhos(slug_base)
    p = perfil_lib.resolver(slug_base, args.perfil)
    texto_doc = modelos.ler_json(c.texto)

    print("\n── apostila: extrair itens, grade e comentários (substitui etapas 4/5/6)")
    partes = processar_apostila(slug_base, p, {}, texto_doc)
    if not partes:
        print("  ✕ nenhuma questão reconhecida — confira o perfil e o layout do PDF")
        return 1

    # Idempotência (mesma regra das outras etapas, CLAUDE.md/docs/04): se o
    # texto extraído e o perfil não mudaram desde a última vez, NÃO regrava
    # `classificado` — isso destruiria o `revisado_humano=true` que
    # `8_revisar.py --aprovar` já gravou lá. `--force` ignora o cache de
    # propósito (reprocessa e, sim, derruba aprovações antigas).
    man = cache.Manifesto.abrir(c.cache, slug_base)
    saidas: list = []
    for sub_slug, _ in partes:
        c_sub = caminhos.Caminhos(sub_slug)
        saidas += [c_sub.com_gabarito, c_sub.classificado]
    ja_processado = not args.force and man.em_dia("8_apostila", [c.texto], saidas, VERSAO_APOSTILA, extra=p.nome)

    algum_problema = False
    for sub_slug, artefato in partes:
        c_sub = caminhos.Caminhos(sub_slug)
        c_sub.preparar()
        if ja_processado:
            dados = modelos.ler_json(c_sub.classificado)
            print(f"  {sub_slug}: {len(dados['questoes'])} questões — já processado (cache)")
        else:
            # Sem prova/gabarito em arquivos separados, o próprio `processar()`
            # já entrega o equivalente ao que as etapas 5 (gabarito) e 6
            # (classificar) produziriam — grava nos dois lugares para o
            # cache/pipeline continuar legível por quem for auditar `data/`.
            dados = modelos.para_dict(artefato)
            modelos.escrever_json(c_sub.com_gabarito, dados)
            modelos.escrever_json(c_sub.classificado, dados)
            print(f"  {sub_slug}: {len(dados['questoes'])} questões — status {dados['status']}")
            for aviso in dados.get("avisos", [])[:10]:
                print(f"    ! {aviso}")

        resultado = _publicar(sub_slug)
        if resultado["problemas"]:
            algum_problema = True

    if not ja_processado:
        man.registrar("8_apostila", [c.texto], saidas, VERSAO_APOSTILA, extra=p.nome)

    if algum_problema:
        print(
            "\n  lembrete: nada disso publica de verdade sem revisão humana — "
            "rode `python scripts/ingest/8_revisar.py <sub_slug> --aprovar` "
            "para cada sub-slug acima e rode `run.py`/`7_publicar.py` de novo."
        )
    return 1 if algum_problema else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slug", nargs="?")
    ap.add_argument(
        "--ate", type=int, default=7,
        help="parar depois desta etapa (1 a 7) — sem efeito no fluxo apostila_comentada",
    )
    ap.add_argument(
        "--de", type=int, default=1,
        help="começar nesta etapa — sem efeito no fluxo apostila_comentada",
    )
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

    # Resolve o perfil cedo só para decidir o fluxo. Se a resolução falhar
    # aqui (perfil inexistente, herança quebrada etc.), não é este o lugar
    # de reportar o erro — deixa a etapa 3 (que faz a mesma resolução)
    # explicar o problema com o contexto certo.
    try:
        perfil_da_prova = perfil_lib.resolver(slug, args.perfil)
    except perfil_lib.PerfilInvalido:
        perfil_da_prova = None

    if perfil_da_prova is not None and perfil_da_prova.origem_fonte == "apostila_comentada":
        if args.ate != 7 or args.de != 1:
            print("! --ate/--de não se aplicam ao fluxo apostila_comentada — ignorados")
        return executar_apostila(slug, args=args)

    for numero, nome, descricao in ETAPAS:
        if numero < args.de or numero > args.ate:
            continue
        print(f"\n── etapa {numero}: {descricao}")
        modulo = carregar(nome)
        kwargs: dict = {"forcar": args.force}
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
