/**
 * Espelho local do modelo de dados que vive em `supabase/migrations/`.
 *
 * Enquanto não há login nem banco, tudo isto mora no IndexedDB do aparelho.
 * Os nomes de tabela e de coluna são propositalmente os mesmos do Postgres:
 * quando o Supabase entrar, a migração é um mapeamento 1:1, não uma tradução.
 */

export type UUID = string

// ---------------------------------------------------------------- taxonomia

export interface Disciplina {
  id: UUID
  slug: string
  nome: string
  ordem: number
}

/** Árvore de 2 níveis: profundidade 1 = Assunto, 2 = Tópico. */
export interface Assunto {
  id: UUID
  disciplina_id: UUID
  pai_id: UUID | null
  slug: string
  nome: string
  ordem: number
  profundidade: 1 | 2
}

// ------------------------------------------------------------------- edital
// Vazias até o edital ser cadastrado. Existem para o app não precisar de
// remendo quando ele chegar.

export interface Concurso {
  id: UUID
  slug: string
  nome: string
  orgao: string
  /** Coluna, nunca enum. Regra 1 do projeto: banca é dado, não premissa. */
  banca: string
  ano: number
}

export interface Cargo {
  id: UUID
  concurso_id: UUID
  nome: string
}

export interface Edital {
  id: UUID
  cargo_id: UUID
  versao: string
  publicado_em: string | null
  url_fonte: string | null
  vigente: boolean
}

export interface ItemEdital {
  id: UUID
  edital_id: UUID
  disciplina_id: UUID
  ordem: number
  numeracao: string | null
  /** O edital é copiado literalmente: o concurseiro precisa reconhecer a frase. */
  texto_literal: string
}

export interface ItemEditalAssunto {
  item_edital_id: UUID
  assunto_id: UUID
}

// ------------------------------------------------------------------- acervo
// Vazias até a ingestão dos PDFs. Ver scripts/ingest/.

export type FormatoProva = 'ce' | 'multipla'
export type StatusPublicacao = 'rascunho' | 'em_revisao' | 'publicada'

export interface Prova {
  id: UUID
  concurso_id: UUID
  cargo_id: UUID
  /** Formato e penalidade moram na PROVA, nunca no app. Regra 2 do projeto. */
  formato: FormatoProva
  penalidade_por_erro: boolean
  caderno_tipo: string | null
  aplicada_em: string | null
  url_pdf: string | null
  url_gabarito: string | null
  pdf_sha256: string | null
}

export interface TextoApoio {
  id: UUID
  prova_id: UUID
  rotulo: string
  conteudo_md: string
}

export interface Questao {
  id: UUID
  prova_id: UUID
  numero: number
  enunciado: string
  texto_apoio_id: UUID | null
  gabarito: string | null
  /** Sem casamento com o gabarito DEFINITIVO, não publica. Regra 3 do projeto. */
  gabarito_casado_em: string | null
  anulada: boolean
  /** Explicação NOSSA. Justificativa da banca é fonte, nunca cópia (regra 5). */
  comentario: string | null
  desatualizada: boolean
  motivo_desatualizacao: string | null
  status: StatusPublicacao
}

export interface Alternativa {
  id: UUID
  questao_id: UUID
  letra: string
  texto: string
}

export interface QuestaoAssunto {
  questao_id: UUID
  assunto_id: UUID
  principal: boolean
  confianca: number | null
}

// ------------------------------------------------------------------ usuário

export type TipoSessao = 'teoria' | 'questoes' | 'revisao'
export type Confianca = 'chutei' | 'duvida' | 'certeza'
export type TipoErro =
  | 'conteudo_desconhecido'
  | 'leitura_apressada'
  | 'pegadinha_semantica'
  | 'lei_mudou'
  | 'outro'

export interface Plano {
  id: UUID
  edital_id: UUID | null
  tipo: 'ciclo'
  horas_semana: number | null
  data_prova: string | null
  ativo: boolean
}

export interface BlocoCiclo {
  id: UUID
  plano_id: UUID
  disciplina_id: UUID
  minutos: number
  ordem: number
  peso: number
  /** Quantas voltas do ciclo este bloco já fechou. */
  voltas: number
}

export interface Sessao {
  id: UUID
  bloco_ciclo_id: UUID | null
  /** A sessão se prende ao ASSUNTO — decisão de 2026-08-20. */
  assunto_id: UUID | null
  tipo: TipoSessao
  inicio: string
  fim: string | null
  minutos: number | null
  /** Lançada à mão em vez de cronometrada. */
  manual: boolean
  nota: string | null
}

export interface Resposta {
  id: UUID
  questao_id: UUID
  sessao_id: UUID | null
  /** Só a tentativa 1 conta na estatística — decisão de 2026-08-20. */
  tentativa: number
  marcada: string | null
  correta: boolean
  segundos: number | null
  confianca: Confianca
  tipo_erro: TipoErro | null
  respondida_em: string
}

export interface Card {
  id: UUID
  origem: 'erro' | 'manual' | 'esquema'
  questao_id: UUID | null
  assunto_id: UUID | null
  frente: string
  verso: string
  suspenso: boolean
  criado_em: string
}

export interface Revisao {
  card_id: UUID
  devida_em: string
  estabilidade: number
  dificuldade: number
  estado: number
  ultima_nota: number | null
  ultima_revisao: string | null
  repeticoes: number
  lapsos: number
}

// ----------------------------------------------------------------- ajustes

export interface Ajuste {
  chave: string
  valor: unknown
}
