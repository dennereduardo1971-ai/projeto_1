# Plano do produto — app de estudos para concurso fiscal (Cebraspe)

Documento vivo. Consolida as decisões tomadas e o que será construído.

**Versão visual (leitura fácil):** https://claude.ai/code/artifact/89c8b7e9-d8ab-4ff2-958d-8ff126e0c7d6
Base de pesquisa: [`01-pesquisa-mercado.md`](./01-pesquisa-mercado.md). Perguntas em aberto: [`02-decisoes-em-aberto.md`](./02-decisoes-em-aberto.md).

---

## 1. Decisões travadas

| Tema | Decisão |
|---|---|
| **Natureza do app** | Organizador de estudos + revisão espaçada, **com** banco de questões próprio (integrado, não separado) |
| **Público** | Quem trabalha e estuda ~2h/dia, em blocos picados |
| **Concurso alvo** | Carreira **Fiscal / Receita / Sefaz** — usado como caso de teste real |
| **Banca** | **Cebraspe** apenas, no início |
| **Matérias iniciais** | **Auditoria** e **Direito Civil** |
| **Origem das questões** | Coleta de **provas oficiais em PDF** (com atribuição de banca/ano/órgão/cargo) |
| **Planejamento** | **Ciclo de estudos** (fila que não pune atraso). Cronograma fica para depois |
| **Revisão** | **FSRS** (algoritmo moderno), com a matemática escondida do usuário |
| **Plataforma** | **Web app / PWA** primeiro — celular e computador, sem loja |
| **Offline** | **Fora do escopo.** Usuário sempre tem internet — esforço realocado para conteúdo |
| **Tom** | Sóbrio e adulto, com streak, meta semanal e lembrete de revisão. Sem mascote |
| **Objetivo** | Começa pessoal; monetização só se pegar tração |

### Escopo do MVP (tudo que foi marcado)
1. Mapa do edital + ciclo de estudos
2. Fila de revisão FSRS
3. Resolver questões Cebraspe + caderno de erros automático
4. Estatísticas e diagnóstico
5. **Material de leitura esquematizado**, derivado dos assuntos que as questões cobram

> **Alerta honesto de escopo:** esses 5 pilares juntos não são "um MVP", são o produto v1 completo. Vou construir em fases numeradas, cada uma já utilizável sozinha — você usa desde a Fase 1 e me diz o que ajustar antes de eu seguir. Nada é cortado, só sequenciado.

---

## 2. A ideia central do app

> **Uma linha do edital é a unidade de tudo.**

Cada item do edital verticalizado carrega, ao mesmo tempo: o esquema de leitura, as questões que já caíram dele, seus acertos e erros, e as revisões agendadas. Nenhum concorrente costura essas quatro coisas na mesma unidade — é exatamente por isso que o concurseiro hoje opera Qconcursos + planilha + Anki + PDF do cursinho em paralelo.

O ciclo de fechamento é:

```
Esquema (leitura)  →  Questões do assunto  →  Erro  →  Card de revisão (FSRS)
      ↑                                                        │
      └──────── esquema destaca o ponto que você errou ─────────┘
```

E o **Mapa do Edital** é a tela inicial: cada linha pintada por domínio real (não estudado → estudado → praticado → dominado), alimentada automaticamente pelo que você faz, sem você marcar nada à mão.

---

## 3. Regras específicas do Cebraspe (não são detalhe, são o produto)

1. **Certo/Errado com placar líquido.** Erro anula acerto. O placar do app é `acertos − erros`, nunca % bruto — senão o número mente.
2. **Estratégia de chute é conteúdo.** O app mostra seu saldo líquido por assunto e sugere onde deixar em branco compensa.
3. **Pegadinha semântica.** Cebraspe troca "poderá" por "deverá", "até" por "no mínimo". O caderno de erros marca o *tipo* de erro: conteúdo desconhecido × leitura apressada × pegadinha semântica × mudança de lei.
4. **Confiança declarada.** Ao responder, um toque: *chutei / fiquei na dúvida / tinha certeza*. Acertar chutando não é domínio — sem isso, a estatística engana. Nenhum concorrente mede isso.
5. **Questões anuladas e desatualizadas** precisam de marcação própria (lei alterada, jurisprudência superada) e de um botão "reportar erro".

