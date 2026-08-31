-- 0014_dominio_assunto_e_gamificacao.sql
--
-- O QUE FAZ
--   Pivô de 2026-08-31 (CLAUDE.md, regra 8): substitui `card` + `revisao` +
--   `revisao_log` (FSRS separado, criados na 0010) por um único estado de
--   domínio por assunto — habilidade latente + domínio com esquecimento,
--   unificado com a fila de revisão, no molde do motor do APP-CPA-YOHANNA.
--   O motor que faz a conta mora em `app/src/features/dominio/` (TS puro); o
--   banco só guarda o estado.
--
--   Drop em CASCADE em `card`/`revisao`/`revisao_log` derruba junto as views
--   de 0011 que dependiam deles (`vw_revisao_atrasada_assunto`,
--   `vw_caderno_erros`, e por transitividade `vw_progresso_assunto` e
--   `vw_progresso_item_edital`). Como nada disto foi aplicado a um Supabase
--   real ainda (ver docs/agents/dados.md), recriar aqui é seguro — não há
--   dado de produção para migrar.
--
--   Também entram as tabelas de gamificação (sequência, XP, conquistas,
--   metas) — o catálogo de conquistas fica em código
--   (`features/dominio/gamification.ts`), não em tabela.
--
-- CAMINHO DE VOLTA
--   drop view if exists vw_progresso_item_edital, vw_progresso_assunto,
--     vw_caderno_erros, vw_revisao_atrasada_assunto;
--   drop table if exists meta, conquista_usuario, evento_xp, sequencia, estado_assunto cascade;
--   -- e reaplicar a 0010 + a forma antiga das views de 0011.

-- ---------------------------------------------------------------------------
-- Sai o FSRS separado
-- ---------------------------------------------------------------------------
drop view if exists vw_progresso_item_edital;
drop view if exists vw_progresso_assunto;
drop view if exists vw_caderno_erros;
drop view if exists vw_revisao_atrasada_assunto;

drop table if exists revisao_log, revisao, card cascade;

-- ---------------------------------------------------------------------------
-- Entra o estado único de domínio por assunto
-- ---------------------------------------------------------------------------
create table estado_assunto (
  usuario_id        uuid             not null references usuario(id)  on delete cascade,
  assunto_id        uuid             not null references assunto(id)  on delete cascade,
  theta             double precision not null default 0,
  m                 double precision not null default 0.5 check (m between 0 and 1),
  n                 integer          not null default 0 check (n >= 0),
  acertos           integer          not null default 0 check (acertos >= 0),
  estabilidade      double precision not null default 1 check (estabilidade > 0),
  ultima_pratica_em timestamptz,
  revisar_em        timestamptz,
  esquema_concluido boolean          not null default false,
  erros_abertos     integer          not null default 0 check (erros_abertos >= 0),
  atualizado_em     timestamptz      not null default now(),
  primary key (usuario_id, assunto_id),
  constraint estado_assunto_acertos_ck check (acertos <= n)
);
comment on table estado_assunto is
  'Domínio e revisão de um assunto — um único estado (habilidade + esquecimento), no lugar de card/revisao. Motor em app/src/features/dominio/mastery.ts.';
comment on column estado_assunto.m is 'Domínio 0–1, sem decaimento (chance de acertar uma questão de dificuldade média).';
comment on column estado_assunto.revisar_em is 'Quando a revisão deste assunto vence. Fila do dia = esta coluna <= now().';

-- a fila do dia é UMA consulta ordenada por atraso; este é o índice dela
create index estado_assunto_fila_idx on estado_assunto (usuario_id, revisar_em) where revisar_em is not null;
create index estado_assunto_erros_idx on estado_assunto (usuario_id) where erros_abertos > 0;

create trigger estado_assunto_atualizado_em
  before update on estado_assunto for each row execute function rito.tg_atualizado_em();

-- ---------------------------------------------------------------------------
-- Gamificação — tom sóbrio (CLAUDE.md regra 7): mecânica de jogo é permitida,
-- estética de jogo infantil não.
-- ---------------------------------------------------------------------------
create table sequencia (
  usuario_id     uuid        primary key references usuario(id) on delete cascade,
  atual          integer     not null default 0 check (atual >= 0),
  recorde        integer     not null default 0 check (recorde >= 0),
  ultimo_dia     date,
  congelamentos  integer     not null default 0 check (congelamentos >= 0),
  atualizado_em  timestamptz not null default now()
);
comment on table sequencia is 'Sequência de estudo do usuário. Uma linha por usuário — regra em app/src/features/dominio/gamification.ts.';

