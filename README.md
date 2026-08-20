# Grifo — app de estudos para Auditor-Fiscal da RFB

Versão de teste local. Sem conta, sem servidor: tudo fica no `localStorage` do navegador.

## Rodar

```bash
python3 -m http.server 8080     # ou: npx serve .
```
Abra `http://localhost:8080`. **Não abra o `index.html` com duplo clique** — os módulos ES e o `fetch`
dos dados exigem um servidor.

No celular: rode o comando acima no computador e acesse `http://SEU-IP:8080` pela rede local.

## O que já funciona

| Tela | O que faz |
|---|---|
| **Hoje** | Fila do dia: revisões vencidas, bloco do ciclo, e os 5 assuntos de maior prioridade (peso na prova × seu desempenho) |
| **Edital** | Mapa do edital verticalizado, com nível por assunto — distinguível por forma (○ ◔ ◑ ●), não só por cor |
| **Questões** | Resolve com **confiança declarada** antes de confirmar; erro cai automaticamente na revisão. Placar líquido só em prova com penalidade |
| **Revisar** | Fila de repetição espaçada com quatro notas |
| **Ciclo** | Cronômetro por matéria, lançamento manual, e a volta do ciclo (fila que não pune atraso) |
| **Dados** | Estatísticas, acerto por confiança (revela o falso domínio), exportar/importar/zerar |

## O que ainda não é real

- **As questões são de exemplo**, escritas para este projeto — não são de prova e não têm banca atribuída.
  O acervo Cebraspe entra pelo pipeline descrito em `docs/04-fontes-de-questoes.md`.
- **O agendamento de revisão é interino** (`app/js/srs.js`): FSRS compacto sem dependência, para o app
  rodar sem build. Troca por `ts-fsrs` quando entrar o bundler. O estado guardado já é o do FSRS.
- **Sem sincronização.** Limpar o navegador apaga tudo — use Exportar.
- **Esquemas de leitura** ainda não existem na interface.

## Estrutura

```
index.html              casca e navegação
app/css/app.css         tokens, light/dark, componentes
app/js/store.js         estado, invariantes, níveis derivados
app/js/srs.js           agendamento de revisões
app/js/views.js         telas
app/js/main.js          rotas e eventos
data/edital-afrfb.json  edital verticalizado (esboço 2022/23, reconferir no edital novo)
data/questoes-exemplo.json
```

Publicar: qualquer host estático. `netlify.toml` já está configurado (sem build).
