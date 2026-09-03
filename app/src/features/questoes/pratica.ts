import { atribuicaoDaQuestao, type Atribuicao } from '@/dados/atribuicao'
import { agora, db, novoId } from '@/dados/db'
import { estadoInicial, registrarResposta } from '@/features/dominio/mastery'
import type { Alternativa, Assunto, Confianca, Prova, Questao, TipoErro } from '@/dados/tipos'

/**
 * A prática de questões.
 *
 * Duas regras do projeto vivem aqui e não podem ser contornadas pela tela:
 * questão anulada ou não publicada nunca é servida, e todo ERRO atualiza o
 * `estado_assunto` na hora (habilidade cai, erro fica em aberto, revisão é
 * reagendada) — é o que fecha o laço entre praticar e lembrar.
 */

export interface QuestaoCompleta {
  questao: Questao
  prova: Prova
  alternativas: Alternativa[]
  assunto: Assunto | null
  /** Linha de crédito pronta — a tela nunca monta a sua (regra 4). */
  atribuicao: Atribuicao
}

async function montar(questao: Questao): Promise<QuestaoCompleta | null> {
  const prova = await db.prova.get(questao.prova_id)
  if (!prova) return null
  const alternativas = (await db.alternativa.where('questao_id').equals(questao.id).toArray()).sort(
    (a, b) => a.letra.localeCompare(b.letra),
  )
  const vinculo = await db.questao_assunto.where('questao_id').equals(questao.id).first()
  const assunto = vinculo ? ((await db.assunto.get(vinculo.assunto_id)) ?? null) : null
  // Banca/órgão/cargo/ano de uma prova oficial moram em concurso/cargo; a
  // apostila não tem nem um nem outro e credita autor/título pela questão.
  const concurso = prova.concurso_id ? ((await db.concurso.get(prova.concurso_id)) ?? null) : null
  const cargo = prova.cargo_id ? ((await db.cargo.get(prova.cargo_id)) ?? null) : null
  return { questao, prova, alternativas, assunto, atribuicao: atribuicaoDaQuestao(questao, { concurso, cargo }) }
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
  /** `true` quando a resposta atualizou (ou criou) o estado de domínio do assunto. */
  atualizouDominio: boolean
}

export async function responder(
  alvo: QuestaoCompleta,
  marcada: string,
  confianca: Confianca,
  segundos: number | null = null,
  tipoErro: TipoErro | null = null,
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
    tipo_erro: correta ? null : tipoErro,
    respondida_em: agora(),
  })

  let atualizouDominio = false
  if (alvo.assunto) {
    const anterior = (await db.estado_assunto.get(alvo.assunto.id)) ?? estadoInicial(alvo.assunto.id)
    const { estado } = registrarResposta(anterior, correta, questao.dificuldade_b, Date.now(), tipoErro)
    await db.estado_assunto.put(estado)
    atualizouDominio = true
  }

  return { correta, gabarito: questao.gabarito ?? '', comentario: questao.comentario, atualizouDominio }
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
