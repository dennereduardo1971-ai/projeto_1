"""Segunda origem de questão — apostila comentada de terceiro (pivô 2026-08-31).

Sem pipeline de PDF ainda (não há amostra real — ver docs/agents/coletor.md),
estes testes exercitam só a camada que já existe: schema + regra de validação
em `lib/validador.py`. Constroem o artefato à mão, sem passar pelas etapas
1-6.
"""
from __future__ import annotations

from ingest.lib import validador
from ingest.lib.modelos import STATUS_PUBLICAVEL


def _artefato(*, prova_extra: dict, questao_extra: dict) -> dict:
    return {
        "versao_artefato": 1,
        "gerado_em": "2026-08-31T00:00:00Z",
        "status": STATUS_PUBLICAVEL,
        "prova": {
            "slug": "apostila_tamayo_auditoria_01",
            "formato": "multipla",
            "penalidade_por_erro": False,
            "fonte_pdf": "arquivo local, sem URL pública",
            **prova_extra,
        },
        "questoes": [
            {
                "numero": 1,
                "tipo": "multipla",
                "enunciado": "Enunciado de teste com mais de dez caracteres.",
                "pagina": 1,
                "anulada": False,
                "alternativas": [
                    {"letra": "A", "texto": "primeira"},
                    {"letra": "B", "texto": "segunda"},
                ],
                "gabarito": "A",
                "assunto": "amostragem",
                "classificacao_confianca": 0.9,
                **questao_extra,
            }
        ],
    }


def _apostila(**questao_extra) -> dict:
    return _artefato(
        prova_extra={
            "origem_fonte": "apostila_comentada",
            "autor_fonte": "Profa. Tamayo",
            "titulo_fonte": "Apostila de Auditoria — Módulo 1",
        },
        questao_extra=questao_extra,
    )


def test_apostila_comentada_sem_atribuicao_por_questao_publica():
    """Diferente de prova_oficial, não exige `atribuicao` por questão."""
    dados = _apostila(revisado_humano=True)
    assert validador.validar(dados, para_publicar=True) == []


def test_apostila_comentada_sem_revisado_humano_nao_publica():
    dados = _apostila(revisado_humano=False)
    problemas = validador.validar(dados, para_publicar=True)
    assert any("revisado_humano" in p for p in problemas)


def test_apostila_comentada_libera_comentario_com_autor_fonte():
    dados = _apostila(revisado_humano=True, comentario="Explicação da própria autora da apostila.")
    assert validador.validar(dados, para_publicar=True) == []


def test_apostila_comentada_sem_autor_fonte_continua_barrando_comentario():
    """Sem `autor_fonte` na prova, a exceção da regra 5 não se aplica."""
    dados = _artefato(
        prova_extra={"origem_fonte": "apostila_comentada", "titulo_fonte": "Apostila sem autor"},
        questao_extra={"revisado_humano": True, "comentario": "Não deveria passar."},
    )
    problemas = validador.validar(dados, para_publicar=False)
    assert any("campo proibido" in p for p in problemas)
    assert any("autor_fonte" in p for p in problemas)


def test_prova_oficial_continua_barrando_comentario_mesmo_com_origem_explicita():
    """A exceção é só para apostila_comentada — nunca para prova_oficial."""
    dados = _artefato(
        prova_extra={
            "origem_fonte": "prova_oficial",
            "banca": "CEBRASPE",
            "ano": 2025,
            "orgao": "Órgão",
            "cargo": "Cargo",
        },
        questao_extra={
            "comentario": "Justificativa da banca, não deveria passar.",
            "atribuicao": {
                "banca": "CEBRASPE", "ano": 2025, "orgao": "Órgão", "cargo": "Cargo",
                "numero_original": 1, "url_pdf": "https://cdn.cebraspe.org.br/x.pdf",
            },
        },
    )
    problemas = validador.validar(dados, para_publicar=False)
    assert any("campo proibido" in p for p in problemas)
