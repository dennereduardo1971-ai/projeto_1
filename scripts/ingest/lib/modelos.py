"""Modelo de dados do pipeline + serialização determinística.

Regras do projeto que este módulo faz valer (CLAUDE.md):
- `formato` e `penalidade_por_erro` são atributos da PROVA, nunca do app.
- questão sem gabarito definitivo casado não é publicada;
- atribuição (banca, ano, órgão, cargo, número original) é obrigatória;
- **nenhum texto de justificativa da banca entra no artefato** — só o ponteiro
  `justificativa_ref` = {sha256 do arquivo local, pagina, url}.
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

VERSAO_ARTEFATO = 1

# ── Status possíveis de uma prova no pipeline ────────────────────────────────
STATUS_SEGMENTADO = "segmentado"
STATUS_PENDENTE_DEFINITIVO = "pendente_definitivo"
STATUS_PRECISA_OCR = "precisa_ocr"
STATUS_PENDENTE_CLASSIFICACAO = "pendente_classificacao"
STATUS_PUBLICAVEL = "publicavel"

STATUS_VALIDOS = {
    STATUS_SEGMENTADO,
    STATUS_PENDENTE_DEFINITIVO,
    STATUS_PRECISA_OCR,
    STATUS_PENDENTE_CLASSIFICACAO,
    STATUS_PUBLICAVEL,
}

FORMATOS = {"ce", "multipla"}
GABARITO_CE = {"C", "E"}
GABARITO_MULTIPLA = {"A", "B", "C", "D", "E"}

LIMIAR_CONFIANCA = 0.80

# ── Barreira anti-justificativa ──────────────────────────────────────────────
# Qualquer chave abaixo, em QUALQUER nível do artefato, reprova na validação.
# A justificativa da banca é texto autoral: fica em data/justificativas/{slug}.json
# (fora do git) e o artefato só guarda o ponteiro.
CAMPOS_PROIBIDOS = frozenset(
    {
        "justificativa",
        "justificativas",
        "justificativa_texto",
        "texto_justificativa",
        "justificativa_banca",
        "comentario",
        "comentarios",
        "comentario_banca",
        "explicacao",
        "explicacao_banca",
        "fundamentacao",
        "parecer",
        "parecer_banca",
        "gabarito_comentado",
        "resolucao_banca",
    }
)

# Chaves permitidas dentro de justificativa_ref. Nada além disso.
CAMPOS_JUSTIFICATIVA_REF = frozenset({"sha256", "pagina", "url"})


# ── Dataclasses ──────────────────────────────────────────────────────────────
@dataclass
class Atribuicao:
    """Obrigatória em toda questão (CLAUDE.md, regra 4)."""

    banca: str
    ano: int
    orgao: str
    cargo: str
    numero_original: int
    url_pdf: str


@dataclass
class JustificativaRef:
    """Ponteiro para a justificativa — NUNCA o texto dela.

    `sha256`  do arquivo data/justificativas/{slug}.json que contém o texto;
    `pagina`  a página do caderno COM_JUSTIFICATIVA onde ela está;
    `url`     a URL pública do caderno COM_JUSTIFICATIVA.
    """

    sha256: str
    pagina: int
    url: str


@dataclass
class Alternativa:
    letra: str
    texto: str


@dataclass
class Asset:
    """Tabela, fórmula ou imagem recortada da página e versionada em acervo/assets/."""

    id: str
    tipo: str  # tabela | formula | imagem
    arquivo: str  # caminho relativo à raiz do repo
    sha256: str
    pagina: int
    bbox: list[float]


@dataclass
class TextoApoio:
    """Bloco compartilhado por várias questões — amarrado por referência, nunca duplicado."""

    id: str
    texto: str
    paginas: list[int] = field(default_factory=list)
    assets: list[Asset] = field(default_factory=list)


@dataclass
class Questao:
    numero: int
    tipo: str  # ce | multipla
    enunciado: str
    pagina: int
    atribuicao: Atribuicao
    texto_apoio_id: str | None = None
    alternativas: list[Alternativa] = field(default_factory=list)
    gabarito: str | None = None
    anulada: bool = False
    desatualizada: bool = False
    assets: list[Asset] = field(default_factory=list)
    disciplina: str | None = None
    assunto: str | None = None
    classificacao_confianca: float | None = None
    classificacao_metodo: str | None = None
    justificativa_ref: JustificativaRef | None = None


@dataclass
class Prova:
    slug: str
    banca: str
    ano: int
    orgao: str
    cargo: str
    formato: str
    penalidade_por_erro: bool
    tipo_caderno: str | None = None
    fonte_pdf: str = ""
    fonte_gabarito: str = ""
    sha256_pdf: str | None = None
    sha256_gabarito: str | None = None
    perfil: str | None = None


@dataclass
class Artefato:
    prova: Prova
    status: str = STATUS_SEGMENTADO
    versao_artefato: int = VERSAO_ARTEFATO
    gerado_em: str = ""
    textos_apoio: list[TextoApoio] = field(default_factory=list)
    questoes: list[Questao] = field(default_factory=list)
    avisos: list[str] = field(default_factory=list)


# ── Serialização ─────────────────────────────────────────────────────────────
def _limpar(valor: Any) -> Any:
    """Remove chaves com valor None — mantém o JSON enxuto e o schema estrito."""
    if isinstance(valor, dict):
        return {k: _limpar(v) for k, v in valor.items() if v is not None}
    if isinstance(valor, list):
        return [_limpar(v) for v in valor]
    return valor


def para_dict(art: Artefato) -> dict:
    return _limpar(asdict(art))


def escrever_json(caminho: Path, dados: Any) -> Path:
    """Escrita determinística: mesmo dado ⇒ mesmos bytes (idempotência de verdade)."""
    caminho.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(dados, ensure_ascii=False, indent=2, sort_keys=True)
    caminho.write_text(texto + "\n", encoding="utf-8")
    return caminho


def ler_json(caminho: Path) -> Any:
    return json.loads(Path(caminho).read_text(encoding="utf-8"))


def de_dict(dados: dict) -> Artefato:
    """Reconstrói o Artefato a partir do dicionário lido do disco."""
    p = dados["prova"]
    prova = Prova(**{k: p.get(k) for k in Prova.__dataclass_fields__ if k in p})
    art = Artefato(
        prova=prova,
        status=dados.get("status", STATUS_SEGMENTADO),
        versao_artefato=dados.get("versao_artefato", VERSAO_ARTEFATO),
        gerado_em=dados.get("gerado_em", ""),
        avisos=list(dados.get("avisos", [])),
    )
    for ta in dados.get("textos_apoio", []):
        art.textos_apoio.append(
            TextoApoio(
                id=ta["id"],
                texto=ta["texto"],
                paginas=list(ta.get("paginas", [])),
                assets=[Asset(**a) for a in ta.get("assets", [])],
            )
        )
    for q in dados.get("questoes", []):
        art.questoes.append(
            Questao(
                numero=q["numero"],
                tipo=q["tipo"],
                enunciado=q["enunciado"],
                pagina=q["pagina"],
                atribuicao=Atribuicao(**q["atribuicao"]),
                texto_apoio_id=q.get("texto_apoio_id"),
                alternativas=[Alternativa(**a) for a in q.get("alternativas", [])],
                gabarito=q.get("gabarito"),
                anulada=q.get("anulada", False),
                desatualizada=q.get("desatualizada", False),
                assets=[Asset(**a) for a in q.get("assets", [])],
                disciplina=q.get("disciplina"),
                assunto=q.get("assunto"),
                classificacao_confianca=q.get("classificacao_confianca"),
                classificacao_metodo=q.get("classificacao_metodo"),
                justificativa_ref=(
                    JustificativaRef(**q["justificativa_ref"])
                    if q.get("justificativa_ref")
                    else None
                ),
            )
        )
    return art


# ── Normalização de texto (dedup por enunciado) ──────────────────────────────
_ESPACOS = re.compile(r"\s+")
_PONTUACAO = re.compile(r"[^\w\s]", re.UNICODE)


def normalizar(texto: str) -> str:
    """Forma canônica para comparar enunciados entre cadernos de cores diferentes."""
    t = texto.lower().replace("­", "")
    t = _PONTUACAO.sub(" ", t)
    return _ESPACOS.sub(" ", t).strip()