---

## 4. Arquitetura de conteúdo

### 4.1 Taxonomia (dado canônico, reutilizável entre concursos)

```
Disciplina  →  Assunto  →  Tópico
```
Início: **Auditoria** e **Direito Civil**, com árvore desenhada a partir das provas coletadas (é a prova quem revela o que a banca chama de assunto, não o índice do livro).

### 4.2 Edital

```
Concurso → Cargo → Edital(versão) → ItemDeEdital (a linha literal)
                                        └── mapeia para 1..n Assuntos
```
O edital é copiado **literalmente** — o concurseiro precisa reconhecer a frase do edital. O vínculo com a taxonomia é o que liga tudo ao conteúdo.

### 4.3 Modelo de dados (Postgres / Supabase)

```
-- Conteúdo
disciplina(id, nome)
assunto(id, disciplina_id, nome, pai_id)              -- árvore
concurso(id, nome, orgao, banca, ano)
cargo(id, concurso_id, nome)
edital(id, cargo_id, versao, publicado_em)
item_edital(id, edital_id, ordem, texto_literal, disciplina_id)
item_edital_assunto(item_edital_id, assunto_id)       -- n:n

prova(id, concurso_id, cargo_id, banca, ano, url_pdf, url_gabarito)
questao(id, prova_id, numero, tipo, enunciado, texto_apoio_id,
        gabarito, anulada, desatualizada, fonte_citacao)
questao_assunto(questao_id, assunto_id)
alternativa(id, questao_id, letra, texto)              -- só p/ múltipla escolha

esquema(id, assunto_id, titulo, atualizado_em)         -- material esquematizado
esquema_secao(id, esquema_id, ordem, tipo, conteudo_md)
   -- tipo: conceito | lei_seca | tabela_comparativa | pegadinha_da_banca | sumula

-- Usuário
usuario(id, ...)
plano(id, usuario_id, edital_id, horas_semana, data_prova, tipo)   -- tipo=ciclo
bloco_ciclo(id, plano_id, disciplina_id, minutos, ordem, peso)
sessao(id, usuario_id, bloco_ciclo_id, inicio, fim, tipo)          -- teoria|questoes|revisao
resposta(id, usuario_id, questao_id, marcada, correta, segundos,
         confianca, tipo_erro, respondida_em)
card(id, usuario_id, origem, questao_id, assunto_id, frente, verso)
revisao(id, card_id, devida_em, estabilidade, dificuldade, ultima_nota)  -- FSRS
progresso_item(usuario_id, item_edital_id, minutos, liquido, ultima_revisao, nivel)
```

`progresso_item.nivel` é derivado (não digitado): `não estudado → estudado → praticado → dominado`, calculado de minutos de sessão + saldo líquido + confiança + revisões em dia.

### 4.4 Pipeline de ingestão de questões (Cebraspe)

```
1. Baixar PDF da prova + gabarito oficial do site da banca/órgão
2. Extrair texto preservando layout (pdfplumber / OCR quando escaneado)
3. Segmentar em questões  ← ponto mais frágil; Cebraspe usa blocos de
   texto de apoio compartilhados por várias questões
4. Casar com o gabarito oficial (e com a lista de anuladas)
5. Classificar por disciplina/assunto (LLM + revisão manual por amostragem)
6. Registrar fonte: banca, ano, órgão, cargo, número da questão
7. Revisão humana antes de publicar (você aprova em lote)
```
Cada etapa vira um script versionado no repositório, para reprocessar quando o parser melhorar.

**Jurídico:** o TJ-SP (2024) já decidiu que questão de prova, por si só, não tem proteção autoral. A regra que o projeto segue: **sempre atribuir a origem, nunca copiar comentário/explicação de terceiro, nunca sugerir autoria própria.** Comentários e esquemas são conteúdo original nosso.

