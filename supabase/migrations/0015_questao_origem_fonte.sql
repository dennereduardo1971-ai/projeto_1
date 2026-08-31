-- 0015_questao_origem_fonte.sql
--
-- O QUE FAZ
--   Pivô de 2026-08-31 (CLAUDE.md, regras 3-5, exceção temporária — revisar
--   antes de lançamento público ou monetização): segunda origem de questão,
--   `apostila_comentada` (PDF de terceiro, tipo apostila de professor — ver
--   docs/04-fontes-de-questoes.md §1.3), ao lado da `prova_oficial` (Cebraspe)
--   já existente desde a 0004.
--
--   Para `apostila_comentada` não existe "gabarito definitivo da banca" para
--   casar (regra 3): a barreira de publicação vira `revisado_humano = true`
--   no lugar de `gabarito_confirmado_em`. Atribuição (regra 4) vira
--   `autor_fonte`/`titulo_fonte` no lugar de banca/ano/órgão/cargo por
--   questão — mas a tabela `prova` continua exigindo banca/ano/orgao/
--   cargo_nome NOT NULL (não relaxados aqui, de propósito: mexer nisso exige
--   revisar o UNIQUE de identidade da prova, e não há pressa — quem ingerir
--   uma apostila hoje preenche esses campos com o dado real disponível, ex.:
--   banca = nome do autor).
--
--   `dificuldade_b` alimenta o motor de domínio (`app/src/features/dominio/
--   mastery.ts`, Elo-IRT de 1 parâmetro) — nasce em 0 (dificuldade média)
--   porque não há calibração ainda.
--
-- CAMINHO DE VOLTA
--   alter table questao drop constraint questao_publicada_exige_gabarito_ck;
--   alter table questao add constraint questao_publicada_exige_gabarito_ck check (
--     not publicada or anulada or (gabarito is not null and gabarito_confirmado_em is not null)
--   );
--   alter table questao
--     drop column origem_fonte, drop column autor_fonte, drop column titulo_fonte,
--     drop column revisado_humano, drop column dificuldade_b;

alter table questao
  add column origem_fonte    text             not null default 'prova_oficial'
                             check (origem_fonte in ('prova_oficial', 'apostila_comentada')),
  add column autor_fonte     text,
  add column titulo_fonte    text,
  add column revisado_humano boolean          not null default false,
  add column dificuldade_b   double precision not null default 0;

comment on column questao.origem_fonte is
  'prova_oficial (Cebraspe, casa gabarito) ou apostila_comentada (terceiro, usa revisado_humano). Exceção temporária de 2026-08-31.';
comment on column questao.autor_fonte is 'Atribuição para apostila_comentada (nome do autor/professor). Regra 4.';
comment on column questao.titulo_fonte is 'Atribuição para apostila_comentada (nome da apostila/curso). Regra 4.';
comment on column questao.revisado_humano is
  'Gate de publicação para apostila_comentada — substitui gabarito_confirmado_em, que não existe sem banca.';
comment on column questao.dificuldade_b is
  'Dificuldade latente (escala logit) para o motor de domínio. 0 = média; sem calibração ainda.';

alter table questao drop constraint questao_publicada_exige_gabarito_ck;
alter table questao add constraint questao_publicada_exige_gabarito_ck check (
  not publicada or anulada
  or (origem_fonte = 'prova_oficial'     and gabarito is not null and gabarito_confirmado_em is not null)
  or (origem_fonte = 'apostila_comentada' and gabarito is not null and revisado_humano)
);

alter table questao add constraint questao_apostila_exige_atribuicao_ck check (
  origem_fonte <> 'apostila_comentada'
  or (btrim(coalesce(autor_fonte, '')) <> '' and btrim(coalesce(titulo_fonte, '')) <> '')
);
