import type { Revisao } from '@/dados/tipos'

/**
 * Agendamento das revisões.
 *
 * INTERINO: implementação compacta e sem dependência, com o mesmo ESTADO do
 * FSRS (estabilidade, dificuldade, devida_em, repetições, lapsos). A decisão
 * do projeto é usar `ts-fsrs` — a troca não perde histórico, porque o que fica
 * gravado aqui é exatamente o que a biblioteca espera ler.
 *
 * A matemática nunca aparece na interface: o usuário vê "revisar hoje".
 */

const DIA = 86_400_000

export const NOTAS = [
  { n: 1, rotulo: 'Errei', desc: 'não lembrei' },
  { n: 2, rotulo: 'Difícil', desc: 'lembrei com esforço' },
  { n: 3, rotulo: 'Bom', desc: 'lembrei' },
  { n: 4, rotulo: 'Fácil', desc: 'imediato' },
] as const

export type Nota = (typeof NOTAS)[number]['n']

export function novaRevisao(cardId: string, agora = new Date()): Revisao {
  return {
    card_id: cardId,
    devida_em: agora.toISOString(),
    estabilidade: 1,
    dificuldade: 5,
    estado: 0,
    ultima_nota: null,
    ultima_revisao: null,
    repeticoes: 0,
    lapsos: 0,
  }
}

export function agendar(r: Revisao, nota: Nota, agora = new Date()): Revisao {
  const dificuldade = Math.min(10, Math.max(1, r.dificuldade + (3 - nota) * 0.6))

  let estabilidade: number
  if (nota === 1) {
    estabilidade = Math.max(0.4, r.estabilidade * 0.4) // lapso encolhe, não zera
  } else {
    const ganho = { 2: 1.25, 3: 1.9, 4: 2.7 }[nota]
    const freio = 1 - (dificuldade - 5) * 0.06 // card difícil cresce mais devagar
    estabilidade = Math.max(0.6, r.estabilidade * ganho * freio)
  }

  const intervalo = nota === 1 ? Math.min(estabilidade, 1) : estabilidade

  return {
    ...r,
    dificuldade: Number(dificuldade.toFixed(2)),
    estabilidade: Number(estabilidade.toFixed(2)),
    estado: nota === 1 ? 3 : 2,
    ultima_nota: nota,
    ultima_revisao: agora.toISOString(),
    repeticoes: r.repeticoes + 1,
    lapsos: r.lapsos + (nota === 1 ? 1 : 0),
    devida_em: new Date(agora.getTime() + Math.round(intervalo * DIA)).toISOString(),
  }
}

export const estaDevida = (r: Revisao, agora = Date.now()) =>
  new Date(r.devida_em).getTime() <= agora

export function textoProxima(r: Revisao): string {
  const dias = Math.round((new Date(r.devida_em).getTime() - Date.now()) / DIA)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  if (dias < 30) return `em ${dias} dias`
  const meses = Math.round(dias / 30)
  return meses === 1 ? 'em 1 mês' : `em ${meses} meses`
}
