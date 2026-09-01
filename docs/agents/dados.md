# Diário — dados

> Preenchido pelo próprio agente conforme o projeto anda. Ver `docs/agents/00-protocolo.md`.

## Estado atual

**Nenhum banco existe.** Nenhum projeto Supabase foi criado e nenhuma migration foi aplicada em
base real. O que existe é o schema **versionado** em `supabase/migrations/`, escrito para o dia em
que o Postgres entrar. O app da fase atual roda 100% local (IndexedDB); o Postgres é destino, não
dependência.

O schema foi **validado de verdade** contra um PostgreSQL 16 efêmero levantado nesta sessão
(`initdb` local, banco descartado ao fim). As 13 migrations aplicam limpas, na ordem, em base zerada;
os seeds carregam e recarregam sem erro; as invariantes e o RLS foram testados com dado e com um
papel não-dono. Isto **não** substitui teste em Supabase real — ver Pendências.

### Migrations, em ordem

| # | Arquivo | O que traz |
|---|---|---|
| 0001 | `base_tipos_e_funcoes.sql` | schema `rito`; tipos `formato_prova`, `nivel_dominio`, `confianca_resposta`; `rito.tg_atualizado_em()`, `rito.usuario_atual()`, `rito.calcula_nivel()` |
| 0002 | `taxonomia.sql` | `disciplina`, `assunto` (árvore por `pai_id`, `nivel` por trigger) |
| 0003 | `edital.sql` | `concurso`, `cargo`, `edital`, `item_edital`, `item_edital_assunto` |
| 0004 | `acervo_provas_e_questoes.sql` | `prova`, `texto_apoio`, `questao`, `alternativa`, `questao_assunto` |
| 0005 | `esquemas.sql` | `esquema`, `esquema_secao`, `esquema_fonte_questao` |
| 0006 | `usuario.sql` | `usuario` |
| 0007 | `plano_e_ciclo.sql` | `plano`, `bloco_ciclo` |
| 0008 | `sessao.sql` | `sessao` (presa a `assunto_id`, `minutos` gerada) |
| 0009 | `resposta.sql` | `resposta` (+ triggers de primeira tentativa), `reporte_questao` |
| 0010 | `fsrs_cards_e_revisoes.sql` | `card`, `revisao`, `revisao_log` — **substituídas pela 0014** |
| 0011 | `views_de_desempenho.sql` | 13 views, todas `security_invoker = on` — 4 delas recriadas pela 0014 |
| 0012 | `rls.sql` | RLS ligado em 24 tabelas + políticas |
| 0013 | `supabase_auth.sql` | **ISOLADA. Não aplicar nesta fase.** Único arquivo que toca `auth.users`, `auth.uid()` e os papéis `anon`/`authenticated` |
| 0014 | `dominio_assunto_e_gamificacao.sql` | Pivô 2026-08-31: derruba `card`/`revisao`/`revisao_log` (CASCADE) e recria `vw_revisao_atrasada_assunto`, `vw_caderno_erros`, `vw_progresso_assunto`, `vw_progresso_item_edital` contra `estado_assunto` — estado único de domínio (habilidade + esquecimento), no molde do APP-CPA-YOHANNA. Entram também `sequencia`, `evento_xp`, `conquista_usuario`, `meta` (gamificação) com RLS |
| 0015 | `questao_origem_fonte.sql` | `questao` ganha `origem_fonte`/`autor_fonte`/`titulo_fonte`/`revisado_humano`/`dificuldade_b`; o CHECK de publicação aceita `apostila_comentada` sem gabarito casado com banca |

### Como o esquema se sustenta

- **Formato é da prova.** `questao` tem FK **composta** `(prova_id, formato) → prova(id, formato)`.
  Questão de múltipla escolha dentro de prova C/E é recusada pelo banco. `alternativa` usa a mesma
  técnica com `formato` fixado em `'multipla'` por CHECK: alternativa em questão C/E não entra.
- **Sem gabarito casado não publica.** CHECK em `questao`: `publicada` exige `gabarito` e
  `gabarito_confirmado_em`, salvo se `anulada`.
