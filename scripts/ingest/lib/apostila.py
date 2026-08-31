"""Parser de apostila comentada de terceiro (pivô 2026-08-31, CLAUDE.md regras 3-5).

Layout confirmado nos dois PDFs de amostra da Gran Cursos (Marcelo Aragão —
"Amostragem em Auditoria Contábil, NBC TA 530"; Carlos Elias — "Obrigações —
Parte I"). Ver `docs/agents/coletor.md` → Decisões/Armadilhas para o histórico
completo da calibração. Resumo do que este módulo assume:

- O cabeçalho fixo (3 linhas: título do livro / subtítulo / autor) e o rodapé
  fixo (aviso de licença + "N de M" + "gran.com.br") já foram cortados por
  `perfil.layout.margem_topo_frac`/`margem_rodape_frac` dentro de
  `3_extrair.py` — este módulo recebe só o miolo da página.
- "Negrito" aqui é glifo duplicado, não fonte bold: pdfplumber extrai o
  prefixo do item e os títulos de seção com CADA CARACTERE repetido
  ("008." → "000088..", "GABARITO" → "GGAABBAARRIITTOO"). `_desdobrar_negrito`
  desfaz isso — e só deve ser aplicado a trechos curtos (prefixo, linha de
  cabeçalho), nunca ao corpo do parágrafo, onde uma palavra pode ter letra
  dobrada de verdade ("carro", "passe").
- A fonte usada nos títulos de seção também troca a caixa de algumas letras
  por conta própria (ex.: "APRESENTAÇÃO" desdobra para "APreSeNtAÇÃO"). Por
  isso `_cabecalho` compara em maiúsculas, nunca a string crua.
- Estrutura por capítulo: [prosa do capítulo] → [EXERCÍCIOS] e/ou [QUESTÕES
  COMENTADAS EM AULA] + [QUESTÕES DE CONCURSO] → GABARITO (grade compacta) →
  GABARITO COMENTADO (repete item + comentário do autor). A MESMA questão
  também aparece embutida na prosa do capítulo, como exemplo de aula, ANTES
  da primeira seção reconhecida — por isso `extrair_itens`/`extrair_grade`/
  `extrair_comentarios` só processam linhas que caem DENTRO de uma seção
  conhecida; tudo antes da primeira seção é ignorado de propósito.
- A numeração de item é CONTÍNUA entre EXERCÍCIOS/QUESTÕES COMENTADAS EM
  AULA/QUESTÕES DE CONCURSO quando mais de uma dessas seções existe no mesmo
  documento (não reinicia em 1 na segunda seção).
- Tipo é por questão, não por documento: a mesma apostila mistura Certo/Errado
  e múltipla escolha. A grade do GABARITO decide: maiúscula (C/E) = Certo ou
  Errado; minúscula (a-e) = letra de múltipla escolha.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .modelos import Alternativa, Artefato, Prova, Questao, STATUS_PUBLICAVEL

# ── negrito duplicado ─────────────────────────────────────────────────────
_RE_PAR = re.compile(r"(.)\1")


def _desdobrar_negrito(prefixo: str) -> str:
    """Desfaz o glifo duplicado: 'GGAABB' -> 'GAB'.

    Um único passe (não-sobreposto, esquerda→direita) é suficiente: o PDF
    dobra cada caractere exatamente uma vez, nunca mais. Aplicar isto a um
    trecho longo de texto corrido corromperia palavra com letra dobrada
    legítima — por isso os únicos chamadores são `_item` (só o prefixo
    numérico) e `_cabecalho` (só linhas curtas, já filtradas por tamanho).
    """
    return _RE_PAR.sub(r"\1", prefixo)


# ── cabeçalhos de seção conhecidos ────────────────────────────────────────
CABECALHOS = frozenset(
    {
        "EXERCÍCIOS",
        "QUESTÕES COMENTADAS EM AULA",
        "QUESTÕES DE CONCURSO",
        "GABARITO",
        "GABARITO COMENTADO",
        "RESUMO",
        "SUMÁRIO",
        "APRESENTAÇÃO",
    }
)
# Seções cujo conteúdo é lista de itens (entram em `extrair_itens`).
CABECALHOS_ITENS = frozenset({"EXERCÍCIOS", "QUESTÕES COMENTADAS EM AULA", "QUESTÕES DE CONCURSO"})

_TAM_MAX_CABECALHO = 40  # heurística: título de seção real é curto


def _cabecalho(linha: str) -> str | None:
    """Devolve o rótulo canônico (maiúsculo) se a linha for um cabeçalho de
    seção conhecido, senão None.

    O limite de tamanho é sobre o texto JÁ DESDOBRADO — não sobre o texto
    cru: um título bold-duplicado como "QUESTÕES COMENTADAS EM AULA" tem
    ~51 caracteres crus (cada caractere dobrado) mas só 28 depois de
    desdobrar. Cortar pelo tamanho cru rejeitaria esse cabeçalho por engano.
    """
    bruto = linha.strip()
    if not bruto:
        return None
    desdobrado = _desdobrar_negrito(bruto).strip()
    if len(desdobrado) > _TAM_MAX_CABECALHO:
        return None
    rotulo = desdobrado.upper()
    return rotulo if rotulo in CABECALHOS else None


# ── marcador de item: "NNN. (BANCA/.../ANO[/ADAPTADA]) enunciado..." ─────
# O prefixo (dígitos + ponto) sai duplicado do PDF; a citação entre
# parênteses e o resto do enunciado saem normais (só o número é bold).
_RE_ITEM = re.compile(r"^(?P<prefixo>[\d.]+)\s+\((?P<citacao>[^)]+)\)\s*(?P<resto>.*)$")


def _item(linha: str) -> tuple[int, str, str] | None:
    """Casa o marcador de item. Devolve (numero, citacao, resto) ou None."""
    m = _RE_ITEM.match(linha.strip())
    if not m:
        return None
    prefixo = _desdobrar_negrito(m.group("prefixo")).rstrip(".")
    if not prefixo.isdigit():
        return None
    return int(prefixo), m.group("citacao").strip(), m.group("resto").strip()


# Alternativa de múltipla escolha: "a) texto...". Minúscula sempre — é o que
# o template da Gran usa; maiúscula nesta posição não foi observada.
_RE_ALTERNATIVA = re.compile(r"^(?P<letra>[a-e])\)\s+(?P<resto>\S.*)$")


def _texto(partes: list[str]) -> str:
    return " ".join(p.strip() for p in partes if p.strip()).strip()


@dataclass
class ItemBruto:
    """Questão ainda sem gabarito/comentário — só o que veio da lista de itens."""

    numero: int
    citacao: str
    enunciado: str
    alternativas: list[Alternativa] = field(default_factory=list)
    pagina: int = 1


# ── extração ───────────────────────────────────────────────────────────────
def extrair_itens(linhas: list[dict]) -> dict[int, ItemBruto]:
    """Varre EXERCÍCIOS/QUESTÕES COMENTADAS EM AULA/QUESTÕES DE CONCURSO.

    Ignora tudo fora dessas seções — em particular a mesma questão embutida
    como exemplo na prosa do capítulo, antes da primeira seção reconhecida.
    """
    itens: dict[int, ItemBruto] = {}
    capturando = False
    atual: dict[str, Any] | None = None

    def fechar() -> None:
        nonlocal atual
        if atual is not None:
            alternativas = [
                Alternativa(letra=letra.upper(), texto=texto) for letra, texto in atual["alternativas"]
            ]
            itens[atual["numero"]] = ItemBruto(
                numero=atual["numero"],
                citacao=atual["citacao"],
                enunciado=_texto(atual["enunciado"]),
                alternativas=alternativas,
                pagina=atual["pagina"],
            )
        atual = None

    for linha in linhas:
        texto = (linha.get("texto") or "").strip()
        if not texto:
            continue
        cab = _cabecalho(texto)
        if cab in CABECALHOS_ITENS:
            fechar()
            capturando = True
            continue
        if cab is not None:
            fechar()
            capturando = False
            continue
        if not capturando:
            continue

        m = _item(texto)
        if m:
            fechar()
            numero, citacao, resto = m
            atual = {
                "numero": numero,
                "citacao": citacao,
                "enunciado": [resto] if resto else [],
                "alternativas": [],
                "pagina": linha.get("pagina", 1),
            }
            continue

        if atual is None:
            continue

        m_alt = _RE_ALTERNATIVA.match(texto)
        if m_alt:
            atual["alternativas"].append([m_alt.group("letra"), m_alt.group("resto").strip()])
            continue

        if atual["alternativas"]:
            atual["alternativas"][-1][1] = _texto([atual["alternativas"][-1][1], texto])
        else:
            atual["enunciado"].append(texto)

    fechar()
    return itens


# Grade compacta: "1. C 35. b" — vários pares número/resposta por linha.
# Maiúscula = Certo/Errado; minúscula = letra de múltipla escolha.
_RE_GRADE_ANULADA = re.compile(r"\b(?P<numero>\d{1,3})\.\s*ANULAD[OA]\b", re.I)
_RE_GRADE_ITEM = re.compile(r"\b(?P<numero>\d{1,3})\.\s*(?P<letra>[A-Ea-e])\b")


def extrair_grade(linhas: list[dict]) -> dict[int, dict]:
    """Varre a seção GABARITO (não GABARITO COMENTADO) e devolve
    `{numero: {"resposta": "C"|letra maiúscula|None, "tipo": "ce"|"multipla"|None, "anulada": bool}}`.
    """
    grade: dict[int, dict] = {}
    dentro = False
    for linha in linhas:
        texto = (linha.get("texto") or "").strip()
        if not texto:
            continue
        cab = _cabecalho(texto)
        if cab == "GABARITO":
            dentro = True
            continue
        if cab is not None:
            dentro = False
            continue
        if not dentro:
            continue

        for m in _RE_GRADE_ANULADA.finditer(texto):
            grade[int(m.group("numero"))] = {"resposta": None, "tipo": None, "anulada": True}
        for m in _RE_GRADE_ITEM.finditer(texto):
            numero = int(m.group("numero"))
            if grade.get(numero, {}).get("anulada"):
                continue
            letra = m.group("letra")
            tipo = "ce" if letra.isupper() else "multipla"
            grade[numero] = {"resposta": letra.upper(), "tipo": tipo, "anulada": False}
    return grade


# Salto vertical (pt) que separa a repetição do item (linhas de um mesmo
# parágrafo, ~5-7pt de espaço entre `bottom` da anterior e `top` da atual nos
# dois PDFs de amostra) do início do comentário autoral (~28-52pt de salto,
# folga de parágrafo do template da Gran). Medido nos dois PDFs de amostra —
# ver docs/agents/coletor.md → Armadilhas antes de mexer neste número.
_GAP_PARAGRAFO = 20.0

# Topo típico da primeira linha de conteúdo de uma página (miolo já cortado
# pelo perfil), medido nos dois PDFs de amostra: 97.7-98.4pt. Serve de
# "bottom anterior" sintético quando o item cruza página, para o MESMO teste
# de salto valer sem depender de heurística por página — armadilha real: o
# gerador deste PDF NÃO recolhe o espaço "antes do parágrafo" quando o
# parágrafo cai bem no topo de uma página nova (ao contrário do que se
# esperaria), então um comentário que começa exatamente no topo de uma
# página ainda assim carrega o salto de parágrafo (a linha fica uns 20pt
# mais abaixo do que uma simples quebra de linha cruzando página ficaria).
_TOPO_CORPO_PAGINA = 100.0


def extrair_comentarios(linhas: list[dict]) -> dict[int, str]:
    """Varre GABARITO COMENTADO: repete `NNN. (citação) enunciado` + eventuais
    alternativas, depois o comentário do autor, terminando em 'Certo.',
    'Errado.' ou 'Letra X.'.

    Pula a repetição do item (já veio de `extrair_itens`) usando o salto
    vertical entre linhas como fronteira: linhas da repetição ficam coladas
    (mesmo parágrafo do PDF, ~5-7pt de espaço); o comentário começa depois de
    um salto maior (nova "caixa" de texto no template, ~28-52pt). Decidido
    SÓ pelo salto — não pelo formato da linha: o autor às vezes analisa cada
    alternativa em linha própria dentro do comentário ("a) Certa. ...",
    "b) Errada. ..."), que bateria com o marcador de alternativa se ele fosse
    consultado aqui, e o comentário inteiro seria perdido.
    """
    comentarios: dict[int, str] = {}
    dentro = False
    numero_atual: int | None = None
    modo: str | None = None  # "repeticao" | "comentario"
    buffer: list[str] = []
    anterior: tuple[float, int] | None = None  # (bottom, pagina) da linha anterior

    def fechar() -> None:
        nonlocal numero_atual, buffer
        if numero_atual is not None and buffer:
            comentarios[numero_atual] = _texto(buffer)
        numero_atual, buffer = None, []

    for linha in linhas:
        texto = (linha.get("texto") or "").strip()
        if not texto:
            continue
        cab = _cabecalho(texto)
        if cab == "GABARITO COMENTADO":
            dentro = True
            anterior = None
            continue
        if cab is not None:
            fechar()
            dentro = False
            continue
        if not dentro:
            continue

        pagina = linha.get("pagina", 1)
        topo = float(linha.get("top", 0.0))
        base = float(linha.get("bottom", topo))

        m = _item(texto)
        if m:
            fechar()
            numero_atual = m[0]
            modo = "repeticao"
            anterior = (base, pagina)
            continue

        if numero_atual is None:
            continue

        if modo == "repeticao":
            mesma_pagina = anterior is not None and anterior[1] == pagina
            if mesma_pagina:
                gap = topo - anterior[0]
            else:
                # Cruzou página: usa um "bottom anterior" sintético próximo
                # do topo padrão do corpo (ver _TOPO_CORPO_PAGINA) para que o
                # mesmo teste de salto sirva tanto pra "alternativa quebrada
                # entre páginas" (gap pequeno) quanto pra "comentário que por
                # acaso começa no topo de uma página nova" (gap grande).
                gap = topo - (_TOPO_CORPO_PAGINA - 6.0)
            if gap > _GAP_PARAGRAFO:
                modo = "comentario"
                buffer.append(texto)
            # senão: continuação do enunciado ou das alternativas repetidas — descarta
        else:
            buffer.append(texto)

        anterior = (base, pagina)

    fechar()
    return comentarios


def montar_questoes(
    itens: dict[int, ItemBruto], grade: dict[int, dict], comentarios: dict[int, str]
) -> list[Questao]:
    """Cruza os três dicionários. Só monta o dado — a barreira de publicação
    (gabarito presente, revisado_humano, classificação) roda no validador,
    mais adiante no pipeline (7_publicar / 8_revisar)."""
    questoes: list[Questao] = []
    for numero in sorted(itens):
        item = itens[numero]
        entrada = grade.get(numero)
        anulada = bool(entrada and entrada.get("anulada"))
        tipo = "multipla" if item.alternativas else "ce"
        gabarito = None if anulada else (entrada.get("resposta") if entrada else None)
        citacao = f"({item.citacao}) " if item.citacao else ""
        questoes.append(
            Questao(
                numero=numero,
                tipo=tipo,
                enunciado=f"{citacao}{item.enunciado}".strip(),
                pagina=item.pagina,
                alternativas=list(item.alternativas),
                gabarito=gabarito,
                anulada=anulada,
                revisado_humano=False,
                comentario=comentarios.get(numero),
            )
        )
    return questoes


def dividir_por_tipo(questoes: list[Questao]) -> dict[str, list[Questao]]:
    """Separa por `tipo` — vira uma PROVA por tipo (CLAUDE.md regra 2:
    `formato`/`penalidade_por_erro` são atributos da prova, não da questão)."""
    partes: dict[str, list[Questao]] = {"ce": [], "multipla": []}
    for q in questoes:
        partes.setdefault(q.tipo, []).append(q)
    return partes


def processar(slug_base: str, perfil: Any, meta: dict | None, texto_doc: dict) -> list[tuple[str, Artefato]]:
    """Entry point chamado por `run.py` no lugar de 4_segmentar/5_gabarito
    quando `perfil.prova.get("origem_fonte") == "apostila_comentada"`.

    Devolve `[(f"{slug_base}_ce", Artefato), (f"{slug_base}_multipla", Artefato)]`,
    omitindo o lado que ficar vazio.
    """
    descartaveis = perfil.descartaveis()
    linhas: list[dict] = []
    for pagina in texto_doc.get("paginas", []):
        numero_pagina = pagina.get("numero", 1)
        for linha in pagina.get("linhas", []):
            bruto = (linha.get("texto") or "").strip()
            if not bruto or any(p.search(bruto) for p in descartaveis):
                continue
            linhas.append({**linha, "texto": bruto, "pagina": numero_pagina})

    itens = extrair_itens(linhas)
    grade = extrair_grade(linhas)
    comentarios = extrair_comentarios(linhas)
    questoes = montar_questoes(itens, grade, comentarios)

    prova_meta = {**perfil.prova, **(meta or {})}
    autor_fonte = prova_meta.get("autor_fonte")
    titulo_fonte = prova_meta.get("titulo_fonte")
    disciplina = prova_meta.get("disciplina")
    assunto = prova_meta.get("assunto")

    avisos: list[str] = []
    if not autor_fonte or not titulo_fonte:
        avisos.append(
            "autor_fonte/titulo_fonte ausentes no perfil — obrigatórios para "
            "apostila_comentada (CLAUDE.md, regra 4)"
        )
    if not assunto:
        avisos.append("assunto ausente no perfil `prova:` — questões ficam sem classificação")
    if not itens:
        avisos.append("nenhum item reconhecido — o perfil ou o layout não bate com este PDF")

    sem_gabarito = sorted(n for n in itens if n not in grade)
    if sem_gabarito:
        avisos.append(f"itens sem entrada na grade GABARITO: {sem_gabarito}")
    sem_comentario = sorted(
        n for n in itens if n not in comentarios and not (grade.get(n) or {}).get("anulada")
    )
    if sem_comentario:
        avisos.append(f"itens sem comentário em GABARITO COMENTADO: {sem_comentario}")

    # Apostila é monotemática (CLAUDE.md, esta seção do coletor): classificação
    # vem direto do perfil da prova, com confiança máxima — sem classificador
    # de 2 passadas. 6_classificar.py pula o LLM quando vê confiança 1.0.
    for q in questoes:
        q.disciplina = disciplina
        q.assunto = assunto
        q.classificacao_confianca = 1.0
        q.classificacao_metodo = "apostila:monotematica"

    partes = dividir_por_tipo(questoes)
    fonte_pdf = f"arquivo local: {texto_doc.get('pdf', '')}"
    gerado_em = datetime.now(timezone.utc).isoformat(timespec="seconds")

    resultado: list[tuple[str, Artefato]] = []
    for tipo in ("ce", "multipla"):
        qs = partes.get(tipo) or []
        if not qs:
            continue
        sub_slug = f"{slug_base}_{tipo}"
        prova = Prova(
            slug=sub_slug,
            formato=tipo,
            penalidade_por_erro=(tipo == "ce"),
            origem_fonte="apostila_comentada",
            autor_fonte=autor_fonte,
            titulo_fonte=titulo_fonte,
            fonte_pdf=fonte_pdf,
            sha256_pdf=texto_doc.get("sha256_pdf"),
            perfil=perfil.nome,
        )
        artefato = Artefato(
            prova=prova,
            status=STATUS_PUBLICAVEL,
            gerado_em=gerado_em,
            questoes=qs,
            avisos=list(avisos),
        )
        resultado.append((sub_slug, artefato))
    return resultado
