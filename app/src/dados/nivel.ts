/**
 * Nível de domínio — DERIVADO, nunca digitado.
 *
 * Critério travado em 2026-08-20: `dominado` exige >= 10 questões respondidas,
 * >= 80% de acerto e nenhuma revisão atrasada. Enquanto o acervo estiver vazio,
 * o nível só se move por minutos de sessão — e por isso ele para em `estudado`.
 * Isso é honesto: sem questão respondida ninguém pode afirmar domínio.
 */

export const MIN_RESPOSTAS_DOMINIO = 10
export const MIN_ACERTO_DOMINIO = 0.8

export type Nivel = 0 | 1 | 2 | 3

export const NIVEIS = ['Não estudado', 'Estudado', 'Praticado', 'Dominado'] as const

export interface EntradaNivel {
  minutos: number
  respondidas: number
  acertos: number
  cardsAtrasados: number
}

export function derivarNivel(e: EntradaNivel): Nivel {
  if (e.minutos === 0 && e.respondidas === 0) return 0
  if (e.respondidas < MIN_RESPOSTAS_DOMINIO) return 1
  const taxa = e.acertos / e.respondidas
  if (taxa >= MIN_ACERTO_DOMINIO && e.cardsAtrasados === 0) return 3
  return 2
}