- **Atribuição obrigatória.** `banca`, `ano`, `orgao`, `cargo_nome` são NOT NULL em `prova`, e
  `questao.prova_id` é NOT NULL — nenhuma questão existe sem eles. A view `vw_questao_publicada`
  entrega tudo junto.
- **`conta_estatistica`** é coluna gerada: `publicada and not anulada`.
- **Progresso não é tabela.** É view (`vw_progresso_assunto`, `vw_progresso_item_edital`), calculada
  por `rito.calcula_nivel()`. Não existe caminho para gravar um nível errado.
- **Dado do usuário** carrega `usuario_id` própria e amarra ao pai por FK composta
  (`bloco_ciclo → plano`, `sessao → plano/bloco`, `resposta → sessao`, `revisao → card`). Custo: uma
  coluna e uma unique por tabela. Ganho: a política de RLS é `usuario_id = rito.usuario_atual()`,
  sem subconsulta por linha, e um filho não pode pertencer a outro dono.

### Seeds

`seeds/taxonomia.json` — taxonomia **provisória**, versão 1: Auditoria (14 assuntos / 72 tópicos) e
Direito Civil (14 assuntos / 72 tópicos), 174 slugs, todos únicos. `seeds/aplicar_seeds.sql` faz
upsert por `slug`, é idempotente e **nunca apaga** — slug que sumir do JSON é listado como órfão
para decisão humana. `seeds/README.md` explica por que taxonomia é seed e não migration.

### Carga do acervo real no app local (`app/src/dados/acervo.ts`) — 2026-09-01

Até esta sessão o app só carregava `seeds/questoes-exemplo.json` (andaime, 10 questões fictícias,
via `exemplo.ts`). Os artefatos publicados pelo pipeline em `acervo/provas/*.json` (4 arquivos, 100
questões, todos `status: "publicavel"`) nunca eram lidos por nenhuma tela. Fechado nesta sessão:

- **`carregarAcervo()`** (novo, `app/src/dados/acervo.ts`) lê os artefatos via
  `import.meta.glob<ArtefatoProva>('@acervo/provas/*.json', { eager: true, import: 'default' })` —
  alias `@acervo` novo em `vite.config.ts` e `tsconfig.app.json`, apontando para `/acervo` (repo
  irmão de `/app`) — e faz upsert nas tabelas Dexie `concurso`, `cargo`, `prova`, `texto_apoio`,
  `questao`, `alternativa`, `questao_assunto`. Chamado em `main.tsx` logo depois de
  `garantirSeeds()`, a cada boot (a classificação por assunto depende da taxonomia já existir).
- **Idempotente por construção**, no mesmo molde de `exemplo.ts`: id determinístico
  `acervo-prova-<slug>` / `<provaId>-q<numero>` / `<questaoId>-<letra>`, tudo via `.put()`.
  Reimportar não duplica; artefato atualizado sobrescreve sem apagar `resposta`/`estado_assunto` do
  usuário — mas é upsert, não reconciliação (ver Armadilhas: questão que sumir de uma versão futura
  do artefato fica órfã, não é apagada).
- Reproduz em TS só as **duas invariantes que são território do agente `dados`** (o resto — formato
  ⇒ `penalidade_por_erro`, letra de gabarito válida, texto de apoio referenciado etc. — é do
  pipeline/`coletor`, já verificado em `scripts/ingest/lib/validador.py`, e não é reconferido aqui):
  1. **Gabarito/publicação** (CLAUDE.md regra 3): `prova_oficial` exige `gabarito`;
     `apostila_comentada` exige `gabarito` **e** `revisado_humano` (exceção 2026-08-31). `anulada`
     sempre passa e nunca conta estatística — importa marcada, fora de `respostasValidas()`.
  2. **Atribuição obrigatória** (CLAUDE.md regra 4): `prova_oficial` exige `banca` no artefato;
     `apostila_comentada` exige `autor_fonte` **e** `titulo_fonte`.
  Artefato inteiro é rejeitado se a prova falhar; questão individual é pulada (o resto da prova
  entra) se só ela falhar.
