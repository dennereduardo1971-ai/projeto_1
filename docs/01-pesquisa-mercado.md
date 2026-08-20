# Pesquisa de mercado — app para concurseiros

> Documento de pesquisa que embasa as decisões de produto do projeto.
> Data: agosto/2026. Fontes citadas ao final.

---

## 1. O tamanho e o comportamento do mercado

- O **CNU 2024** (1ª edição) teve **mais de 2,1 milhões de inscritos** para 6.640 vagas — recorde histórico no Brasil. Ausência de 54,12% (970 mil fizeram a prova).
- O **CNU 2025** (2ª edição, FGV) teve **761 mil inscritos** em 9 blocos temáticos, 3.652 vagas, 32 órgãos, 228 municípios.
- **Não haverá CNU em 2026** (restrição do calendário eleitoral) — o público migra para concursos estaduais, municipais, tribunais, bancos e carreiras policiais nesse período.
- O mercado de **EdTech no Brasil** era de ~US$ 6,0 bi em 2025 com projeção de US$ 15,6 bi até 2034 (CAGR ~11%).

**Leitura para o produto:** o público é gigantesco, recorrente e sazonal (picos por edital). Mais importante: **a taxa de abandono é o verdadeiro problema** — mais da metade dos inscritos nem aparece na prova. Um app que ataca *constância e organização* endereça a dor #1, não a falta de conteúdo.

---

## 2. Quem já está no mercado (concorrência)

### 2.1 Bancos de questões (o "core" tradicional)

| Plataforma | Acervo | Preço aprox. | Força | Fraqueza |
|---|---|---|---|---|
| **Qconcursos** | 1,8–2 mi de questões | a partir de ~R$ 22–30/mês | Maior volume, filtros, cadernos, estatísticas, comunidade | App com nota ~3,1 na Play Store; reclamações recorrentes de erro de acesso, travamento, suporte fraco |
| **TEC Concursos** | ~400 mil+ (curadoria) | a partir de ~R$ 29,90/mês | Qualidade de comentário, comunidade forte de alunos | Acervo menor, interface datada |
| **Estratégia Questões** | 2 mi+ (850 mil comentadas) | dentro do combo de cursos | Integração com curso e PDF | Amarrado ao ecossistema pago do cursinho |
| **Gran Questões** | grande | combo | Integração com curso | Idem |

### 2.2 Apps de controle/organização de estudo

| App | O que faz | Modelo |
|---|---|---|
| **Aprovado** | Cronômetro, registro manual, gráficos, alarme, sync web, offline | Grátis + pacotes avulsos (ciclo, revisão automática, exercícios) |
| **Estudaqui** | Monta plano automático a partir da prova e da disponibilidade, ciclo, revisões programadas, estatísticas | Freemium com Premium mensal/tri/anual |
| **Estuda.com** | Questões + trilhas (foco ENEM/vestibular, mas usado por concurseiros) | Freemium |
| **Anki / AnkiDroid** | Repetição espaçada pura (SM-2/FSRS) | Grátis (iOS pago) |
| **EmÁudio / JurisVoz / audiobooks Estratégia** | Legislação e conteúdo em áudio para trajeto/academia | Assinatura |

### 2.3 O que ninguém faz bem (as brechas reais)

1. **Ninguém integra as três camadas.** Questões ficam no Qconcursos, planejamento no Estudaqui/planilha, revisão no Anki, áudio no EmÁudio. O concurseiro opera 4 ferramentas que não conversam. **Essa é a maior oportunidade do projeto.**
2. **O edital não é o eixo do app.** Quase todos organizam por "disciplina/assunto" genérico. O concurseiro pensa em **edital verticalizado**: cada linha do edital é uma unidade de estudo com status, % de acerto e data de revisão.
3. **Revisão espaçada só existe fora do app.** Quem usa Anki tem que criar os cards à mão. Ninguém transforma **erro em questão** automaticamente em card de revisão.
4. **Qualidade técnica baixa nos apps líderes.** Nota 3,1 na Play Store e reclamações de "app não abre / erro E04" são um convite a um concorrente com execução mobile decente e **offline de verdade**.
5. **Estudo por banca é superficial.** Todo mundo sabe que Cebraspe (Certo/Errado, erro anula acerto), FGV (enunciado longo, todas as alternativas plausíveis) e FCC (direta, técnica, cálculo) exigem treinos diferentes — mas nenhum app **treina a estratégia** (quando chutar no Cebraspe, gestão de tempo por questão, leitura de pegadinha).
6. **Nada é desenhado para quem trabalha.** O público real estuda 2h/dia em blocos picados, no ônibus, no intervalo. Falta microlearning e modo mãos-livres/áudio de primeira classe.

