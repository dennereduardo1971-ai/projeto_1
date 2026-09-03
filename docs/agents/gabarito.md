# Diário — gabarito

> Preenchido pelo próprio agente conforme o projeto anda. Ver `docs/agents/00-protocolo.md`.

## Estado atual

**Nenhuma questão foi auditada ainda, mas agora existe o que auditar — e ele está no ar.**
`acervo/provas/` tem 4 artefatos (100 questões de apostila comentada: Marcelo Aragão/Auditoria e
Carlos Elias/Direito Civil) e, desde 2026-09-03, o app os carrega e mostra ao usuário. O gate que
sustenta essas questões é `revisado_humano = true` — o aval de quem aprovou por `8_revisar.py`, não
uma conferência deste agente. A pergunta desta lane para elas é a da decisão de 2026-08-31: o
gabarito e o comentário do autor batem com a lei/norma vigente hoje?

Fora isso continuam existindo as 10 questões de `seeds/questoes-exemplo.json`, que são **nossas**:
escritas para o projeto, sem banca, sem ano, sem órgão. O gabarito delas é o que nós afirmamos —
não há gabarito oficial para conferir contra. Elas não passam pela auditoria deste agente e não
devem ser tratadas como acervo. Desde 2026-09-03 elas não são mais o que o app mostra por padrão:
entram só se o usuário pedir em *Mais*, e saem inteiras pelo botão *Remover exemplo*
(`app/src/dados/exemplo.ts`).

Última varredura por mudança de lei: **nunca**. Agora há o que varrer — ver Pendências.

## Decisões

- **2026-08-31 — O que "gabarito correto" significa muda para `apostila_comentada`.** Pivô de
  produto: além de `prova_oficial` (Cebraspe, gabarito casado com a banca), o acervo passa a aceitar
  PDF de apostila comentada de terceiro. Sem banca, não há "definitivo" para casar — o gate vira
  `revisado_humano = true` (você conferiu que o gabarito e o comentário do autor estão certos) +
  `gabarito` preenchido. A auditoria deste agente, para essa origem, é outra pergunta: não "bate com
  o definitivo da banca?", mas **"o gabarito e o comentário do autor batem com a lei/norma vigente
  hoje?"** — a mesma varredura por mudança de lei já prevista (pendência abaixo), só que aplicada
  também a conteúdo de terceiro, não só ao que a banca escreveu. Exceção temporária das regras 3 e 5
  do `CLAUDE.md`, revisar antes de lançamento público ou monetização.
- **2026-08-20 — Questão de exemplo não é auditável.** Como o gabarito é nosso, conferir contra
  "a banca" seria teatro. A auditoria começa na primeira prova real ingerida.
- **2026-08-20 — Gabarito preliminar não publica.** Questão só sai de `pendente_definitivo` com o
  definitivo oficial casado (regra 3 do `CLAUDE.md`, invariante no schema).

## Armadilhas

- **Gabarito trocado por tipo de caderno** é o erro clássico do Cebraspe: mesma questão, número
  diferente conforme a cor do caderno. Conferir sempre contra o caderno do mesmo tipo.
- **Alteração pós-recurso**: a banca republica o definitivo. Comparar com o que já está no banco em
  vez de confiar na primeira importação.

## Pendências

- Definir a rotina de varredura por mudança de lei. Alvos permanentes deste projeto: reforma
  tributária (EC 132/2023 e leis complementares), alterações no Código Civil, NBC TA/PA revisadas
  pelo CFC, legislação aduaneira.
- Não existe fluxo de "reportar erro de gabarito" na interface — hoje um erro só chega por conversa.
  Isso deixou de ser teórico em 2026-09-03: as questões estão na tela, e a tabela `reporte_questao`
  (migration 0009) já existe do lado da SQL, sem nada que a alimente no app.
- **Primeira auditoria de verdade a fazer:** as 100 questões de apostila publicadas. Elas nunca
  passaram por este agente — entraram pelo aval do dono no gate humano. Prioridade por incidência:
  `auditoria-amostragem` (63 questões) antes de `civil-obrigacoes` (37).
- Quando uma questão for retirada por gabarito errado, basta tirá-la do artefato: o app poda sozinho
  no boot seguinte (`podarAcervo`) e, se o usuário já tiver respondido, ela para de ser servida sem
  apagar o histórico dele.
