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

# ── Pivô 2026-08-31: segunda origem de questão (CLAUDE.md, regras 3-5) ──────
# `prova_oficial` é o Cebraspe: gabarito casado, sem comentário de terceiro.
# `apostila_comentada` é PDF de terceiro (tipo apostila de professor) — sem
# banca para casar gabarito, comentário do autor pode ser guardado com
# atribuição. Exceção TEMPORÁRIA, revisar antes de lançamento público ou
# monetização. Ver docs/04-fontes-de-questoes.md, seção 1.3.
ORIGENS_FONTE = frozenset({"prova_oficial", "apostila_comentada"})

# Campos que a barreira anti-justificativa deixa passar quando a prova é uma
# `apostila_comentada` com autoria clara (`prova.autor_fonte` preenchido).
# Fora desse caso — em particular para `prova_oficial` — continuam proibidos
# em QUALQUER nível, sem exceção.
CAMPOS_LIBERADOS_APOSTILA = frozenset({"comentario", "comentarios"})


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
    # Obrigatória para `prova_oficial`; ausente em `apostila_comentada`, cuja
    # atribuição (autor/título) vive na PROVA — ver `Prova.origem_fonte`.
    atribuicao: Atribuicao | None = None
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
    # Gate leve para `apostila_comentada`: substitui o gabarito casado com a
    # banca (que não existe nessa origem) na hora de publicar.
    revisado_humano: bool = False


@dataclass
class Prova:
    slug: str
    formato: str
    penalidade_por_erro: bool
    # `prova_oficial` (default): banca/ano/orgao/cargo obrigatórios (regra 4).
    # `apostila_comentada`: autor_fonte/titulo_fonte obrigatórios no lugar.
    origem_fonte: str = "prova_oficial"
    banca: str | None = None
    ano: int | None = None
    orgao: str | None = None
    cargo: str | None = None
    autor_fonte: str | None = None
    titulo_fonte: str | None = None
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
                # Ausente em questão de `apostila_comentada` — a atribuição
                # dela é `Prova.autor_fonte`/`titulo_fonte`, não por questão.
                atribuicao=Atribuicao(**q["atribuicao"]) if q.get("atribuicao") else None,
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
                revisado_humano=q.get("revisado_humano", False),
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
