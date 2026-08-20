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
| 0010 | `fsrs_cards_e_revisoes.sql` | `card`, `revisao`, `revisao_log` |
| 0011 | `views_de_desempenho.sql` | 13 views, todas `security_invoker = on` |
| 0012 | `rls.sql` | RLS ligado em 24 tabelas + políticas |
| 0013 | `supabase_auth.sql` | **ISOLADA. Não aplicar nesta fase.** Único arquivo que toca `auth.users`, `auth.uid()` e os papéis `anon`/`authenticated` |

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

**`ts-fsrs` ainda não escolheu a escala.** `revisao.ultima_nota` e `revisao_log.nota` assumem 1–4
(again/hard/good/easy). Conferir contra a versão da biblioteca antes da Fase 3; se divergir, é um
`ALTER` de CHECK, barato — mas só enquanto não houver histórico gravado.

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
