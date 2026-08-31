import type { EstadoAssunto, Questao } from '@/dados/tipos'
import { dominioEfetivo, probabilidadeAcerto, retencao } from './mastery'

/**
 * Revisão adaptativa — simples e explicável de propósito, portada do motor do
 * APP-CPA-YOHANNA (`src/lib/engine/scheduler.ts`).
 *
 * Todo assunto priorizado carrega o motivo pelo qual foi escolhido, e a
 * interface mostra esse motivo ao usuário. Um algoritmo que o aluno não
 * entende vira superstição.
 */

export type MotivoSelecao =
  | 'erro_recente'
  | 'revisao_vencida'
  | 'lacuna'
  | 'peso_disciplina'
  | 'conteudo_novo'
  | 'manutencao'

export const ROTULO_SELECAO: Record<MotivoSelecao, string> = {
  erro_recente: 'Você errou isso recentemente',
  revisao_vencida: 'Está na hora de revisar',
  lacuna: 'Seu ponto mais fraco agora',
  peso_disciplina: 'Assunto com peso alto',
  conteudo_novo: 'Conteúdo novo para você',
  manutencao: 'Manutenção — só para não esquecer',
}

export interface ItemPriorizado {
  assuntoId: string
  score: number
  motivo: MotivoSelecao
  /** Frase pronta explicando a escolha ao usuário. */
  explicacao: string
}

export interface ContextoPrioridade {
  estados: Record<string, EstadoAssunto>
  /**
   * Peso do assunto (0–1), tipicamente o peso da disciplina. Sem edital
   * cadastrado ainda, todo assunto entra com peso uniforme (ver Fase 1 do
   * roadmap) — quando o edital existir, este mapa passa a refletir a
   * incidência real.
   */
  pesoAssunto: Record<string, number>
  agoraMs: number
  /** Assuntos vistos nas últimas 24h — reduz repetição imediata. */
  recentes: Set<string>
}

/** Pesos da fórmula de prioridade. Explicitados para poderem ser auditados. */
export const PESOS = {
  lacuna: 1.0,
  peso: 0.7,
  revisao: 0.9,
  erro: 1.1,
  saturacao: 0.6,
  novo: 0.45,
} as const

/**
 * Pontua um assunto. Quanto maior o score, mais o aluno precisa dele agora.
 *
 *   score = lacuna + peso do assunto + urgência de revisão + erros abertos
 *           − saturação recente
 */
export function pontuarAssunto(assuntoId: string, ctx: ContextoPrioridade): ItemPriorizado {
  const estado = ctx.estados[assuntoId]
  const peso = ctx.pesoAssunto[assuntoId] ?? 0.25

  if (!estado || estado.n === 0) {
    return {
      assuntoId,
      score: PESOS.novo + PESOS.peso * peso,
      motivo: 'conteudo_novo',
      explicacao: ROTULO_SELECAO.conteudo_novo,
    }
  }

  const efetivo = dominioEfetivo(estado, ctx.agoraMs)
  const lacuna = PESOS.lacuna * (1 - efetivo)
  const relevancia = PESOS.peso * peso
  const urgencia = PESOS.revisao * Math.max(0, 1 - retencao(estado, ctx.agoraMs))
  const erro = PESOS.erro * Math.min(1, estado.erros_abertos / 2)
  const saturacao = ctx.recentes.has(assuntoId) ? PESOS.saturacao : 0

  const score = lacuna + relevancia + urgencia + erro - saturacao

  // O motivo exibido é o termo que mais pesou na escolha.
  const termos: [MotivoSelecao, number][] = [
    ['erro_recente', erro],
    ['revisao_vencida', urgencia],
    ['lacuna', lacuna],
    ['peso_disciplina', relevancia],
  ]
  termos.sort((a, b) => b[1] - a[1])
  const motivo: MotivoSelecao = efetivo >= 0.9 ? 'manutencao' : termos[0][0]

  return { assuntoId, score, motivo, explicacao: ROTULO_SELECAO[motivo] }
}

/**
 * Escolhe a melhor questão de um conjunto para o estado atual do aluno.
 * Busca chance de acerto próxima de 80% — nem frustrante, nem inútil.
 */
export function escolherQuestao(
  candidatas: Questao[],
  estado: EstadoAssunto | undefined,
  jaVistas: Set<string>,
): Questao | undefined {
  if (!candidatas.length) return undefined
  const theta = estado?.theta ?? 0

  const naoVistas = candidatas.filter((q) => !jaVistas.has(q.id))
  const pool = naoVistas.length ? naoVistas : candidatas

  return pool.reduce((melhor, q) => {
    const distancia = Math.abs(probabilidadeAcerto(theta, q.dificuldade_b) - 0.8)
    const distanciaMelhor = Math.abs(probabilidadeAcerto(theta, melhor.dificuldade_b) - 0.8)
    return distancia < distanciaMelhor ? q : melhor
  })
}

/** Assuntos com revisão vencida, do mais atrasado para o menos. */
export function filaDeRevisao(
  estados: Record<string, EstadoAssunto>,
  agoraMs: number,
): EstadoAssunto[] {
  return Object.values(estados)
    .filter((e) => e.n > 0 && e.revisar_em && new Date(e.revisar_em).getTime() <= agoraMs)
    .sort((a, b) => new Date(a.revisar_em!).getTime() - new Date(b.revisar_em!).getTime())
}

/** Assuntos com erros ainda não superados. */
export function errosAbertos(estados: Record<string, EstadoAssunto>): EstadoAssunto[] {
  return Object.values(estados)
    .filter((e) => e.erros_abertos > 0)
    .sort((a, b) => b.erros_abertos - a.erros_abertos)
}
