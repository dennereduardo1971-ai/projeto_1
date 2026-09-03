# Rito — app de estudos para Auditor-Fiscal da RFB

O edital como unidade central do estudo: cada assunto carrega o que você já estudou, o que já errou
e quando precisa revisar. Sem conta e sem servidor — tudo fica no IndexedDB do próprio aparelho.

## Rodar

```bash
cd app
npm install
npm run dev      # http://localhost:5173
```

Para testar a versão de produção:

```bash
npm run build && npm run preview
```

No celular, na mesma rede: `npm run dev -- --host` e acesse o IP que ele imprimir.

## O que já funciona

| Tela | Estado |
|---|---|
| **Hoje** | Minutos do dia e da semana, revisões devidas, próximo bloco do ciclo |
| **Mapa** | Árvore de assuntos com nível derivado (não estudado → dominado) por disciplina |
| **Ciclo** | Fila de blocos que não pune atraso, com cronômetro e lançamento manual |
| **Questões** | 100 questões reais do acervo, com a fonte creditada; confiança declarada; placar líquido só onde o erro pune; erro vira revisão |
| **Revisão** | Fila de repetição espaçada com quatro notas |
| **Mais** | De onde vem cada questão do acervo, backup exportar/importar, tema, questões de exemplo |

## O que ainda não é real

- **Acervo.** São **100 questões**, todas de **apostila comentada de terceiro** (Gran Cursos:
  Marcelo Aragão em Amostragem/Auditoria, Carlos Elias em Obrigações/Direito Civil) — ingeridas pelo
  pipeline, com autor e título creditados em cada uma. Elas cobrem 2 dos 28 assuntos da taxonomia.
  **Nenhuma prova oficial Cebraspe foi ingerida ainda**; quando for, entra pelo mesmo caminho, com
  gabarito definitivo casado. Detalhe em `docs/04-fontes-de-questoes.md`. As 10 questões *de
  exemplo* seguem existindo como andaime opcional, em *Mais*.
- **Edital.** O concurso alvo só tem edital previsto até janeiro de 2027; até lá o Mapa usa a árvore
  de assuntos provisória em `seeds/taxonomia.json`.
- **Agendamento.** O motor em `app/src/features/dominio/` é próprio (habilidade latente + domínio
  com esquecimento num só estado por assunto), não uma biblioteca de FSRS.
- **Esquemas.** Nenhum material de leitura foi escrito. Agora dá para ordenar a fila por incidência:
  amostragem em auditoria tem 63 questões, obrigações tem 37.
- **Sem sincronização.** Limpar os dados do navegador apaga o progresso. Exporte em *Mais*.

## Estrutura

```
app/                aplicação (Vite + React + TypeScript + Tailwind + Dexie)
  src/dados/        modelo local espelhando o Postgres do Supabase
  src/features/     ciclo, domínio (habilidade e revisão), questões, tema
  src/app/routes/   telas
acervo/provas/      artefato por prova/apostila — o que o app carrega no boot
seeds/              taxonomia de assuntos e questões de exemplo
scripts/ingest/     pipeline de ingestão dos PDFs
docs/               pesquisa, plano do produto, fontes de questões
.claude/agents/     os seis agentes do projeto
```

Deploy: Netlify já configurado em `netlify.toml` (base `app`, build `npm run build`).