---

## 3. Como o concurseiro realmente estuda (metodologia que o app precisa suportar)

### 3.1 Cronograma × Ciclo de estudos
- **Cronograma:** dia fixo, matéria fixa. Dá segurança para iniciante, mas **quebra na primeira semana atípica** — e a pessoa abandona.
- **Ciclo:** fila de blocos de tempo por matéria; se você não estudou hoje, o bloco continua te esperando. **Sobrevive à vida real.**
- **Conclusão de produto:** o ciclo deve ser o padrão, com cronograma como opção. E o app precisa de "recuperação de atraso" sem punir.

### 3.2 Revisão espaçada
- Ciclo clássico citado pelo mercado: **24h → 7 dias → 30 dias**.
- Algoritmos: SM-2 (Anki clássico) e **FSRS** (mais moderno, prevê a probabilidade de lembrar). Recomendação: **FSRS**, com apresentação simplificada (o usuário não deveria ver "fator de facilidade").
- Volume saudável citado: 20–40 cards novos/dia.

### 3.3 Questões como método, não como acessório
- A prática recomendada é **estudar → resolver → analisar erro → revisar o erro**. O ponto fraco de todos os concorrentes é o passo 3–4.
- **Caderno de erros** é a funcionalidade mais pedida e a menos bem executada no mercado.

### 3.4 Perfil das bancas (regra de negócio real)

| Banca | Formato | Implicação para o app |
|---|---|---|
| **Cebraspe** | Certo/Errado; **erro anula acerto** | Placar precisa usar a fórmula líquida (C−E); precisa de "estratégia de chute" e treino de pegadinha semântica |
| **FGV** | Múltipla escolha, enunciado longo, alternativas plausíveis | Cronômetro por questão, treino de eliminação, marcação de "palavra-chave" |
| **FCC** | Múltipla escolha, direta, técnica, com cálculo | Treino de velocidade e caderno de fórmulas |
| **VUNESP/IBFC/Instituto AOCP etc.** | variados | Taxonomia de banca precisa ser dado de primeira classe, não uma tag |

---

## 4. Conteúdo: de onde vêm as questões (jurídico + operacional)

- **Jurisprudência favorável:** o TJ-SP (3ª Câmara de Direito Privado, 2024) decidiu que **questões de prova não gozam, por si só, de proteção autoral** — falta originalidade, é método de avaliação; e o acervo não configura "base de dados" protegida.
- **Boas práticas obrigatórias mesmo assim:** sempre **atribuir** banca, ano, órgão, cargo e prova de origem; nunca sugerir autoria própria; não copiar **comentários/explicações** de terceiros (esses sim são obra autoral protegida).
- **Fontes de coleta:** PDFs oficiais de provas e gabaritos publicados pelas bancas (Cebraspe, FGV, FCC, VUNESP, IBFC, Quadrix…) e por órgãos. Pipeline: download → OCR/parse → segmentação em questões → normalização → classificação por disciplina/assunto → vínculo com gabarito oficial.
- **Risco real não é o copyright, é o esforço:** parsear PDF de prova com fidelidade (imagens, tabelas, textos de apoio compartilhados por várias questões) é o item mais caro do projeto. Alternativas: começar com **poucas bancas e poucos anos**, ou **gerar questões inéditas com IA** a partir de lei seca (mais barato, menos fiel ao estilo da banca).
- **Comentários:** gerar explicação com IA (barato, escalável, exige revisão) × comentário de professor (caro, é o que Qconcursos/TEC vendem) × comentário colaborativo dos usuários (custo zero, exige moderação).

---

## 5. Arquitetura de conteúdo proposta (modelo de dados)

O eixo do app é o **edital verticalizado**. Estrutura em camadas:

```
Concurso  →  Cargo  →  Edital (versão)  →  ItemDeEdital  (a "linha" literal do edital)
                                              │
                    Disciplina → Assunto → Tópico  (taxonomia canônica, reutilizável)
                                              │
                       ┌──────────────────────┼───────────────────────┐
                    Questão                Material                 Card
              (banca, ano, órgão,     (resumo, lei seca,       (revisão espaçada,
               cargo, gabarito,        áudio, videoaula,        gerado do erro ou
               tipo C/E ou ME)         link externo)            criado à mão)
```

Entidades de progresso do usuário:

```
Usuário → PlanoDeEstudo (ciclo ou cronograma)
        → SessãoDeEstudo (tempo, matéria, tipo: teoria/questões/revisão)
        → Resposta (questão, acerto/erro, tempo gasto, confiança declarada)
        → RevisãoAgendada (FSRS: item, próxima data, estabilidade)
        → ProgressoNoEdital (por ItemDeEdital: %estudado, %acerto, última revisão)
```

