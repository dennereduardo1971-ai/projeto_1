"""Gera PDFs sintéticos que copiam a ESTRUTURA de um caderno, não o conteúdo.

Isso é deliberado e não negociável: o conteúdo é notoriamente fictício
("Repartição Fictícia de Ilhas Flutuantes", alternativas alfa/beta/gama), para
que nenhuma fixture possa ser confundida com item de prova real nem entrar no
acervo por engano. O que está sob teste é o segmentador — duas colunas,
cabeçalho e rodapé repetidos, numeração de item, bloco de texto de apoio
compartilhado, tabela — e não a matéria.
"""
from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

AQUI = Path(__file__).resolve().parent
LARGURA, ALTURA = A4
MARGEM = 42
CALHA = 30
COL = (LARGURA - 2 * MARGEM - CALHA) / 2

CABECALHO = "CEBRASPE — APLICAÇÃO: 2026 — CARGO 1: CARGO FICTÍCIO"


def _quebrar(texto: str, largura_max: float, c: canvas.Canvas, fonte="Helvetica", tam=9) -> list[str]:
    palavras, linhas, atual = texto.split(), [], ""
    for p in palavras:
        teste = f"{atual} {p}".strip()
        if c.stringWidth(teste, fonte, tam) <= largura_max:
            atual = teste
        else:
            linhas.append(atual)
            atual = p
    if atual:
        linhas.append(atual)
    return linhas


class Folha:
    """Escreve em duas colunas, quebrando página sozinha."""

    def __init__(self, caminho: Path, colunas: int = 2) -> None:
        self.c = canvas.Canvas(str(caminho), pagesize=A4)
        self.colunas = colunas
        self.pagina = 0
        self._nova_pagina()

    def _nova_pagina(self) -> None:
        if self.pagina:
            self.c.showPage()
        self.pagina += 1
        self.c.setFont("Helvetica", 7)
        self.c.drawString(MARGEM, ALTURA - 28, CABECALHO)
        self.c.drawCentredString(LARGURA / 2, 24, f"– {self.pagina} –")
        self.col = 0
        self.y = ALTURA - 60

    def _x(self) -> float:
        return MARGEM if self.col == 0 or self.colunas == 1 else MARGEM + COL + CALHA

    def _largura(self) -> float:
        return COL if self.colunas == 2 else LARGURA - 2 * MARGEM

    def _avancar(self, altura: float) -> None:
        self.y -= altura
        if self.y < 60:
            if self.colunas == 2 and self.col == 0:
                self.col, self.y = 1, ALTURA - 60
            else:
                self._nova_pagina()

    def escrever(self, texto: str, *, negrito=False, recuo=0.0, tam=9) -> None:
        fonte = "Helvetica-Bold" if negrito else "Helvetica"
        self.c.setFont(fonte, tam)
        for linha in _quebrar(texto, self._largura() - recuo, self.c, fonte, tam):
            self.c.drawString(self._x() + recuo, self.y, linha)
            self._avancar(tam + 2.5)
        self._avancar(2)

    def tabela(self, linhas: list[list[str]]) -> None:
        alt, larg = 13, self._largura() / max(1, len(linhas[0]))
        topo = self.y
        self.c.setFont("Helvetica", 8)
        for i, linha in enumerate(linhas):
            for j, celula in enumerate(linha):
                x = self._x() + j * larg
                self.c.rect(x, self.y - alt + 3, larg, alt)
                self.c.drawString(x + 3, self.y - alt + 7, celula)
            self.y -= alt
            if i == len(linhas) - 1:
                self._avancar(6)
        assert topo > self.y

    def salvar(self) -> None:
        self.c.save()


TEXTO_APOIO = (
    "A Repartição Fictícia de Ilhas Flutuantes contratou auditoria independente de suas "
    "demonstrações do exercício encerrado. Durante os trabalhos, a equipe identificou que os "
    "registros de barcaças estavam mantidos em três sistemas paralelos, sem conciliação entre "
    "eles, e que o inventário anual foi realizado por servidor responsável pela própria "
    "custódia dos bens."
)

ITENS_CE = [
    "a inexistência de conciliação entre os três sistemas paralelos configura deficiência de controle interno.",
    "a realização do inventário pelo próprio custodiante dos bens viola a segregação de funções.",
    "a equipe de auditoria deve emitir opinião adversa exclusivamente em razão dos achados descritos.",
    "os achados descritos devem ser comunicados aos responsáveis pela governança da entidade.",
    "a auditoria independente é responsável por implantar os controles internos que faltam à entidade.",
]

