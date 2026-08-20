-- 0009_resposta.sql
--
-- O QUE FAZ
--   Respostas do usuário e o botão "reportar erro".
--
--   DECISÃO (2026-08-20): só a PRIMEIRA tentativa de cada questão conta na
--   estatística. As demais ficam gravadas como TREINO e ficam fora de toda
--   agregação. Isso é garantido em dois níveis:
--     - trigger BEFORE INSERT calcula `primeira_tentativa` (o app não escolhe);
--     - trigger BEFORE UPDATE congela o valor (ninguém "promove" uma tentativa);
--     - índice único parcial garante no máximo uma primeira tentativa por
--       (usuario, questao), inclusive sob concorrência.
--
--   `confianca` é NOT NULL: sem ela a estatística engana (acertar chutando não é
--   domínio). `tipo_erro` é opcional, mas só pode existir em resposta errada.
--
-- CAMINHO DE VOLTA
--   drop table if exists reporte_questao, resposta cascade;
--   drop function if exists rito.tg_resposta_primeira_tentativa(), rito.tg_resposta_congela_tentativa();

create table resposta (
  id                 uuid               primary key default gen_random_uuid(),
  usuario_id         uuid               not null references usuario(id) on delete cascade,
  questao_id         uuid               not null references questao(id) on delete cascade,
  sessao_id          uuid,
  marcada            text,
  correta            boolean            not null,
  segundos           integer            check (segundos >= 0),
  confianca          confianca_resposta not null,
  tipo_erro          text               check (tipo_erro in (
                        'conteudo', 'leitura_apressada', 'pegadinha_semantica',
                        'mudanca_de_lei', 'chute', 'outro'
                      )),
  primeira_tentativa boolean            not null default false,
  respondida_em      timestamptz        not null default now(),

  em_branco boolean generated always as (marcada is null) stored,

  constraint resposta_marcada_ck check (
    marcada is null or marcada ~ '^[A-E]$' or marcada in ('C', 'E')
  ),
  constraint resposta_em_branco_nao_acerta_ck check (marcada is not null or not correta),
  constraint resposta_tipo_erro_so_no_erro_ck check (tipo_erro is null or not correta),
  constraint resposta_sessao_fk foreign key (sessao_id, usuario_id)
    references sessao (id, usuario_id) on delete set null (sessao_id),
  -- alvo da FK composta de `card.resposta_id` (migration 0010)
  constraint resposta_id_usuario_uk unique (id, usuario_id)
);
comment on table resposta is
  'Toda tentativa fica gravada. Só a primeira entra na estatística; as demais são treino.';
comment on column resposta.marcada is 'Nulo = deixou em branco. Em branco nunca é acerto.';
comment on column resposta.tipo_erro is
  'Diagnóstico do erro. text + CHECK porque a taxonomia de erro vai crescer com as provas.';
comment on column resposta.primeira_tentativa is
  'DERIVADA por trigger e congelada. Nunca escrever à mão.';

-- garante no máximo uma primeira tentativa por questão, mesmo com corrida
create unique index resposta_primeira_tentativa_uk
  on resposta (usuario_id, questao_id) where primeira_tentativa;

create index resposta_usuario_periodo_idx on resposta (usuario_id, respondida_em desc);
create index resposta_questao_idx         on resposta (questao_id);
create index resposta_erros_idx           on resposta (usuario_id, questao_id) where not correta;
create index resposta_sessao_idx          on resposta (sessao_id) where sessao_id is not null;

create or replace function rito.tg_resposta_primeira_tentativa()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.primeira_tentativa := not exists (
    select 1 from resposta r
     where r.usuario_id = new.usuario_id
       and r.questao_id = new.questao_id
       and r.id <> new.id
  );
  return new;
end;
$$;

create or replace function rito.tg_resposta_congela_tentativa()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.primeira_tentativa := old.primeira_tentativa;
  new.usuario_id         := old.usuario_id;
  new.questao_id         := old.questao_id;
  return new;
end;
$$;
comment on function rito.tg_resposta_congela_tentativa() is
  'Impede reescrever a história: quem foi a primeira tentativa não muda depois do INSERT.';

create trigger resposta_primeira_tentativa
  before insert on resposta
  for each row execute function rito.tg_resposta_primeira_tentativa();

create trigger resposta_congela_tentativa
  before update on resposta
  for each row execute function rito.tg_resposta_congela_tentativa();

create table reporte_questao (
  id            uuid        primary key default gen_random_uuid(),
  usuario_id    uuid        not null references usuario(id) on delete cascade,
  questao_id    uuid        not null references questao(id) on delete cascade,
  motivo        text        not null check (motivo in (
                  'gabarito_errado', 'enunciado_incompleto', 'classificacao_errada',
                  'desatualizada', 'anulada_nao_marcada', 'outro'
                )),
  detalhe       text,
  status        text        not null default 'aberto'
                            check (status in ('aberto', 'procede', 'improcede')),
  criado_em     timestamptz not null default now(),
  resolvido_em  timestamptz,
  constraint reporte_resolvido_ck check ((status = 'aberto') = (resolvido_em is null))
);
comment on table reporte_questao is 'Botão "reportar erro". Alimenta a fila de correção do acervo.';

create index reporte_questao_abertos_idx on reporte_questao (questao_id) where status = 'aberto';
create index reporte_questao_usuario_idx on reporte_questao (usuario_id);
