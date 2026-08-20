-- 0005_esquemas.sql
--
-- O QUE FAZ
--   Material de leitura esquematizado. A unidade é o ASSUNTO (e pela ponte
--   item_edital_assunto chega à linha do edital). Seções são tipadas para a tela
--   saber renderizar cada bloco de jeito diferente.
--
--   `esquema_fonte_questao` guarda de quais questões o esquema saiu — é o que
--   permite dizer "este ponto caiu em TCU 2025". A justificativa da banca é
--   FONTE, nunca conteúdo republicado (CLAUDE.md, regra 5): por isso não existe
--   coluna para armazenar texto de terceiro.
--
-- CAMINHO DE VOLTA
--   drop table if exists esquema_fonte_questao, esquema_secao, esquema cascade;

create table esquema (
  id             uuid        primary key default gen_random_uuid(),
  assunto_id     uuid        not null unique references assunto(id) on delete cascade,
  titulo         text        not null check (btrim(titulo) <> ''),
  resumo         text,
  publicado      boolean     not null default false,
  revisado_em    date,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint esquema_publicado_exige_revisao_ck check (not publicado or revisado_em is not null)
);
comment on table esquema is
  'Um esquema por assunto. Só publica depois de revisão humana (revisado_em obrigatório).';

create trigger esquema_atualizado_em
  before update on esquema for each row execute function rito.tg_atualizado_em();

create table esquema_secao (
  id           uuid        primary key default gen_random_uuid(),
  esquema_id   uuid        not null references esquema(id) on delete cascade,
  ordem        smallint    not null check (ordem > 0),
  tipo         text        not null check (tipo in (
                 'conceito', 'lei_seca', 'tabela_comparativa', 'pegadinha_da_banca', 'sumula'
               )),
  titulo       text,
  conteudo_md  text        not null check (btrim(conteudo_md) <> ''),
  constraint esquema_secao_ordem_uk unique (esquema_id, ordem)
);
comment on column esquema_secao.tipo is
  'text + CHECK, não enum: a lista de tipos de seção deve poder crescer sem migration de tipo.';

create table esquema_fonte_questao (
  esquema_id  uuid not null references esquema(id)  on delete cascade,
  questao_id  uuid not null references questao(id)  on delete cascade,
  primary key (esquema_id, questao_id)
);
comment on table esquema_fonte_questao is
  'Questões que originaram o esquema. Atribuição, e insumo para o destaque do que o usuário errou.';

create index esquema_fonte_questao_questao_idx on esquema_fonte_questao (questao_id);
