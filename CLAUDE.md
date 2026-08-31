# Rito — app de estudos para Auditor-Fiscal da RFB

App web (PWA) que transforma o edital verticalizado na unidade central do estudo: cada linha do edital
carrega o esquema de leitura, as questões que já caíram, o desempenho e as revisões agendadas.

**Antes de mexer em qualquer coisa, leia:**

| Documento | O que tem |
|---|---|
| `docs/03-plano-do-produto.md` | Decisões travadas, modelo de dados, telas, roadmap por fases |
| `docs/04-fontes-de-questoes.md` | De onde vêm as questões, padrão de URL do Cebraspe, pipeline |
| `docs/01-pesquisa-mercado.md` | Concorrência, metodologia, jurídico |
| `docs/agents/00-protocolo.md` | **Protocolo de memória viva — obrigatório para todo agente** |

## Regras do projeto

1. **Banca é dado, não premissa.** Hoje o acervo é Cebraspe; a banca da RFB ainda não foi contratada.
   Nada no código pode assumir uma banca fixa.
2. **Formato é atributo da prova.** `formato` (`ce` \| `multipla`) e `penalidade_por_erro` vivem na prova.
   Placar líquido (`acertos − erros`) só onde o erro pune de fato.
3. **Questão sem gabarito definitivo casado não é publicada.**  Anulada entra marcada e nunca conta
   estatística.
   **Exceção temporária (2026-08-31, revisar antes de lançamento público ou monetização):** para
   questão de `origem_fonte = 'apostila_comentada'` (PDF de terceiro, tipo apostila de professor —
   ver `docs/04-fontes-de-questoes.md`) não existe "gabarito definitivo da banca" para casar. Publica
   com `revisado_humano = true` no lugar disso. A regra original continua de pé, sem exceção, para
   `origem_fonte = 'prova_oficial'`.
4. **Atribuição é obrigatória:** toda questão guarda banca, ano, órgão, cargo e número original.
   Para `origem_fonte = 'apostila_comentada'` a atribuição equivalente é autor e título da apostila
   (`autor_fonte`, `titulo_fonte`) — não existe banca/ano/órgão/cargo numa apostila de terceiro.
5. **Justificativa da banca é texto autoral** — serve de fonte para escrever o nosso esquema, nunca
   para republicar.
   **Exceção temporária (2026-08-31, revisar antes de lançamento público ou monetização):** o
   comentário do autor de uma `apostila_comentada` pode ser guardado e exibido **com atribuição
   obrigatória** (regra 4) — é uma decisão de produto separada e mais frágil juridicamente do que a
   pesquisa sobre justificativa de banca em `04-fontes-de-questoes.md`. A barreira original continua
   de pé, sem exceção, para a justificativa oficial da banca em `origem_fonte = 'prova_oficial'`.
6. **Offline está fora do escopo.** Não gastar esforço nisso.
7. **Tom sóbrio.** Sem mascote, sem confete, sem infantilização — vale também para XP, sequência e
   conquistas (regra 8): mecânica de jogo é permitida, estética de jogo infantil não.
8. **Progresso é um estado por assunto, não um card avulso.** Cada assunto carrega habilidade latente,
   domínio com esquecimento e fila de revisão no mesmo registro (`EstadoAssunto` /
   `estado_assunto`) — não existe mais card de flashcard separado da questão/assunto que o originou.

## Agentes

Definidos em `.claude/agents/`. Cada um mantém seu diário em `docs/agents/`.

| Agente | Lane |
|---|---|
| `inspetor` | Estrutura do projeto, bugs, saúde do código |
| `designer` | Interface, tokens visuais, acessibilidade, light/dark |
| `gabarito` | Correção das provas — respostas sempre corretas e atualizadas |
| `coletor` | Ingestão dos PDFs do Cebraspe → JSON normalizado |
| `esquemas` | Material de leitura esquematizado, escrito por incidência |
| `dados` | Modelo de dados, migrations do Supabase, FSRS, integridade |
