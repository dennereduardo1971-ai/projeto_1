#!/usr/bin/env python3
"""Etapa 1 — descobrir os arquivos de uma prova.

Dois modos, e o modo offline é o principal hoje:

**offline** (padrão): lê `data/00_manual/{slug}/`, classifica cada PDF pelo nome
e reconstrói a URL canônica do CDN — a atribuição fica correta mesmo sem rede.

**online** (`--online`): abre a página do concurso e extrai os links do CDN por
regex. Os nomes de arquivo com hash não são adivinháveis; é por isso que não dá
para montar a URL sem abrir a página. Nesta sessão remota o egresso para os
domínios da banca é bloqueado — o modo online existe para a máquina do dono.

Saída: `data/01_fontes/{slug}/fontes.json`
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest.lib import cache, caminhos, modelos, rede  # noqa: E402

VERSAO = "1.0"

CDN = "https://cdn.cebraspe.org.br/concursos/{slug}/arquivos/{arquivo}"
PAGINA = "https://www.cebraspe.org.br/concursos/{slug}"

RE_LINK_CDN = re.compile(r"https?://cdn\.cebraspe\.org\.br/concursos/[^\"'\s<>]+", re.I)

# A ordem importa: `_COM_JUSTIFICATIVA` também casa com o padrão de caderno.
CLASSES = (
    ("caderno_com_justificativa", re.compile(r"com[_\-]?justificativa", re.I)),
    ("gabarito_definitivo", re.compile(r"gab.*definitiv", re.I)),
    ("gabarito_preliminar", re.compile(r"gab.*preliminar", re.I)),
    # Além de MATRIZ_/caderno_/prova_, o Cebraspe também nomeia cadernos como
    # `{cod}_{SIGLA}{CARGO}_{tipo}_{caderno}.pdf` (ex.: 060_SEFAZRJAUDITOR_001_01.pdf),
    # sem nenhuma palavra-chave — só reconhecível pelo sufixo numérico. Como esta
    # regra roda depois das de gabarito, os gabaritos (que têm o mesmo sufixo) já
    # foram capturados antes e não caem aqui.
    ("caderno", re.compile(r"(matriz|caderno|prova)|_\d{3}_\d{2}\.pdf$", re.I)),
    ("edital", re.compile(r"edital|retifica", re.I)),
)


def classificar(nome: str) -> str:
    for rotulo, padrao in CLASSES:
        if padrao.search(nome):
            return rotulo
    return "ignorado"


def _fonte(slug: str, nome: str, local: Path | None, url: str | None) -> dict:
    return {
        "arquivo": nome,
        "classe": classificar(nome),
        "url": url or CDN.format(slug=slug, arquivo=nome),
        "local": caminhos.relativo(local) if local else None,
        "sha256": cache.sha256_arquivo(local) if local and local.exists() else None,
    }


def offline(slug: str) -> list[dict]:
    c = caminhos.Caminhos(slug)
    if not c.manual.exists():
        raise SystemExit(
            f"pasta não encontrada: {caminhos.relativo(c.manual)}\n"
            f"Crie-a e largue os PDFs lá dentro, sem renomear."
        )
    pdfs = sorted(p for p in c.manual.iterdir() if p.suffix.lower() == ".pdf")
    if not pdfs:
        raise SystemExit(
            f"nenhum PDF em {caminhos.relativo(c.manual)}.\n"
            f"Precisa do caderno de provas e do gabarito definitivo."
        )
    return [_fonte(slug, p.name, p, None) for p in pdfs]


def online(slug: str) -> list[dict]:
    sessao = rede.Sessao()
    html = sessao.obter(PAGINA.format(slug=slug)).text
    urls = sorted(set(RE_LINK_CDN.findall(html)))
    if not urls:
        raise SystemExit(
            "a página não trouxe nenhum link do CDN. Provavelmente é renderizada por "
            "JavaScript — baixe os PDFs pelo navegador e use o modo offline."
        )
    return [_fonte(slug, rede.nome_do_arquivo(u), None, u) for u in urls]


def executar(slug: str, *, usar_rede: bool = False, forcar: bool = False) -> dict:
    c = caminhos.Caminhos(slug)
    c.preparar()
    man = cache.Manifesto.abrir(c.cache, slug)

    entradas = sorted(c.manual.glob("*")) if not usar_rede else []
    if not forcar and not usar_rede and man.em_dia("1_descobrir", entradas, [c.fontes], VERSAO):
        return modelos.ler_json(c.fontes)

    fontes = online(slug) if usar_rede else offline(slug)
    doc = {
        "slug": slug,
        "descoberto_em": date.today().isoformat(),
        "modo": "online" if usar_rede else "offline",
        "pagina_concurso": PAGINA.format(slug=slug),
        "fontes": fontes,
    }
    modelos.escrever_json(c.fontes, doc)
    man.registrar("1_descobrir", entradas, [c.fontes], VERSAO)
    return doc


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slug")
    ap.add_argument("--online", action="store_true", help="abrir a página do concurso (exige rede)")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    doc = executar(args.slug, usar_rede=args.online, forcar=args.force)
    print(f"{args.slug}: {len(doc['fontes'])} arquivo(s) — modo {doc['modo']}")
    for f in doc["fontes"]:
        print(f"  {f['classe']:28} {f['arquivo']}")
    faltando = {"caderno", "gabarito_definitivo"} - {f["classe"] for f in doc["fontes"]}
    if "caderno" in faltando and "caderno_com_justificativa" not in {f["classe"] for f in doc["fontes"]}:
        print("  ! falta o caderno de provas")
    if "gabarito_definitivo" in faltando:
        print("  ! falta o gabarito definitivo — a prova vai parar em pendente_definitivo")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
