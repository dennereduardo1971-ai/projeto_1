/**
 * Gamificação orientada a APRENDIZADO, não a volume — portada do motor do
 * APP-CPA-YOHANNA (`src/lib/engine/gamification.ts`).
 *
 * Regras de projeto:
 *  - revisar erro vale mais que responder questão nova;
 *  - refazer questão já dominada vale quase nada;
 *  - resposta rápida demais não ganha bônus (evita clicar no automático);
 *  - perder um dia custa a sequência, nunca o progresso real.
 *
 * Tom sóbrio (CLAUDE.md regra 7): mecânica de jogo é permitida, estética de
 * jogo infantil não — por isso esta versão não porta o tema de "guardiões"/
 * dragões do CPA-YOHANNA (aquilo é a temática dele, não a do Rito).
 */

import type { Sequencia } from '@/dados/tipos'

export const XP = {
  responderQuestao: 5,
  acertoBonus: 10,
  acertoDificilBonus: 6,
  revisarErro: 18,
  concluirMetaDiaria: 60,
  concluirMetaSemanal: 150,
  esquemaConcluido: 25,
} as const

/** Tempo abaixo do qual não há bônus — resposta no automático não é estudo. */
export const TEMPO_MINIMO_MS = 3000

export interface GanhoXP {
  pontos: number
  motivo: string
}

export function xpPorResposta(params: {
  acertou: boolean
  dificil: boolean
  tempoMs: number
  eraErroAberto: boolean
  jaDominado: boolean
}): GanhoXP {
  const { acertou, dificil, tempoMs, eraErroAberto, jaDominado } = params

  // Refazer o que já se domina rende quase nada — evita farm de XP.
  if (jaDominado && acertou) return { pontos: 1, motivo: 'Manutenção' }

  const rapidoDemais = tempoMs < TEMPO_MINIMO_MS
  let pontos = XP.responderQuestao
  let motivo = 'Questão respondida'

  if (acertou && !rapidoDemais) {
    pontos += XP.acertoBonus
    motivo = 'Acerto'
    if (dificil) {
      pontos += XP.acertoDificilBonus
      motivo = 'Acerto em questão difícil'
    }
  } else if (acertou && rapidoDemais) {
    motivo = 'Acerto rápido demais — sem bônus'
  }

  if (eraErroAberto && acertou) {
    pontos += XP.revisarErro
    motivo = 'Erro superado'
  }

  return { pontos, motivo }
}

/** Nível cresce de forma quadrática: cada nível exige um pouco mais. */
export function nivelPorXP(xpTotal: number): { nivel: number; atual: number; proximo: number } {
  const nivel = Math.floor(Math.sqrt(xpTotal / 100)) + 1
  const base = (nivel - 1) ** 2 * 100
  const proximo = nivel ** 2 * 100
  return { nivel, atual: xpTotal - base, proximo: proximo - base }
}

