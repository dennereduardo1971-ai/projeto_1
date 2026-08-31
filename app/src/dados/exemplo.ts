import exemplo from '@seeds/questoes-exemplo.json'
import { agora, db } from './db'
import type { Alternativa, FormatoProva, Questao } from './tipos'

/**
 * Conjunto de questões de EXEMPLO, carregado sob demanda.
 *
 * Não é acervo: é andaime. O acervo real entra pelo pipeline de ingestão, com
 * gabarito definitivo casado e atribuição de banca/ano/órgão/cargo. Estas aqui
 * existem para dar o que testar enquanto o pipeline não roda, ficam marcadas
 * como tal na interface, e saem inteiras com `removerExemplo()`.
 */

const CONCURSO_ID = 'exemplo-concurso'
const CARGO_ID = 'exemplo-cargo'

interface AlternativaSeed { letra: string; texto: string }
interface QuestaoSeed {
  numero: number
  assunto: string
  gabarito: string
  enunciado: string
  comentario: string
  alternativas?: AlternativaSeed[]
}
interface ProvaSeed {
  slug: string
  formato: FormatoProva
  penalidade_por_erro: boolean
  questoes: QuestaoSeed[]
}
interface ExemploSeed {
  versao: number
  aviso: string
  concurso: { slug: string; nome: string; orgao: string; banca: string; ano: number }
  cargo: string
  provas: ProvaSeed[]
}

const dados = exemplo as ExemploSeed
export const AVISO_EXEMPLO = dados.aviso

export async function temExemplo(): Promise<boolean> {
  return (await db.prova.where('concurso_id').equals(CONCURSO_ID).count()) > 0
}

export async function carregarExemplo(): Promise<number> {
  if (await temExemplo()) return 0

  const assuntos = await db.assunto.toArray()
  const porSlug = new Map(assuntos.map((a) => [a.slug, a.id]))
  let total = 0

  await db.transaction(
    'rw',
    [db.concurso, db.cargo, db.prova, db.questao, db.alternativa, db.questao_assunto],
    async () => {
      await db.concurso.put({
        id: CONCURSO_ID,
        slug: dados.concurso.slug,
        nome: dados.concurso.nome,
        orgao: dados.concurso.orgao,
        banca: dados.concurso.banca,
        ano: dados.concurso.ano,
      })
      await db.cargo.put({ id: CARGO_ID, concurso_id: CONCURSO_ID, nome: dados.cargo })

      for (const p of dados.provas) {
        const provaId = `exemplo-prova-${p.slug}`
        await db.prova.put({
          id: provaId,
          concurso_id: CONCURSO_ID,
          cargo_id: CARGO_ID,
          formato: p.formato,
          penalidade_por_erro: p.penalidade_por_erro,
          caderno_tipo: null,
          aplicada_em: null,
          url_pdf: null,
          url_gabarito: null,
          pdf_sha256: null,
        })

        for (const q of p.questoes) {
          const questaoId = `${provaId}-q${q.numero}`
          const questao: Questao = {
            id: questaoId,
            prova_id: provaId,
            numero: q.numero,
            enunciado: q.enunciado,
            texto_apoio_id: null,
            gabarito: q.gabarito,
            gabarito_casado_em: agora(),
            anulada: false,
            comentario: q.comentario,
            desatualizada: false,
            motivo_desatualizacao: null,
            status: 'publicada',
            origem_fonte: 'prova_oficial',
            autor_fonte: null,
            titulo_fonte: null,
            revisado_humano: true,
            dificuldade_b: 0,
          }
          await db.questao.put(questao)
          total++

          for (const alt of q.alternativas ?? []) {
            const a: Alternativa = {
              id: `${questaoId}-${alt.letra}`,
              questao_id: questaoId,
              letra: alt.letra,
              texto: alt.texto,
            }
            await db.alternativa.put(a)
          }

          const assuntoId = porSlug.get(q.assunto)
          if (assuntoId) {
            await db.questao_assunto.put({
              questao_id: questaoId,
              assunto_id: assuntoId,
              principal: true,
              confianca: 1,
            })
          }
        }
      }
    },
  )

  return total
}

/**
 * Tira o andaime: questões, respostas dadas a elas e o vínculo de domínio.
 *
 * `estado_assunto` não sabe distinguir "veio do exemplo" de "veio do acervo
 * real" (é por assunto, não por questão) — então só é removido se, depois de
 * tirar as questões de exemplo, aquele assunto não tiver mais nenhuma
 * resposta válida. Assunto que já tinha domínio real fica intocado.
 */
export async function removerExemplo(): Promise<void> {
  const provas = await db.prova.where('concurso_id').equals(CONCURSO_ID).toArray()
  const provaIds = provas.map((p) => p.id)
  const questoes = await db.questao.filter((q) => provaIds.includes(q.prova_id)).toArray()
  const questaoIds = new Set(questoes.map((q) => q.id))
  const assuntoIds = new Set(
    (await db.questao_assunto.filter((qa) => questaoIds.has(qa.questao_id)).toArray()).map(
      (qa) => qa.assunto_id,
    ),
  )

  await db.transaction(
    'rw',
    [db.concurso, db.cargo, db.prova, db.questao, db.alternativa, db.questao_assunto, db.resposta, db.estado_assunto],
    async () => {
      for (const q of questoes) {
        await db.alternativa.where('questao_id').equals(q.id).delete()
        await db.questao_assunto.where('questao_id').equals(q.id).delete()
        await db.resposta.where('questao_id').equals(q.id).delete()
        await db.questao.delete(q.id)
      }
      for (const id of provaIds) await db.prova.delete(id)
      await db.cargo.delete(CARGO_ID)
      await db.concurso.delete(CONCURSO_ID)

      for (const assuntoId of assuntoIds) {
        const aindaTemQuestao = await db.questao_assunto.where('assunto_id').equals(assuntoId).count()
        if (aindaTemQuestao === 0) await db.estado_assunto.delete(assuntoId)
      }
    },
  )
}

export const ehExemplo = (provaId: string) => provaId.startsWith('exemplo-prova-')
