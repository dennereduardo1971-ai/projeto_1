-- 0010_fsrs_cards_e_revisoes.sql
--
-- O QUE FAZ
--   Cards e agendamento FSRS.
--
--   Divisão de trabalho: o BANCO guarda estado (estabilidade, dificuldade,
--   devida_em, ultima_nota) e histórico; a BIBLIOTECA (`ts-fsrs`) calcula. Nada
--   de reimplementar o algoritmo em SQL. A tela nunca mostra esses números —
--   o usuário vê "revisar hoje", não fator de facilidade.
--
--   `revisao` é 1:1 com `card` (PK = card_id): é o estado atual do agendamento.
--   `revisao_log` é o histórico append-only — é o que permite reotimizar os
--   parâmetros do FSRS depois, e o que se perde para sempre se não for gravado
--   desde o começo.
--
-- CAMINHO DE VOLTA
--   drop table if exists revisao_log, revisao, card cascade;

create table card (
  id             uuid        primary key default gen_random_uuid(),
  usuario_id     uuid        not null references usuario(id) on delete cascade,
  origem         text        not null check (origem in ('erro', 'questao', 'assunto', 'manual')),
  questao_id     uuid        references questao(id)  on delete cascade,
  assunto_id     uuid        references assunto(id)  on delete cascade,
  resposta_id    uuid,
  frente         text        not null check (btrim(frente) <> ''),
  verso          text        not null check (btrim(verso) <> ''),
  suspenso       boolean     not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  constraint card_origem_exige_alvo_ck check (
       (origem in ('erro', 'questao') and questao_id is not null)
    or (origem = 'assunto' and assunto_id is not null)
    or (origem = 'manual')
  ),
  -- questao_id e assunto_id são nulos conforme a origem; sem NULLS NOT DISTINCT
  -- o UNIQUE deixaria criar infinitos cards iguais para o mesmo erro.
  constraint card_unico_por_origem_uk unique nulls not distinct (usuario_id, origem, questao_id, assunto_id),
  constraint card_resposta_fk foreign key (resposta_id, usuario_id)
    references resposta (id, usuario_id) on delete set null (resposta_id),
  constraint card_id_usuario_uk unique (id, usuario_id)
);
comment on table card is 'Card de revisão. Erro do caderno vira card com origem = ''erro''.';

create index card_usuario_idx on card (usuario_id) where not suspenso;
create index card_questao_idx on card (questao_id) where questao_id is not null;
create index card_assunto_idx on card (assunto_id) where assunto_id is not null;

create trigger card_atualizado_em
  before update on card for each row execute function rito.tg_atualizado_em();

create table revisao (
  card_id            uuid             primary key,
  usuario_id         uuid             not null,
  estado             text             not null default 'novo'
                                      check (estado in ('novo', 'aprendendo', 'revisao', 'reaprendendo')),
  devida_em          timestamptz      not null default now(),
  estabilidade       double precision check (estabilidade > 0),
  dificuldade        double precision check (dificuldade between 1 and 10),
  ultima_nota        smallint         check (ultima_nota between 1 and 4),
  repeticoes         integer          not null default 0 check (repeticoes >= 0),
  lapsos             integer          not null default 0 check (lapsos >= 0),
  ultima_revisao_em  timestamptz,
  atualizado_em      timestamptz      not null default now(),
  constraint revisao_card_fk foreign key (card_id, usuario_id)
    references card (id, usuario_id) on delete cascade
);
comment on table revisao is
  'Estado atual do agendamento FSRS. Escrito pela ts-fsrs; o banco não calcula intervalo.';
comment on column revisao.ultima_nota is 'Nota FSRS: 1 again, 2 hard, 3 good, 4 easy.';

-- a fila do dia é UMA consulta ordenada por atraso; este é o índice dela
create index revisao_fila_idx on revisao (usuario_id, devida_em);

create trigger revisao_atualizado_em
  before update on revisao for each row execute function rito.tg_atualizado_em();

create table revisao_log (
  id                   bigint      generated always as identity primary key,
  card_id              uuid        not null,
  usuario_id           uuid        not null,
  revisado_em          timestamptz not null default now(),
  nota                 smallint    not null check (nota between 1 and 4),
  segundos             integer     check (segundos >= 0),
  estado_antes         text,
  estabilidade_antes   double precision,
  dificuldade_antes    double precision,
  estado_depois        text,
  estabilidade_depois  double precision,
  dificuldade_depois   double precision,
  devida_em_depois     timestamptz,
  constraint revisao_log_card_fk foreign key (card_id, usuario_id)
    references card (id, usuario_id) on delete cascade
);
comment on table revisao_log is
  'Histórico append-only de revisões. Insumo para reotimizar os parâmetros do FSRS — se não gravar, não se recupera.';

create index revisao_log_card_idx    on revisao_log (card_id, revisado_em desc);
create index revisao_log_usuario_idx on revisao_log (usuario_id, revisado_em desc);