- **Assunto do artefato que não existe na taxonomia local: a questão é pulada, nunca inventa
  assunto novo.** Reportado em `RelatorioCargaAcervo.assuntosDesconhecidos`.
- **`estadoAcervo()`** (`app/src/dados/consultas.ts`) passou a excluir o andaime de `exemplo.ts` por
  definição — `provas`/`questoesPublicadas`/`anuladas` só contam o acervo real — e ganhou `fontes`
  (banca, ou autor+título de apostila, com contagem por fonte), pra `Mais.tsx` mostrar proveniência
  sem nunca reexibir justificativa de banca (regra 5).

**Carga real** (rodada nesta sessão contra os 4 artefatos publicados em `acervo/provas/`):
100/100 questões importadas, 0 rejeitadas, 0 assunto desconhecido.

| Prova (slug) | origem_fonte | formato | penalidade_por_erro | questões |
|---|---|---|---|---|
| `apostila_auditoria_amostragem_ce` | apostila_comentada | ce | true | 18 |
| `apostila_auditoria_amostragem_multipla` | apostila_comentada | multipla | false | 45 |
| `apostila_civil_obrigacoes_1_ce` | apostila_comentada | ce | true | 33 |
| `apostila_civil_obrigacoes_1_multipla` | apostila_comentada | multipla | false | 4 |

Por assunto: `auditoria-amostragem` 63, `civil-obrigacoes` 37. As provas `_ce`/`_multipla` da mesma
apostila (mesmo `prova.perfil`) compartilham um único `concurso`/`cargo` sintéticos — 2 concursos no
total, um por apostila.

---

## Decisões

**2026-08-20 — O app se chama Rito.** Schema utilitário `rito`, GUC `rito.usuario_id`.

**2026-08-20 — Migrations versionadas, não aplicadas.** Nenhum projeto Supabase criado, nenhuma
ferramenta de Supabase usada. Motivo: sem edital e sem acervo, um banco em nuvem só acumularia
custo e schema à deriva. Escrever o schema agora é barato; corrigi-lo depois de ter dado dentro
não é.

**2026-08-20 — Sem login nesta fase, mas com tabelas de usuário e RLS escritos.** O schema nasce
com a fronteira de dado pessoal desenhada. O acoplamento com autenticação foi comprimido em **um
ponto**: `rito.usuario_atual()`. Hoje ela lê um GUC; a 0013 a reescreve para `auth.uid()`. Nenhuma
política de RLS precisa mudar quando o login chegar.

**2026-08-20 — Tudo que referencia `auth` mora só na 0013.** O arquivo aborta sozinho se o schema
`auth` não existir. Sem isso, o schema inteiro ficaria refém do Supabase e não rodaria num Postgres
comum — inclusive no cluster onde ele foi validado.

**2026-08-20 — Sem edital semeado.** `concurso`, `cargo`, `edital` e `item_edital` nascem vazios. A
banca da RFB não foi contratada e o edital não saiu; `concurso.banca` é `text` e **anulável**, nunca
enum (CLAUDE.md, regra 1).

**2026-08-20 — A sessão se prende a `assunto_id`, não a `item_edital_id`.** O assunto existe hoje
(vem dos seeds); a linha do edital não. Os minutos rateiam para as linhas do edital pela view
`vw_sessao_item_edital`, dividindo igualmente entre as linhas ligadas ao assunto **ou a qualquer
ancestral dele**. Sem edital a view devolve zero linhas e nada quebra; no dia em que o edital
entrar, toda sessão já gravada passa a pintar o Mapa retroativamente, sem migração de dado.

**2026-08-20 — Só a primeira tentativa de cada questão conta.** Garantido em três camadas: trigger
`BEFORE INSERT` decide (o app não escolhe), trigger `BEFORE UPDATE` congela (`primeira_tentativa`,
`usuario_id` e `questao_id` não se reescrevem), e índice único parcial
`(usuario_id, questao_id) WHERE primeira_tentativa` fecha a corrida. As demais tentativas ficam
gravadas como treino e aparecem no caderno de erros — que é ferramenta de estudo, não estatística.

