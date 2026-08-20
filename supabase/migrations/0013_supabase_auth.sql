-- 0013_supabase_auth.sql
--
-- ############################################################################
-- #  MIGRATION ISOLADA — SÓ SE APLICA QUANDO EXISTIR SUPABASE AUTH.          #
-- #                                                                          #
-- #  É a ÚNICA migration do projeto que toca em `auth.users`, `auth.uid()` e #
-- #  nos papéis `anon` / `authenticated` / `service_role`. Nada dela é        #
-- #  necessário para o schema funcionar em um Postgres comum.                #
-- #                                                                          #
-- #  NESTA FASE DO PROJETO NÃO HÁ LOGIN e nenhum projeto Supabase foi criado: #
-- #  esta migration existe versionada, para o schema já nascer certo, e NÃO   #
-- #  deve ser aplicada. Ela aborta sozinha se o schema `auth` não existir.    #
-- ############################################################################
--
-- O QUE FAZ
--   1. Amarra `usuario.id` a `auth.users(id)` (padrão Supabase: a linha de
--      perfil tem o mesmo id do usuário autenticado) e remove o default de UUID,
--      que só fazia sentido na fase sem login.
--   2. Reescreve `rito.usuario_atual()` para devolver `auth.uid()`.
--   3. Cria a linha de `usuario` automaticamente quando alguém se cadastra.
--   4. Dá os GRANTs que os papéis do PostgREST precisam. RLS (migration 0012)
--      continua sendo quem filtra as linhas; GRANT só abre a porta da tabela.
--
-- CAMINHO DE VOLTA
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop function if exists rito.tg_cria_usuario_do_auth();
--   alter table usuario drop constraint usuario_auth_fk;
--   alter table usuario alter column id set default gen_random_uuid();
--   create or replace function rito.usuario_atual() ... (corpo da migration 0001)
--   revoke all on all tables in schema public from anon, authenticated;

do $$
begin
  if to_regclass('auth.users') is null then
    raise exception
      'Migration 0013 exige Supabase Auth (schema auth). Não aplique este arquivo em Postgres sem auth.';
  end if;
end;
$$;

-- 1. usuario.id passa a ser o id do auth ------------------------------------
alter table usuario alter column id drop default;
alter table usuario
  add constraint usuario_auth_fk foreign key (id)
  references auth.users (id) on delete cascade;
comment on column usuario.id is
  'Mesmo id de auth.users. Apagar a conta no Auth apaga o perfil e, em cascata, todo o progresso (LGPD).';

-- 2. identidade do usuário corrente ------------------------------------------
create or replace function rito.usuario_atual()
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select auth.uid();
$$;

-- 3. perfil criado junto com a conta ------------------------------------------
create or replace function rito.tg_cria_usuario_do_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.usuario (id, email, nome)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
comment on function rito.tg_cria_usuario_do_auth() is
  'SECURITY DEFINER de propósito: roda no cadastro, antes de existir sessão do usuário.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function rito.tg_cria_usuario_do_auth();

-- 4. GRANTs para os papéis do PostgREST ---------------------------------------
grant usage on schema public to anon, authenticated;
grant usage on schema rito   to anon, authenticated;

-- `rito.usuario_atual()` chama `auth.uid()`, e quem chama precisa de USAGE em
-- `auth`. O Supabase já concede isso; em um clone do schema (teste local, réplica)
-- pode não estar lá — e o sintoma é confuso: "permission denied for schema auth"
-- vindo de dentro de uma política de RLS. Tenta conceder; se o papel que roda a
-- migration não puder, avisa em vez de derrubar a migration inteira.
do $$
begin
  execute 'grant usage on schema auth to anon, authenticated';
exception when insufficient_privilege then
  raise warning 'sem permissão para conceder USAGE em auth; confirme que anon e authenticated já a possuem';
end;
$$;

-- acervo e views: leitura (o RLS da 0012 decide o que aparece)
grant select on
  disciplina, assunto, concurso, cargo, edital, item_edital, item_edital_assunto,
  prova, texto_apoio, questao, alternativa, questao_assunto,
  esquema, esquema_secao, esquema_fonte_questao
to anon, authenticated;

grant select on
  vw_assunto_ancestral, vw_questao_publicada, vw_resposta_valida,
  vw_resposta_assunto, vw_desempenho_assunto, vw_minutos_assunto,
  vw_revisao_atrasada_assunto, vw_progresso_assunto,
  vw_sessao_item_edital, vw_resposta_item_edital, vw_progresso_item_edital,
  vw_fila_revisao, vw_caderno_erros
to anon, authenticated;

-- dado do usuário: só quem está autenticado, e o RLS restringe à própria linha
grant select, insert, update, delete on
  usuario, plano, bloco_ciclo, sessao, resposta, reporte_questao,
  card, revisao, revisao_log
to authenticated;

grant usage, select on all sequences in schema public to authenticated;
