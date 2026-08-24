import { agora, db, novoId } from '@/dados/db'
import { novaRevisao } from '@/features/revisao/fsrs'
import type { Alternativa, Assunto, Confianca, Prova, Questao } from '@/dados/tipos'

/**
 * A prática de questões.
 *
 * Duas regras do projeto vivem aqui e não podem ser contornadas pela tela:
 * questão anulada ou não publicada nunca é servida, e todo ERRO vira card de
 * revisão na hora — é o que fecha o laço entre praticar e lembrar.
 */

export interface QuestaoCompleta {
  questao: Questao
  prova: Prova
  alternativas: Alternativa[]
  assunto: Assunto | null
}

async function montar(questao: Questao): Promise<QuestaoCompleta | null> {
  const prova = await db.prova.get(questao.prova_id)
  if (!prova) return null
  const alternativas = (await db.alternativa.where('questao_id').equals(questao.id).toArray()).sort(
    (a, b) => a.letra.localeCompare(b.letra),
  )
  const vinculo = await db.questao_assunto.where('questao_id').equals(questao.id).first()
  const assunto = vinculo ? ((await db.assunto.get(vinculo.assunto_id)) ?? null) : null
  return { questao, prova, alternativas, assunto }
}

/** Não respondida primeiro; depois a mais antiga, para reciclar sem repetir em sequência. */
export async function proximaQuestao(assuntoId?: string): Promise<QuestaoCompleta | null> {
  let publicadas = await db.questao
    .where('status')
    .equals('publicada')
    .filter((q) => !q.anulada)
    .toArray()

  if (assuntoId) {
    const vinculos = await db.questao_assunto.where('assunto_id').equals(assuntoId).toArray()
    const ids = new Set(vinculos.map((v) => v.questao_id))
    publicadas = publicadas.filter((q) => ids.has(q.id))
  }
  if (publicadas.length === 0) return null

  const respostas = await db.resposta.toArray()
  const ultimaPorQuestao = new Map<string, number>()
  for (const r of respostas) {
    const t = new Date(r.respondida_em).getTime()
    ultimaPorQuestao.set(r.questao_id, Math.max(ultimaPorQuestao.get(r.questao_id) ?? 0, t))
  }

  const inedita = publicadas.find((q) => !ultimaPorQuestao.has(q.id))
  if (inedita) return montar(inedita)

  const maisAntiga = publicadas.sort(
    (a, b) => (ultimaPorQuestao.get(a.id) ?? 0) - (ultimaPorQuestao.get(b.id) ?? 0),
  )[0]
  return montar(maisAntiga)
}

export interface Veredito {
  correta: boolean
  gabarito: string
  comentario: string | null
  virouCard: boolean
}

export async function responder(
  alvo: QuestaoCompleta,
  marcada: string,
  confianca: Confianca,
  segundos: number | null = null,
): Promise<Veredito> {
  const { questao } = alvo
  const correta = marcada === questao.gabarito

  const anteriores = await db.resposta.where('questao_id').equals(questao.id).count()

  await db.resposta.add({
    id: novoId(),
    questao_id: questao.id,
    sessao_id: null,
    tentativa: anteriores + 1,
    marcada,
    correta,
    segundos,
    confianca,
    tipo_erro: null,
    respondida_em: agora(),
  })

  let virouCard = false
  if (!correta) {
    const jaTem = await db.card.where('questao_id').equals(questao.id).first()
    if (!jaTem) {
      const cardId = novoId()
      await db.card.add({
        id: cardId,
        origem: 'erro',
        questao_id: questao.id,
        assunto_id: alvo.assunto?.id ?? null,
        frente: questao.enunciado,
        verso: questao.comentario ?? `Gabarito: ${questao.gabarito}`,
        suspenso: false,
        criado_em: agora(),
      })
      await db.revisao.add(novaRevisao(cardId))
      virouCard = true
    }
  }

  return { correta, gabarito: questao.gabarito ?? '', comentario: questao.comentario, virouCard }
}

export interface Placar {
  respondidas: number
  acertos: number
  erros: number
  /** Só faz sentido em prova que pune o erro. Em múltipla escolha, mentiria. */
  liquido: number | null
  percentual: number
}

export function placar(
  itens: { correta: boolean }[],
  penalidade: boolean,
): Placar {
  const acertos = itens.filter((i) => i.correta).length
  const erros = itens.length - acertos
  return {
    respondidas: itens.length,
    acertos,
    erros,
    liquido: penalidade ? acertos - erros : null,
    percentual: itens.length ? Math.round((acertos / itens.length) * 100) : 0,
  }
}