**2026-08-20 — `desatualizada` conta na estatística; só `anulada` fica fora.** A view
`vw_resposta_valida` carrega a flag `desatualizada` para a tela poder avisar sem alterar o número.

**2026-08-20 — `dominado` = ≥10 questões válidas + ≥80% de acerto + zero revisão atrasada.**
Escala completa em `rito.calcula_nivel()`: `nao_estudado` (nada), `estudado` (minuto ou questão, mas
menos de 10 questões), `praticado` (≥10 questões), `dominado` (as três condições). O corte de 10 é a
amostra mínima para qualquer afirmação sobre domínio — abaixo disso a taxa de acerto é ruído.

**2026-08-20 — Progresso é view, não tabela.** O plano do produto (§4.3) previa uma tabela
`progresso_item`. Trocada por `vw_progresso_assunto` e `vw_progresso_item_edital`. Motivo: a
invariante "nível é derivado, nunca digitado" deixa de depender de disciplina do código. Cache
materializado, se um dia for preciso, é decisão de desempenho — e desempenho ainda não é problema.

**2026-08-20 — "Tópico" não é tabela.** `assunto` é árvore (`pai_id`); tópico é assunto de nível 2.
O JSON do seed usa a chave `topicos` só por legibilidade. Duas tabelas seriam dois vocabulários
concorrentes para a mesma coisa, e a árvore já permite um terceiro nível quando as provas pedirem.

**2026-08-20 — Enum só onde a ordem importa e o vocabulário está fechado.** `formato_prova`,
`nivel_dominio`, `confianca_resposta`. Todo o resto (`tipo_erro`, `tipo` de sessão, `tipo` de seção
de esquema, `origem` de card, `estado` do FSRS, `motivo` de reporte) é `text` + CHECK.

**2026-08-20 — Taxonomia entra por seed.** Migration só com estrutura. Ver `seeds/README.md`.

**2026-08-31 — Card/Revisão (FSRS separado) saem; entra `estado_assunto` único.** Decisão do dono do
produto: quer progressão e análise "igual ao APP-CPA-YOHANNA" — habilidade latente (Elo-IRT de 1
parâmetro) e domínio com esquecimento no MESMO registro que a fila de revisão, por assunto. Um card
por questão errada virou um passo a mais sem necessidade: o que importa é o estado do assunto, não o
card. Migration 0014. Motor em `app/src/features/dominio/` (TS puro, testado por `vitest`).

**2026-08-31 — Segunda origem de questão: `apostila_comentada`.** O gargalo real era ingerir a
primeira prova Cebraspe. Destravado por outra via: PDF de apostila comentada de terceiro (autor
próprio, gabarito e comentário no mesmo documento). Exceção temporária das regras 3 e 5 do
`CLAUDE.md` — revisar antes de lançamento público ou monetização. Migration 0015. **Decisão
deliberada:** a tabela `prova` NÃO foi relaxada (banca/ano/orgao/cargo_nome continuam NOT NULL) —
quem ingerir uma apostila preenche esses campos com o dado real disponível (ex.: `banca` = nome do
autor). Repensar isso é trabalho futuro, não urgente enquanto o volume for baixo.

**2026-09-01 — Atribuição da apostila mora na PROVA no artefato JSON, mas na QUESTÃO no
Dexie/`tipos.ts` (e na migration 0015).** `carregarAcervo()` resolve isso propagando: toda questão
de uma prova `apostila_comentada` recebe o mesmo `autor_fonte`/`titulo_fonte` da prova do artefato.
Isto resolve, do lado do app local, a pendência que o `coletor` registrou no próprio diário
(`docs/agents/coletor.md`, seção Pendências) sobre `7_publicar.py` ainda não decidir essa conversão
para o Supabase — quando aquele script escrever de verdade, o padrão de propagação prova→questão
usado aqui é o candidato natural a repetir lá, para as duas gravações não divergirem.

