# Diário — inspetor

> Preenchido pelo próprio agente conforme o projeto anda. Ver `docs/agents/00-protocolo.md`.

## Estado atual

**Saudável.** Verificação de 2026-09-03, com o app em `app/`:

| Verificação | Resultado |
|---|---|
| `npx tsc -b --noEmit` | limpo |
| `npm run build` | passa (~0,8 s; JS 603 kB, gzip 175 kB) |
| `npm run lint` (oxlint) | 0 erro, **13 avisos** |
| `npm test` (vitest) | 35 testes, todos passando |
| `pytest scripts/ingest/tests` | 42 testes, todos passando |
| Laço acervo → questão → erro → revisão | verificado em navegador (Playwright), sem erro de console |

Estrutura em ordem: `app/` (Vite + React + TS + Tailwind + Dexie), `scripts/ingest/` (pipeline de
7 etapas + gate humano), `supabase/migrations/` (15 migrations), `acervo/provas/` (4 artefatos, 100
questões), `seeds/`, `docs/`, `.claude/agents/`.

O JS cresceu de 455 kB para 603 kB em 2026-09-03: o acervo entra no bundle por `import.meta.glob`
eager (ver `docs/agents/coletor.md`, Pendências, para o limite a partir do qual isso precisa mudar).

Os 13 avisos são todos do mesmo padrão — `set-state-in-effect` e um `exhaustive-deps` — nas telas
que carregam dado do Dexie no `useEffect` (Hoje, Mapa, Ciclo, Questões, Revisão, Mais). Não são
bugs; são o preço de buscar dado assíncrono sem uma camada de query.

## Decisões

- **2026-08-26 — Removida a duplicação de app.** O repositório tinha duas implementações: um
  protótipo em JavaScript puro na raiz (`index.html`, `app/js/`, `app/css/`) e o app React em
  `app/src/`. O protótipo saiu; o React ficou. Junto, o `netlify.toml` passou a publicar `app/dist`
  com fallback de SPA, em vez da raiz.

## Armadilhas

- **`pytest` falha por motivo errado neste ambiente remoto: falta `_cffi_backend`.** 14 dos 42
  testes morrem com `pyo3_runtime.PanicException: Python API call failed` vindo de
  `cryptography` → `pdfminer` → `pdfplumber`. Não é o repositório: `pip install cffi` resolve e a
  suíte fica verde. Antes de investigar "regressão no parser", rode isso.
- **Estado vazio codificado em texto fixo vira mentira.** `Hoje` afirmava "Nenhuma questão no acervo
  ainda" sem consultar o acervo; no dia em que as 100 questões entraram, a home continuou negando o
  que as outras telas mostravam (corrigido em 2026-09-03). Vale a varredura: qualquer tela que
  afirme algo sobre o estado do produto tem que ler esse estado.
- **O protótipo estava quebrado sem avisar**: ele buscava `data/*.json`, mas `.gitignore` ignora
  `data/*` inteiro (por causa dos PDFs da banca). Em clone novo, o app subia e não achava os dados.
  Lição: dado que o app precisa para rodar mora em `seeds/`, nunca em `data/`.
- **Teste de integração não pode depender de rede externa.** Os domínios das bancas estão
  bloqueados no ambiente remoto — teste que baixa PDF falha por motivo errado.

## Pendências

- **Continua sem CI**, e agora custa mais caro: o acervo entra no app por um caminho que só é testado
  quando alguém lembra de rodar `npm test`. Um artefato publicado com defeito passa despercebido até
  a tela ficar vazia.
- Decidir se os 13 avisos de `set-state-in-effect` viram dívida aceita ou pedem uma camada de query
  (`dexie-react-hooks` já vem com o Dexie e resolveria o padrão inteiro).
- Nenhum teste automatizado cobre as TELAS do app React. O motor de domínio, o carregador do acervo
  e a atribuição têm testes (`vitest`, 35); componente e rota, nenhum.
- `app/smoke.mjs` é resto de sessão antiga: aponta para um diretório de scratchpad que não existe
  mais e para um caminho fixo do Chromium. Não roda como está e não está em nenhum script do
  `package.json` — ou vira teste de verdade, ou sai.