create trigger sequencia_atualizado_em
  before update on sequencia for each row execute function rito.tg_atualizado_em();

create table evento_xp (
  id         bigint      generated always as identity primary key,
  usuario_id uuid        not null references usuario(id) on delete cascade,
  pontos     integer     not null,
  motivo     text        not null check (btrim(motivo) <> ''),
  criado_em  timestamptz not null default now()
);
comment on table evento_xp is 'Log append-only de XP. Nível é derivado (soma), nunca gravado.';

create index evento_xp_usuario_idx on evento_xp (usuario_id, criado_em desc);

create table conquista_usuario (
  usuario_id    uuid        not null references usuario(id) on delete cascade,
  conquista_id  text        not null check (btrim(conquista_id) <> ''),
  obtida_em     timestamptz not null default now(),
  primary key (usuario_id, conquista_id)
);
comment on table conquista_usuario is
  'Conquistas desbloqueadas. O catálogo (nome, descrição, regra) fica em código — features/dominio/gamification.ts — não aqui.';

create table meta (
  usuario_id     uuid        primary key references usuario(id) on delete cascade,
  minutos_dia    integer     not null default 0 check (minutos_dia >= 0),
  questoes_dia   integer     not null default 0 check (questoes_dia >= 0),
  dias_semana    integer     not null default 0 check (dias_semana between 0 and 7),
  data_prova     date,
  atualizado_em  timestamptz not null default now()
);
comment on table meta is 'Meta diária/semanal declarada pelo usuário. Uma linha por usuário.';

create trigger meta_atualizado_em
  before update on meta for each row execute function rito.tg_atualizado_em();

-- ---------------------------------------------------------------------------
-- Views recriadas contra estado_assunto (mesma forma de saída da 0011 —
-- quem consultava vw_progresso_assunto/vw_progresso_item_edital não precisa
-- mudar nada).
-- ---------------------------------------------------------------------------
create view vw_revisao_atrasada_assunto with (security_invoker = on) as
select ea.usuario_id,
       anc.ancestral_id as assunto_id,
       count(distinct ea.assunto_id)::integer as revisoes_atrasadas
  from estado_assunto ea
  join vw_assunto_ancestral anc on anc.assunto_id = ea.assunto_id
 where ea.revisar_em is not null
   and ea.revisar_em <= now()
 group by ea.usuario_id, anc.ancestral_id;
comment on view vw_revisao_atrasada_assunto is
  'Revisão atrasada = revisar_em vencido, rolado para os ancestrais. Terceiro requisito do nível ''dominado''.';

create view vw_progresso_assunto with (security_invoker = on) as
select u.id as usuario_id,
       a.id as assunto_id,
       a.disciplina_id,
       a.pai_id,
       a.nivel as nivel_arvore,
       coalesce(m.minutos, 0)              as minutos,
       coalesce(d.respondidas, 0)          as respondidas,
       coalesce(d.acertos, 0)              as acertos,
       coalesce(d.erros, 0)                as erros,
       coalesce(d.brancos, 0)              as brancos,
       d.taxa_acerto,
       coalesce(d.saldo_liquido, 0)        as saldo_liquido,
       coalesce(d.acertos_no_chute, 0)     as acertos_no_chute,
       coalesce(d.erros_com_certeza, 0)    as erros_com_certeza,
       coalesce(ra.revisoes_atrasadas, 0)  as revisoes_atrasadas,
       greatest(m.ultima_sessao_em, d.ultima_resposta_em) as ultima_atividade_em,
       rito.calcula_nivel(
         coalesce(m.minutos, 0),
         coalesce(d.respondidas, 0),
         coalesce(d.acertos, 0),
         coalesce(ra.revisoes_atrasadas, 0)
       ) as nivel
  from usuario u
  cross join assunto a
  left join vw_minutos_assunto           m  on m.usuario_id  = u.id and m.assunto_id  = a.id
  left join vw_desempenho_assunto        d  on d.usuario_id  = u.id and d.assunto_id  = a.id
  left join vw_revisao_atrasada_assunto  ra on ra.usuario_id = u.id and ra.assunto_id = a.id;
