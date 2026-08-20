-- 0011_views_de_desempenho.sql
--
-- O QUE FAZ
--   As views que definem, de uma vez só, o que "conta" no Rito. Regra de ouro:
--   nenhuma tela e nenhuma consulta de aplicação repete estas condições — elas
--   consultam a view. Escrever a regra duas vezes é como o número da tela começa
--   a divergir do número do relatório.
--
--   Todas as views são SECURITY INVOKER (`security_invoker = on`). Sem isso, a
--   view roda com os direitos do DONO e passa POR CIMA do RLS das tabelas —
--   quem consultasse `vw_desempenho_assunto` veria o progresso de todo mundo.
--   Exige PG 15+.
--
--   Regras materializadas aqui:
--     - só a PRIMEIRA tentativa conta (vw_resposta_valida);
--     - ANULADA fica fora; DESATUALIZADA CONTA, e a view carrega a flag para a
--       tela poder avisar;
--     - placar líquido só onde a prova pune o erro (penalidade_por_erro);
--     - progresso é DERIVADO por view, nunca gravado. Não existe tabela de
--       progresso de propósito: não há como gravar um nível errado.
--
-- CAMINHO DE VOLTA
--   drop view if exists <todas as views abaixo> ;  -- na ordem inversa da criação

-- ---------------------------------------------------------------------------
-- Fechamento transitivo da árvore de assuntos (inclui o próprio assunto).
-- É o que faz o desempenho de um tópico subir para o assunto pai.
-- ---------------------------------------------------------------------------
create view vw_assunto_ancestral with (security_invoker = on) as
with recursive arvore as (
  select a.id as ancestral_id, a.id as assunto_id
    from assunto a
  union all
  select t.ancestral_id, f.id
    from assunto f
    join arvore t on f.pai_id = t.assunto_id
)
select ancestral_id, assunto_id from arvore;
comment on view vw_assunto_ancestral is
  'Par (ancestral, descendente) incluindo o próprio assunto. Usada para rolar agregações tópico → assunto.';

-- ---------------------------------------------------------------------------
-- Acervo
-- ---------------------------------------------------------------------------
create view vw_questao_publicada with (security_invoker = on) as
select q.id, q.prova_id, q.formato, q.numero, q.enunciado, q.texto_apoio_id,
       q.gabarito, q.anulada, q.desatualizada, q.nota_desatualizacao,
       q.fonte_citacao, q.conta_estatistica,
       p.banca, p.ano, p.orgao, p.cargo_nome, p.caderno,
       p.penalidade_por_erro
  from questao q
  join prova   p on p.id = q.prova_id
 where q.publicada;
comment on view vw_questao_publicada is
  'Questões publicadas com a atribuição obrigatória junto (banca, ano, órgão, cargo, número).';

-- ---------------------------------------------------------------------------
-- Respostas que contam
-- ---------------------------------------------------------------------------
create view vw_resposta_valida with (security_invoker = on) as
select r.id, r.usuario_id, r.questao_id, r.marcada, r.correta, r.em_branco,
       r.segundos, r.confianca, r.tipo_erro, r.respondida_em,
       q.prova_id, q.formato, q.desatualizada,
       p.penalidade_por_erro
  from resposta r
  join questao  q on q.id = r.questao_id and q.conta_estatistica
  join prova    p on p.id = q.prova_id
 where r.primeira_tentativa;
comment on view vw_resposta_valida is
  'Base de TODA estatística: primeira tentativa, questão publicada e não anulada. Desatualizada entra (com aviso na tela).';

-- resposta válida "espalhada" pelos assuntos (e ancestrais) da questão
create view vw_resposta_assunto with (security_invoker = on) as
select distinct
       anc.ancestral_id as assunto_id,
       rv.id, rv.usuario_id, rv.questao_id, rv.correta, rv.em_branco,
       rv.segundos, rv.confianca, rv.tipo_erro, rv.respondida_em,
       rv.penalidade_por_erro
  from vw_resposta_valida    rv
  join questao_assunto       qa  on qa.questao_id = rv.questao_id
  join vw_assunto_ancestral  anc on anc.assunto_id = qa.assunto_id;