**Sacada central:** `ProgressoNoEdital` é a tela principal do app. É o "mapa da prova": cada linha do edital pintada por cor conforme domínio (não estudado → estudado → praticado → dominado), alimentada automaticamente pelas respostas e sessões. Nenhum concorrente entrega isso bem.

**Confiança declarada** (o usuário marca "chutei / fiquei na dúvida / tinha certeza" ao responder) é um dado barato de coletar e ouro para diagnóstico: acertar chutando ≠ dominar. Isso permite detectar *falso domínio*, algo que nenhum concorrente mede.

---

## 6. Catálogo de funcionalidades (priorizado)

### MVP (o mínimo que já resolve a dor)
1. **Cadastro do edital verticalizado** (manual + importação de edital pronto para os concursos populares).
2. **Ciclo de estudos** com cronômetro, registro de sessão e retomada de atraso.
3. **Resolver questões** com filtro por disciplina/assunto/banca/ano + resposta com gabarito.
4. **Caderno de erros automático** → todo erro vira item de revisão.
5. **Revisão espaçada (FSRS)** com fila diária unificada (cards + questões erradas).
6. **Painel de progresso do edital** (o mapa colorido).
7. **Offline real** (fila de sincronização; estudar no metrô sem sinal).

### v1 (diferenciação)
8. **Modo banca**: simulado cronometrado com regra da banca (C/E com erro anulando acerto, tempo por questão, corte por bloco).
9. **Estatísticas úteis**: acerto por assunto × tempo médio × confiança; "assuntos que mais caem × seu desempenho" = ranking de prioridade.
10. **Plano gerado automaticamente** a partir de: data da prova + horas disponíveis + peso do assunto no edital + seu desempenho.
11. **Áudio / mãos-livres**: lei seca e resumos em TTS, com fila de reprodução ligada ao plano do dia.
12. **Microsessões** de 5–10 min ("tenho 7 minutos") — 5 questões do assunto mais atrasado.
13. **Simulados completos** com correção e comparação com outros usuários.

### v2 (retenção e receita)
14. **Gamificação sóbria**: streak, metas semanais, "horas líquidas", ligas por concurso — **sem infantilizar** (o público é adulto e ansioso; ranking mal calibrado aumenta abandono).
15. **Comunidade/comentários** por questão, com moderação e reputação.
16. **Grupos de estudo / accountability** (dupla de estudo, meta compartilhada).
17. **Assistente IA**: explica erro, gera flashcard do erro, resume PDF do aluno, gera questões inéditas do assunto fraco.
18. **Redação/discursiva** com correção assistida por IA + rubrica da banca.
19. **Importação de PDF do cursinho** → vira material vinculado ao item do edital.

### Coisas que parecem boas e provavelmente não são (para o MVP)
- Videoaulas próprias (custo altíssimo, concorrência estabelecida).
- Rede social completa (moderação cara, valor incerto).
- Cobertura de "todas as bancas e todos os anos" no dia 1 (é o que trava o lançamento).

---

## 7. Modelos de negócio possíveis

| Modelo | Como funciona | Prós | Contras |
|---|---|---|---|
| **Freemium** (recomendado) | Organização/plano/ciclo grátis; questões ilimitadas, simulados, IA e estatísticas avançadas no Pro | Aquisição barata, valor demonstrável antes de pagar | Precisa de disciplina no corte de funcionalidades |
| Assinatura pura | R$ X/mês desde o dia 1 | Receita previsível | Barreira alta contra Qconcursos a R$ 22–30 |
| Pacotes avulsos (modelo Aprovado) | Compra recursos separados | Sem compromisso mensal | Receita irregular, LTV baixo |
| Gratuito com anúncio | Ads | Escala | Péssimo para foco/estudo; receita baixa no Brasil |
| B2B2C | Venda para cursinhos como white-label | Ticket alto | Ciclo de venda longo, muda o produto |

**Faixa de preço de referência do mercado:** R$ 22–30/mês nos bancos de questões; R$ 13,90/mês é o "preço psicológico" de assinatura de consumo no Brasil. Um Pro entre **R$ 14,90 e R$ 24,90/mês**, com anual com desconto forte, é a faixa defensável.

---

## 8. Opções técnicas (resumo)