**2026-09-01 — `Concurso`/`Cargo` sintéticos para `apostila_comentada`.** Não existe "concurso" real
por trás de uma apostila comentada, mas `prova.concurso_id`/`cargo_id` são NOT NULL no schema (app e
Postgres). Chave sintética `apostila:<perfil ou slug>` — usar `perfil` (quando presente) em vez do
`slug` da prova é o que permite as duas provas-gêmeas `_ce`/`_multipla` da mesma apostila
compartilharem um único concurso/cargo, em vez de um par duplicado por formato. Para
`prova_oficial`, a chave é `oficial:<banca>:<orgao>:<cargo>:<ano>` — não sintética, é o dado real do
artefato.

**2026-09-01 — `estadoAcervo()` exclui `exemplo.ts` por definição, não por flag.** O filtro é
`!ehExemplo(prova.id)` (prefixo do id, mesmo padrão que já existia para `ehExemplo`/`ehAcervo`).
Alternativa descartada: um campo booleano tipo `eh_exemplo` na tabela `prova` — rejeitada porque
duplicaria a informação que já mora no formato do id, e porque `exemplo.ts` já se define como "não é
acervo" na própria doc-string; a consulta deveria refletir isso, não reabrir a decisão.

**2026-09-01 — `carregarAcervo()` roda em todo boot, sem gate de versão (diferente de
`garantirSeeds()`, que usa `db.meta`).** Decisão deliberada: como é upsert idempotente e barato (4
artefatos, 100 questões), rodar sempre mantém o Dexie local em dia com o que o pipeline publicou por
último sem exigir um mecanismo extra de invalidação. Se o acervo crescer a ponto de o upsert-a-cada-
boot pesar, aí sim vale copiar o gate de versão do `seed.ts`.

**2026-09-01 — `fake-indexeddb` como devDependency nova (`app/package.json`).** Necessário para
`acervo.test.ts` rodar transação Dexie real (upsert, idempotência, sobrevivência de `resposta` a
reimportação) em vez de testar só funções puras. Import do subcaminho `/auto`, sempre como primeira
linha do arquivo de teste — precisa registrar `indexedDB` global antes de `db.ts` importar `dexie`.

---

## Armadilhas

**Coluna gerada não pode referenciar outra coluna gerada.** Verificado:
`c int generated always as (b+1)` onde `b` também é gerada devolve
`cannot use generated column "b" in column generation expression`. Foi por isso que
`questao.conta_estatistica` calcula `publicada and not anulada` direto das colunas base em vez de se
apoiar numa coluna intermediária. **Mas CHECK constraint referenciando coluna gerada é permitido** —
testado e aceito. São regras diferentes; não confunda uma com a outra.

**View sem `security_invoker = on` fura o RLS.** Uma view roda com os direitos do dono. Sem a opção,
`vw_desempenho_assunto` mostraria o progresso de todo mundo para qualquer um — e ninguém perceberia
enquanto houvesse um usuário só. As 13 views têm a opção, e há uma consulta pronta para conferir:

```sql
select c.relname,
       coalesce((select option_value from pg_options_to_table(c.reloptions)
                  where option_name = 'security_invoker'), 'AUSENTE')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'v';
```

Exige PG 15+. Rode isso depois de qualquer migration que crie view.

**`UNIQUE` com coluna anulável não faz o que parece.** No padrão, `NULL` é distinto de `NULL`: duas
provas sem `caderno`, idênticas no resto, passariam pelo `UNIQUE`. `UNIQUE NULLS NOT DISTINCT`
(PG 15+) resolve. Usado em `prova_identidade_uk` e em `card_unico_por_origem_uk` — neste último é
essencial, porque `questao_id` e `assunto_id` são nulos conforme a origem do card, e sem isso dava
para criar cards infinitos para o mesmo erro.

**FK composta exige UNIQUE na tabela referenciada — e a migration morre no meio.** A 0010 falhou com
`there is no unique constraint matching given keys for referenced table "resposta"` porque
`card.resposta_id` aponta para `(id, usuario_id)` e essa unique não existia na 0009. A unique
"redundante" `(id, usuario_id)` tem que existir em toda tabela que vira alvo desse padrão:
`plano`, `bloco_ciclo`, `sessao`, `resposta`, `card` e `prova`/`questao` (por `(id, formato)`).