/** Data local no formato YYYY-MM-DD, respeitando o fuso do dispositivo. */
export function diaLocal(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`)) / 86_400_000)
}

/**
 * Congelamentos deixaram de ser um saldo que só desce. O usuário começa com
 * zero e ganha um a cada marco de sequência — sem isso, quem usasse os
 * congelamentos ficava sem rede para sempre, e a sequência virava uma métrica
 * que só se pode perder.
 */
export const MAX_CONGELAMENTOS = 3
export const MARCOS_CONGELAMENTO = [7, 14, 30, 60, 100] as const

/** Um marco foi cruzado nesta virada de dia? */
export function cruzouMarco(anterior: number, novo: number): boolean {
  return MARCOS_CONGELAMENTO.some((m) => anterior < m && novo >= m)
}

export interface ResultadoSequencia extends Sequencia {
  /** `true` quando a sequência foi mantida por um congelamento. */
  usouCongelamento: boolean
  /** `true` quando esta virada de dia cruzou um marco e rendeu um congelamento. */
  ganhouCongelamento: boolean
  quebrou: boolean
}

/** Aplica o marco de sequência, respeitando o teto. */
function comMarco(anterior: number, novo: number, congelamentos: number) {
  const ganhou = cruzouMarco(anterior, novo) && congelamentos < MAX_CONGELAMENTOS
  return {
    congelamentos: ganhou ? congelamentos + 1 : congelamentos,
    ganhouCongelamento: ganhou,
  }
}

/**
 * Atualiza a sequência de estudos.
 * Um dia perdido consome um congelamento, se houver — a ideia é reduzir a
 * ansiedade da sequência sem tornar a métrica inútil.
 */
export function atualizarSequencia(atual: Sequencia, hoje: string): ResultadoSequencia {
  const parado = { ...atual, ultimo_dia: hoje, usouCongelamento: false, ganhouCongelamento: false, quebrou: false }

  if (atual.ultimo_dia === hoje) return parado
  if (!atual.ultimo_dia) {
    return { ...parado, atual: 1, recorde: Math.max(atual.recorde, 1) }
  }

  const lacuna = diasEntre(atual.ultimo_dia, hoje)

  if (lacuna === 1) {
    const novo = atual.atual + 1
    return {
      ...parado,
      atual: novo,
      recorde: Math.max(atual.recorde, novo),
      ...comMarco(atual.atual, novo, atual.congelamentos),
    }
  }

  // Um único dia perdido pode ser coberto por congelamento. O marco é avaliado
  // depois do gasto: quem usa a última rede e cruza o marco na mesma virada
  // sai com uma de novo, não com duas.
  if (lacuna === 2 && atual.congelamentos > 0) {
    const novo = atual.atual + 1
    const marco = comMarco(atual.atual, novo, atual.congelamentos - 1)
    return { ...parado, atual: novo, recorde: Math.max(atual.recorde, novo), usouCongelamento: true, ...marco }
  }

  return { ...parado, atual: 1, quebrou: true }
}

/** Próximo marco de sequência ainda não alcançado. */
export function proximoMarco(recorde: number): number | null {
  return MARCOS_CONGELAMENTO.find((m) => recorde < m) ?? null
}

// ------------------------------------------------------------- conquistas
// Catálogo em código, não em tabela — igual ao CPA-YOHANNA: a taxonomia de
// assuntos pode mudar, e uma constante calculada no import congelaria a
// lista de conquistas na versão anterior à edição.

export interface Conquista {
  id: string
  nome: string
  descricao: string
  incentiva: 'consistencia' | 'revisao' | 'desempenho' | 'meta'
}

export const CONQUISTAS: Conquista[] = [
  { id: 'primeira-sessao', nome: 'Rotina iniciada', descricao: 'Concluiu a primeira sessão de estudo.', incentiva: 'consistencia' },
  { id: 'sequencia-3', nome: 'Três seguidos', descricao: 'Manteve 3 dias de sequência.', incentiva: 'consistencia' },
  { id: 'sequencia-7', nome: 'Uma semana', descricao: 'Manteve 7 dias de sequência.', incentiva: 'consistencia' },
  { id: 'sequencia-30', nome: 'Um mês inteiro', descricao: 'Manteve 30 dias de sequência.', incentiva: 'consistencia' },
  { id: 'erro-superado-10', nome: 'Corrigiu a rota', descricao: 'Superou 10 erros na revisão.', incentiva: 'revisao' },
  { id: 'revisao-em-dia', nome: 'Revisão em dia', descricao: 'Zerou a fila de revisão vencida.', incentiva: 'revisao' },
  { id: 'dominado-5', nome: 'Cinco dominados', descricao: 'Atingiu nível Dominado em 5 assuntos.', incentiva: 'desempenho' },
  { id: 'meta-7', nome: 'Meta batida 7 vezes', descricao: 'Cumpriu a meta diária em 7 dias.', incentiva: 'meta' },
]

export const getConquista = (id: string) => CONQUISTAS.find((c) => c.id === id)

/** O recorte do estado que as regras de conquista precisam ver. */
export interface SnapshotGamificacao {
  sessoes: number
  sequenciaAtual: number
  congelamentos: number
  assuntosDominados: number
  errosSuperados: number
  revisaoEmDia: boolean
  diasComMetaCumprida: number
}

const REGRAS: Record<string, (s: SnapshotGamificacao) => boolean> = {
  'primeira-sessao': (s) => s.sessoes >= 1,
  'sequencia-3': (s) => s.sequenciaAtual >= 3,
  'sequencia-7': (s) => s.sequenciaAtual >= 7,
  'sequencia-30': (s) => s.sequenciaAtual >= 30,
  'erro-superado-10': (s) => s.errosSuperados >= 10,
  'revisao-em-dia': (s) => s.revisaoEmDia,
  'dominado-5': (s) => s.assuntosDominados >= 5,
  'meta-7': (s) => s.diasComMetaCumprida >= 7,
}

/** Conquistas que o snapshot satisfaz e que ainda não foram concedidas. */
export function avaliarConquistas(
  snap: SnapshotGamificacao,
  jaObtidas: readonly string[],
): Conquista[] {
  return CONQUISTAS.filter((c) => !jaObtidas.includes(c.id) && REGRAS[c.id]?.(snap))
}
