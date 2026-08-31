"""Testes de unidade para `lib/apostila.py` — parser de apostila comentada.

Nenhum PDF real, nenhum trecho copiado de PDF de terceiro: as linhas são
construídas à mão para reproduzir o artefato de negrito duplicado observado
nos dois PDFs de amostra (ver docs/agents/coletor.md → Armadilhas), sem
conteúdo protegido. `_dobrar` é o inverso de `_desdobrar_negrito` — dobra
cada caractere uma vez, exatamente como o PDF real faz no prefixo de item e
no título de seção.
"""
from __future__ import annotations

from ingest.lib import apostila as ap
from ingest.lib.modelos import Questao


def _dobrar(texto: str) -> str:
    """Inverso de `_desdobrar_negrito`: 'GAB' -> 'GGAABB'."""
    return "".join(c * 2 for c in texto)


def _linha(texto: str, *, top: float, bottom: float | None = None, pagina: int = 1) -> dict:
    return {"texto": texto, "top": top, "bottom": bottom if bottom is not None else top + 12.0, "pagina": pagina}


# ── _desdobrar_negrito ───────────────────────────────────────────────────
def test_desdobrar_negrito_prefixo_de_item():
    assert ap._desdobrar_negrito(_dobrar("008.")) == "008."
    assert ap._desdobrar_negrito(_dobrar("22.")) == "22."


def test_desdobrar_negrito_nao_mexe_em_texto_sem_dobra():
    assert ap._desdobrar_negrito("a) alternativa normal") == "a) alternativa normal"


# ── _cabecalho ───────────────────────────────────────────────────────────
def test_cabecalho_reconhece_titulo_dobrado():
    assert ap._cabecalho(_dobrar("GABARITO")) == "GABARITO"
    assert ap._cabecalho(_dobrar("GABARITO COMENTADO")) == "GABARITO COMENTADO"
    assert ap._cabecalho(_dobrar("QUESTÕES COMENTADAS EM AULA")) == "QUESTÕES COMENTADAS EM AULA"
    assert ap._cabecalho(_dobrar("QUESTÕES DE CONCURSO")) == "QUESTÕES DE CONCURSO"
    assert ap._cabecalho(_dobrar("EXERCÍCIOS")) == "EXERCÍCIOS"


def test_cabecalho_ignora_linha_de_enunciado():
    assert ap._cabecalho(_dobrar("001.") + " (BANCA/CARGO/2020) Um enunciado qualquer.") is None
    assert ap._cabecalho("Uma frase comum de parágrafo, não é cabeçalho.") is None


def test_cabecalho_so_conta_linha_curta_depois_de_desdobrar():
    # Uma linha comprida não pode virar cabeçalho por acaso, mesmo que o
    # texto desdobrado (hipotético) coubesse na sigla de alguma seção.
    linha_longa = "Este parágrafo é claramente enunciado de questão, não título de seção alguma."
    assert ap._cabecalho(linha_longa) is None


# ── _item ────────────────────────────────────────────────────────────────
def test_item_com_citacao_e_resto():
    linha = _dobrar("001.") + " (CESPE/CEBRASPE/ÓRGÃO/CARGO/2020) Enunciado do item um."
    numero, citacao, resto = ap._item(linha)
    assert numero == 1
    assert citacao == "CESPE/CEBRASPE/ÓRGÃO/CARGO/2020"
    assert resto == "Enunciado do item um."


def test_item_com_ordem_de_tokens_diferente_na_citacao():
    # A ordem banca/cargo/órgão/ano varia entre questões — não estruturamos,
    # só preservamos a citação inteira.
    linha = _dobrar("017.") + " (FCC/PROMOTOR/MPE-MT/2019/ADAPTADA) Outro enunciado."
    numero, citacao, resto = ap._item(linha)
    assert numero == 17
    assert citacao == "FCC/PROMOTOR/MPE-MT/2019/ADAPTADA"


def test_item_nao_casa_linha_sem_prefixo_numerico():
    assert ap._item("a) uma alternativa qualquer") is None
    assert ap._item("Um parágrafo comum.") is None


# ── extrair_itens ────────────────────────────────────────────────────────
def _linhas_secao_itens() -> list[dict]:
    linhas = []
    linhas.append(_linha(_dobrar("QUESTÕES DE CONCURSO"), top=100))
    # item 1: Certo/Errado, sem alternativas
    linhas.append(_linha(_dobrar("001.") + " (BANCA/CARGO/2020) Afirmação a julgar,", top=140))
    linhas.append(_linha("continuando na linha seguinte.", top=158))
    # item 2: múltipla escolha, com alternativas
    linhas.append(_linha(_dobrar("002.") + " (BANCA/CARGO/2021) Assinale a opção correta.", top=200))
    linhas.append(_linha("a) primeira alternativa", top=220))
    linhas.append(_linha("b) segunda alternativa", top=240))
    linhas.append(_linha("c) terceira alternativa,", top=260))
    linhas.append(_linha("continuando também.", top=280))
    linhas.append(_linha(_dobrar("GABARITO"), top=320))
    linhas.append(_linha("1. E 2. b", top=340))
    return linhas


