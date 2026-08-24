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
| **Questões** | Resolve com confiança declarada; placar líquido só onde o erro pune; erro vira revisão |
| **Revisão** | Fila de repetição espaçada com quatro notas |
| **Mais** | Backup exportar/importar, tema, e carregar/remover as questões de exemplo |

## O que ainda não é real

- **Acervo.** As 10 questões disponíveis são **de exemplo**, escritas para o projeto — não são de
  prova e não têm banca. Carregue e remova em *Mais*. O acervo Cebraspe entra pelo pipeline descrito
  em `docs/04-fontes-de-questoes.md`, e questão sem gabarito definitivo casado não é publicada.
- **Edital.** O concurso alvo só tem edital previsto até janeiro de 2027; até lá o Mapa usa a árvore
  de assuntos provisória em `seeds/taxonomia.json`.
- **Agendamento.** `app/src/features/revisao/fsrs.ts` é interino: FSRS compacto, sem dependência. O
  estado gravado já é o do FSRS, então trocar por `ts-fsrs` não perde histórico.
- **Sem sincronização.** Limpar os dados do navegador apaga o progresso. Exporte em *Mais*.

## Estrutura

```
app/                aplicação (Vite + React + TypeScript + Tailwind + Dexie)
  src/dados/        modelo local espelhando o Postgres do Supabase
  src/features/     ciclo, revisão (FSRS), questões, tema
  src/app/routes/   telas
seeds/              taxonomia de assuntos e questões de exemplo
scripts/ingest/     pipeline de ingestão dos PDFs da banca
docs/               pesquisa, plano do produto, fontes de questões
.claude/agents/     os seis agentes do projeto
```

Deploy: Netlify já configurado em `netlify.toml` (base `app`, build `npm run build`).
