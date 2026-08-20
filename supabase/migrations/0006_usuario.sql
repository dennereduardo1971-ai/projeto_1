-- 0006_usuario.sql
--
-- O QUE FAZ
--   A tabela de usuário. NESTA FASE NÃO HÁ LOGIN: o app roda 100% local
--   (IndexedDB) e o Postgres é o destino futuro. A tabela existe agora para o
--   schema nascer certo — todo dado pessoal já pendura em `usuario.id` e cai
--   junto por ON DELETE CASCADE (LGPD: exclusão de conta desde o primeiro dia).
--
--   O `default gen_random_uuid()` é da fase sem login. A migration 0013 remove o
--   default e amarra `usuario.id` a `auth.users(id)`.
--
-- CAMINHO DE VOLTA
--   drop table if exists usuario cascade;   -- derruba TODO o progresso do usuário

create table usuario (
  id                    uuid        primary key default gen_random_uuid(),
  nome                  text,
  email                 text        unique check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  fuso                  text        not null default 'America/Sao_Paulo',
  meta_semanal_minutos  integer     not null default 600 check (meta_semanal_minutos >= 0),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);
comment on table usuario is
  'Perfil do usuário. Sem login nesta fase; a 0013 liga o id a auth.users quando houver Supabase Auth.';
comment on column usuario.meta_semanal_minutos is 'Meta semanal de estudo. Alimenta o tom sóbrio de progresso, sem confete.';

create trigger usuario_atualizado_em
  before update on usuario for each row execute function rito.tg_atualizado_em();