def test_extrair_itens_ce_sem_alternativas():
    itens = ap.extrair_itens(_linhas_secao_itens())
    assert set(itens) == {1, 2}
    item1 = itens[1]
    assert item1.citacao == "BANCA/CARGO/2020"
    assert item1.enunciado == "Afirmação a julgar, continuando na linha seguinte."
    assert item1.alternativas == []


def test_extrair_itens_multipla_com_alternativas():
    itens = ap.extrair_itens(_linhas_secao_itens())
    item2 = itens[2]
    assert item2.enunciado == "Assinale a opção correta."
    assert [a.letra for a in item2.alternativas] == ["A", "B", "C"]
    assert item2.alternativas[2].texto == "terceira alternativa, continuando também."


def test_extrair_itens_ignora_conteudo_fora_de_secao_conhecida():
    linhas = [
        _linha(_dobrar("001.") + " (BANCA/CARGO/2020) Exemplo dado no meio do capítulo.", top=100),
        _linha(_dobrar("QUESTÕES DE CONCURSO"), top=200),
        _linha(_dobrar("001.") + " (BANCA/CARGO/2020) Item de verdade.", top=240),
    ]
    itens = ap.extrair_itens(linhas)
    assert len(itens) == 1
    assert itens[1].enunciado == "Item de verdade."


# ── extrair_grade ────────────────────────────────────────────────────────
def test_extrair_grade_maiuscula_e_minuscula_misturadas():
    linhas = [
        _linha(_dobrar("GABARITO"), top=100),
        _linha("1. C 2. E 3. a 4. b", top=140),
        _linha(_dobrar("GABARITO COMENTADO"), top=200),
        _linha("isto não é grade, é outra seção", top=240),
    ]
    grade = ap.extrair_grade(linhas)
    assert grade[1] == {"resposta": "C", "tipo": "ce", "anulada": False}
    assert grade[2] == {"resposta": "E", "tipo": "ce", "anulada": False}
    assert grade[3] == {"resposta": "A", "tipo": "multipla", "anulada": False}
    assert grade[4] == {"resposta": "B", "tipo": "multipla", "anulada": False}


def test_extrair_grade_anulada():
    linhas = [
        _linha(_dobrar("GABARITO"), top=100),
        _linha("1. C 2. ANULADA 3. b", top=140),
    ]
    grade = ap.extrair_grade(linhas)
    assert grade[2]["anulada"] is True
    assert grade[2]["resposta"] is None


# ── extrair_comentarios ──────────────────────────────────────────────────
def test_extrair_comentarios_ate_o_proximo_marcador():
    linhas = [
        _linha(_dobrar("GABARITO COMENTADO"), top=100),
        _linha(_dobrar("001.") + " (BANCA/CARGO/2020) Afirmação a julgar.", top=150),
        # salto de parágrafo grande (~40pt) = começo do comentário
        _linha("Comentário do autor sobre o item um,", top=192),
        _linha("terminando aqui.", top=210),
        _linha("Errado.", top=228),
        _linha(_dobrar("002.") + " (BANCA/CARGO/2021) Assinale a opção correta.", top=270),
        _linha("a) primeira", top=290),
        _linha("b) segunda", top=310),
        _linha("Comentário do item dois.", top=352),
        _linha("Letra b.", top=370),
    ]
    comentarios = ap.extrair_comentarios(linhas)
    assert comentarios[1] == "Comentário do autor sobre o item um, terminando aqui. Errado."
    assert comentarios[2] == "Comentário do item dois. Letra b."


def test_extrair_comentarios_nao_confunde_analise_por_alternativa_com_repeticao():
    """O autor às vezes analisa cada alternativa em linha própria dentro do
    comentário ("a) Certa. ...") — isso não pode ser confundido com a
    repetição das alternativas do item e perder o comentário inteiro."""
    linhas = [
        _linha(_dobrar("GABARITO COMENTADO"), top=100),
        _linha(_dobrar("001.") + " (BANCA/CARGO/2020) Pergunta.", top=150),
        _linha("a) primeira", top=170),
        _linha("b) segunda", top=190),
        # salto grande, mas o texto PARECE alternativa de novo
        _linha("a) Certa. Explicação da primeira.", top=232),
        _linha("b) Errada. Explicação da segunda.", top=250),
        _linha("Letra a.", top=268),
    ]
    comentarios = ap.extrair_comentarios(linhas)
    assert comentarios[1] == "a) Certa. Explicação da primeira. b) Errada. Explicação da segunda. Letra a."


def test_extrair_comentarios_continua_atraves_de_quebra_de_pagina():
    linhas = [
        _linha(_dobrar("GABARITO COMENTADO"), top=100, pagina=1),
        _linha(_dobrar("001.") + " (BANCA/CARGO/2020) Pergunta.", top=150, pagina=1),
        _linha("Início do comentário na página um,", top=192, pagina=1),
        _linha("e a continuação cai na página dois.", top=98, pagina=2),
        _linha("Certo.", top=116, pagina=2),
    ]
    comentarios = ap.extrair_comentarios(linhas)
    assert comentarios[1] == (
        "Início do comentário na página um, e a continuação cai na página dois. Certo."
    )


