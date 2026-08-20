-- 0007_plano_e_ciclo.sql
--
-- O QUE FAZ
--   Planejamento por CICLO de estudos (fila que não pune atraso), não cronograma.
--   `plano` aponta para um edital de forma OPCIONAL: hoje não há edital cadastrado
--   e o usuário precisa poder rodar um ciclo mesmo assim.
--
--   Padrão que se repete daqui em diante: toda tabela de dado do usuário carrega
--   `usuario_id` própria (mesmo sendo filha de outra que já o tem) e amarra por FK
--   COMPOSTA na tabela pai. Custa uma coluna e uma unique; em troca, a política de
--   RLS vira `usuario_id = rito.usuario_atual()` — sem subconsulta, sem EXISTS
--   caro em cada linha, e sem risco de um filho pertencer a outro dono.
--
-- CAMINHO DE VOLTA
--   drop table if exists bloco_ciclo, plano cascade;

create table plano (
  id             uuid        primary key default gen_random_uuid(),
  usuario_id     uuid        not null references usuario(id) on delete cascade,
  edital_id      uuid        references edital(id) on delete set null,
  nome           text        not null default 'Ciclo de estudos' check (btrim(nome) <> ''),
  tipo           text        not null default 'ciclo' check (tipo in ('ciclo')),
  horas_semana   numeric(4,1) check (horas_semana > 0),
  data_prova     date,
  ativo          boolean     not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint plano_id_usuario_uk unique (id, usuario_id)
);
comment on column plano.edital_id is
  'Opcional de propósito: o edital da RFB ainda não existe e o ciclo tem que rodar sem ele.';
comment on column plano.tipo is
  'Só ''ciclo'' hoje. Cronograma com data fica para depois — o CHECK cresce, não vira enum.';

create unique index plano_ativo_uk on plano (usuario_id) where ativo;

create trigger plano_atualizado_em
  before update on plano for each row execute function rito.tg_atualizado_em();

create table bloco_ciclo (
  id             uuid        primary key default gen_random_uuid(),
  plano_id       uuid        not null,
  usuario_id     uuid        not null,
  disciplina_id  uuid        not null references disciplina(id) on delete restrict,
  assunto_id     uuid        references assunto(id) on delete set null,
  minutos        integer     not null check (minutos between 5 and 480),
  ordem          smallint    not null check (ordem > 0),
  peso           numeric(4,2) not null default 1 check (peso > 0),
  concluido_em   timestamptz,
  criado_em      timestamptz not null default now(),
  constraint bloco_ciclo_plano_fk foreign key (plano_id, usuario_id)
    references plano (id, usuario_id) on delete cascade,
  constraint bloco_ciclo_ordem_uk unique (plano_id, ordem),
  constraint bloco_ciclo_id_usuario_uk unique (id, usuario_id)
);
comment on table bloco_ciclo is
  'Um bloco do ciclo. Sem data: o ciclo é fila, e atraso não gera dívida nem culpa.';

create index bloco_ciclo_usuario_idx on bloco_ciclo (usuario_id, plano_id, ordem);
