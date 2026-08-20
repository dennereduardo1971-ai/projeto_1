"""Tabela, fórmula e imagem — o que não sobrevive à extração de texto puro.

A estratégia é a definida em docs/04: capturar a REGIÃO da página como imagem e
vincular à questão. Os PNGs são versionados em `acervo/assets/{slug}/`.

Limite conhecido: fórmula matemática não tem marcador estrutural em PDF. O que
capturamos é o que o pdfplumber enxerga como tabela (grade de linhas) ou imagem
embutida. Fórmula composta só de texto passa batido — ver `# CALIBRAR` abaixo.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .cache import sha256_arquivo

BBox = tuple[float, float, float, float]  # (x0, topo, x1, base) — topo cresce p/ baixo


@dataclass
class Regiao:
    tipo: str  # tabela | imagem | formula
    bbox: BBox
    pagina: int

    @property
    def area(self) -> float:
        x0, topo, x1, base = self.bbox
        return max(0.0, x1 - x0) * max(0.0, base - topo)

    def centro(self) -> tuple[float, float]:
        x0, topo, x1, base = self.bbox
        return ((x0 + x1) / 2.0, (topo + base) / 2.0)


def _sobrepoe(a: BBox, b: BBox) -> bool:
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def _unir(a: BBox, b: BBox) -> BBox:
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def _fundir(regioes: list[Regiao]) -> list[Regiao]:
    """Funde regiões sobrepostas do mesmo tipo — uma tabela costuma virar várias."""
    saida: list[Regiao] = []
    for r in sorted(regioes, key=lambda r: (r.bbox[1], r.bbox[0])):
        for existente in saida:
            if existente.tipo == r.tipo and _sobrepoe(existente.bbox, r.bbox):
                existente.bbox = _unir(existente.bbox, r.bbox)
                break
        else:
            saida.append(r)
    return saida


def detectar(pagina, numero_pagina: int, conf_assets: dict) -> list[Regiao]:
    """Acha tabelas e imagens numa página do pdfplumber."""
    area_min = float(conf_assets.get("area_minima", 4000))
    achadas: list[Regiao] = []

    if conf_assets.get("capturar_tabelas", True):
        try:
            for tabela in pagina.find_tables():
                achadas.append(Regiao("tabela", tuple(map(float, tabela.bbox)), numero_pagina))
        except Exception:  # pragma: no cover - pdfplumber é tolerante, mas não sempre
            pass

    if conf_assets.get("capturar_imagens", True):
        for img in getattr(pagina, "images", []) or []:
            bbox = (
                float(img["x0"]),
                float(img["top"]),
                float(img["x1"]),
                float(img["bottom"]),
            )
            achadas.append(Regiao("imagem", bbox, numero_pagina))

    # CALIBRAR: fórmula. Hoje `capturar_formulas` fica desligado no perfil.
    # A heurística plausível (densidade de glifos matemáticos + fonte itálica em
    # linha isolada) só dá para calibrar vendo um caderno real de Contabilidade;
    # antes disso ela geraria mais falso positivo que captura útil.

    achadas = [r for r in achadas if r.area >= area_min]
    return _fundir(achadas)


def recortar(pagina, regiao: Regiao, destino: Path, dpi: int = 200) -> dict:
    """Renderiza a região como PNG e devolve o dicionário do asset."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    x0, topo, x1, base = regiao.bbox
    # folga de 2 pt para não decepar a borda da grade
    caixa = (
        max(0.0, x0 - 2),
        max(0.0, topo - 2),
        min(float(pagina.width), x1 + 2),
        min(float(pagina.height), base + 2),
    )
    imagem = pagina.crop(caixa).to_image(resolution=dpi)
    imagem.save(str(destino))
    return {
        "tipo": regiao.tipo,
        "arquivo": destino,
        "sha256": sha256_arquivo(destino),
        "pagina": regiao.pagina,
        "bbox": [round(v, 2) for v in caixa],
    }


def dentro_do_trecho(
    regiao: Regiao,
    pagina: int,
    topo: float,
    base: float,
    coluna: tuple[float, float] | None = None,
) -> bool:
    """A região pertence ao trecho vertical (de uma questão) nesta página/coluna?"""
    if regiao.pagina != pagina:
        return False
    cx, cy = regiao.centro()
    if not (topo - 1 <= cy <= base + 1):
        return False
    if coluna is not None:
        cx0, cx1 = coluna
        if not (cx0 - 6 <= cx <= cx1 + 6):
            return False
    return True
