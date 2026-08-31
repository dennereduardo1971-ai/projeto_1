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

/**
 * De onde a questão veio. Pivô de 2026-08-31 (CLAUDE.md, regras 3–5):
 * `prova_oficial` é o Cebraspe, com gabarito casado e sem comentário de
 * terceiro. `apostila_comentada` é PDF de terceiro (tipo apostila de
 * professor) — não há banca para casar gabarito, e o comentário do autor
 * pode ser guardado com atribuição. Exceção temporária, revisar antes de
 * lançamento público ou monetização.
 */
export type OrigemFonte = 'prova_oficial' | 'apostila_comentada'

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
  /** Sem casamento com o gabarito DEFINITIVO, não publica. Regra 3 do projeto
   *  — exceto `origem_fonte = 'apostila_comentada'`, que usa `revisado_humano`. */
  gabarito_casado_em: string | null
  anulada: boolean
  /**
   * Explicação exibida ao usuário. Quando `origem_fonte = 'prova_oficial'` é
   * NOSSA (justificativa da banca é fonte, nunca cópia — regra 5). Quando
   * `origem_fonte = 'apostila_comentada'` pode ser o comentário do próprio
   * autor da apostila, com atribuição obrigatória em `autor_fonte`.
   */
  comentario: string | null
  desatualizada: boolean
  motivo_desatualizacao: string | null
  status: StatusPublicacao
  /** Pivô 2026-08-31 — ver `OrigemFonte`. */
  origem_fonte: OrigemFonte
  /** Atribuição para `apostila_comentada` (nome do autor/professor). Regra 4. */
  autor_fonte: string | null
  /** Atribuição para `apostila_comentada` (nome da apostila/curso). Regra 4. */
  titulo_fonte: string | null
  /**
   * Gate leve para `apostila_comentada`: você revisou e confirma que o
   * gabarito e o comentário estão corretos. Substitui `gabarito_casado_em`
   * só nessa origem — `prova_oficial` continua exigindo o casamento.
   */
  revisado_humano: boolean
  /**
   * Dificuldade latente da questão (escala logit), para o motor de domínio
   * (`app/src/features/dominio/mastery.ts`). `0` = dificuldade média; sem
   * calibração ainda, toda questão nasce em `0`.
   */
  dificuldade_b: number
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

/**
 * Domínio e revisão de um assunto — um único estado, no molde do
 * `EstadoConceito` do APP-CPA-YOHANNA. Substitui `Card` + `Revisao` (FSRS
 * separado): decisão de 2026-08-31, ver CLAUDE.md regra 8. Motor em
 * `app/src/features/dominio/mastery.ts`.
 */
export interface EstadoAssunto {
  assunto_id: UUID
  /** Habilidade latente (logit) — Elo-IRT de 1 parâmetro. */
  theta: number
  /** Domínio 0–1, sem decaimento (chance de acertar uma questão média). */
  m: number
  /** Nº de respostas registradas neste assunto. */
  n: number
  acertos: number
  /** Estabilidade da memória, em dias — quanto maior, mais devagar esquece. */
  estabilidade: number
  ultima_pratica: string | null
  /** Quando a revisão deste assunto vence. */
  revisar_em: string | null
  /** Material esquematizado deste assunto já foi lido (Fase 4). */
  esquema_concluido: boolean
  /** Erros ainda não superados (zera quando acerta de novo). */
  erros_abertos: number
}

// ------------------------------------------------------------ gamificação
// Motor igual ao APP-CPA-YOHANNA, tom sóbrio (CLAUDE.md regra 7): mecânica de
// jogo é permitida, estética de jogo infantil não.

export interface Sequencia {
  atual: number
  recorde: number
  ultimo_dia: string | null
  congelamentos: number
}

export interface EventoXP {
  id: UUID
  pontos: number
  motivo: string
  data: string
}

export interface ConquistaUsuario {
  conquista_id: string
  obtida_em: string
}

export interface Meta {
  minutos_dia: number
  questoes_dia: number
  dias_semana: number
  data_prova: string | null
}

// ----------------------------------------------------------------- ajustes

export interface Ajuste {
  chave: string
  valor: unknown
}
