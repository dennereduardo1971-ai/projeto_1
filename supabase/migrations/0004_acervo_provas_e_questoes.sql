-- 0004_acervo_provas_e_questoes.sql
--
-- O QUE FAZ
--   O acervo: prova, texto de apoio, questão, alternativa e a ligação
--   questão↔assunto. Aqui moram as invariantes que o app NÃO pode confiar ao
--   código de aplicação:
--
--   1. `formato` e `penalidade_por_erro` moram na PROVA. A questão herda o
--      formato por chave estrangeira COMPOSTA (prova_id, formato) — é
--      impossível existir questão C/E dentro de prova de múltipla escolha.
--   2. Alternativa só existe em questão de múltipla escolha — mesma técnica de
--      FK composta, com CHECK fixando formato = 'multipla'.
--   3. Questão sem gabarito definitivo casado não pode estar publicada.
--      Exceção: questão ANULADA pode ser publicada sem gabarito, marcada.
--   4. Atribuição obrigatória (banca, ano, órgão, cargo): NOT NULL na prova,
--      e `questao.prova_id` é NOT NULL — logo nenhuma questão existe sem eles.
--   5. `conta_estatistica` é coluna GERADA: publicada e não anulada.
--      DESATUALIZADA CONTA na estatística (decisão de 2026-08-20), com aviso na
--      tela. Só ANULADA fica fora.
--
-- CAMINHO DE VOLTA
--   drop table if exists questao_assunto, alternativa, questao, texto_apoio, prova cascade;

create table prova (
  id                   uuid          primary key default gen_random_uuid(),
  concurso_id          uuid          references concurso(id) on delete set null,
  cargo_id             uuid          references cargo(id)    on delete set null,
  banca                text          not null check (btrim(banca) <> ''),
  ano                  smallint      not null check (ano between 1990 and 2100),
  orgao                text          not null check (btrim(orgao) <> ''),
  cargo_nome           text          not null check (btrim(cargo_nome) <> ''),
  caderno              text,
  formato              formato_prova not null,
  penalidade_por_erro  boolean       not null,
  url_pdf              text,
  url_gabarito         text,
  gabarito_definitivo_em date,
  criado_em            timestamptz   not null default now(),
  atualizado_em        timestamptz   not null default now(),
  -- alvo da FK composta que fixa o formato nas questões
  constraint prova_id_formato_uk unique (id, formato),
  -- caderno pode ser nulo; NULLS NOT DISTINCT impede duas provas "sem caderno"
  -- idênticas passarem como distintas (o comportamento padrão do UNIQUE deixaria).
  constraint prova_identidade_uk unique nulls not distinct (banca, ano, orgao, cargo_nome, caderno)
);
comment on table prova is
  'Uma prova aplicada. banca/ano/orgao/cargo_nome são texto e NOT NULL: é a atribuição obrigatória de toda questão.';
comment on column prova.penalidade_por_erro is
  'Se o erro anula acerto. Só onde isto é true o app mostra placar líquido.';
comment on column prova.caderno is 'Tipo/cor do caderno quando a banca aplica mais de um ("MATRIZ", "AZUL").';

create index prova_banca_ano_idx on prova (banca, ano);

create trigger prova_atualizado_em
  before update on prova for each row execute function rito.tg_atualizado_em();

create table texto_apoio (
  id          uuid        primary key default gen_random_uuid(),
  prova_id    uuid        not null references prova(id) on delete cascade,
  rotulo      text,
  conteudo_md text        not null check (btrim(conteudo_md) <> ''),
  criado_em   timestamptz not null default now()
);
comment on table texto_apoio is
  'Bloco de texto compartilhado por várias questões (padrão Cebraspe). É o ponto mais frágil da ingestão.';

create index texto_apoio_prova_idx on texto_apoio (prova_id);

create table questao (
  id                    uuid          primary key default gen_random_uuid(),
  prova_id              uuid          not null,
  formato               formato_prova not null,
  numero                integer       not null check (numero > 0),
  enunciado             text          not null check (btrim(enunciado) <> ''),
  texto_apoio_id        uuid          references texto_apoio(id) on delete set null,
  gabarito              text,
  gabarito_confirmado_em date,
  anulada               boolean       not null default false,
  desatualizada         boolean       not null default false,
  nota_desatualizacao   text,
  publicada             boolean       not null default false,
  fonte_citacao         text          not null check (btrim(fonte_citacao) <> ''),
  criado_em             timestamptz   not null default now(),
  atualizado_em         timestamptz   not null default now(),

  -- publicada e não anulada. Desatualizada CONTA (com aviso na tela).
  conta_estatistica     boolean generated always as (publicada and not anulada) stored,

  constraint questao_prova_fk foreign key (prova_id, formato)
    references prova (id, formato) on update cascade on delete cascade,
  constraint questao_numero_uk unique (prova_id, numero),
  constraint questao_id_formato_uk unique (id, formato),

  constraint questao_gabarito_formato_ck check (
    gabarito is null
    or (formato = 'ce'       and gabarito in ('C', 'E'))
    or (formato = 'multipla' and gabarito ~ '^[A-E]$')
  ),
  constraint questao_publicada_exige_gabarito_ck check (
    not publicada or anulada or (gabarito is not null and gabarito_confirmado_em is not null)
  ),
  constraint questao_desatualizada_exige_nota_ck check (
    not desatualizada or btrim(coalesce(nota_desatualizacao, '')) <> ''
  )
);
comment on column questao.fonte_citacao is
  'Atribuição legível ("Cebraspe — TCU 2025, AUFC, questão 42"). Obrigatória: nunca sugerir autoria própria.';
comment on column questao.conta_estatistica is
  'GERADA. Só ANULADA fica fora da estatística; DESATUALIZADA conta, com aviso na tela.';
comment on column questao.nota_desatualizacao is
  'Por que está desatualizada (lei alterada, jurisprudência superada). Obrigatória quando desatualizada.';

create index questao_prova_idx           on questao (prova_id, numero);
create index questao_publicadas_idx      on questao (prova_id) where conta_estatistica;
create index questao_texto_apoio_idx     on questao (texto_apoio_id) where texto_apoio_id is not null;

create trigger questao_atualizado_em
  before update on questao for each row execute function rito.tg_atualizado_em();

create table alternativa (
  id          uuid          primary key default gen_random_uuid(),
  questao_id  uuid          not null,
  -- coluna-âncora: existe só para a FK composta abaixo recusar questão C/E
  formato     formato_prova not null default 'multipla' check (formato = 'multipla'),
  letra       text          not null check (letra ~ '^[A-E]$'),
  texto       text          not null check (btrim(texto) <> ''),
  constraint alternativa_questao_fk foreign key (questao_id, formato)
    references questao (id, formato) on update cascade on delete cascade,
  constraint alternativa_letra_uk unique (questao_id, letra)
);
comment on column alternativa.formato is
  'Sempre ''multipla''. Existe só para a FK composta impedir alternativa em questão Certo/Errado.';

create table questao_assunto (
  questao_id  uuid    not null references questao(id) on delete cascade,
  assunto_id  uuid    not null references assunto(id) on delete cascade,
  principal   boolean not null default false,
  primary key (questao_id, assunto_id)
);
comment on table questao_assunto is
  'Classificação da questão. `principal` marca o assunto que manda na estatística por assunto.';

create unique index questao_assunto_principal_uk on questao_assunto (questao_id) where principal;
create index questao_assunto_assunto_idx on questao_assunto (assunto_id);
