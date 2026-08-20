"""Infra de teste do pipeline.

Nenhum teste toca a rede: os domínios das bancas são bloqueados em ambiente
remoto e um teste que depende de rede é um teste que mente quando falha.

Todo teste roda num `data/` temporário — o cache e os JSONs intermediários da
sua máquina nunca são tocados.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

import pytest

RAIZ_INGEST = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ_INGEST.parent))

from ingest.lib import caminhos  # noqa: E402
from ingest.tests.fixtures import gerar  # noqa: E402


@pytest.fixture(scope="session")
def fixtures(tmp_path_factory) -> dict[str, Path]:
    return gerar.gerar_todas(tmp_path_factory.mktemp("fixtures"))


@pytest.fixture
def area(tmp_path, monkeypatch) -> Path:
    """Redireciona data/ e acervo/ para um diretório temporário."""
    monkeypatch.setattr(caminhos, "DATA", tmp_path / "data")
    monkeypatch.setattr(caminhos, "ACERVO", tmp_path / "acervo")
    return tmp_path


@pytest.fixture
def prova_ce(area, fixtures) -> str:
    """Prova sintética Certo/Errado, com caderno e gabarito definitivo na pasta manual."""
    slug = "fixture_ce"
    c = caminhos.Caminhos(slug)
    c.preparar()
    shutil.copy(fixtures["ce"], c.manual / "MATRIZ_999_FIXTURE_001.PDF")
    shutil.copy(fixtures["gabarito_ce"], c.manual / "Gab_Definitivo_999_FIXTURE_001.pdf")
    return slug


@pytest.fixture
def prova_sem_gabarito(area, fixtures) -> str:
    slug = "fixture_sem_gab"
    c = caminhos.Caminhos(slug)
    c.preparar()
    shutil.copy(fixtures["ce"], c.manual / "MATRIZ_998_FIXTURE_001.PDF")
    return slug


@pytest.fixture
def prova_escaneada(area, fixtures) -> str:
    slug = "fixture_ocr"
    c = caminhos.Caminhos(slug)
    c.preparar()
    shutil.copy(fixtures["sem_texto"], c.manual / "MATRIZ_997_FIXTURE_001.PDF")
    shutil.copy(fixtures["gabarito_ce"], c.manual / "Gab_Definitivo_997_FIXTURE_001.pdf")
    return slug


def etapa(nome: str):
    """Carrega um script numerado do pipeline (import normal não aceita dígito)."""
    import importlib.util

    spec = importlib.util.spec_from_file_location(f"etapa_{nome}", RAIZ_INGEST / f"{nome}.py")
    modulo = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    # Registrar em sys.modules antes de executar: sem isso, dataclass com
    # `from __future__ import annotations` não acha o próprio módulo.
    sys.modules[spec.name] = modulo
    spec.loader.exec_module(modulo)
    return modulo