# ── montar_questoes / dividir_por_tipo ────────────────────────────────────
def test_montar_questoes_cruza_itens_grade_comentarios():
    itens = ap.extrair_itens(_linhas_secao_itens())
    grade = ap.extrair_grade(_linhas_secao_itens())
    comentarios = {1: "Comentário do item um. Errado."}
    questoes = ap.montar_questoes(itens, grade, comentarios)
    assert len(questoes) == 2
    q1 = next(q for q in questoes if q.numero == 1)
    assert q1.tipo == "ce"
    assert q1.gabarito == "E"
    assert q1.anulada is False
    assert q1.revisado_humano is False
    assert q1.comentario == "Comentário do item um. Errado."
    assert q1.enunciado.startswith("(BANCA/CARGO/2020)")

    q2 = next(q for q in questoes if q.numero == 2)
    assert q2.tipo == "multipla"
    assert q2.gabarito == "B"
    assert len(q2.alternativas) == 3
    assert q2.comentario is None


def test_montar_questoes_anulada_sem_gabarito():
    itens = {1: ap.ItemBruto(numero=1, citacao="BANCA/2020", enunciado="Item anulado.", pagina=1)}
    grade = {1: {"resposta": None, "tipo": None, "anulada": True}}
    questoes = ap.montar_questoes(itens, grade, {})
    assert questoes[0].anulada is True
    assert questoes[0].gabarito is None


def test_dividir_por_tipo_separa_ce_e_multipla():
    questoes = [
        Questao(numero=1, tipo="ce", enunciado="x", pagina=1),
        Questao(numero=2, tipo="multipla", enunciado="y", pagina=1),
        Questao(numero=3, tipo="ce", enunciado="z", pagina=1),
    ]
    partes = ap.dividir_por_tipo(questoes)
    assert [q.numero for q in partes["ce"]] == [1, 3]
    assert [q.numero for q in partes["multipla"]] == [2]


# ── processar (integração) ────────────────────────────────────────────────
class _PerfilFake:
    nome = "apostila_teste"
    prova = {
        "autor_fonte": "Autor de Teste",
        "titulo_fonte": "Apostila de Teste",
        "disciplina": "Disciplina de Teste",
        "assunto": "assunto-teste",
    }

    def descartaveis(self):
        return []


def test_processar_gera_dois_artefatos_quando_mistura_tipos():
    texto_doc = {
        "pdf": "data/00_manual/apostila_teste/arquivo.pdf",
        "sha256_pdf": "abc123",
        "paginas": [
            {
                "numero": 1,
                "linhas": [
                    *_linhas_secao_itens(),
                    _linha(_dobrar("GABARITO COMENTADO"), top=400),
                    _linha(_dobrar("001.") + " (BANCA/CARGO/2020) Afirmação a julgar,", top=440),
                    _linha("continuando na linha seguinte.", top=458),
                    _linha("Comentário do item um,", top=500),
                    _linha("terminando aqui.", top=518),
                    _linha("Errado.", top=536),
                ],
            }
        ],
    }
    resultado = ap.processar("apostila_teste", _PerfilFake(), {}, texto_doc)
    slugs = dict(resultado)
    assert set(slugs) == {"apostila_teste_ce", "apostila_teste_multipla"}

    ce = slugs["apostila_teste_ce"]
    assert ce.prova.slug == "apostila_teste_ce"
    assert ce.prova.formato == "ce"
    assert ce.prova.penalidade_por_erro is True
    assert ce.prova.origem_fonte == "apostila_comentada"
    assert ce.prova.autor_fonte == "Autor de Teste"
    assert ce.prova.titulo_fonte == "Apostila de Teste"
    assert len(ce.questoes) == 1
    assert ce.questoes[0].disciplina == "Disciplina de Teste"
    assert ce.questoes[0].assunto == "assunto-teste"
    assert ce.questoes[0].classificacao_confianca == 1.0
    assert ce.questoes[0].comentario == "Comentário do item um, terminando aqui. Errado."

    multipla = slugs["apostila_teste_multipla"]
    assert multipla.prova.formato == "multipla"
    assert multipla.prova.penalidade_por_erro is False
    assert len(multipla.questoes) == 1


def test_processar_omite_lado_vazio():
    texto_doc = {
        "pdf": "arquivo.pdf",
        "sha256_pdf": None,
        "paginas": [
            {
                "numero": 1,
                "linhas": [
                    _linha(_dobrar("QUESTÕES DE CONCURSO"), top=100),
                    _linha(_dobrar("001.") + " (BANCA/CARGO/2020) Só um item Certo/Errado.", top=140),
                    _linha(_dobrar("GABARITO"), top=200),
                    _linha("1. C", top=220),
                ],
            }
        ],
    }
    resultado = ap.processar("apostila_teste", _PerfilFake(), {}, texto_doc)
    slugs = dict(resultado)
    assert set(slugs) == {"apostila_teste_ce"}