create view vw_desempenho_assunto with (security_invoker = on) as
select usuario_id,
       assunto_id,
       count(*)::integer                                              as respondidas,
       count(*) filter (where correta)::integer                       as acertos,
       count(*) filter (where not correta and not em_branco)::integer as erros,
       count(*) filter (where em_branco)::integer                     as brancos,
       round(count(*) filter (where correta)::numeric / nullif(count(*), 0), 4) as taxa_acerto,
       -- placar líquido: -1 por erro SÓ onde a prova pune. Em branco nunca pune.
       sum(
         case
           when correta then 1
           when em_branco then 0
           when penalidade_por_erro then -1
           else 0
         end
       )::integer                                              as saldo_liquido,
       -- diagnóstico de falso domínio
       count(*) filter (where correta and confianca = 'chute')::integer      as acertos_no_chute,
       count(*) filter (where not correta and confianca = 'certeza')::integer as erros_com_certeza,
       round(avg(segundos)::numeric, 1)                        as segundos_medios,
       max(respondida_em)                                      as ultima_resposta_em
  from vw_resposta_assunto
 group by usuario_id, assunto_id;
comment on view vw_desempenho_assunto is
  'Desempenho por assunto, já rolado para os ancestrais. saldo_liquido só desconta erro em prova com penalidade.';

-- ---------------------------------------------------------------------------
-- Tempo e revisões
-- ---------------------------------------------------------------------------
create view vw_minutos_assunto with (security_invoker = on) as
select s.usuario_id,
       anc.ancestral_id as assunto_id,
       sum(s.minutos)::integer as minutos,
       max(s.iniciada_em)      as ultima_sessao_em
  from sessao s
  join vw_assunto_ancestral anc on anc.assunto_id = s.assunto_id
 where s.assunto_id is not null
   and s.encerrada_em is not null
 group by s.usuario_id, anc.ancestral_id;

create view vw_revisao_atrasada_assunto with (security_invoker = on) as
select c.usuario_id,
       anc.ancestral_id as assunto_id,
       count(distinct c.id)::integer as revisoes_atrasadas
  from card c
  join revisao rv on rv.card_id = c.id and rv.devida_em < now()
  left join questao_assunto qa on qa.questao_id = c.questao_id
  join vw_assunto_ancestral anc on anc.assunto_id = coalesce(c.assunto_id, qa.assunto_id)
 where not c.suspenso
 group by c.usuario_id, anc.ancestral_id;
comment on view vw_revisao_atrasada_assunto is
  'Revisão atrasada = devida antes de agora. É o terceiro requisito do nível ''dominado''.';

-- ---------------------------------------------------------------------------
-- Progresso — DERIVADO, nunca gravado
-- ---------------------------------------------------------------------------
create view vw_progresso_assunto with (security_invoker = on) as
select u.id as usuario_id,
       a.id as assunto_id,
       a.disciplina_id,
       a.pai_id,
       a.nivel as nivel_arvore,
       coalesce(m.minutos, 0)              as minutos,
       coalesce(d.respondidas, 0)          as respondidas,
       coalesce(d.acertos, 0)              as acertos,
       coalesce(d.erros, 0)                as erros,
       coalesce(d.brancos, 0)              as brancos,
       d.taxa_acerto,
       coalesce(d.saldo_liquido, 0)        as saldo_liquido,
       coalesce(d.acertos_no_chute, 0)     as acertos_no_chute,
       coalesce(d.erros_com_certeza, 0)    as erros_com_certeza,
       coalesce(ra.revisoes_atrasadas, 0)  as revisoes_atrasadas,
       greatest(m.ultima_sessao_em, d.ultima_resposta_em) as ultima_atividade_em,
       rito.calcula_nivel(
         coalesce(m.minutos, 0),
         coalesce(d.respondidas, 0),
         coalesce(d.acertos, 0),
         coalesce(ra.revisoes_atrasadas, 0)
       ) as nivel
  from usuario u
  cross join assunto a
  left join vw_minutos_assunto           m  on m.usuario_id  = u.id and m.assunto_id  = a.id
  left join vw_desempenho_assunto        d  on d.usuario_id  = u.id and d.assunto_id  = a.id
  left join vw_revisao_atrasada_assunto  ra on ra.usuario_id = u.id and ra.assunto_id = a.id;
comment on view vw_progresso_assunto is
  'Nível de domínio por assunto. Não existe tabela de progresso: derivar por view torna impossível gravar nível errado.';

-- ---------------------------------------------------------------------------
-- Rateio para o edital
--
-- A sessão prende a ASSUNTO. Quando (e só quando) existir edital, os minutos de
-- cada sessão se dividem igualmente entre as linhas de edital ligadas àquele
-- assunto ou a qualquer ancestral dele. Sem edital cadastrado a view devolve
-- zero linhas — e nada quebra.
-- ---------------------------------------------------------------------------
create view vw_sessao_item_edital with (security_invoker = on) as
with alvo as (
  select distinct s.id as sessao_id, s.usuario_id, s.minutos, iea.item_edital_id
    from sessao s
    join vw_assunto_ancestral anc on anc.assunto_id = s.assunto_id
    join item_edital_assunto  iea on iea.assunto_id = anc.ancestral_id
   where s.encerrada_em is not null
)
select sessao_id,
       usuario_id,
       item_edital_id,
       minutos::numeric / count(*) over (partition by sessao_id) as minutos_rateados
  from alvo;
