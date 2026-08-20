import { db } from './db'
import { derivarNivel, type Nivel } from './nivel'
import type { Assunto, Disciplina } from './tipos'

/**
 * Leituras do app. Toda agregação de desempenho passa por aqui, e por aqui
 * passa uma regra só: questão ANULADA fica fora, e só a PRIMEIRA tentativa
 * de cada questão conta. Nenhuma tela recalcula isso por conta própria.
 */

export interface EstadoAcervo {
  provas: number
  questoesPublicadas: number
  anuladas: number
}

export async function estadoAcervo(): Promise<EstadoAcervo> {
  const [provas, questoesPublicadas, anuladas] = await Promise.all([
    db.prova.count(),
    db.questao.where('status').equals('publicada').count(),
    db.questao.filter((q) => q.anulada).count(),
  ])
  return { provas, questoesPublicadas, anuladas }
}

/** Respostas que entram em estatística: 1ª tentativa e questão não anulada. */
async function respostasValidas() {
  const primeiras = await db.resposta.filter((r) => r.tentativa === 1).toArray()
  if (primeiras.length === 0) return []
  const anuladas = new Set(
    (await db.questao.filter((q) => q.anulada).toArray()).map((q) => q.id),
  )
  return primeiras.filter((r) => !anuladas.has(r.questao_id))
}

export interface LinhaAssunto {
  assunto: Assunto
  topicos: Assunto[]
  minutos: number
  respondidas: number
  acertos: number
  cardsAtrasados: number
  questoesNoAcervo: number
  nivel: Nivel
}

export interface GrupoDisciplina {
  disciplina: Disciplina
  linhas: LinhaAssunto[]
  minutos: number
  porNivel: [number, number, number, number]
}

/**
 * O Mapa. Enquanto o edital não é cadastrado, a unidade visível é o ASSUNTO —
 * quando o edital entrar, cada linha literal dele aponta para estes mesmos
 * assuntos e o progresso acumulado aqui continua valendo.
 */
export async function mapa(): Promise<GrupoDisciplina[]> {
  const [disciplinas, assuntos, sessoes, respostas, questaoAssunto, revisoes] =
    await Promise.all([
      db.disciplina.orderBy('ordem').toArray(),
      db.assunto.toArray(),
      db.sessao.filter((s) => s.fim !== null).toArray(),
      respostasValidas(),
      db.questao_assunto.toArray(),
      db.revisao.toArray(),
    ])

  const agoraMs = Date.now()
  const cardsPorAssunto = new Map<string, number>()
  if (revisoes.length > 0) {
    const cards = await db.card.toArray()
    const porId = new Map(cards.map((c) => [c.id, c]))
    for (const r of revisoes) {
      if (new Date(r.devida_em).getTime() > agoraMs) continue
      const card = porId.get(r.card_id)
      if (!card?.assunto_id) continue
      cardsPorAssunto.set(card.assunto_id, (cardsPorAssunto.get(card.assunto_id) ?? 0) + 1)
    }
  }

  const minutosPorAssunto = new Map<string, number>()
  for (const s of sessoes) {
    if (!s.assunto_id || !s.minutos) continue
    minutosPorAssunto.set(s.assunto_id, (minutosPorAssunto.get(s.assunto_id) ?? 0) + s.minutos)
  }

  const assuntoDaQuestao = new Map<string, string>()
  const questoesPorAssunto = new Map<string, number>()
  for (const qa of questaoAssunto) {
    questoesPorAssunto.set(qa.assunto_id, (questoesPorAssunto.get(qa.assunto_id) ?? 0) + 1)
    if (qa.principal) assuntoDaQuestao.set(qa.questao_id, qa.assunto_id)
  }

  const desempenho = new Map<string, { respondidas: number; acertos: number }>()
  for (const r of respostas) {
    const assuntoId = assuntoDaQuestao.get(r.questao_id)
    if (!assuntoId) continue
    const d = desempenho.get(assuntoId) ?? { respondidas: 0, acertos: 0 }
    d.respondidas++
    if (r.correta) d.acertos++
    desempenho.set(assuntoId, d)
  }

  const porDisciplina = new Map<string, Assunto[]>()
  for (const a of assuntos) {
    const lista = porDisciplina.get(a.disciplina_id) ?? []
    lista.push(a)
    porDisciplina.set(a.disciplina_id, lista)
  }

  return disciplinas.map((disciplina) => {
    const todos = (porDisciplina.get(disciplina.id) ?? []).sort((a, b) => a.ordem - b.ordem)
    const raizes = todos.filter((a) => a.profundidade === 1)
    const porNivel: [number, number, number, number] = [0, 0, 0, 0]
    let minutosDisciplina = 0

    const linhas = raizes.map((assunto) => {
      const topicos = todos.filter((t) => t.pai_id === assunto.id)
      const idsDoRamo = [assunto.id, ...topicos.map((t) => t.id)]

      const minutos = idsDoRamo.reduce((s, id) => s + (minutosPorAssunto.get(id) ?? 0), 0)
      const d = idsDoRamo.reduce(
        (acc, id) => {
          const x = desempenho.get(id)
          return x ? { respondidas: acc.respondidas + x.respondidas, acertos: acc.acertos + x.acertos } : acc
        },
        { respondidas: 0, acertos: 0 },
      )
      const cardsAtrasados = idsDoRamo.reduce((s, id) => s + (cardsPorAssunto.get(id) ?? 0), 0)
      const questoesNoAcervo = idsDoRamo.reduce((s, id) => s + (questoesPorAssunto.get(id) ?? 0), 0)

      const nivel = derivarNivel({ minutos, respondidas: d.respondidas, acertos: d.acertos, cardsAtrasados })
      porNivel[nivel]++
      minutosDisciplina += minutos

      return { assunto, topicos, minutos, ...d, cardsAtrasados, questoesNoAcervo, nivel }
    })

    return { disciplina, linhas, minutos: minutosDisciplina, porNivel }
  })
}

export interface ResumoDeHoje {
  minutosHoje: number
  minutosSemana: number
  sessoesHoje: number
  revisoesDevidas: number
}

export async function resumoDeHoje(): Promise<ResumoDeHoje> {
  const inicioDoDia = new Date()
  inicioDoDia.setHours(0, 0, 0, 0)
  const inicioDaSemana = new Date(inicioDoDia)
  inicioDaSemana.setDate(inicioDaSemana.getDate() - 6)

  const sessoes = await db.sessao.filter((s) => s.fim !== null).toArray()
  let minutosHoje = 0
  let minutosSemana = 0
  let sessoesHoje = 0
  for (const s of sessoes) {
    const t = new Date(s.inicio).getTime()
    if (t >= inicioDaSemana.getTime()) minutosSemana += s.minutos ?? 0
    if (t >= inicioDoDia.getTime()) {
      minutosHoje += s.minutos ?? 0
      sessoesHoje++
    }
  }

  const agoraMs = Date.now()
  const revisoesDevidas = await db.revisao
    .filter((r) => new Date(r.devida_em).getTime() <= agoraMs)
    .count()

  return { minutosHoje, minutosSemana, sessoesHoje, revisoesDevidas }
}
