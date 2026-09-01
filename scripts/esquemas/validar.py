#!/usr/bin/env python3
"""Valida os esquemas de `conteudo/esquemas/` — `python scripts/esquemas/validar.py`.

    python scripts/esquemas/validar.py                       # todos
    python scripts/esquemas/validar.py civil-obrigacoes      # um so
    python scripts/esquemas/validar.py --sem-acervo          # so forma, sem cruzar acervo

Duas camadas, no mesmo espirito de `scripts/ingest/lib/validador.py`:

1. **JSON Schema** (`conteudo/esquemas/esquema.schema.json`) — forma: tipos,
   campos obrigatorios, uniao discriminada por `tipo`.
2. **Regras** — o que o schema nao alcanca: referencia cruzada com o acervo,
   incidencia conferida contra a contagem real, marcacao proibida no texto e a
   barreira anti-copia da regra 5 do CLAUDE.md.

Todo problema aqui e um "nao publica". Sai com codigo 1 e lista tudo — nunca so
o primeiro erro, porque quem escreve esquema quer a lista inteira de uma vez.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

from jsonschema import Draft202012Validator

RAIZ = Path(__file__).resolve().parents[2]
DIR_ESQUEMAS = RAIZ / "conteudo" / "esquemas"
DIR_ACERVO = RAIZ / "acervo" / "provas"
ARQ_SCHEMA = DIR_ESQUEMAS / "esquema.schema.json"

# Tamanho da janela da barreira anti-copia (regra 5). Doze palavras seguidas
# iguais as do comentario de terceiro nao e coincidencia, e copia.
JANELA_COPIA = 12

# Campos cujo conteudo e NOSSO e por isso passam pela barreira anti-copia.
CAMPOS_AUTORAIS = {
    "resumo", "texto", "comentario", "isca", "correcao", "explicacao", "nota",
}

MARCACAO = [
    (re.compile(r"\*\*|__"), "negrito de markdown (** ou __)"),
    (re.compile(r"^\s{0,3}#{1,6}\s"), "titulo de markdown (#)"),
    (re.compile(r"^\s{0,3}[-*+]\s"), "bullet de markdown — use um bloco lista"),
    (re.compile(r"<[a-zA-Z/][^>]{0,40}>"), "tag HTML"),
    (re.compile(r"\|.*\|"), "tabela de markdown — use um bloco tabela"),
]


class Invalido(Exception):
    """Levantada com a lista completa de problemas — nunca so o primeiro."""

    def __init__(self, problemas: list[str]) -> None:
        self.problemas = problemas
        super().__init__(f"{len(problemas)} problema(s): " + "; ".join(problemas[:5]))


# ── camada 1: schema ─────────────────────────────────────────────────────────
_validador_cache: Draft202012Validator | None = None


def _validador() -> Draft202012Validator:
    global _validador_cache
    if _validador_cache is None:
        schema = json.loads(ARQ_SCHEMA.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        _validador_cache = Draft202012Validator(schema)
    return _validador_cache


def problemas_de_schema(dados: dict) -> list[str]:
    saida = []
    for erro in sorted(_validador().iter_errors(dados), key=lambda e: list(e.path)):
        onde = "/".join(str(p) for p in erro.path) or "(raiz)"
        # A uniao discriminada faz o jsonschema reclamar dos oito ramos de uma
        # vez; o ramo cujo `tipo` bate e o unico que interessa.
        if erro.validator == "oneOf" and isinstance(erro.instance, dict):
            tipo = erro.instance.get("tipo")
            melhores = [e for e in erro.context or [] if _ramo_do_tipo(e) == tipo]
            if melhores:
                for e in melhores:
                    sub = "/".join(str(p) for p in e.path)
                    saida.append(f"schema[{onde}/{sub}]: {e.message}" if sub else f"schema[{onde}]: {e.message}")
                continue
        saida.append(f"schema[{onde}]: {erro.message}")
    return saida


def _ramo_do_tipo(erro) -> str | None:
    """Descobre a qual `tipo` pertence o sub-erro de um `oneOf`."""
    const = erro.schema.get("properties", {}).get("tipo", {}).get("const") if isinstance(erro.schema, dict) else None
    if const:
        return const
    pai = getattr(erro, "parent", None)
    while pai is not None:
        props = pai.schema.get("properties", {}) if isinstance(pai.schema, dict) else {}
        const = props.get("tipo", {}).get("const")
        if const:
            return const
        pai = getattr(pai, "parent", None)
    return None


# ── acervo ───────────────────────────────────────────────────────────────────
def carregar_acervo() -> tuple[dict[tuple[str, int], dict], dict[str, int], list[str]]:
    """Le `acervo/provas/*.json` (somente leitura).

    Devolve o indice (prova_slug, numero) -> questao, a contagem de questoes
    por assunto e o corpus de comentarios de terceiro que alimenta a barreira
    anti-copia.
    """
    indice: dict[tuple[str, int], dict] = {}
    por_assunto: dict[str, int] = {}
    comentarios: list[str] = []
    for arquivo in sorted(DIR_ACERVO.glob("*.json")):
        dados = json.loads(arquivo.read_text(encoding="utf-8"))
        slug = dados["prova"]["slug"]
        for q in dados.get("questoes", []):
            indice[(slug, q["numero"])] = q
            assunto = q.get("assunto")
            if assunto and not q.get("anulada"):
                por_assunto[assunto] = por_assunto.get(assunto, 0) + 1
            if q.get("comentario"):
                comentarios.append(q["comentario"])
    return indice, por_assunto, comentarios


def _palavras(texto: str) -> list[str]:
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn"
    )
    return re.findall(r"[a-z0-9]+", sem_acento)


def _janelas(texto: str, n: int = JANELA_COPIA) -> set[str]:
    p = _palavras(texto)
    return {" ".join(p[i : i + n]) for i in range(len(p) - n + 1)}


# ── camada 2: regras ─────────────────────────────────────────────────────────
def _campos_de_texto(no, caminho: str = ""):
    """Percorre o esquema devolvendo (caminho, chave, texto) de todo string."""
    if isinstance(no, dict):
        for chave, valor in no.items():
            onde = f"{caminho}/{chave}" if caminho else chave
            if isinstance(valor, str):
                yield onde, chave, valor
            else:
                yield from _campos_de_texto(valor, onde)
    elif isinstance(no, list):
        for i, item in enumerate(no):
            onde = f"{caminho}[{i}]"
            if isinstance(item, str):
                yield onde, caminho.rsplit("/", 1)[-1], item
            else:
                yield from _campos_de_texto(item, onde)


def _caminhos_literais(dados: dict) -> list[str]:
    """Prefixos de caminho onde a citacao literal e o ponto do bloco.

    Norma nao e obra protegida (Lei 9.610/1998, art. 8, IV), entao `lei_seca`,
    `sumula` e `definicao` com `literal: true` reproduzem o texto legal de
    proposito. Como o comentario de terceiro no acervo tambem cita a norma, sem
    esta lista a barreira anti-copia acusaria a propria lei de plagio.
    """
    prefixos: list[str] = ["fontes"]
    for i, bloco in enumerate(dados.get("blocos", [])):
        tipo = bloco.get("tipo")
        if tipo == "lei_seca":
            prefixos.append(f"blocos[{i}]/dispositivos")
        elif tipo == "sumula":
            prefixos.append(f"blocos[{i}]/texto")
        elif tipo == "definicao" and bloco.get("literal"):
            prefixos.append(f"blocos[{i}]/texto")
            prefixos.append(f"blocos[{i}]/nao_confundir_com")
    return prefixos


def problemas_de_regra(
    dados: dict,
    *,
    indice_acervo: dict[tuple[str, int], dict] | None,
    por_assunto: dict[str, int] | None,
    corpus_terceiro: list[str] | None,
) -> list[str]:
    problemas: list[str] = []
    assunto = dados.get("assunto_slug")
    blocos = dados.get("blocos", [])

    # ids unicos: o id e ancora de link e de "voce errou isto aqui".
    ids: list[str] = [b.get("id") for b in blocos]
    repetidos = sorted({i for i in ids if ids.count(i) > 1})
    if repetidos:
        problemas.append(f"blocos: id repetido {repetidos} — id e ancora estavel, tem de ser unico")

    for i, bloco in enumerate(blocos):
        rot = f"bloco[{i}] {bloco.get('id')}"
        if bloco.get("tipo") == "tabela":
            largura = len(bloco.get("colunas", []))
            for j, linha in enumerate(bloco.get("linhas", [])):
                if len(linha) != largura:
                    problemas.append(
                        f"{rot}: linha {j} tem {len(linha)} celulas e a tabela tem {largura} colunas"
                    )
        if bloco.get("tipo") == "lei_seca":
            for d in bloco.get("dispositivos", []):
                for trecho in d.get("grifo", []):
                    if trecho not in d.get("texto", ""):
                        problemas.append(
                            f"{rot}/{d.get('rotulo')}: grifo '{trecho[:40]}' nao ocorre no texto do dispositivo"
                        )

    # marcacao: a tela renderiza texto puro, entao markdown vaza como lixo.
    for onde, _chave, texto in _campos_de_texto(dados):
        if onde.startswith("fontes"):
            continue
        for padrao, nome in MARCACAO:
            if padrao.search(texto):
                problemas.append(f"marcacao[{onde}]: {nome} — o formato nao aceita marcacao em string")
                break

    # ── referencia cruzada com o acervo ──────────────────────────────────────
    if indice_acervo is not None:
        vistas: set[tuple[str, int]] = set()
        for i, bloco in enumerate(blocos):
            rot = f"bloco[{i}] {bloco.get('id')}"
            refs = bloco.get("questoes", [])
            if not refs and bloco.get("tipo") != "alerta":
                problemas.append(f"{rot}: sem questao de origem — esquema se escreve por incidencia")
            for ref in refs:
                chave = (ref["prova_slug"], ref["numero"])
                vistas.add(chave)
                q = indice_acervo.get(chave)
                if q is None:
                    problemas.append(f"{rot}: questao {chave[0]} n. {chave[1]} nao existe no acervo")
                    continue
                if q.get("anulada"):
                    problemas.append(
                        f"{rot}: questao {chave[0]} n. {chave[1]} esta anulada — "
                        "nao sustenta esquema (CLAUDE.md, regra 3)"
                    )
                if assunto and q.get("assunto") != assunto:
                    problemas.append(
                        f"{rot}: questao {chave[0]} n. {chave[1]} e do assunto "
                        f"'{q.get('assunto')}', nao de '{assunto}'"
                    )
        provas_citadas = {p for p, _ in vistas}
        declaradas = set(dados.get("incidencia", {}).get("provas", []))
        if provas_citadas - declaradas:
            problemas.append(
                f"incidencia.provas nao lista {sorted(provas_citadas - declaradas)}, "
                "citadas nos blocos"
            )

    if por_assunto is not None and assunto:
        real = por_assunto.get(assunto, 0)
        declarada = dados.get("incidencia", {}).get("questoes")
        if real == 0:
            problemas.append(
                f"incidencia: nenhuma questao do assunto '{assunto}' no acervo — "
                "assunto que nunca caiu nao ganha esquema"
            )
        elif declarada != real:
            problemas.append(
                f"incidencia.questoes diz {declarada} e o acervo tem {real} "
                f"questoes de '{assunto}' — reconte antes de publicar"
            )

    # ── barreira anti-copia (CLAUDE.md, regra 5) ─────────────────────────────
    if corpus_terceiro:
        alheias: set[str] = set()
        for c in corpus_terceiro:
            alheias |= _janelas(c)
        literais = _caminhos_literais(dados)
        for onde, chave, texto in _campos_de_texto(dados):
            if chave not in CAMPOS_AUTORAIS:
                continue
            if any(onde.startswith(pref) for pref in literais):
                continue
            batidas = _janelas(texto) & alheias
            if batidas:
                amostra = sorted(batidas)[0]
                problemas.append(
                    f"copia[{onde}]: {JANELA_COPIA} palavras seguidas iguais as do comentario "
                    f"de terceiro no acervo ('{amostra}') — o esquema e texto nosso (regra 5)"
                )

    if dados.get("estado") == "publicado" and dados.get("motivo_revisar"):
        problemas.append("estado 'publicado' com motivo_revisar preenchido — decida um dos dois")
    return problemas


def validar(dados: dict, **kwargs) -> list[str]:
    """Devolve TODOS os problemas. Lista vazia = esquema integro."""
    problemas = problemas_de_schema(dados)
    if problemas:
        # Sem a forma certa, regra de dominio so produz ruido.
        return problemas
    return problemas_de_regra(dados, **kwargs)


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("slug", nargs="*", help="assunto_slug a validar (vazio = todos)")
    ap.add_argument(
        "--sem-acervo", action="store_true",
        help="pular as regras que dependem de acervo/provas/",
    )
    args = ap.parse_args()

    if not ARQ_SCHEMA.exists():
        print(f"✕ schema nao encontrado: {ARQ_SCHEMA}")
        return 1

    arquivos = sorted(p for p in DIR_ESQUEMAS.glob("*.json") if p.name != ARQ_SCHEMA.name)
    if args.slug:
        arquivos = [p for p in arquivos if p.stem in args.slug]
        faltando = set(args.slug) - {p.stem for p in arquivos}
        if faltando:
            print(f"✕ sem arquivo para {sorted(faltando)} em {DIR_ESQUEMAS}")
            return 1
    if not arquivos:
        print(f"nenhum esquema em {DIR_ESQUEMAS} — nada a validar")
        return 0

    if args.sem_acervo:
        indice, por_assunto, comentarios = None, None, None
    else:
        indice, por_assunto, comentarios = carregar_acervo()

    total = 0
    for arquivo in arquivos:
        try:
            dados = json.loads(arquivo.read_text(encoding="utf-8"))
        except json.JSONDecodeError as erro:
            print(f"✕ {arquivo.name}: JSON invalido — {erro}")
            total += 1
            continue

        if dados.get("assunto_slug") != arquivo.stem:
            print(f"✕ {arquivo.name}: assunto_slug '{dados.get('assunto_slug')}' != nome do arquivo")
            total += 1
            continue

        problemas = validar(
            dados,
            indice_acervo=indice,
            por_assunto=por_assunto,
            corpus_terceiro=comentarios,
        )
        if problemas:
            total += len(problemas)
            print(f"✕ {arquivo.name}: {len(problemas)} problema(s)")
            for p in problemas[:25]:
                print(f"   {p}")
            if len(problemas) > 25:
                print(f"   ... e mais {len(problemas) - 25}")
        else:
            inc = dados.get("incidencia", {}).get("questoes")
            print(
                f"  {arquivo.name}: ok — {len(dados['blocos'])} blocos, "
                f"{inc} questoes de incidencia, estado {dados.get('estado')}"
            )

    if total:
        print(f"\n✕ {total} problema(s) no total — nada publica assim")
        return 1
    print(f"\n{len(arquivos)} esquema(s) validos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
