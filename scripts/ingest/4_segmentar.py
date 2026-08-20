#!/usr/bin/env python3
"""Etapa 4 — quebrar as linhas em itens e amarrar os textos de apoio.

É o ponto mais frágil do pipeline inteiro, e o motivo é o Cebraspe: um bloco de
texto serve várias questões seguidas. A segmentação ingênua ou duplica o texto
em cada questão ou perde o contexto da segunda em diante. Aqui o bloco vira um
registro próprio (`TA-n`) e cada questão guarda só a **referência**.

A defesa contra falso positivo de marcador (um "2025" no meio do enunciado
parecendo número de item) não é o regex: é a exigência de **sequência**. Um
marcador de item só vale se o número for o anterior + 1.

Saída: `data/04_segmentado/{slug}.json`
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest.lib import cache, caminhos, modelos, perfil as perfil_lib  # noqa: E402
from ingest.lib.modelos import (  # noqa: E402
    Artefato, Atribuicao, Alternativa, Prova, Questao, TextoApoio,
    STATUS_PRECISA_OCR, STATUS_SEGMENTADO,
)

VERSAO = "1.0"


def _descartar(texto: str, padroes) -> bool:
    return any(p.search(texto) for p in padroes)


def _fechar_texto(partes: list[str]) -> str:
    return "\n".join(x.strip() for x in partes if x.strip()).strip()


def executar(
    slug: str,
    *,
    nome_perfil: str | None = None,
    meta: dict | None = None,
    forcar: bool = False,
) -> dict:
    c = caminhos.Caminhos(slug)
    c.preparar()
    texto = modelos.ler_json(c.texto)
    p = perfil_lib.resolver(slug, nome_perfil or texto.get("perfil"))

    man = cache.Manifesto.abrir(c.cache, slug)
    if not forcar and man.em_dia("4_segmentar", [c.texto], [c.segmentado], VERSAO, extra=p.nome):
        return modelos.ler_json(c.segmentado)

    descartaveis = p.descartaveis()
    re_item = p.marcador("item")
    re_alt = p.marcador("alternativa")
    re_apoio = p.marcador("inicio_texto_apoio")
    re_instrucao = p.marcador("instrucao")
    re_ref = p.marcador("referencia_texto_apoio")
    re_precedente = p.marcador("referencia_precedente")
    re_fim = p.marcador("fim_prova")

    minimo = int(p.numeracao.get("minimo", 1))
    maximo = int(p.numeracao.get("maximo", 200))
    exige_sequencia = bool(p.numeracao.get("exige_sequencia", True))
    formato = p.formato

    meta = {**p.prova, **(meta or {})}
    atribuicao_base = dict(
        banca=meta.get("banca", "CEBRASPE"),
        ano=int(meta.get("ano", 0)) or datetime.now(timezone.utc).year,
        orgao=meta.get("orgao", ""),
        cargo=meta.get("cargo", ""),
        url_pdf=texto.get("url_pdf", ""),
    )

    textos_apoio: list[TextoApoio] = []
    questoes: list[Questao] = []
    avisos: list[str] = []

    apoio_atual: TextoApoio | None = None
    buffer_apoio: list[str] = []
    # Bloco de apoio em vigor para os próximos itens. No Cebraspe é uma frase de
    # comando que amarra o texto ao lote: "Considerando o texto precedente,
    # julgue os itens a seguir." Ela vale até o próximo bloco de apoio abrir.
    apoio_vigente: str | None = None
    questao_atual: Questao | None = None
    buffer_questao: list[str] = []
    alternativa_atual: Alternativa | None = None
    buffer_alt: list[str] = []
    esperado = minimo
    paginas_sem_texto = [pg["numero"] for pg in texto["paginas"] if pg["precisa_ocr"]]

    def fechar_alternativa() -> None:
        nonlocal alternativa_atual, buffer_alt
        if alternativa_atual and questao_atual:
            alternativa_atual.texto = _fechar_texto([alternativa_atual.texto, *buffer_alt])
            questao_atual.alternativas.append(alternativa_atual)
        alternativa_atual, buffer_alt = None, []

    def fechar_questao() -> None:
        nonlocal questao_atual, buffer_questao
        fechar_alternativa()
        if questao_atual:
            questao_atual.enunciado = _fechar_texto([questao_atual.enunciado, *buffer_questao])
            questoes.append(questao_atual)
        questao_atual, buffer_questao = None, []

    def fechar_apoio() -> None:
        nonlocal apoio_atual, buffer_apoio
        if apoio_atual:
            apoio_atual.texto = _fechar_texto(buffer_apoio)
            textos_apoio.append(apoio_atual)
        apoio_atual, buffer_apoio = None, []

    for pagina in texto["paginas"]:
        for linha in pagina["linhas"]:
            bruto = linha["texto"].strip()
            if not bruto or _descartar(bruto, descartaveis):
                continue
            if re_fim and re_fim.search(bruto):
                fechar_questao()
                fechar_apoio()
                break

            # ── abertura de um bloco de texto de apoio ──────────────────────
            if re_apoio and (m := re_apoio.match(bruto)):
                fechar_questao()
                fechar_apoio()
                apoio_vigente = None
                apoio_atual = TextoApoio(id=f"TA-{m.group('id')}", texto="", paginas=[pagina["numero"]])
                continue

            # ── frase de comando: fecha o apoio e amarra o lote seguinte ────
            if re_instrucao and questao_atual is None and re_instrucao.search(bruto):
                if apoio_atual is not None:
                    fechar_apoio()
                if textos_apoio:
                    if re_ref and (mr := re_ref.search(bruto)):
                        apoio_vigente = f"TA-{mr.group('id')}"
                    else:
                        apoio_vigente = textos_apoio[-1].id
                continue

            # ── marcador de item ────────────────────────────────────────────
            m_item = re_item.match(bruto) if re_item else None
            if m_item:
                numero = int(m_item.group("numero"))
                valido = minimo <= numero <= maximo and (not exige_sequencia or numero == esperado)
                if valido:
                    fechar_questao()
                    fechar_apoio()
                    esperado = numero + 1
                    resto = m_item.group("resto")
                    referencia = apoio_vigente
                    if re_ref and (mr := re_ref.search(resto)):
                        referencia = f"TA-{mr.group('id')}"
                    elif re_precedente and re_precedente.search(resto) and textos_apoio:
                        referencia = textos_apoio[-1].id
                    questao_atual = Questao(
                        numero=numero,
                        tipo=formato,
                        enunciado=resto,
                        pagina=pagina["numero"],
                        texto_apoio_id=referencia,
                        atribuicao=Atribuicao(numero_original=numero, **atribuicao_base),
                    )
                    buffer_questao = []
                    continue

            # ── marcador de alternativa (só em múltipla escolha) ────────────
            if formato == "multipla" and questao_atual and re_alt and (m_alt := re_alt.match(bruto)):
                fechar_alternativa()
                alternativa_atual = Alternativa(letra=m_alt.group("letra"), texto=m_alt.group("resto"))
                buffer_alt = []
                continue

            # ── continuação ─────────────────────────────────────────────────
            if alternativa_atual is not None:
                buffer_alt.append(bruto)
            elif questao_atual is not None:
                buffer_questao.append(bruto)
                if questao_atual.texto_apoio_id is None:
                    if re_ref and (mr := re_ref.search(bruto)):
                        questao_atual.texto_apoio_id = f"TA-{mr.group('id')}"
                    elif re_precedente and re_precedente.search(bruto) and textos_apoio:
                        questao_atual.texto_apoio_id = textos_apoio[-1].id
            elif apoio_atual is not None:
                buffer_apoio.append(bruto)
                if pagina["numero"] not in apoio_atual.paginas:
                    apoio_atual.paginas.append(pagina["numero"])

    fechar_questao()
    fechar_apoio()

    # ── conferências que valem mais que o parser ────────────────────────────
    faltando_meta = [c for c in ("orgao", "cargo") if not meta.get(c)]
    if faltando_meta:
        avisos.append(
            f"metadados da prova ausentes: {faltando_meta} — a atribuição é obrigatória "
            f"(CLAUDE.md, regra 4). Crie perfis/{slug}.yaml com o bloco `prova:` "
            "antes de tentar publicar."
        )

    numeros = [q.numero for q in questoes]
    if numeros:
        faltando = sorted(set(range(min(numeros), max(numeros) + 1)) - set(numeros))
        if faltando:
            avisos.append(f"itens faltando na sequência: {faltando}")
    else:
        avisos.append("nenhum item reconhecido — o perfil provavelmente não bate com este caderno")

    ids_apoio = {t.id for t in textos_apoio}
    for q in questoes:
        if q.texto_apoio_id and q.texto_apoio_id not in ids_apoio:
            avisos.append(f"questão {q.numero} aponta para texto de apoio inexistente {q.texto_apoio_id}")
            q.texto_apoio_id = None
    orfaos = ids_apoio - {q.texto_apoio_id for q in questoes if q.texto_apoio_id}
    if orfaos:
        avisos.append(f"texto de apoio sem questão apontando: {sorted(orfaos)}")
        textos_apoio = [t for t in textos_apoio if t.id not in orfaos]

    if formato == "multipla":
        esperadas = p.alternativas_esperadas or 5
        incompletas = [q.numero for q in questoes if len(q.alternativas) != esperadas]
        if incompletas:
            avisos.append(f"questões com número inesperado de alternativas: {incompletas[:20]}")

    status = STATUS_PRECISA_OCR if paginas_sem_texto else STATUS_SEGMENTADO
    if paginas_sem_texto:
        avisos.append(
            f"páginas sem camada de texto: {paginas_sem_texto} — OCR está fora da v1, "
            "esta prova não pode ser publicada"
        )

    artefato = Artefato(
        prova=Prova(
            slug=slug,
            banca=atribuicao_base["banca"],
            ano=atribuicao_base["ano"],
            orgao=atribuicao_base["orgao"],
            cargo=atribuicao_base["cargo"],
            formato=formato,
            penalidade_por_erro=p.penalidade_por_erro,
            tipo_caderno=meta.get("tipo_caderno"),
            fonte_pdf=texto.get("url_pdf", ""),
            sha256_pdf=texto.get("sha256_pdf"),
            perfil=p.nome,
        ),
        status=status,
        gerado_em=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        textos_apoio=textos_apoio,
        questoes=questoes,
        avisos=avisos,
    )
    dados = modelos.para_dict(artefato)
    modelos.escrever_json(c.segmentado, dados)
    man.registrar("4_segmentar", [c.texto], [c.segmentado], VERSAO, extra=p.nome)
    return dados


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slug")
    ap.add_argument("--perfil")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    d = executar(args.slug, nome_perfil=args.perfil, forcar=args.force)
    print(
        f"{args.slug}: {len(d['questoes'])} itens, "
        f"{len(d.get('textos_apoio', []))} textos de apoio, status {d['status']}"
    )
    for aviso in d.get("avisos", []):
        print(f"  ! {aviso}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
