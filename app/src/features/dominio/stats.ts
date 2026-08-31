import type { EstadoAssunto } from '@/dados/tipos'
import { dominioEfetivo, nivelDominio, type NivelDominio } from './mastery'

/**
 * Cálculo de desempenho — portado do motor do APP-CPA-YOHANNA
 * (`src/lib/engine/stats.ts`). Puro: recebe estados e respostas já resolvidos
 * pela camada de dados (`dados/consultas.ts`), devolve números. Nenhuma
 * consulta ao banco mora aqui — isso mantém o motor testável sem Dexie.
 */

export interface RespostaAgregavel {
  correta: boolean
  segundos: number | null
  /** Timestamp ISO — usado só em `evolucaoDiaria`. */
  respondidaEm: string
}

export interface Agregado {
  total: number
  acertos: number
  taxaAcerto: number
  tempoMedioMs: number
}

export function agregar(respostas: RespostaAgregavel[]): Agregado {
  const total = respostas.length
  const acertos = respostas.filter((r) => r.correta).length
  const tempo = respostas.reduce((s, r) => s + (r.segundos ?? 0) * 1000, 0)
  return {
    total,
    acertos,
    taxaAcerto: total ? acertos / total : 0,
    tempoMedioMs: total ? tempo / total : 0,
  }
}

/**
 * Domínio médio de um ramo (um assunto e seus tópicos filhos, ou uma
 * disciplina inteira) — média do domínio efetivo dos ids do ramo que já têm
 * estado registrado.
 */
export function dominioRamo(
  idsDoRamo: string[],
  estados: Record<string, EstadoAssunto>,
  agoraMs: number,
): number {
  if (!idsDoRamo.length) return 0
  const soma = idsDoRamo.reduce((s, id) => {
    const estado = estados[id]
    return s + (estado ? dominioEfetivo(estado, agoraMs) : 0)
  }, 0)
  return soma / idsDoRamo.length
}

export interface RankingLinha {
  id: string
  nome: string
  dominio: number
  nivel: NivelDominio
  respostas: number
}

/** Ramos ordenados por domínio — os primeiros são os mais fracos. */
export function ranking(
  ramos: { id: string; nome: string; idsDoRamo: string[] }[],
  estados: Record<string, EstadoAssunto>,
  agoraMs: number,
): RankingLinha[] {
  return ramos
    .map(({ id, nome, idsDoRamo }) => {
      const respostas = idsDoRamo.reduce((s, i) => s + (estados[i]?.n ?? 0), 0)
      const dominio = dominioRamo(idsDoRamo, estados, agoraMs)
      return { id, nome, dominio, nivel: nivelDominio(dominio), respostas }
    })
    .sort((a, b) => a.dominio - b.dominio)
}

export const assuntosFracos = (
  ramos: { id: string; nome: string; idsDoRamo: string[] }[],
  estados: Record<string, EstadoAssunto>,
  agoraMs: number,
) => ranking(ramos, estados, agoraMs).filter((r) => r.respostas > 0 && r.dominio < 0.6)

export const assuntosFortes = (
  ramos: { id: string; nome: string; idsDoRamo: string[] }[],
  estados: Record<string, EstadoAssunto>,
  agoraMs: number,
) =>
  ranking(ramos, estados, agoraMs)
    .filter((r) => r.dominio >= 0.75)
    .reverse()

/** Série temporal de taxa de acerto por dia, para o gráfico de evolução. */
export function evolucaoDiaria(
  respostas: RespostaAgregavel[],
  dias = 30,
): { dia: string; taxa: number; total: number }[] {
  const porDia = new Map<string, { acertos: number; total: number }>()
  for (const r of respostas) {
    const d = new Date(r.respondidaEm)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
    const atual = porDia.get(chave) ?? { acertos: 0, total: 0 }
    atual.total += 1
    if (r.correta) atual.acertos += 1
    porDia.set(chave, atual)
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-dias)
    .map(([dia, v]) => ({ dia, taxa: v.total ? v.acertos / v.total : 0, total: v.total }))
}

/** Cobertura: proporção de assuntos com pelo menos uma resposta. */
export function cobertura(todosAssuntoIds: string[], estados: Record<string, EstadoAssunto>): number {
  if (!todosAssuntoIds.length) return 0
  const tocados = todosAssuntoIds.filter((id) => (estados[id]?.n ?? 0) > 0).length
  return tocados / todosAssuntoIds.length
}

/**
 * Progresso geral: domínio ponderado pelo peso de cada disciplina.
 * É um indicador pedagógico — nunca uma previsão de aprovação.
 */
export function progressoGeral(
  disciplinas: { id: string; peso: number; idsDoRamo: string[] }[],
  estados: Record<string, EstadoAssunto>,
  agoraMs: number,
): number {
  return disciplinas.reduce(
    (s, d) => s + d.peso * dominioRamo(d.idsDoRamo, estados, agoraMs),
    0,
  )
}

/**
 * Prontidão declarada com honestidade: só reporta um número quando há
 * amostra suficiente. Abaixo do mínimo, devolve `null` e a interface diz
 * "cobertura insuficiente" em vez de inventar uma probabilidade.
 */
export const MINIMO_RESPOSTAS = 60
export const MINIMA_COBERTURA = 0.5

export interface Prontidao {
  valor: number | null
  cobertura: number
  respostas: number
  faltamRespostas: number
  motivo?: string
}

export function prontidao(
  totalRespostas: number,
  todosAssuntoIds: string[],
  disciplinas: { id: string; peso: number; idsDoRamo: string[] }[],
  estados: Record<string, EstadoAssunto>,
  agoraMs: number,
): Prontidao {
  const cob = cobertura(todosAssuntoIds, estados)

  if (totalRespostas < MINIMO_RESPOSTAS || cob < MINIMA_COBERTURA) {
    return {
      valor: null,
      cobertura: cob,
      respostas: totalRespostas,
      faltamRespostas: Math.max(0, MINIMO_RESPOSTAS - totalRespostas),
      motivo:
        totalRespostas < MINIMO_RESPOSTAS
          ? `Responda mais ${MINIMO_RESPOSTAS - totalRespostas} questões para liberar esta estimativa.`
          : `Você ainda não estudou ${Math.round((1 - cob) * 100)}% dos assuntos.`,
    }
  }

  return {
    valor: progressoGeral(disciplinas, estados, agoraMs),
    cobertura: cob,
    respostas: totalRespostas,
    faltamRespostas: 0,
  }
}