**`ON DELETE SET NULL` na tabela inteira briga com `NOT NULL`.** `sessao (plano_id, usuario_id)`
referencia `plano (id, usuario_id)`: apagar o plano tentaria zerar `usuario_id`, que é NOT NULL.
A forma `ON DELETE SET NULL (plano_id)` — só a coluna nomeada — resolve e **exige PG 15+**. Usada
em `sessao`, `resposta` e `card`.

**`count(*)` devolve `bigint`, e isso quebra função `IMMUTABLE`.** A 0011 falhou com
`function rito.calcula_nivel(integer, bigint, bigint, bigint) does not exist`. Como a função é
`IMMUTABLE` (para poder ser usada em coluna gerada), não há coerção automática. Os agregados das
views agora têm `::integer` explícito.

**Enum não tem `DROP VALUE`.** Adicionar valor é fácil; tirar exige recriar o tipo e reescrever toda
coluna que o usa. Por isso só três enums, e todos com ordem semântica que compensa o custo
(`nivel >= 'praticado'` funciona de graça).

**`SAVEPOINT` fora de bloco de transação não funciona no psql** — cada comando vira sua própria
transação. Para testar CHECKs que devem falhar sem abortar o script, rode com `psql -1` e **sem**
`ON_ERROR_STOP`.

**Trigger `BEFORE UPDATE OF col1, col2` ignora a cláusula `OF` no INSERT.** O `assunto_hierarquia`
dispara em todo INSERT, como se quer, mas em UPDATE só quando `pai_id` ou `disciplina_id` mudam.
Consequência conhecida: se o `nivel` de um pai mudar, o `nivel` dos filhos **não** é recalculado.
Com árvore de dois níveis não morde; se um terceiro nível entrar, isto precisa virar um recálculo
recursivo.

**RLS não vale para o dono da tabela.** Testar RLS conectado como `postgres` dá falso positivo:
tudo aparece. Os testes desta sessão usaram um papel comum (`app_cliente`) e, na simulação do
Supabase, `SET ROLE anon` / `authenticated`. `FORCE ROW LEVEL SECURITY` **não** foi ligado de
propósito — o dono precisa continuar podendo rodar migration, ingestão e correção de acervo.

**`auth.uid()` dentro de política exige `USAGE` no schema `auth`.** Se faltar, o erro que aparece é
`permission denied for schema auth` vindo de dentro do RLS — sintoma que não sugere a causa. O
Supabase já concede; a 0013 tenta conceder de novo e apenas avisa se não puder.

**`rito.usuario_atual()` devolvendo NULL nega tudo**, porque `usuario_id = NULL` é sempre falso.
É o padrão que se quer (negar por omissão), mas é também o primeiro suspeito quando "o app não vê
nada": faltou `set local rito.usuario_id` (hoje) ou o JWT (depois).

**`\set` com crase no psql depende do diretório de trabalho.** `aplicar_seeds.sql` faz
`\set taxonomia \`cat seeds/taxonomia.json\``, o que só funciona a partir da raiz do repositório.
Rodado de outro lugar, a variável vem vazia e o erro natural seria um parse de JSON incompreensível
— por isso o script carrega o texto cru primeiro, checa se está vazio e só então converte para
`jsonb`, com mensagem que diz o que fazer.

