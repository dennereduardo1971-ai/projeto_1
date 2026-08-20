"""Pipeline ponta a ponta, sem rede e sem PDF real.

O que estes testes NÃO provam: que os regexes do perfil batem com o caderno de
verdade do Cebraspe. Isso só o primeiro PDF real resolve. O que eles provam é
que a estrutura aguenta — texto de apoio compartilhado, sequência de itens,
gabarito casado, anulada fora, cache idempotente.
"""
from __future__ import annotations

import pytest

from ingest.lib import caminhos, modelos
from ingest.lib.modelos import (
    STATUS_PENDENTE_DEFINITIVO, STATUS_PRECISA_OCR, STATUS_PUBLICAVEL,
)
from ingest.tests.conftest import etapa


META_FIXTURE = {
    "banca": "CEBRASPE",
    "ano": 2026,
    "orgao": "Órgão Fictício",
    "cargo": "Cargo Fictício",
    "tipo_caderno": "1",
}


def _ate_segmentar(slug: str) -> dict:
    etapa("1_descobrir").executar(slug)
    etapa("2_baixar").executar(slug)
    etapa("3_extrair").executar(slug, nome_perfil="ce_bloco")
    return etapa("4_segmentar").executar(slug, nome_perfil="ce_bloco", meta=META_FIXTURE)


def test_descobrir_classifica_por_nome(prova_ce):
    doc = etapa("1_descobrir").executar(prova_ce)
    classes = {f["classe"] for f in doc["fontes"]}
    assert "caderno" in classes
    assert "gabarito_definitivo" in classes


def test_descobrir_reconstroi_url_do_cdn(prova_ce):
    doc = etapa("1_descobrir").executar(prova_ce)
    caderno = next(f for f in doc["fontes"] if f["classe"] == "caderno")
    # Sem rede, a atribuição obrigatória ainda precisa apontar para a origem.
    assert caderno["url"].startswith("https://cdn.cebraspe.org.br/concursos/")
    assert prova_ce in caderno["url"]


def test_extrair_preserva_coordenadas(prova_ce):
    etapa("1_descobrir").executar(prova_ce)
    etapa("2_baixar").executar(prova_ce)
    doc = etapa("3_extrair").executar(prova_ce, nome_perfil="ce_bloco")
    linha = doc["paginas"][0]["linhas"][0]
    assert {"texto", "top", "bottom", "x0", "x1"} <= set(linha)
    assert not doc["paginas"][0]["precisa_ocr"]


def test_extrair_descarta_cabecalho_e_rodape(prova_ce):
    etapa("1_descobrir").executar(prova_ce)
    etapa("2_baixar").executar(prova_ce)
    doc = etapa("3_extrair").executar(prova_ce, nome_perfil="ce_bloco")
    texto = " ".join(l["texto"] for p in doc["paginas"] for l in p["linhas"])
    assert "APLICAÇÃO" not in texto


def test_segmentar_encontra_os_itens(prova_ce):
    d = _ate_segmentar(prova_ce)
    assert [q["numero"] for q in d["questoes"]] == [1, 2, 3, 4, 5]
    assert all(q["tipo"] == "ce" for q in d["questoes"])
    assert all(not q.get("alternativas") for q in d["questoes"])


def test_texto_de_apoio_e_referencia_nao_copia(prova_ce):
    """O padrão que quebra parser ingênuo: um bloco servindo vários itens."""
    d = _ate_segmentar(prova_ce)
    assert len(d["textos_apoio"]) == 1
    apoio = d["textos_apoio"][0]
    assert "Ilhas Flutuantes" in apoio["texto"]
    # Todas as questões apontam para o mesmo bloco, e nenhuma carrega o texto.
    assert {q["texto_apoio_id"] for q in d["questoes"]} == {apoio["id"]}
    for q in d["questoes"]:
        assert "Ilhas Flutuantes" not in q["enunciado"]


def test_atribuicao_obrigatoria_em_toda_questao(prova_ce):
    d = _ate_segmentar(prova_ce)
    for q in d["questoes"]:
        atr = q["atribuicao"]
        assert atr["banca"] and atr["url_pdf"]
        assert atr["numero_original"] == q["numero"]


def test_gabarito_casa_e_marca_anuladas(prova_ce):
    _ate_segmentar(prova_ce)
    d = etapa("5_gabarito").executar(prova_ce)
    gabaritos = {q["numero"]: q["gabarito"] for q in d["questoes"]}
    assert gabaritos == {1: "C", 2: "C", 3: "E", 4: "C", 5: "E"}
    assert d["resumo_gabarito"]["sem_gabarito"] == 0
    assert d["prova"]["fonte_gabarito"].startswith("https://cdn.cebraspe.org.br/")


def test_sem_gabarito_definitivo_nao_publica(prova_sem_gabarito):
    _ate_segmentar(prova_sem_gabarito)
    d = etapa("5_gabarito").executar(prova_sem_gabarito)
    assert d["status"] == STATUS_PENDENTE_DEFINITIVO
    r = etapa("7_publicar").executar(prova_sem_gabarito)
    assert r["publicado"] is False


