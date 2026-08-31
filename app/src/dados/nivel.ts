/**
 * Nível de domínio — DERIVADO, nunca digitado.
 *
 * Desde 2026-08-31 vem do domínio EFETIVO do motor (`features/dominio/mastery.ts`
 * — habilidade × retenção), agregado por ramo (assunto + seus tópicos), no
 * lugar da contagem crua de respostas/acertos/cards atrasados de antes. Os
 * limiares (0,75 / 0,4) são os mesmos que `tomDominio` usa para colorir a
 * interface — nível e cor nunca podem divergir para o mesmo número.
 */

export const LIMIAR_BOM = 0.75
export const LIMIAR_DESENVOLVIMENTO = 0.4

export type Nivel = 0 | 1 | 2 | 3

export const NIVEIS = ['Não estudado', 'Estudado', 'Praticado', 'Dominado'] as const

export interface EntradaNivel {
  minutos: number
  /** Nº de respostas (1ª tentativa, válidas) registradas no ramo. */
  respostas: number
  /** Domínio efetivo médio do ramo (0–1), já com o piso de retenção aplicado. */
  dominioEfetivo: number
}

export function derivarNivel(e: EntradaNivel): Nivel {
  if (e.minutos === 0 && e.respostas === 0) return 0
  if (e.respostas === 0) return 1
  if (e.dominioEfetivo >= LIMIAR_BOM) return 3
  if (e.dominioEfetivo >= LIMIAR_DESENVOLVIMENTO) return 2
  return 1
}