**`app/src/dados/tipos.ts` (espelho do IndexedDB) e `supabase/migrations/` já divergiam antes desta
sessão** — achado ao trabalhar na 0014/0015, não introduzido por elas. Exemplos: `sessao.inicio/fim`
(TS) vs `sessao.iniciada_em/encerrada_em` (SQL); `resposta.tentativa` (TS, número) vs
`resposta.primeira_tentativa` (SQL, boolean gerado por trigger); `questao.status` enum (TS) vs
`questao.publicada` boolean + `gabarito_casado_em` (TS) vs `gabarito_confirmado_em` (SQL);
`resposta.tipo_erro` tem valores diferentes nos dois lados (`conteudo_desconhecido`/`lei_mudou` no TS
× `conteudo`/`mudanca_de_lei`/`chute` no CHECK da 0009). O app roda 100% sobre o Dexie hoje — a SQL
nunca foi aplicada de verdade — então isto não quebra nada em produção, mas quem for finalmente
plugar o Supabase vai precisar escolher um lado e reconciliar. Não mexi nisso agora: as tabelas novas
(`estado_assunto` e gamificação) foram escritas cada uma na convenção do lado onde vivem, sem tentar
consertar a divergência antiga de passagem.

**Heredoc/edição de texto pode inserir Unicode "correto na tela, errado no arquivo".** Ao escrever
`acervo.ts`, a regex de `slugify()` saiu com caracteres combinantes diacríticos LITERAIS
colados nos colchetes (algo como `[<marca>-<marca>]`) em vez do escape `\u0300-\u036f`
pretendido — visualmente quase idênticos ao ler o arquivo, mas a `Edit`
tool recusou o fix ("old_string e new_string são exatamente iguais") porque a string digitada e a
gravada renderizavam igual. Resolvido com um script Python à parte, que localizou a linha por
substring e regravou com a string escapada explícita. Lição: qualquer regex com faixa Unicode
escrita via heredoc merece uma conferência com `grep -n` ou `python3 -c "print(repr(...))"` depois,
não só leitura visual.

**`import.meta.glob` eager só sai tipado se o genérico for passado explicitamente.** Sem
`import.meta.glob<ArtefatoProva>(..., { eager: true, import: 'default' })`, o retorno vem `unknown`
mesmo com `eager: true` — o overload que infere pelo `query`/`as` não cobre esse caso. Consequência
prática: o `@acervo/*` em `tsconfig.app.json` **não** precisou entrar em `include` (diferente de
`@seeds/*.json`, que `seed.ts` importa estaticamente por arquivo) — o glob não é uma importação
estática por caminho, é resolvido pelo Vite em runtime/build, então o TS só precisa do alias de
`paths` para o `import.meta.glob` typar certo.

---

## Pendências

**Nada foi testado em Supabase real.** RLS, `auth.uid()`, o trigger em `auth.users` e os GRANTs para
`anon`/`authenticated` foram validados contra um **stub** do schema `auth` montado à mão. O
comportamento real do PostgREST (colunas expostas, `search_path` dos papéis, `service_role`) segue
não verificado. Primeira coisa a fazer quando houver projeto: aplicar 0001–0013 numa branch do
Supabase e rodar `get_advisors` de segurança.

**Migração de progresso quando o edital real da RFB entrar.** Não haverá migração de dado — é o
ponto da decisão de prender a sessão ao assunto. O que **vai** haver é trabalho de mapeamento:
preencher `item_edital_assunto` ligando cada linha literal do edital aos assuntos da taxonomia.
Enquanto essa ponte estiver vazia, `vw_progresso_item_edital` devolve todas as linhas em
`nao_estudado`, com minutos zerados — e isso é correto, não é bug. Vale conferir também se o rateio
igualitário entre linhas continua defensável quando uma linha do edital for muito maior que outra;
hoje `item_edital` não tem peso.

**Remapeamento da taxonomia depois da primeira ingestão.** A árvore atual é anterior às provas. Ao
remapear: **não apagar slug** que já tenha questão, esquema ou progresso ligado — `aplicar_seeds.sql`
lista os órfãos justamente para essa conversa. Se um assunto precisar ser dividido, o caminho é
criar os novos e reclassificar `questao_assunto`, mantendo o antigo até a reclassificação terminar.

**Índices são hipótese, não medida.** Foram criados por consulta prevista (fila de revisão por
`(usuario_id, devida_em)`, caderno de erros por `WHERE not correta`, acervo por `(prova_id, numero)`).
Nenhum foi medido — não há dado. Revisar com `pg_stat_user_indexes` depois da primeira carga real e
derrubar o que nunca for usado.

