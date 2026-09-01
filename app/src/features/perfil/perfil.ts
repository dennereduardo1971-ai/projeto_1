import { agora, db } from '@/dados/db'
import { estadoInicial, probabilidadeAcerto, type NivelDominio } from '@/features/dominio/mastery'
import type { EstadoAssunto, Meta } from '@/dados/tipos'
import type { Perfil, Ritmo } from './tipos'

/**
 * Onboarding sem login (`/bemvindo`): nome, ritmo e domínio inicial por
 * disciplina. As funções puras (presets, prior de theta, validação de nome)
 * ficam em cima; `obterPerfil`/`salvarPerfil` são as únicas que tocam o Dexie
 * e por isso não entram no teste unitário (`perfil.test.ts`).
 */

export const MAX_NOME = 60

/** Espaços redundantes cortados, tamanho travado — nunca salva lixo de teclado mobile. */
export function normalizarNome(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ').slice(0, MAX_NOME)
}

export function nomeValido(nome: string): boolean {
  return normalizarNome(nome).length > 0
}

export interface PresetRitmo {
  rotulo: string
  minutos_dia: number
  questoes_dia: number
  dias_semana: number
  descricao: string
}

/**
 * Presets do passo "Ritmo". `leve` e `moderado` seguem a sugestão original.
 * `intenso` foi ajustado de 180 para 120 min/dia: o público do produto é
 * adulto, ansioso e com pouco tempo — 2h por dia é o teto assumido no design
 * (ver persona no protocolo do agente `designer`) — 3h/dia no nível mais alto
 * seria prometer um ritmo que a própria pesquisa de produto diz que não
 * existe na rotina de quem estuda. 120 min continua sendo claramente o mais
 * exigente dos três, sem sair do teto.
 */
export const RITMOS: Record<Ritmo, PresetRitmo> = {
  leve: {
    rotulo: 'Leve',
    minutos_dia: 45,
    questoes_dia: 10,
    dias_semana: 4,
    descricao: '45 min por dia · 10 questões · 4 dias por semana',
  },
  moderado: {
    rotulo: 'Moderado',
    minutos_dia: 90,
    questoes_dia: 20,
    dias_semana: 5,
    descricao: '90 min por dia · 20 questões · 5 dias por semana',
  },
  intenso: {
    rotulo: 'Intenso',
    minutos_dia: 120,
    questoes_dia: 30,
    dias_semana: 6,
    descricao: '120 min por dia · 30 questões · 6 dias por semana',
  },
}

export function metaDoRitmo(ritmo: Ritmo, dataProva: string | null): Meta {
  const preset = RITMOS[ritmo]
  return {
    minutos_dia: preset.minutos_dia,
    questoes_dia: preset.questoes_dia,
    dias_semana: preset.dias_semana,
    data_prova: dataProva,
  }
}

/**
 * Prior de `theta` para cada nível declarado no passo "Domínio inicial".
 * Calibra a dificuldade/prioridade a partir do dia 1 — nunca vira estatística
 * de acerto sozinho, porque `dominioEfetivo` só liga depois de `n > 0`
 * (`features/dominio/mastery.ts`).
 */
export const PRIORS_THETA: Record<NivelDominio, number> = {
  inicial: -1.2,
  desenvolvimento: -0.5,
  intermediario: 0,
  bom: 0.6,
  dominado: 1.2,
}

export function thetaInicial(nivel: NivelDominio): number {
  return PRIORS_THETA[nivel]
}

/**
 * `EstadoAssunto` com o prior do nível declarado, mas `n = 0`, `acertos = 0`
 * e `ultima_pratica = null` — a autodeclaração calibra, nunca infla estatística.
 */
export function estadoInicialDoNivel(assuntoId: string, nivel: NivelDominio): EstadoAssunto {
  const theta = thetaInicial(nivel)
  return {
    ...estadoInicial(assuntoId),
    theta,
    m: probabilidadeAcerto(theta, 0),
  }
}

export async function obterPerfil(): Promise<Perfil | null> {
  return (await db.perfil.get('local')) ?? null
}

export interface EntradaPerfil {
  nome: string
  ritmo: Ritmo
  data_prova: string | null
  /** Chave = `disciplina.slug`. Disciplina sem entrada aqui vira `'inicial'`. */
  nivel_inicial: Record<string, NivelDominio>
}

/**
 * Semeia `estado_assunto` com o prior declarado para todo assunto (raiz e
 * tópico — `pratica.ts` grava domínio em qualquer profundidade) de cada
 * disciplina. Assunto que já tem `n > 0` fica intocado: é o caso de reabrir
 * `/bemvindo` em modo edição depois de já ter respondido questões — a
 * autodeclaração não pode apagar desempenho real.
 */
async function semearDominioInicial(nivelInicial: Record<string, NivelDominio>): Promise<void> {
  const disciplinas = await db.disciplina.toArray()
  for (const disciplina of disciplinas) {
    const nivel = nivelInicial[disciplina.slug] ?? 'inicial'
    const assuntos = await db.assunto.where('disciplina_id').equals(disciplina.id).toArray()
    for (const assunto of assuntos) {
      const existente = await db.estado_assunto.get(assunto.id)
      if (existente && existente.n > 0) continue
      await db.estado_assunto.put(estadoInicialDoNivel(assunto.id, nivel))
    }
  }
}

/**
 * Grava o perfil, espelha o ritmo em `db.meta` (é essa tabela que o resto do
 * app já lê) e semeia o domínio inicial. `criado_em` é preservado quando já
 * existe perfil — chamar de novo é editar, não recriar.
 */
export async function salvarPerfil(entrada: EntradaPerfil): Promise<void> {
  const existente = await obterPerfil()
  const perfil: Perfil = {
    nome: normalizarNome(entrada.nome),
    ritmo: entrada.ritmo,
    nivel_inicial: entrada.nivel_inicial,
    data_prova: entrada.data_prova,
    criado_em: existente?.criado_em ?? agora(),
    atualizado_em: agora(),
  }
  await db.perfil.put(perfil, 'local')
  await db.meta.put(metaDoRitmo(entrada.ritmo, entrada.data_prova), 'local')
  await semearDominioInicial(entrada.nivel_inicial)
}
