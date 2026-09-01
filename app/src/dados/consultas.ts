import { dominioEfetivo } from '@/features/dominio/mastery'
import { db } from './db'
import { ehExemplo } from './exemplo'
import { derivarNivel, type Nivel } from './nivel'
import type { Assunto, Disciplina, EstadoAssunto, OrigemFonte } from './tipos'

/**
 * Leituras do app. Toda agregação de desempenho passa por aqui, e por aqui
 * passa uma regra só: questão ANULADA fica fora, e só a PRIMEIRA tentativa
 * de cada questão conta. Nenhuma tela recalcula isso por conta própria.
 */

/**
 * Uma fonte distinta dentro do acervo real — uma prova oficial de uma banca,
 * ou uma apostila comentada de um autor. `Mais.tsx` lista isto para deixar
 * claro de onde vêm as questões; nunca é o texto autoral da banca, só a
 * atribuição (regra 4/5 do projeto).
 */
export interface FonteAcervo {
  origemFonte: OrigemFonte
  /** Banca (prova_oficial) ou autor da apostila (apostila_comentada). */
  banca: string | null
  autorFonte: string | null
  tituloFonte: string | null
  questoes: number
}

export interface EstadoAcervo {
  provas: number
  questoesPublicadas: number
  anuladas: number
  /** Fontes do acervo REAL — exclui o andaime de `exemplo.ts` por definição. */
  fontes: FonteAcervo[]
}

/**
 * Estado do acervo REAL, sem o andaime de `exemplo.ts` — que existe só para
 * testar o laço de estudo e nunca deve inflar "provas ingeridas" nem
 * "questões publicadas". Ver `ehExemplo`.
 */
export async function estadoAcervo(): Promise<EstadoAcervo> {
  const provas = await db.prova.toArray()
  const provasReais = provas.filter((p) => !ehExemplo(p.id))
  const idsProvasReais = new Set(provasReais.map((p) => p.id))

  const concursos = await db.concurso.bulkGet([...new Set(provasReais.map((p) => p.concurso_id))])
  const bancaPorConcurso = new Map(concursos.filter((c) => c).map((c) => [c!.id, c!.banca]))

  const questoes = await db.questao.filter((q) => idsProvasReais.has(q.prova_id)).toArray()
  const publicadas = questoes.filter((q) => q.status === 'publicada')

  const porFonte = new Map<string, FonteAcervo>()
  for (const q of publicadas) {
    const provaId = q.prova_id
    const prova = provasReais.find((p) => p.id === provaId)
    const banca = q.origem_fonte === 'prova_oficial' && prova
      ? bancaPorConcurso.get(prova.concurso_id) ?? null
      : null
    const chave = `${q.origem_fonte}::${q.autor_fonte ?? ''}::${q.titulo_fonte ?? ''}`
    const atual = porFonte.get(chave)
    if (atual) atual.questoes++
    else porFonte.set(chave, {
      origemFonte: q.origem_fonte,
      banca,
      autorFonte: q.autor_fonte,
      tituloFonte: q.titulo_fonte,
      questoes: 1,
    })
  }

  return {
    provas: provasReais.length,
    questoesPublicadas: publicadas.length,
    anuladas: questoes.filter((q) => q.anulada).length,
    fontes: [...porFonte.values()],
  }
}

/** Respostas que entram em estatística: 1ª tentativa e questão não anulada. */
export async function respostasValidas() {
  const primeiras = await db.resposta.filter((r) => r.tentativa === 1).toArray()
  if (primeiras.length === 0) return []
  const anuladas = new Set(
    (await db.questao.filter((q) => q.anulada).toArray()).map((q) => q.id),
  )
  return primeiras.filter((r) => !anuladas.has(r.questao_id))
}

/** Todo `estado_assunto`, indexado por assunto — a forma que o motor de domínio consome. */
export async function todosEstados(): Promise<Record<string, EstadoAssunto>> {
  const estados = await db.estado_assunto.toArray()
  return Object.fromEntries(estados.map((e) => [e.assunto_id, e]))
}

export interface LinhaAssunto {
  assunto: Assunto
  topicos: Assunto[]
  minutos: number
  respondidas: number
  acertos: number
  revisoesAtrasadas: number
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
  const [disciplinas, assuntos, sessoes, respostas, questaoAssunto, estados] = await Promise.all([
    db.disciplina.orderBy('ordem').toArray(),
    db.assunto.toArray(),
    db.sessao.filter((s) => s.fim !== null).toArray(),
    respostasValidas(),
    db.questao_assunto.toArray(),
    todosEstados(),
  ])

  const agoraMs = Date.now()

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
      const revisoesAtrasadas = idsDoRamo.filter((id) => {
        const e = estados[id]
        return e && e.revisar_em && new Date(e.revisar_em).getTime() <= agoraMs
      }).length
      const questoesNoAcervo = idsDoRamo.reduce((s, id) => s + (questoesPorAssunto.get(id) ?? 0), 0)

      const dominio = idsDoRamo.length
        ? idsDoRamo.reduce((s, id) => s + (estados[id] ? dominioEfetivo(estados[id], agoraMs) : 0), 0) /
          idsDoRamo.length
        : 0
      const nivel = derivarNivel({ minutos, respostas: d.respondidas, dominioEfetivo: dominio })
      porNivel[nivel]++
      minutosDisciplina += minutos

      return { assunto, topicos, minutos, ...d, revisoesAtrasadas, questoesNoAcervo, nivel }
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
  const revisoesDevidas = await db.estado_assunto
    .filter((e) => !!e.revisar_em && new Date(e.revisar_em).getTime() <= agoraMs)
    .count()

  return { minutosHoje, minutosSemana, sessoesHoje, revisoesDevidas }
}
