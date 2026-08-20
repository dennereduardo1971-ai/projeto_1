-- 0012_rls.sql
--
-- O QUE FAZ
--   Liga RLS em TODAS as tabelas e escreve as políticas.
--
--   Duas famílias:
--
--   a) ACERVO (disciplina, assunto, edital, prova, questão, esquema...) —
--      leitura pública do que está PUBLICADO, e nenhuma política de escrita.
--      Sem política de escrita, ninguém escreve por RLS: a ingestão roda como
--      dono da tabela (ou `service_role` no Supabase), que passa por cima.
--      Rascunho não publicado fica invisível para o app.
--
--   b) DADO DO USUÁRIO (usuario, plano, sessão, resposta, card, revisão...) —
--      dono vê o seu e só o seu, em SELECT/INSERT/UPDATE/DELETE.
--
--   `rito.usuario_atual()` devolve NULL quando não há identidade definida, e
--   `usuario_id = NULL` é sempre falso: o padrão é NEGAR. Ela vai sempre dentro
--   de um subselect — `(select rito.usuario_atual())` — para o planejador
--   avaliar uma vez por consulta em vez de uma vez por linha.
--
--   NÃO se usa FORCE ROW LEVEL SECURITY de propósito: o dono da tabela precisa
--   continuar podendo rodar migration, ingestão e correção de acervo.
--
--   AVISO: sem banco nesta fase, estas políticas NÃO foram testadas contra um
--   cliente real autenticado. Foram testadas em cluster local com um papel
--   comum (não-dono) — ver docs/agents/dados.md.
--
-- CAMINHO DE VOLTA
--   alter table <t> disable row level security;  -- por tabela
--   drop policy <p> on <t>;

-- ---------------------------------------------------------------------------
-- (a) Acervo — leitura pública do publicado
-- ---------------------------------------------------------------------------
alter table disciplina           enable row level security;
alter table assunto              enable row level security;
alter table concurso             enable row level security;
alter table cargo                enable row level security;
alter table edital               enable row level security;
alter table item_edital          enable row level security;
alter table item_edital_assunto  enable row level security;
alter table prova                enable row level security;
alter table texto_apoio          enable row level security;
alter table questao              enable row level security;
alter table alternativa          enable row level security;
alter table questao_assunto      enable row level security;
alter table esquema              enable row level security;
alter table esquema_secao        enable row level security;
alter table esquema_fonte_questao enable row level security;

create policy acervo_leitura on disciplina          for select using (true);
create policy acervo_leitura on assunto             for select using (true);
create policy acervo_leitura on concurso            for select using (true);
create policy acervo_leitura on cargo               for select using (true);
create policy acervo_leitura on edital              for select using (true);
create policy acervo_leitura on item_edital         for select using (true);
create policy acervo_leitura on item_edital_assunto for select using (true);
create policy acervo_leitura on prova               for select using (true);
create policy acervo_leitura on texto_apoio         for select using (true);

-- questão só aparece publicada (a regra "sem gabarito casado não publica" já é
-- garantida por CHECK na 0004)
create policy acervo_leitura on questao for select using (publicada);

create policy acervo_leitura on alternativa for select using (
  exists (select 1 from questao q where q.id = alternativa.questao_id and q.publicada)
);

create policy acervo_leitura on questao_assunto for select using (
  exists (select 1 from questao q where q.id = questao_assunto.questao_id and q.publicada)
);

create policy acervo_leitura on esquema for select using (publicado);

create policy acervo_leitura on esquema_secao for select using (
  exists (select 1 from esquema e where e.id = esquema_secao.esquema_id and e.publicado)
);

create policy acervo_leitura on esquema_fonte_questao for select using (
  exists (select 1 from esquema e where e.id = esquema_fonte_questao.esquema_id and e.publicado)
);

-- ---------------------------------------------------------------------------
-- (b) Dado do usuário — dono vê e mexe só no seu
-- ---------------------------------------------------------------------------
alter table usuario         enable row level security;
alter table plano           enable row level security;
alter table bloco_ciclo     enable row level security;
alter table sessao          enable row level security;
alter table resposta        enable row level security;
alter table reporte_questao enable row level security;
alter table card            enable row level security;
alter table revisao         enable row level security;
alter table revisao_log     enable row level security;

create policy usuario_proprio on usuario
  for all
  using      (id = (select rito.usuario_atual()))
  with check (id = (select rito.usuario_atual()));

do $$
declare t text;
begin
  foreach t in array array[
    'plano', 'bloco_ciclo', 'sessao', 'resposta',
    'reporte_questao', 'card', 'revisao', 'revisao_log'
  ]
  loop
    execute format(
      'create policy dono on public.%I for all
         using      (usuario_id = (select rito.usuario_atual()))
         with check (usuario_id = (select rito.usuario_atual()))', t);
  end loop;
end;
$$;

comment on policy usuario_proprio on usuario is
  'LGPD: cada um vê o seu. Exclusão de conta cai por ON DELETE CASCADE a partir daqui.';
