-- 0002_taxonomia.sql
--
-- O QUE FAZ
--   Taxonomia canônica do conteúdo: `disciplina` e `assunto`.
--   `assunto` é uma ÁRVORE (pai_id), então "tópico" não é uma tabela separada —
--   é um assunto filho (nivel = 2). Uma tabela só evita dois vocabulários
--   concorrentes quando a árvore precisar de um terceiro nível.
--
--   `slug` é a chave estável de negócio: os seeds fazem upsert por slug e a
--   taxonomia provisória será REMAPEADA quando as provas chegarem. Trocar o
--   nome é barato; trocar o slug quebra o seed.
--
--   Esta migration NÃO semeia conteúdo. A taxonomia entra por `seeds/`.
--
-- CAMINHO DE VOLTA
--   drop table if exists assunto, disciplina cascade;
--   drop function if exists rito.tg_assunto_hierarquia();

create table disciplina (
  id             uuid        primary key default gen_random_uuid(),
  slug           text        not null unique
                             check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome           text        not null check (btrim(nome) <> ''),
  ordem          smallint    not null default 0,
  ativa          boolean     not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
comment on table disciplina is 'Disciplina do edital (Auditoria, Direito Civil, ...). Reutilizável entre concursos.';
comment on column disciplina.slug is 'Chave estável usada pelos seeds. Nunca reaproveitar um slug para outro conteúdo.';

create trigger disciplina_atualizado_em
  before update on disciplina
  for each row execute function rito.tg_atualizado_em();

create table assunto (
  id             uuid        primary key default gen_random_uuid(),
  disciplina_id  uuid        not null references disciplina(id) on delete cascade,
  pai_id         uuid        references assunto(id) on delete cascade,
  slug           text        not null unique
                             check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome           text        not null check (btrim(nome) <> ''),
  ordem          smallint    not null default 0,
  nivel          smallint    not null default 1 check (nivel between 1 and 3),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint assunto_nao_e_pai_de_si_ck check (pai_id is null or pai_id <> id)
);
comment on table assunto is
  'Árvore de assuntos. nivel 1 = assunto, nivel 2 = tópico. nivel é mantido por trigger, não se escreve à mão.';
comment on column assunto.pai_id is 'Nulo = assunto raiz da disciplina. Preenchido = tópico.';

create index assunto_disciplina_ordem_idx on assunto (disciplina_id, nivel, ordem);
create index assunto_pai_idx              on assunto (pai_id) where pai_id is not null;

-- Mantém `nivel` coerente, impede que um filho troque de disciplina e barra ciclos.
create or replace function rito.tg_assunto_hierarquia()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_pai_disciplina uuid;
  v_pai_nivel      smallint;
  v_ciclo          boolean;
begin
  if new.pai_id is null then
    new.nivel := 1;
    return new;
  end if;

  select disciplina_id, nivel into v_pai_disciplina, v_pai_nivel
    from assunto where id = new.pai_id;

  if not found then
    raise exception 'assunto pai % não existe', new.pai_id;
  end if;

  if v_pai_disciplina <> new.disciplina_id then
    raise exception 'assunto % está na disciplina % mas seu pai está na disciplina %',
      new.slug, new.disciplina_id, v_pai_disciplina;
  end if;

  if tg_op = 'UPDATE' then
    with recursive descendentes as (
      select id from assunto where pai_id = new.id
      union all
      select a.id from assunto a join descendentes d on a.pai_id = d.id
    )
    select exists (select 1 from descendentes where id = new.pai_id) into v_ciclo;

    if v_ciclo then
      raise exception 'ciclo na árvore de assuntos: % não pode ser filho de um descendente seu', new.slug;
    end if;
  end if;

  new.nivel := v_pai_nivel + 1;
  return new;
end;
$$;

create trigger assunto_hierarquia
  before insert or update of pai_id, disciplina_id on assunto
  for each row execute function rito.tg_assunto_hierarquia();

create trigger assunto_atualizado_em
  before update on assunto
  for each row execute function rito.tg_atualizado_em();
