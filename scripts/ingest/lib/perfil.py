"""Perfis de parser.

O layout do Cebraspe muda entre anos e entre cargos. Um regex único quebra.
Cada prova aponta para um perfil YAML; perfis herdam de `_base.yaml` via `extends`.

Resolução do perfil, nesta ordem:
  1. `--perfil NOME` na linha de comando;
  2. `perfis/{slug}.yaml`, se existir (é o caso da prova piloto `tcu_25_aufc`);
  3. o perfil genérico do formato (`ce_bloco` ou `multipla_5`).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

DIR_PERFIS = Path(__file__).resolve().parents[1] / "perfis"

_CHAVES_OBRIGATORIAS = ("formato", "layout", "descartar", "marcadores", "numeracao")


class PerfilInvalido(Exception):
    pass


def _mesclar(base: dict, filho: dict) -> dict:
    """Merge profundo: dict funde, o resto do filho substitui o do pai."""
    saida = dict(base)
    for chave, valor in filho.items():
        if chave == "extends":
            continue
        if isinstance(valor, dict) and isinstance(saida.get(chave), dict):
            saida[chave] = _mesclar(saida[chave], valor)
        else:
            saida[chave] = valor
    return saida


def _carregar_bruto(nome: str, vistos: set[str] | None = None) -> dict:
    vistos = vistos or set()
    if nome in vistos:
        raise PerfilInvalido(f"herança circular de perfil em '{nome}'")
    vistos.add(nome)

    caminho = DIR_PERFIS / f"{nome}.yaml"
    if not caminho.exists():
        disponiveis = ", ".join(sorted(p.stem for p in DIR_PERFIS.glob("*.yaml")))
        raise PerfilInvalido(f"perfil '{nome}' não existe. Disponíveis: {disponiveis}")

    dados = yaml.safe_load(caminho.read_text(encoding="utf-8")) or {}
    pai = dados.get("extends")
    if pai:
        dados = _mesclar(_carregar_bruto(pai, vistos), dados)
    dados.setdefault("nome", nome)
    return dados


@dataclass
class Perfil:
    nome: str
    dados: dict

    # ── acesso conveniente ───────────────────────────────────────────────────
    @property
    def formato(self) -> str:
        return self.dados["formato"]

    @property
    def penalidade_por_erro(self) -> bool:
        return bool(self.dados.get("penalidade_por_erro", self.formato == "ce"))

    @property
    def alternativas_esperadas(self) -> int:
        return int(self.dados.get("alternativas_esperadas", 0))

    @property
    def layout(self) -> dict:
        return self.dados["layout"]

    @property
    def numeracao(self) -> dict:
        return self.dados["numeracao"]

    @property
    def assets(self) -> dict:
        return self.dados.get("assets", {})

    @property
    def ocr(self) -> dict:
        return self.dados.get("ocr", {})

    @property
    def prova(self) -> dict:
        """Metadados fixos da prova, quando o perfil é específico de uma."""
        return self.dados.get("prova", {})

    # ── regexes ──────────────────────────────────────────────────────────────
    def marcador(self, chave: str) -> re.Pattern | None:
        bruto = self.dados["marcadores"].get(chave)
        if not bruto:
            return None
        return _compilar(bruto, f"marcadores.{chave}")

    def descartaveis(self) -> list[re.Pattern]:
        return [
            _compilar(p, f"descartar[{i}]")
            for i, p in enumerate(self.dados.get("descartar", []))
        ]


_cache_regex: dict[str, re.Pattern] = {}


def _compilar(padrao: str, onde: str) -> re.Pattern:
    if padrao in _cache_regex:
        return _cache_regex[padrao]
    try:
        compilado = re.compile(padrao)
    except re.error as erro:  # pragma: no cover - erro de configuração
        raise PerfilInvalido(f"regex inválido em {onde}: {padrao} ({erro})") from erro
    _cache_regex[padrao] = compilado
    return compilado


def carregar(nome: str) -> Perfil:
    dados = _carregar_bruto(nome)
    faltando = [c for c in _CHAVES_OBRIGATORIAS if c not in dados]
    if faltando:
        raise PerfilInvalido(f"perfil '{nome}' sem as chaves {faltando}")
    if dados["formato"] not in {"ce", "multipla"}:
        raise PerfilInvalido(f"formato inválido em '{nome}': {dados['formato']}")
    # compila tudo agora para o erro aparecer no carregamento, não no meio da prova
    perfil = Perfil(nome=dados["nome"], dados=dados)
    perfil.descartaveis()
    for chave in dados["marcadores"]:
        perfil.marcador(chave)
    return perfil


def resolver(slug: str, explicito: str | None = None, formato: str | None = None) -> Perfil:
    if explicito:
        return carregar(explicito)
    if (DIR_PERFIS / f"{slug}.yaml").exists():
        return carregar(slug)
    if formato == "multipla":
        return carregar("multipla_5")
    return carregar("ce_bloco")


def listar() -> list[str]:
    return sorted(p.stem for p in DIR_PERFIS.glob("*.yaml"))


def como_dict(perfil: Perfil) -> dict[str, Any]:
    return dict(perfil.dados)
