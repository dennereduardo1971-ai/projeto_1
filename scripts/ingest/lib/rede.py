"""Acesso à rede — isolado aqui de propósito.

Educação com o servidor da banca (CLAUDE.md / docs/04):
  - User-Agent identificável;
  - 1 requisição a cada 2 segundos, no mínimo;
  - cache local por URL: baixou uma vez, não baixa de novo.

Ambiente remoto tem egresso bloqueado para cebraspe.org.br e cdn.cebraspe.org.br.
Quando a conexão falhar, o erro diz para rodar na máquina do dono — não inventa
que baixou.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import unquote, urlparse

INTERVALO_MIN_S = 2.0
USER_AGENT = (
    "Rito/0.1 (+app de estudos, ingestao de provas publicas; "
    "contato: dennereduardo1971@gmail.com)"
)

DOMINIOS_BANCA = ("cebraspe.org.br", "cdn.cebraspe.org.br")

MENSAGEM_EGRESSO = (
    "Sem acesso a {host}. Este ambiente bloqueia o egresso para os domínios da banca.\n"
    "Rode o pipeline na sua máquina:\n"
    "    python3 scripts/ingest/run.py {slug}\n"
    "ou baixe os PDFs à mão para data/00_manual/{slug}/ e rode com --local."
)


class EgressoBloqueado(RuntimeError):
    pass


class DownloadFalhou(RuntimeError):
    pass


def nome_do_arquivo(url: str) -> str:
    caminho = unquote(urlparse(url).path)
    nome = caminho.rsplit("/", 1)[-1] or "arquivo.bin"
    return re.sub(r"[^A-Za-z0-9._-]", "_", nome)


@dataclass
class Sessao:
    """Cliente HTTP com throttle. `requests` só é importado quando usado —
    assim as etapas offline (3 a 7) rodam sem a dependência instalada."""

    slug: str = ""
    intervalo_s: float = INTERVALO_MIN_S
    _ultima: float = field(default=0.0, repr=False)
    _sessao: object | None = field(default=None, repr=False)

    def _cliente(self):
        if self._sessao is None:
            import requests  # import tardio de propósito

            s = requests.Session()
            s.headers.update({"User-Agent": USER_AGENT})
            self._sessao = s
        return self._sessao

    def _esperar(self) -> None:
        agora = time.monotonic()
        espera = self.intervalo_s - (agora - self._ultima)
        if espera > 0:
            time.sleep(espera)
        self._ultima = time.monotonic()

    def obter(self, url: str, timeout: float = 60.0):
        import requests

        self._esperar()
        try:
            resposta = self._cliente().get(url, timeout=timeout)
        except requests.RequestException as erro:
            host = urlparse(url).netloc
            if any(d in host for d in DOMINIOS_BANCA):
                raise EgressoBloqueado(
                    MENSAGEM_EGRESSO.format(host=host, slug=self.slug or "SLUG")
                ) from erro
            raise DownloadFalhou(f"falha ao acessar {url}: {erro}") from erro
        if resposta.status_code >= 400:
            raise DownloadFalhou(f"HTTP {resposta.status_code} em {url}")
        return resposta

    def baixar(self, url: str, destino: Path) -> Path:
        """Baixa para `destino`. Se o arquivo já existe, não baixa de novo."""
        destino.parent.mkdir(parents=True, exist_ok=True)
        if destino.exists() and destino.stat().st_size > 0:
            return destino
        resposta = self.obter(url)
        destino.write_bytes(resposta.content)
        return destino
