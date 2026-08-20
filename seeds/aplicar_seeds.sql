-- aplicar_seeds.sql
--
-- Carrega `seeds/taxonomia.json` nas tabelas `disciplina` e `assunto`.
-- É IDEMPOTENTE: faz upsert por `slug`. Rodar dez vezes tem o mesmo efeito de
-- rodar uma. Nunca APAGA nada — se um slug sumir do JSON, a linha continua no
-- banco (pode haver questão, esquema e progresso pendurados nela) e o script
-- apenas lista o órfão no fim, para decisão humana.
--
-- COMO RODAR (a partir da raiz do repositório):
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f seeds/aplicar_seeds.sql
--
-- Ou passando o JSON explicitamente (útil em CI, ou de outro diretório):
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--          -v taxonomia="$(cat seeds/taxonomia.json)" -f seeds/aplicar_seeds.sql
--
-- Requer permissão de ESCRITA no acervo. As políticas de RLS da migration 0012
-- não abrem escrita para ninguém: rode como dono das tabelas (ou `service_role`
-- no Supabase).

\if :{?taxonomia}
\else
\set taxonomia `cat seeds/taxonomia.json`
\endif

begin;

-- o texto entra cru e só vira jsonb depois da checagem, para o erro de
-- "arquivo não encontrado" sair legível em vez de um erro de parse de JSON
create temporary table _taxonomia (bruto text, j jsonb) on commit drop;
insert into _taxonomia (bruto) values (:'taxonomia');

do $$
declare v jsonb;
begin
  if (select btrim(coalesce(bruto, '')) from _taxonomia) = '' then
    raise exception using message =
      'taxonomia.json não foi lido. Rode a partir da raiz do repositório, ou passe -v taxonomia="$(cat seeds/taxonomia.json)".';
  end if;

  update _taxonomia set j = bruto::jsonb;
  select j into v from _taxonomia;

  if jsonb_typeof(v -> 'disciplinas') <> 'array' then
    raise exception using message =
      'taxonomia.json sem a chave "disciplinas" — arquivo errado ou corrompido.';
  end if;

  raise notice 'taxonomia versão % (gerada em %)', v ->> 'versao', v ->> 'gerado_em';
end;
$$;

-- 1. disciplinas -------------------------------------------------------------
insert into disciplina (slug, nome, ordem)
select d ->> 'slug',
       d ->> 'nome',
       (d ->> 'ordem')::smallint
  from _taxonomia t
  cross join lateral jsonb_array_elements(t.j -> 'disciplinas') d
on conflict (slug) do update
   set nome  = excluded.nome,
       ordem = excluded.ordem;

-- 2. assuntos (nível 1) ------------------------------------------------------
insert into assunto (disciplina_id, pai_id, slug, nome, ordem)
select disc.id,
       null,
       a ->> 'slug',
       a ->> 'nome',
       (a ->> 'ordem')::smallint
  from _taxonomia t
  cross join lateral jsonb_array_elements(t.j -> 'disciplinas') d
  join disciplina disc on disc.slug = d ->> 'slug'
  cross join lateral jsonb_array_elements(d -> 'assuntos') a
on conflict (slug) do update
   set disciplina_id = excluded.disciplina_id,
       pai_id        = excluded.pai_id,
       nome          = excluded.nome,
       ordem         = excluded.ordem;

-- 3. tópicos (nível 2, filhos do assunto) ------------------------------------
insert into assunto (disciplina_id, pai_id, slug, nome, ordem)
select disc.id,
       pai.id,
       tp ->> 'slug',
       tp ->> 'nome',
       (tp ->> 'ordem')::smallint
  from _taxonomia t
  cross join lateral jsonb_array_elements(t.j -> 'disciplinas') d
  join disciplina disc on disc.slug = d ->> 'slug'
  cross join lateral jsonb_array_elements(d -> 'assuntos') a
  join assunto pai on pai.slug = a ->> 'slug'
  cross join lateral jsonb_array_elements(a -> 'topicos') tp
on conflict (slug) do update
   set disciplina_id = excluded.disciplina_id,
       pai_id        = excluded.pai_id,
       nome          = excluded.nome,
       ordem         = excluded.ordem;

-- 4. relatório ---------------------------------------------------------------
select d.nome                                            as disciplina,
       count(*) filter (where a.nivel = 1)               as assuntos,
       count(*) filter (where a.nivel = 2)               as topicos
  from disciplina d
  join assunto a on a.disciplina_id = d.id
 group by d.nome, d.ordem
 order by d.ordem;

-- Slugs que existem no banco e sumiram do JSON. NÃO são apagados: podem ter
-- questão, esquema ou progresso ligados. Decisão de remapear é humana.
select a.slug as assunto_orfao_no_banco, a.nome
  from assunto a
 where not exists (
   select 1
     from _taxonomia t
     cross join lateral jsonb_array_elements(t.j -> 'disciplinas') d
     cross join lateral jsonb_array_elements(d -> 'assuntos') x
     where x ->> 'slug' = a.slug
        or exists (select 1 from jsonb_array_elements(x -> 'topicos') tp where tp ->> 'slug' = a.slug)
 )
 order by a.slug;

commit;
