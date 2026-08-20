-- 0008_sessao.sql
--
-- O QUE FAZ
--   Sessão de estudo cronometrada.
--
--   DECISÃO (2026-08-20): a sessão se prende a `assunto_id`, NÃO a
--   `item_edital_id`. Motivo: o assunto existe hoje (vem dos seeds), o edital
--   não. Quando o edital da RFB entrar, os minutos rateiam para as linhas do
--   edital pela ponte item_edital_assunto — ver a view `vw_sessao_item_edital`
--   na migration 0011. Nada precisa ser reescrito: sessão antiga passa a
--   contribuir para o Mapa do Edital no dia em que o edital chega.
--
--   `minutos` é coluna GERADA a partir do intervalo. Sessão aberta vale 0 —
--   cronômetro rodando não conta como estudo.
--
-- CAMINHO DE VOLTA
--   drop table if exists sessao cascade;

create table sessao (
  id              uuid        primary key default gen_random_uuid(),
  usuario_id      uuid        not null references usuario(id) on delete cascade,
  plano_id        uuid,
  bloco_ciclo_id  uuid,
  assunto_id      uuid        references assunto(id) on delete set null,
  tipo            text        not null check (tipo in ('teoria', 'questoes', 'revisao')),
  iniciada_em     timestamptz not null default now(),
  encerrada_em    timestamptz,
  nota            text,
  criado_em       timestamptz not null default now(),

  minutos integer generated always as (
    case
      when encerrada_em is null then 0
      else greatest(0, floor(extract(epoch from (encerrada_em - iniciada_em)) / 60)::integer)
    end
  ) stored,

  constraint sessao_intervalo_ck check (encerrada_em is null or encerrada_em >= iniciada_em),
  constraint sessao_plano_fk foreign key (plano_id, usuario_id)
    references plano (id, usuario_id) on delete set null (plano_id),
  constraint sessao_bloco_fk foreign key (bloco_ciclo_id, usuario_id)
    references bloco_ciclo (id, usuario_id) on delete set null (bloco_ciclo_id),
  constraint sessao_id_usuario_uk unique (id, usuario_id)
);
comment on table sessao is
  'Sessão cronometrada, presa ao ASSUNTO. Os minutos rateiam para o edital pela view vw_sessao_item_edital.';
comment on column sessao.minutos is
  'GERADA. Sessão em aberto vale 0: cronômetro rodando não é estudo registrado.';
comment on constraint sessao_plano_fk on sessao is
  'ON DELETE SET NULL só na coluna plano_id — apagar o plano não pode zerar usuario_id (NOT NULL). Exige PG 15+.';

-- Um cronômetro por vez.
create unique index sessao_aberta_uk on sessao (usuario_id) where encerrada_em is null;

create index sessao_usuario_periodo_idx on sessao (usuario_id, iniciada_em desc);
create index sessao_assunto_idx         on sessao (assunto_id) where assunto_id is not null;