**Testar 0014/0015 num Supabase real** quando houver projeto — junto com o resto (ver pendência
acima sobre nada ter sido testado em Supabase real). Conferir em especial: o `DROP ... CASCADE` de
`card`/`revisao`/`revisao_log` derruba as 4 views na ordem certa e as recriadas ficam com
`security_invoker = on` (a consulta de conferência já documentada acima serve para isso); e a
constraint `questao_apostila_exige_atribuicao_ck` da 0015 não conflita com nenhuma linha existente
se algum dia isto rodar sobre uma base que já tenha `apostila_comentada` sem `revisado_humano`.

**Reconciliar `tipos.ts` × `supabase/migrations/`** (ver Armadilhas acima) fica pendente para quando
o Supabase entrar de verdade — hoje não é urgente porque nada roda sobre a SQL.

**Interface, para o `designer`:** três coisas que o schema entrega e a tela precisa tratar.
(1) questão `desatualizada` **conta** na estatística e tem que exibir aviso, com o texto de
`questao.nota_desatualizacao`; (2) tentativa que **não** é a primeira precisa aparecer marcada como
treino no caderno de erros, senão o usuário acha que a estatística está errada; (3) placar líquido
só pode aparecer onde `prova.penalidade_por_erro` é verdadeiro — em prova de múltipla escolha,
mostrar "líquido" mente na direção oposta.

**`tipo_erro` é opcional no banco.** A invariante do produto quer o diagnóstico em todo erro, mas
exigir NOT NULL forçaria a interface a bloquear o usuário a cada questão errada. Ficou anulável, com
CHECK impedindo preenchimento em resposta correta. Se a tela conseguir cobrar sem atrito, apertar
depois é uma migration de uma linha.

**`7_publicar.py` (coletor) ainda não aplica a propagação prova→questão da atribuição.** A decisão
de 2026-09-01 acima (mesma seção, "Decisões") resolve isso do lado do app local
(`carregarAcervo()`); o `coletor` registrou a mesma lacuna no próprio diário para o script Python que
escreve no Supabase (`docs/agents/coletor.md`, Pendências). Quando esse script escrever de verdade,
usar o mesmo padrão — toda questão herda `autor_fonte`/`titulo_fonte` da prova do artefato — para os
dois lados não divergirem.

**`carregarAcervo()` é upsert-only: não existe caminho para retratar uma questão.** Se uma versão
futura de um artefato remover uma questão que já foi importada (reclassificação, erro corrigido
removendo a linha em vez de marcar `anulada`), a linha antiga fica órfã no Dexie — importar não
apaga o que não está mais no artefato. Hoje isso não morde (o pipeline sempre marca `anulada`, nunca
remove a linha), mas se algum dia um artefato precisar "recolher" uma questão publicada por engano,
vai precisar de um mecanismo explícito de retratação (marcar/arquivar), não de upsert.

**`app/src/dados/consultas.ts` (`estadoAcervo`/`FonteAcervo`) e `app/src/app/routes/Mais.tsx`
mudaram nesta rodada** — novo card "Acervo" listando fonte (banca ou autor+título) com contagem, e
o texto "Sem conta · ..." atualizado para refletir que o acervo carrega sozinho no boot. Ficou só
texto/leitura de dado, sem decisão de layout — se o `designer` quiser tratar visualmente diferente
(ex.: separar "Acervo" de "Questões de exemplo" com mais destaque, ou revisar a hierarquia dos
Cards em `Mais.tsx`), é território dele, não foi reaberto aqui.

**Import automático do acervo roda em todo boot sem tela de progresso.** Para os 4 artefatos atuais
(100 questões) é instantâneo; se o acervo crescer para milhares de questões, upsert-a-cada-boot pode
passar a valer a pena mostrar algum feedback de carregamento — hoje `main.tsx` só bloqueia o
primeiro render até `garantirSeeds()` + `carregarAcervo()` resolverem, sem barra de progresso nem
cache de "já rodei esta versão" (ver Decisões acima, por que isso foi deliberado por ora).
