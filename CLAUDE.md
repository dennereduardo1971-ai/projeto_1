# Projeto — app de estudos para Auditor-Fiscal da RFB

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
3. **Questão sem gabarito definitivo casado não é publicada.** Anulada entra marcada e nunca conta estatística.
4. **Atribuição é obrigatória:** toda questão guarda banca, ano, órgão, cargo e número original.
5. **Justificativa da banca é texto autoral** — serve de fonte para escrever o nosso esquema, nunca para republicar.
6. **Offline está fora do escopo.** Não gastar esforço nisso.
7. **Tom sóbrio.** Sem mascote, sem confete, sem infantilização.

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