comment on view vw_progresso_assunto is
  'Nível de domínio por assunto. Não existe tabela de progresso: derivar por view torna impossível gravar nível errado.';

create view vw_progresso_item_edital with (security_invoker = on) as
with minutos as (
  select usuario_id, item_edital_id, round(sum(minutos_rateados))::integer as minutos
    from vw_sessao_item_edital
   group by usuario_id, item_edital_id
),
desempenho as (
  select usuario_id, item_edital_id,
         count(*)::integer                                              as respondidas,
         count(*) filter (where correta)::integer                       as acertos,
         count(*) filter (where not correta and not em_branco)::integer as erros,
         sum(case when correta then 1
                  when em_branco then 0
                  when penalidade_por_erro then -1
                  else 0 end)::integer  as saldo_liquido
    from vw_resposta_item_edital
   group by usuario_id, item_edital_id
),
atrasadas as (
  select r.usuario_id, iea.item_edital_id, count(distinct r.assunto_id)::integer as revisoes_atrasadas
    from vw_revisao_atrasada_assunto r
    join item_edital_assunto iea on iea.assunto_id = r.assunto_id
   group by r.usuario_id, iea.item_edital_id
)
select u.id  as usuario_id,
       ie.id as item_edital_id,
       ie.edital_id,
       ie.ordem,
       ie.texto_literal,
       coalesce(m.minutos, 0)             as minutos,
       coalesce(d.respondidas, 0)         as respondidas,
       coalesce(d.acertos, 0)             as acertos,
       coalesce(d.erros, 0)               as erros,
       coalesce(d.saldo_liquido, 0)       as saldo_liquido,
       coalesce(a.revisoes_atrasadas, 0)  as revisoes_atrasadas,
       rito.calcula_nivel(
         coalesce(m.minutos, 0),
         coalesce(d.respondidas, 0),
         coalesce(d.acertos, 0),
         coalesce(a.revisoes_atrasadas, 0)
       ) as nivel
  from usuario u
  cross join item_edital ie
  left join minutos    m on m.usuario_id = u.id and m.item_edital_id = ie.id
  left join desempenho d on d.usuario_id = u.id and d.item_edital_id = ie.id
  left join atrasadas  a on a.usuario_id = u.id and a.item_edital_id = ie.id;
comment on view vw_progresso_item_edital is
  'O Mapa do Edital. Uma linha por item de edital, pintada pelo nível derivado. Vazia enquanto não houver edital.';

create view vw_caderno_erros with (security_invoker = on) as
select r.id as resposta_id,
       r.usuario_id,
       r.questao_id,
       r.tipo_erro,
       r.confianca,
       r.marcada,
       r.primeira_tentativa,
       r.respondida_em,
       q.formato, q.numero, q.enunciado, q.gabarito,
       q.desatualizada, q.nota_desatualizacao, q.fonte_citacao,
       p.banca, p.ano, p.orgao, p.cargo_nome
  from resposta r
  join questao  q on q.id = r.questao_id and q.conta_estatistica
  join prova    p on p.id = q.prova_id
 where not r.correta;
comment on view vw_caderno_erros is
  'Caderno de erros: inclui tentativas de treino de propósito. É ferramenta de estudo, não estatística — a coluna primeira_tentativa diz qual é qual. Desde a 0014 não existe mais coluna "virou_card": todo erro atualiza estado_assunto direto, sem card intermediário.';

-- ---------------------------------------------------------------------------
-- RLS das tabelas novas — mesma família (b) da 0012: dono vê e mexe só no seu.
-- card/revisao/revisao_log saíram de cena acima; a política deles caiu junto
-- com as tabelas (RLS não sobrevive a um DROP TABLE).
-- ---------------------------------------------------------------------------
alter table estado_assunto    enable row level security;
alter table sequencia         enable row level security;
alter table evento_xp         enable row level security;
alter table conquista_usuario enable row level security;
alter table meta              enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'estado_assunto', 'sequencia', 'evento_xp', 'conquista_usuario', 'meta'
  ]
  loop
    execute format(
      'create policy dono on public.%I for all
         using      (usuario_id = (select rito.usuario_atual()))
         with check (usuario_id = (select rito.usuario_atual()))', t);
  end loop;
end;
$$;
