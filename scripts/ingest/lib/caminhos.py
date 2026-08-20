"""Onde cada coisa mora no disco. Um lugar só para não espalhar `Path(...)`."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# raiz do repositório = três níveis acima deste arquivo
RAIZ = Path(__file__).resolve().parents[3]

DATA = RAIZ / "data"
ACERVO = RAIZ / "acervo"


@dataclass(frozen=True)
class Caminhos:
    """Caminhos derivados do slug da prova.

    `data/` inteiro está no .gitignore. `acervo/` é versionado — é o que o app lê.
    """

    slug: str

    # ── entrada ──────────────────────────────────────────────────────────────
    @property
    def manual(self) -> Path:
        """Onde o dono larga os PDFs à mão."""
        return DATA / "00_manual" / self.slug

    # ── etapas (tudo fora do git) ────────────────────────────────────────────
    @property
    def fontes(self) -> Path:
        return DATA / "01_fontes" / self.slug / "fontes.json"

    @property
    def pdfs(self) -> Path:
        return DATA / "02_pdfs" / self.slug

    @property
    def texto(self) -> Path:
        return DATA / "03_texto" / self.slug / "paginas.json"

    @property
    def segmentado(self) -> Path:
        return DATA / "04_segmentado" / f"{self.slug}.json"

    @property
    def com_gabarito(self) -> Path:
        return DATA / "05_gabarito" / f"{self.slug}.json"

    @property
    def classificado(self) -> Path:
        return DATA / "06_classificado" / f"{self.slug}.json"

    @property
    def justificativas(self) -> Path:
        """Texto autoral da banca. FORA do git, FORA do app, FORA do artefato.

        O artefato guarda só `justificativa_ref` = {sha256, pagina, url}.
        """
        return DATA / "justificativas" / f"{self.slug}.json"

    @property
    def cache(self) -> Path:
        return DATA / "cache"

    # ── saída versionada ─────────────────────────────────────────────────────
    @property
    def artefato(self) -> Path:
        return ACERVO / "provas" / f"{self.slug}.json"

    @property
    def assets(self) -> Path:
        return ACERVO / "assets" / self.slug

    @property
    def fila_revisao(self) -> Path:
        return ACERVO / "fila_revisao" / f"{self.slug}.json"

    def preparar(self) -> None:
        """Cria todas as pastas que as etapas vão escrever."""
        for p in (
            self.manual,
            self.fontes.parent,
            self.pdfs,
            self.texto.parent,
            self.segmentado.parent,
            self.com_gabarito.parent,
            self.classificado.parent,
            self.justificativas.parent,
            self.cache,
            self.artefato.parent,
            self.assets,
            self.fila_revisao.parent,
        ):
            p.mkdir(parents=True, exist_ok=True)


def relativo(p: Path) -> str:
    """Caminho relativo à raiz do repo, com barra normal — vai para dentro do JSON."""
    try:
        return p.resolve().relative_to(RAIZ).as_posix()
    except ValueError:
        return p.as_posix()