comment on view vw_sessao_item_edital is
  'Rateio dos minutos da sessão entre as linhas do edital do assunto. Vazia enquanto não houver edital.';

create view vw_resposta_item_edital with (security_invoker = on) as
select distinct
       iea.item_edital_id,
       ra.id, ra.usuario_id, ra.questao_id, ra.correta, ra.em_branco,
       ra.confianca, ra.penalidade_por_erro
  from vw_resposta_assunto ra
  join item_edital_assunto iea on iea.assunto_id = ra.assunto_id;

create view vw_progresso_item_edital with (security_invoker = on) as
with minutos as (
  select usuario_id, item_edital_id, round(sum(minutos_rateados))::integer as minutos
    from vw_sessao_item_edital
   group by usuario_id, item_edital_id
),
desempenho as (
  select usuario_id, item_edital_id,
         count(*)::integer                                              as respondidas,
         count(*) filter (where correta)::integer                       as acertos,
         count(*) filter (where not correta and not em_branco)::integer as erros,
         sum(case when correta then 1
                  when em_branco then 0
                  when penalidade_por_erro then -1
                  else 0 end)::integer  as saldo_liquido
    from vw_resposta_item_edital
   group by usuario_id, item_edital_id
),
atrasadas as (
  select r.usuario_id, iea.item_edital_id, count(distinct r.assunto_id)::integer as revisoes_atrasadas
    from vw_revisao_atrasada_assunto r
    join item_edital_assunto iea on iea.assunto_id = r.assunto_id
   group by r.usuario_id, iea.item_edital_id
)
select u.id  as usuario_id,
       ie.id as item_edital_id,
       ie.edital_id,
       ie.ordem,
       ie.texto_literal,
       coalesce(m.minutos, 0)             as minutos,
       coalesce(d.respondidas, 0)         as respondidas,
       coalesce(d.acertos, 0)             as acertos,
       coalesce(d.erros, 0)               as erros,
       coalesce(d.saldo_liquido, 0)       as saldo_liquido,
       coalesce(a.revisoes_atrasadas, 0)  as revisoes_atrasadas,
       rito.calcula_nivel(
         coalesce(m.minutos, 0),
         coalesce(d.respondidas, 0),
         coalesce(d.acertos, 0),
         coalesce(a.revisoes_atrasadas, 0)
       ) as nivel
  from usuario u
  cross join item_edital ie
  left join minutos    m on m.usuario_id = u.id and m.item_edital_id = ie.id
  left join desempenho d on d.usuario_id = u.id and d.item_edital_id = ie.id
  left join atrasadas  a on a.usuario_id = u.id and a.item_edital_id = ie.id;
comment on view vw_progresso_item_edital is
  'O Mapa do Edital. Uma linha por item de edital, pintada pelo nível derivado. Vazia enquanto não houver edital.';

-- ---------------------------------------------------------------------------
-- Filas e caderno
-- ---------------------------------------------------------------------------
create view vw_fila_revisao with (security_invoker = on) as
select c.id as card_id,
       c.usuario_id,
       c.origem,
       c.frente,
       c.verso,
       c.questao_id,
       c.assunto_id,
       r.estado,
       r.devida_em,
       now() - r.devida_em as atraso
  from card c
  join revisao r on r.card_id = c.id
 where not c.suspenso
   and r.devida_em <= now()
 order by r.devida_em;
comment on view vw_fila_revisao is
  'Fila do dia em UMA consulta, ordenada por atraso. A tela não monta fila em memória e não vê a matemática do FSRS.';

create view vw_caderno_erros with (security_invoker = on) as
select r.id as resposta_id,
       r.usuario_id,
       r.questao_id,
       r.tipo_erro,
       r.confianca,
       r.marcada,
       r.primeira_tentativa,
       r.respondida_em,
       q.formato, q.numero, q.enunciado, q.gabarito,
       q.desatualizada, q.nota_desatualizacao, q.fonte_citacao,
       p.banca, p.ano, p.orgao, p.cargo_nome,
       exists (
         select 1 from card c
          where c.usuario_id = r.usuario_id
            and c.questao_id = r.questao_id
            and c.origem = 'erro'
       ) as virou_card
  from resposta r
  join questao  q on q.id = r.questao_id and q.conta_estatistica
  join prova    p on p.id = q.prova_id
 where not r.correta;
comment on view vw_caderno_erros is
  'Caderno de erros: inclui tentativas de treino de propósito. É ferramenta de estudo, não estatística — a coluna primeira_tentativa diz qual é qual.';