| Camada | Opções | Comentário |
|---|---|---|
| App | **Flutter**, React Native / Expo, PWA | Flutter e RN entregam Android+iOS. PWA é o mais barato mas offline e notificação são piores. Público é **majoritariamente Android**. |
| Backend | **Supabase** (Postgres + auth + storage + realtime), Firebase, backend próprio | Supabase já está conectado neste ambiente; Postgres é ideal para a taxonomia relacional do edital. |
| Offline | SQLite local + sync incremental | Requisito de produto, não detalhe técnico. |
| Repetição espaçada | FSRS (open source, há implementações em Dart/TS) | Não reinventar. |
| IA | API de LLM para explicação de erro, geração de questões e resumo | Custo por uso — precisa de limite no plano grátis. |
| Ingestão de questões | Pipeline de PDF → parser → revisão humana | O maior item de esforço do projeto. |

---

## 9. Riscos principais

1. **Conteúdo é o fosso, não o código.** Sem acervo de questões relevante, o app vira "mais um cronômetro". Decidir cedo a estratégia de conteúdo.
2. **Escopo.** A lista de funcionalidades acima é fácil de escrever e leva anos para construir inteira. MVP precisa ser brutalmente cortado.
3. **Sazonalidade.** Sem CNU em 2026, o crescimento depende de editais estaduais/municipais — o app precisa funcionar bem para *qualquer* edital, inclusive cadastrado à mão.
4. **Retenção.** Concurseiro desiste. O produto precisa de um motivo diário para abrir (fila de revisão + microsessão), não só um motivo mensal.
5. **Custo de IA** se for usada sem limite no plano gratuito.

---

## Fontes

- [Tec Concursos ou Qconcursos? — Demanda Concursos](https://www.demandaconcursos.com.br/concursos/tec-concursos-ou-qconcursos-veja-qual-plataforma-vale-mais-a-pena-para-concurseiros/)
- [QConcursos ou TEC Concursos: qual é melhor?](https://queropassaremconcursos.com.br/qconcursos-ou-tec-concursos-qual-e-melhor/)
- [Melhores plataformas de estudo para concursos em 2026 — Gabaritei](https://gabaritei.com.br/melhores-plataformas-concursos)
- [Os 6 melhores aplicativos para estudar para concurso em 2026 — DR Concursos](https://drconcursos.com/melhores-aplicativos-para-estudar-para-concurso/)
- [17 aplicativos para estudar para concursos — Próximos Concursos](https://www.proximosconcursos.com/aplicativos-para-estudar-para-concurso-gratis/)
- [Estudaqui — controle de estudos e revisões](https://www.estudaqui.com/)
- [Ciclo ou cronograma de estudos — Estratégia Concursos](https://www.estrategiaconcursos.com.br/blog/ciclo-ou-cronograma-de-estudos/)
- [Dicas para concurso: estudar espaçado — Gran Cursos](https://blog.grancursosonline.com.br/dicas-para-concurso-estudar-espacado/)
- [Anki: revisões espaçadas para concursos — Estratégia](https://www.estrategiaconcursos.com.br/blog/anki-revisoes-concursos/)
- [Configuração do Anki para concursos — Provas Brasil](https://blog.provasbrasil.com.br/metodos-de-estudo/configuracao-anki-concursos/)
- [Perfil das bancas de concursos: Cebraspe, FGV, FCC — Gran Cursos](https://blog.grancursosonline.com.br/perfil-bancas-de-concursos-publicos/)
- [Diferenças entre FGV e Cebraspe — Estratégia](https://www.estrategiaconcursos.com.br/blog/diferencas-entre-fgv-cebraspe/)
- [Questões de prova não têm proteção de direito autoral, diz TJ-SP — ConJur](https://conjur.com.br/2024-abr-08/questoes-de-prova-nao-tem-protecao-de-direito-autoral-diz-tj-sp/)
- [Segundo TJSP, questões de prova não estão sujeitas à proteção autoral — IDS](https://ids.org.br/noticia/segundo-tjsp-questoes-de-prova-nao-estao-sujeitas-por-si-so-a-protecao-por-direito-autoral/)
- [CNU — guia completo e números — EstudePlan](https://estudeplan.com.br/blog/concurso-nacional-unificado-cnu.html)
- [CNU: atualizações e convocações — Gran Cursos](https://blog.grancursosonline.com.br/concurso-nacional-unificado/)
- [Mercado de EdTech no Brasil — IMARC Group](https://www.imarcgroup.com/brazil-edtech-market)
- [App não funciona — Qconcursos (Reclame Aqui)](https://www.reclameaqui.com.br/qconcursos/app-nao-funciona_CAR4TawaXakwg6Dc/)
- [Como estudar para concurso com apenas 2 horas por dia — EmÁudio](https://emaudioconcursos.com.br/como-estudar-para-concurso-quando-voce-tem-apenas-2-horas-por-dia/)
