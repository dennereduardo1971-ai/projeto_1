/**
 * O ÚNICO lugar do app que decide se o placar é líquido ou bruto.
 *
 * Regra 2 do projeto: formato e penalidade são atributos da PROVA. Mostrar
 * "líquido" numa prova de múltipla escolha seria mentir; esconder o líquido
 * numa prova Certo/Errado também. Nenhum componente recalcula isto.
 */
import type { FormatoProva } from '@/dados/tipos'

export interface RegraDaProva {
  formato: FormatoProva
  penalidade_por_erro: boolean
}

export interface Contagem {
  acertos: number
  erros: number
  brancos: number
}

export interface Placar {
  /** `acertos − erros`, só onde o erro realmente pune. Fora disso, null. */
  liquido: number | null
  /** Percentual bruto de acerto sobre o que foi respondido. Sem base, null. */
  percentual: number | null
  respondidas: number
  rotulo: string
}

export function placar(regra: RegraDaProva, c: Contagem): Placar {
  const respondidas = c.acertos + c.erros
  const pune = regra.penalidade_por_erro
  return {
    liquido: pune ? c.acertos - c.erros : null,
    percentual: respondidas > 0 ? c.acertos / respondidas : null,
    respondidas,
    rotulo: pune ? 'Líquido (acertos − erros)' : 'Acerto bruto',
  }
}

/** Zero sem denominador é "—", nunca "0%": número sem base engana. */
export function formatarPercentual(v: number | null): string {
  if (v === null || Number.isNaN(v)) return '—'
  return `${Math.round(v * 100)}%`
}

export function formatarLiquido(v: number | null): string {
  if (v === null) return '—'
  return v > 0 ? `+${v}` : String(v)
}
