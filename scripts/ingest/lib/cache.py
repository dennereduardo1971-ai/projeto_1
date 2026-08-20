"""Cache e idempotência entre etapas.

Regra do projeto: reprocessar uma prova não pode depender de baixar tudo de novo,
e rodar a mesma etapa duas vezes tem de produzir exatamente os mesmos bytes.

O mecanismo é simples e auditável: um manifesto JSON que guarda, para cada saída,
o sha256 de cada entrada mais a versão da etapa. Se nada mudou, a etapa é pulada.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

BLOCO = 1 << 20


def sha256_arquivo(caminho: Path) -> str:
    h = hashlib.sha256()
    with open(caminho, "rb") as fh:
        for pedaco in iter(lambda: fh.read(BLOCO), b""):
            h.update(pedaco)
    return h.hexdigest()


def sha256_bytes(dados: bytes) -> str:
    return hashlib.sha256(dados).hexdigest()


def sha256_texto(texto: str) -> str:
    return sha256_bytes(texto.encode("utf-8"))


@dataclass
class Manifesto:
    """Estado do cache de uma prova. Um arquivo por prova, em data/cache/."""

    caminho: Path
    dados: dict

    @classmethod
    def abrir(cls, dir_cache: Path, slug: str) -> "Manifesto":
        caminho = dir_cache / f"{slug}.manifesto.json"
        dados = {}
        if caminho.exists():
            try:
                dados = json.loads(caminho.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                dados = {}  # manifesto corrompido = cache frio, não erro fatal
        return cls(caminho=caminho, dados=dados)

    def gravar(self) -> None:
        self.caminho.parent.mkdir(parents=True, exist_ok=True)
        self.caminho.write_text(
            json.dumps(self.dados, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )

    # ── consulta / registro ──────────────────────────────────────────────────
    def _assinatura(self, entradas: Iterable[Path], versao: str, extra: str = "") -> dict:
        return {
            "versao_etapa": versao,
            "extra": extra,
            "entradas": {
                str(p): (sha256_arquivo(p) if Path(p).exists() else "AUSENTE")
                for p in sorted(map(Path, entradas), key=str)
            },
        }

    def em_dia(
        self,
        etapa: str,
        entradas: Iterable[Path],
        saidas: Iterable[Path],
        versao: str,
        extra: str = "",
    ) -> bool:
        """True se a etapa já rodou com exatamente estas entradas e as saídas existem."""
        saidas = list(map(Path, saidas))
        if not all(s.exists() for s in saidas):
            return False
        registro = self.dados.get(etapa)
        if not registro:
            return False
        return registro.get("assinatura") == self._assinatura(entradas, versao, extra)

    def registrar(
        self,
        etapa: str,
        entradas: Iterable[Path],
        saidas: Iterable[Path],
        versao: str,
        extra: str = "",
    ) -> None:
        self.dados[etapa] = {
            "assinatura": self._assinatura(entradas, versao, extra),
            "saidas": {
                str(s): (sha256_arquivo(Path(s)) if Path(s).exists() else "AUSENTE")
                for s in sorted(map(str, saidas))
            },
        }
        self.gravar()

    def invalidar(self, etapa: str | None = None) -> None:
        if etapa is None:
            self.dados = {}
        else:
            self.dados.pop(etapa, None)
        self.gravar()
