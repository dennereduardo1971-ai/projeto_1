-- 0003_edital.sql
--
-- O QUE FAZ
--   O edital verticalizado: concurso → cargo → edital(versão) → item_edital,
--   e a ponte n:n `item_edital_assunto` que liga a linha literal do edital à
--   taxonomia. É essa ponte que faz "uma linha do edital" ser a unidade do app.
--
--   `item_edital.texto_literal` é cópia LITERAL do edital, de propósito: o
--   concurseiro precisa reconhecer a frase. Não normalizar, não resumir.
--
--   Estas tabelas nascem VAZIAS. O edital da RFB ainda não existe (autorizado em
--   07/2026, publicação até 01/2027) e a banca não foi contratada — por isso
--   `concurso.banca` é text, nunca enum (CLAUDE.md, regra 1).
--
-- CAMINHO DE VOLTA
--   drop table if exists item_edital_assunto, item_edital, edital, cargo, concurso cascade;

create table concurso (
  id             uuid        primary key default gen_random_uuid(),
  slug           text        not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome           text        not null check (btrim(nome) <> ''),
  orgao          text        not null check (btrim(orgao) <> ''),
  banca          text        check (banca is null or btrim(banca) <> ''),
  ano            smallint    not null check (ano between 1990 and 2100),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
comment on column concurso.banca is
  'Nulo enquanto a banca não é contratada (é o caso da RFB 2026/2027). Nunca vira enum.';

create trigger concurso_atualizado_em
  before update on concurso for each row execute function rito.tg_atualizado_em();

create table cargo (
  id            uuid        primary key default gen_random_uuid(),
  concurso_id   uuid        not null references concurso(id) on delete cascade,
  slug          text        not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome          text        not null check (btrim(nome) <> ''),
  vagas         integer     check (vagas >= 0),
  criado_em     timestamptz not null default now(),
  constraint cargo_slug_uk unique (concurso_id, slug)
);

create table edital (
  id            uuid        primary key default gen_random_uuid(),
  cargo_id      uuid        not null references cargo(id) on delete cascade,
  versao        text        not null check (btrim(versao) <> ''),
  publicado_em  date,
  url_fonte     text,
  vigente       boolean     not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint edital_versao_uk unique (cargo_id, versao)
);
comment on column edital.versao is 'Versão/retificação do edital ("original", "retificacao-1", ...).';

-- Um único edital vigente por cargo. Retificação nova = desliga a anterior.
create unique index edital_vigente_uk on edital (cargo_id) where vigente;

create trigger edital_atualizado_em
  before update on edital for each row execute function rito.tg_atualizado_em();

create table item_edital (
  id             uuid        primary key default gen_random_uuid(),
  edital_id      uuid        not null references edital(id) on delete cascade,
  disciplina_id  uuid        references disciplina(id) on delete set null,
  ordem          integer     not null check (ordem > 0),
  numeracao      text,
  texto_literal  text        not null check (btrim(texto_literal) <> ''),
  criado_em      timestamptz not null default now(),
  constraint item_edital_ordem_uk unique (edital_id, ordem)
);
comment on column item_edital.texto_literal is
  'Texto COPIADO do edital, sem edição. O reconhecimento da frase é parte do produto.';
comment on column item_edital.numeracao is
  'Numeração como aparece no edital ("1.2.3", "9"). Texto, porque nem sempre é numérica.';

create index item_edital_disciplina_idx on item_edital (disciplina_id);

create table item_edital_assunto (
  item_edital_id  uuid not null references item_edital(id) on delete cascade,
  assunto_id      uuid not null references assunto(id)     on delete cascade,
  primary key (item_edital_id, assunto_id)
);
comment on table item_edital_assunto is
  'Ponte n:n. É por aqui que os minutos de uma sessão (presa a assunto) rateiam para as linhas do edital.';

create index item_edital_assunto_assunto_idx on item_edital_assunto (assunto_id);