### 4.5 Material esquematizado

Derivado da realidade da prova, não do livro:
- A unidade é o **Assunto** (e por tabela de ligação chega ao item do edital).
- Cada esquema tem seções tipadas: **conceito curto**, **lei seca** (artigo literal, quando for lei), **tabela comparativa** (o que a banca confunde), **pegadinha da banca** (padrões extraídos das questões daquele assunto), **súmula/jurisprudência**.
- **Prioridade de escrita = incidência**: o assunto com mais questões coletadas ganha esquema primeiro. Assunto que nunca caiu, não ganha esquema.
- Geração assistida por IA a partir das questões + revisão sua antes de publicar. O esquema cita as questões de onde saiu.
- No app, o esquema é lido com **destaque nos pontos que você errou** naquele assunto.

---

## 5. Telas

| Tela | Função |
|---|---|
| **Hoje** | Fila única: revisões devidas + bloco do ciclo + questões sugeridas. É a home. |
| **Mapa do edital** | Lista literal do edital pintada por nível de domínio; toca e abre o assunto. |
| **Assunto** | Esquema de leitura + questões + seu histórico ali dentro. |
| **Questões** | Resolver com filtro (assunto, ano, cargo), C/E com placar líquido, confiança declarada. |
| **Caderno de erros** | Erros agrupados por tipo e assunto; botão "virar card". |
| **Revisão** | Fila FSRS, sem matemática à vista. |
| **Estatísticas** | Líquido por assunto × tempo × confiança; ranking de prioridade; evolução semanal. |
| **Ciclo** | Blocos por disciplina, minutos, ordem; cronômetro e registro. |

---

## 6. Stack

| Camada | Escolha | Porquê |
|---|---|---|
| Front | React + TypeScript + Tailwind (PWA instalável) | Roda no celular e no PC, publica por link |
| Backend/DB | **Supabase** (Postgres + Auth + Storage) | Já conectado neste ambiente; Postgres é ideal para a taxonomia relacional |
| Hospedagem | **Netlify** | Já conectado; publica em minutos |
| FSRS | biblioteca open source (`ts-fsrs`) | Não reinventar algoritmo de memória |
| Ingestão | Python (pdfplumber + LLM p/ classificação) | Scripts versionados, rodados sob demanda |

---

## 7. Roadmap por fases (cada fase é utilizável sozinha)

| Fase | Entrega | Você consegue... |
|---|---|---|
| **0** | Esqueleto: app publicado, login, banco criado, taxonomia de Auditoria e Direito Civil | Entrar e ver o app de pé |
| **1** | Edital do concurso alvo cadastrado + Mapa do Edital + ciclo de estudos com cronômetro | Planejar e registrar estudo de verdade |
| **2** | Pipeline de ingestão + primeiras provas Cebraspe + tela de resolver questões (C/E, placar líquido, confiança) + caderno de erros | Treinar questão de banca com estatística honesta |
| **3** | Fila FSRS unificada + erro vira card automaticamente + streak e lembrete | Ter motivo para abrir o app todo dia |
| **4** | Material esquematizado dos assuntos de maior incidência | Estudar teoria dentro do app |
| **5** | Estatísticas e diagnóstico (prioridade, falso domínio, evolução) | Saber onde investir a próxima hora |

---

## 8. Perguntas ainda abertas

1. Você quer que eu escreva o código no repositório (você versiona, roda e publica) ou prefere montar no **Lovable** (edição visual, mais rápido de mexer sem programar)?
2. Qual concurso/órgão exatamente? (Receita Federal, Sefaz de qual estado, ISS de qual município) — preciso do edital certo para semear o Mapa.
3. Tem os PDFs de provas Cebraspe que quer usar, ou eu busco as provas públicas?
4. Você aceita esquemas **gerados com IA e revisados por você** antes de publicar, ou quer escrever tudo à mão?
5. Nome do app já existe ou eu proponho opções?
