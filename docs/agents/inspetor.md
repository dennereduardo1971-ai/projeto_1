# Diário — inspetor

> Preenchido pelo próprio agente conforme o projeto anda. Ver `docs/agents/00-protocolo.md`.

## Estado atual

**Saudável.** Verificação de 2026-08-26, com o app em `app/`:

| Verificação | Resultado |
|---|---|
| `npx tsc -b --noEmit` | limpo |
| `npm run build` | passa (~1,2 s; JS 455 kB, gzip 145 kB) |
| `npm run lint` (oxlint) | 0 erro, **13 avisos** |
| `pytest scripts/ingest/tests` | 16 testes, todos passando |
| Laço questão → erro → card → revisão | verificado em navegador, sem erro de página |

Estrutura em ordem: `app/` (Vite + React + TS + Tailwind + Dexie), `scripts/ingest/` (pipeline de
7 etapas), `supabase/migrations/` (4 migrations), `seeds/`, `docs/`, `.claude/agents/`.

Os 13 avisos são todos do mesmo padrão — `set-state-in-effect` e um `exhaustive-deps` — nas telas
que carregam dado do Dexie no `useEffect` (Hoje, Mapa, Ciclo, Questões, Revisão, Mais). Não são
bugs; são o preço de buscar dado assíncrono sem uma camada de query.

## Decisões

- **2026-08-26 — Removida a duplicação de app.** O repositório tinha duas implementações: um
  protótipo em JavaScript puro na raiz (`index.html`, `app/js/`, `app/css/`) e o app React em
  `app/src/`. O protótipo saiu; o React ficou. Junto, o `netlify.toml` passou a publicar `app/dist`
  com fallback de SPA, em vez da raiz.

## Armadilhas

- **O protótipo estava quebrado sem avisar**: ele buscava `data/*.json`, mas `.gitignore` ignora
  `data/*` inteiro (por causa dos PDFs da banca). Em clone novo, o app subia e não achava os dados.
  Lição: dado que o app precisa para rodar mora em `seeds/`, nunca em `data/`.
- **Teste de integração não pode depender de rede externa.** Os domínios das bancas estão
  bloqueados no ambiente remoto — teste que baixa PDF falha por motivo errado.

## Pendências

- Decidir se os 13 avisos de `set-state-in-effect` viram dívida aceita ou pedem uma camada de query
  (`dexie-react-hooks` já vem com o Dexie e resolveria o padrão inteiro).
- Não há CI: build, typecheck, lint e pytest só rodam quando alguém lembra.
- Nenhum teste automatizado cobre o app React — só o pipeline Python tem testes.
