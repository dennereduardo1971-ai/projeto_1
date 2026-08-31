# Diário — gabarito

> Preenchido pelo próprio agente conforme o projeto anda. Ver `docs/agents/00-protocolo.md`.

## Estado atual

**Nenhuma questão de banca foi auditada, porque não existe nenhuma no acervo.** `acervo/provas/`
está vazio e nada foi ingerido.

As 10 questões que o app mostra hoje vêm de `seeds/questoes-exemplo.json` e são **nossas**:
escritas para o projeto, sem banca, sem ano, sem órgão. O gabarito delas é o que nós afirmamos —
não há gabarito oficial para conferir contra. Elas não passam pela auditoria deste agente e não
devem ser tratadas como acervo. Ficam marcadas como exemplo na interface e saem inteiras pelo botão
*Remover exemplo* (`app/src/dados/exemplo.ts`).

Última varredura por mudança de lei: **nunca** — não há o que varrer ainda.

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
