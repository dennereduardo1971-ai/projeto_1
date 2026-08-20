-- 0001_base_tipos_e_funcoes.sql
--
-- O QUE FAZ
--   Fundação do schema do Rito. Cria o schema utilitário `rito` (funções de apoio,
--   fora do `public` para não poluir a API gerada), os tipos enumerados realmente
--   fechados do domínio e as funções usadas por triggers, colunas geradas e RLS.
--
--   `rito.usuario_atual()` é o único ponto onde o schema pergunta "quem é o usuário".
--   Nesta fase o app roda sem login e a função lê o GUC `rito.usuario_id`.
--   A migration 0013 (isolada, só com Supabase Auth) a reescreve para `auth.uid()`.
--
-- CAMINHO DE VOLTA
--   drop schema rito cascade;
--   drop type if exists confianca_resposta, nivel_dominio, formato_prova;
--   (só é seguro depois de derrubar as migrations 0002+ que dependem dos tipos)

create schema if not exists rito;
comment on schema rito is 'Funções utilitárias do Rito. Sem tabelas — o dado mora em public.';

-- ---------------------------------------------------------------------------
-- Tipos enumerados
--
-- Regra adotada: só vira ENUM o vocabulário fechado de verdade e cuja ORDEM
-- importa. Enum no Postgres não tem volta barata (não existe DROP VALUE), então
-- tudo que pode crescer com o produto (tipo de erro, tipo de sessão, tipo de
-- seção de esquema, origem de card) ficou como text + CHECK, que se altera com
-- um ALTER ... DROP CONSTRAINT.
-- ---------------------------------------------------------------------------

-- Formato da PROVA, nunca do app (CLAUDE.md, regra 2).
create type formato_prova as enum ('ce', 'multipla');
comment on type formato_prova is
  'ce = Certo/Errado; multipla = múltipla escolha A–E. Atributo da prova, não do app.';

-- Ordenado de propósito: 'nao_estudado' < 'estudado' < 'praticado' < 'dominado'.
create type nivel_dominio as enum ('nao_estudado', 'estudado', 'praticado', 'dominado');
comment on type nivel_dominio is
  'Nível de domínio. Sempre DERIVADO (ver rito.calcula_nivel), nunca digitado pelo usuário.';

-- Ordenado de propósito: 'chute' < 'duvida' < 'certeza'.
create type confianca_resposta as enum ('chute', 'duvida', 'certeza');
comment on type confianca_resposta is
  'Confiança declarada no momento da resposta. Acertar chutando não é domínio.';

-- ---------------------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------------------

create or replace function rito.tg_atualizado_em()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
comment on function rito.tg_atualizado_em() is
  'Trigger BEFORE UPDATE genérico: mantém a coluna atualizado_em.';

-- Identidade do usuário corrente.
-- Fase atual (sem login): quem consulta define `set local rito.usuario_id = '<uuid>'`.
-- Com Supabase Auth: a 0013 substitui o corpo por auth.uid().
create or replace function rito.usuario_atual()
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select nullif(current_setting('rito.usuario_id', true), '')::uuid;
$$;
comment on function rito.usuario_atual() is
  'UUID do usuário corrente. Único ponto de acoplamento com autenticação — ver migration 0013.';

-- Regra de nível de domínio (decisão do dono do produto, 2026-08-20):
--   dominado = >= 10 questões respondidas (1ª tentativa, válidas)
--              E >= 80% de acerto
--              E zero revisão atrasada.
-- IMMUTABLE porque é consumida por views e pode ser usada em coluna gerada.
create or replace function rito.calcula_nivel(
  minutos             integer,
  questoes            integer,
  acertos             integer,
  revisoes_atrasadas  integer
)
returns nivel_dominio
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when coalesce(minutos, 0) = 0 and coalesce(questoes, 0) = 0
      then 'nao_estudado'
    when coalesce(questoes, 0) >= 10
         and coalesce(acertos, 0)::numeric / questoes >= 0.80
         and coalesce(revisoes_atrasadas, 0) = 0
      then 'dominado'
    when coalesce(questoes, 0) >= 10
      then 'praticado'
    else 'estudado'
  end::nivel_dominio;
$$;
comment on function rito.calcula_nivel(integer, integer, integer, integer) is
  'Nível de domínio derivado. 10 questões é a amostra mínima para qualquer afirmação sobre domínio.';