ITENS_MULTIPLA = [
    (
        "Com relação à situação descrita no texto precedente, assinale a opção correta.",
        [
            "A conciliação entre os sistemas paralelos é dispensável quando há inventário anual.",
            "A segregação de funções foi observada, pois o custodiante conhece melhor os bens.",
            "A deficiência de controle interno identificada deve ser comunicada por escrito.",
            "A auditoria deve abster-se de emitir relatório enquanto os sistemas não forem unificados.",
            "A entidade deve contratar segunda firma de auditoria para conciliar os sistemas.",
        ],
    ),
    (
        "Considerando a estrutura dos papéis de trabalho, assinale a opção correta.",
        [
            "O papel de trabalho é propriedade da entidade auditada.",
            "O papel de trabalho registra a evidência que sustenta a conclusão do auditor.",
            "O papel de trabalho substitui o relatório do auditor independente.",
            "O papel de trabalho é dispensável quando a equipe é a mesma do ano anterior.",
            "O papel de trabalho deve ser descartado ao fim do trabalho.",
        ],
    ),
]


def ce_duas_colunas(destino: Path) -> Path:
    f = Folha(destino, colunas=2)
    f.escrever("Texto CB1A1-I", negrito=True)
    f.escrever(TEXTO_APOIO)
    f.escrever("")
    f.escrever("Considerando o texto precedente, julgue os itens a seguir.")
    for i, item in enumerate(ITENS_CE, start=1):
        f.escrever(f"{i} {item}")
    f.escrever("Espaço livre.")
    f.salvar()
    return destino


def multipla_escolha(destino: Path) -> Path:
    f = Folha(destino, colunas=2)
    f.escrever("Texto CB2A1-I", negrito=True)
    f.escrever(TEXTO_APOIO)
    for i, (enunciado, alternativas) in enumerate(ITENS_MULTIPLA, start=1):
        f.escrever(f"{i} {enunciado}")
        for letra, alt in zip("ABCDE", alternativas):
            f.escrever(f"{letra} {alt}", recuo=10)
    f.salvar()
    return destino


def com_tabela(destino: Path) -> Path:
    f = Folha(destino, colunas=1)
    f.escrever("Texto CB3A1-I", negrito=True)
    f.escrever("Considere a tabela de barcaças fictícias a seguir.")
    f.tabela([["Sistema", "Barcaças", "Valor"], ["Alfa", "12", "1.000"], ["Beta", "9", "800"]])
    f.escrever("Com base na tabela precedente, julgue o item a seguir.")
    f.escrever("1 a divergência entre os sistemas indica falha de conciliação.")
    f.salvar()
    return destino


def pagina_sem_texto(destino: Path) -> Path:
    """Simula prova escaneada: página sem camada de texto (só um retângulo)."""
    c = canvas.Canvas(str(destino), pagesize=A4)
    c.rect(60, 300, 400, 300, fill=0)
    c.save()
    return destino


def gabarito_definitivo(destino: Path, respostas: dict[int, str]) -> Path:
    c = canvas.Canvas(str(destino), pagesize=A4)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGEM, ALTURA - 60, "GABARITO DEFINITIVO")
    c.setFont("Helvetica", 10)
    y = ALTURA - 90
    for numero, letra in sorted(respostas.items()):
        c.drawString(MARGEM, y, f"{numero} {letra}")
        y -= 16
    c.save()
    return destino


def gerar_todas(dir_saida: Path | None = None) -> dict[str, Path]:
    d = dir_saida or AQUI
    d.mkdir(parents=True, exist_ok=True)
    return {
        "ce": ce_duas_colunas(d / "ce_2colunas.pdf"),
        "multipla": multipla_escolha(d / "multipla_5.pdf"),
        "tabela": com_tabela(d / "com_tabela.pdf"),
        "sem_texto": pagina_sem_texto(d / "pagina_sem_texto.pdf"),
        "gabarito_ce": gabarito_definitivo(
            d / "Gab_Definitivo_ce.pdf", {1: "C", 2: "C", 3: "E", 4: "C", 5: "E"}
        ),
        "gabarito_multipla": gabarito_definitivo(d / "Gab_Definitivo_multipla.pdf", {1: "C", 2: "B"}),
    }


if __name__ == "__main__":
    for nome, caminho in gerar_todas().items():
        print(f"{nome}: {caminho}")