def test_prova_escaneada_e_recusada(prova_escaneada):
    _ate_segmentar(prova_escaneada)
    d = modelos.ler_json(caminhos.Caminhos(prova_escaneada).segmentado)
    assert d["status"] == STATUS_PRECISA_OCR
    assert any("OCR" in a for a in d["avisos"])


def test_classificacao_exige_concordancia_das_duas_passadas(prova_ce):
    _ate_segmentar(prova_ce)
    etapa("5_gabarito").executar(prova_ce)
    mod = etapa("6_classificar")
    d = mod.executar(prova_ce, classificador=mod.ClassificadorStub())
    # Stub sem respostas gravadas: confiança zero, tudo vai para revisão humana.
    assert d["resumo_classificacao"]["classificadas"] == 0
    assert d["resumo_classificacao"]["em_revisao"] == 5
    assert caminhos.Caminhos(prova_ce).fila_revisao.exists()


def test_divergencia_entre_passadas_vai_para_a_fila(prova_ce):
    _ate_segmentar(prova_ce)
    etapa("5_gabarito").executar(prova_ce)
    mod = etapa("6_classificar")
    d = modelos.ler_json(caminhos.Caminhos(prova_ce).com_gabarito)

    gravadas = {}
    for i, q in enumerate(d["questoes"]):
        chave = modelos.normalizar(q["enunciado"])
        gravadas[chave] = {
            "disciplina": "Auditoria",
            "assunto": "Controles internos",
            # A primeira questão recebe assunto diferente na 2ª passada.
            "assunto_2": "Evidência de auditoria" if i == 0 else "Controles internos",
            "assunto_1": "Controles internos",
            "confianca": 0.95,
        }
    resultado = mod.executar(
        prova_ce, classificador=mod.ClassificadorStub(gravadas), forcar=True
    )
    assert resultado["resumo_classificacao"]["em_revisao"] == 1
    assert resultado["resumo_classificacao"]["classificadas"] == 4
    fila = modelos.ler_json(caminhos.Caminhos(prova_ce).fila_revisao)
    assert fila["itens"][0]["motivo"] == "divergência entre as passadas"


def test_publica_quando_tudo_casa(prova_ce):
    _ate_segmentar(prova_ce)
    etapa("5_gabarito").executar(prova_ce)
    mod = etapa("6_classificar")
    d = modelos.ler_json(caminhos.Caminhos(prova_ce).com_gabarito)
    gravadas = {
        modelos.normalizar(q["enunciado"]): {
            "disciplina": "Auditoria",
            "assunto": "Controles internos",
            "confianca": 0.91,
        }
        for q in d["questoes"]
    }
    final = mod.executar(prova_ce, classificador=mod.ClassificadorStub(gravadas), forcar=True)
    assert final["status"] == STATUS_PUBLICAVEL

    r = etapa("7_publicar").executar(prova_ce)
    assert r["problemas"] == [], r["problemas"]
    assert r["publicado"] is True
    artefato = modelos.ler_json(caminhos.Caminhos(prova_ce).artefato)
    assert len(artefato["questoes"]) == 5


def test_cache_torna_reprocesso_barato(prova_ce):
    etapa("1_descobrir").executar(prova_ce)
    etapa("2_baixar").executar(prova_ce)
    primeiro = etapa("3_extrair").executar(prova_ce, nome_perfil="ce_bloco")
    c = caminhos.Caminhos(prova_ce)
    marca = c.texto.stat().st_mtime_ns
    segundo = etapa("3_extrair").executar(prova_ce, nome_perfil="ce_bloco")
    assert segundo == primeiro
    assert c.texto.stat().st_mtime_ns == marca  # não reescreveu


def test_forcar_invalida_o_cache(prova_ce):
    etapa("1_descobrir").executar(prova_ce)
    etapa("2_baixar").executar(prova_ce)
    etapa("3_extrair").executar(prova_ce, nome_perfil="ce_bloco")
    c = caminhos.Caminhos(prova_ce)
    marca = c.texto.stat().st_mtime_ns
    etapa("3_extrair").executar(prova_ce, nome_perfil="ce_bloco", forcar=True)
    assert c.texto.stat().st_mtime_ns != marca


def test_multipla_escolha_le_alternativas(area, fixtures):
    import shutil

    slug = "fixture_multipla"
    c = caminhos.Caminhos(slug)
    c.preparar()
    shutil.copy(fixtures["multipla"], c.manual / "MATRIZ_996_FIXTURE_001.PDF")
    shutil.copy(fixtures["gabarito_multipla"], c.manual / "Gab_Definitivo_996_FIXTURE_001.pdf")

    etapa("1_descobrir").executar(slug)
    etapa("2_baixar").executar(slug)
    etapa("3_extrair").executar(slug, nome_perfil="multipla_5")
    d = etapa("4_segmentar").executar(slug, nome_perfil="multipla_5", meta=META_FIXTURE)

    assert d["prova"]["formato"] == "multipla"
    # Múltipla escolha não pune erro: o placar líquido não existe nesta prova.
    assert d["prova"]["penalidade_por_erro"] is False
    assert len(d["questoes"]) == 2
    assert [a["letra"] for a in d["questoes"][0]["alternativas"]] == list("ABCDE")
