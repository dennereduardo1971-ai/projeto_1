import { db } from './db'
import type {
  Alternativa, Cargo, Concurso, FormatoProva, OrigemFonte, Prova, Questao, QuestaoAssunto,
} from './tipos'

/**
 * O acervo real, lido de `acervo/provas/*.json`.
 *
 * Aqueles arquivos são a saída do pipeline (`scripts/ingest/`), versionados no
 * git e auditáveis. Este módulo é a ponte que faltava: sem ele o pipeline
 * publicava para ninguém — o app só conhecia as questões de exemplo.
 *
 * O portão de publicação é repetido AQUI de propósito. `7_publicar.py` já
 * validou o artefato quando ele foi gravado, mas o artefato é um arquivo que
 * qualquer um edita à mão depois; o app não confia num carimbo de status para
 * mostrar questão ao usuário. As regras 3 e 4 do `CLAUDE.md` são checadas de
 * novo, questão por questão, e o que não passa não entra:
 *
 * - `prova_oficial` exige gabarito casado com o definitivo da banca e a
 *   atribuição completa (banca, ano, órgão, cargo, número original);
 * - `apostila_comentada` exige gabarito próprio + `revisado_humano`, e a
 *   atribuição equivalente (autor e título da apostila);
 * - questão anulada entra marcada, nunca é servida e nunca conta estatística.
 *
 * O acervo é conteúdo do projeto, não escolha do usuário: carrega sozinho no
 * boot, como a taxonomia. As questões de EXEMPLO (`exemplo.ts`) continuam
 * sendo outra coisa — andaime opcional, sem banca.
 */

// ── forma do artefato (espelha scripts/ingest/schema/prova.schema.json) ──────

interface AlternativaBruta {
  letra: string
  texto: string
}

interface AtribuicaoBruta {
  banca?: string
  ano?: number
  orgao?: string
  cargo?: string
  numero_original?: number
  url_pdf?: string
}

interface QuestaoBruta {
  numero: number
  tipo: FormatoProva
  enunciado: string
  pagina: number
  texto_apoio_id?: string
  alternativas?: AlternativaBruta[]
  gabarito?: string
  anulada: boolean
  desatualizada?: boolean
  revisado_humano?: boolean
  comentario?: string
  disciplina?: string
  assunto?: string
  classificacao_confianca?: number
  atribuicao?: AtribuicaoBruta
}

interface ProvaBruta {
  slug: string
  origem_fonte?: OrigemFonte
  autor_fonte?: string
  titulo_fonte?: string
  banca?: string
  ano?: number
  orgao?: string
  cargo?: string
  formato: FormatoProva
  penalidade_por_erro: boolean
  tipo_caderno?: string
  fonte_pdf?: string
  fonte_gabarito?: string
  sha256_pdf?: string
}

export interface ArtefatoBruto {
  versao_artefato: number
  gerado_em: string
  status: string
  avisos?: string[]
  prova: ProvaBruta
  questoes: QuestaoBruta[]
}

/** Confiança mínima da classificação por assunto — igual a `lib/modelos.py`. */
export const LIMIAR_CONFIANCA = 0.75

const modulos = import.meta.glob<ArtefatoBruto>('../../../acervo/provas/*.json', {
  eager: true,
  import: 'default',
})

/** Todo artefato publicado no repositório, em ordem estável de arquivo. */
export const ARTEFATOS: ArtefatoBruto[] = Object.keys(modulos)
  .sort((a, b) => a.localeCompare(b))
  .map((caminho) => modulos[caminho])

// ── normalização: artefato → linhas do banco local ──────────────────────────

export interface RegistrosDoArtefato {
  /** Só existe para `prova_oficial` — apostila de terceiro não tem concurso. */
  concurso: Concurso | null
  cargo: Cargo | null
  prova: Prova
  questoes: Questao[]
  alternativas: Alternativa[]
  vinculos: QuestaoAssunto[]
  /** Questão que não passou no portão, com o motivo. Não entra no banco. */
  recusadas: { numero: number; motivo: string }[]
  /** Entrou, mas com ressalva (assunto fora da taxonomia, por exemplo). */
  avisos: string[]
}

export type Normalizacao =
  | { ok: true; registros: RegistrosDoArtefato }
  | { ok: false; slug: string; motivos: string[] }

/** Ids determinísticos: reprocessar a mesma prova atualiza, nunca duplica. */
export const idProva = (slug: string) => `acervo:${slug}`
const idQuestao = (slug: string, numero: number) => `acervo:${slug}:${numero}`
const idAlternativa = (slug: string, numero: number, letra: string) =>
  `acervo:${slug}:${numero}:${letra}`

export const ehAcervo = (provaId: string) => provaId.startsWith('acervo:')

const vazio = (v: unknown) => typeof v !== 'string' || v.trim() === ''

function chaveConcurso(p: ProvaBruta): string {
  return [p.banca, p.orgao, p.ano]
    .map((x) => String(x ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('-')
}

/**
 * Converte um artefato nas linhas do banco local, aplicando o portão de
 * publicação. `assuntoPorSlug` vem da taxonomia já carregada.
 *
 * Recusa o artefato inteiro quando o problema é da PROVA (status não
 * publicável, atribuição ausente) e recusa questão por questão quando o
 * problema é da questão — uma questão sem gabarito não derruba as outras 44.
 */
export function normalizarArtefato(
  bruto: ArtefatoBruto,
  assuntoPorSlug: Map<string, string>,
): Normalizacao {
  const p = bruto.prova
  const slug = p?.slug ?? '(sem slug)'
  const motivos: string[] = []

  if (bruto.status !== 'publicavel') {
    motivos.push(`status '${bruto.status}' não é publicável`)
  }
  const origem: OrigemFonte = p?.origem_fonte ?? 'prova_oficial'
  const oficial = origem === 'prova_oficial'

  // Regra 4 — atribuição é obrigatória, e o par exigido depende da origem.
  if (oficial) {
    if (vazio(p?.banca)) motivos.push('sem banca (regra 4)')
    if (vazio(p?.orgao)) motivos.push('sem órgão (regra 4)')
    if (vazio(p?.cargo)) motivos.push('sem cargo (regra 4)')
    if (typeof p?.ano !== 'number') motivos.push('sem ano (regra 4)')
  } else {
    if (vazio(p?.autor_fonte)) motivos.push('apostila sem autor_fonte (regra 4)')
    if (vazio(p?.titulo_fonte)) motivos.push('apostila sem titulo_fonte (regra 4)')
  }
  if (p?.formato !== 'ce' && p?.formato !== 'multipla') {
    motivos.push(`formato inválido '${p?.formato}'`)
  }
  if (motivos.length > 0) return { ok: false, slug, motivos }

  const concurso: Concurso | null = oficial
    ? {
        id: `acervo:concurso:${chaveConcurso(p)}`,
        slug: `acervo-${chaveConcurso(p)}`,
        nome: `${p.orgao} ${p.ano}`,
        orgao: p.orgao!,
        banca: p.banca!,
        ano: p.ano!,
      }
    : null
  const cargo: Cargo | null =
    concurso && p.cargo ? { id: `${concurso.id}:cargo`, concurso_id: concurso.id, nome: p.cargo } : null

  const prova: Prova = {
    id: idProva(slug),
    concurso_id: concurso?.id ?? null,
    cargo_id: cargo?.id ?? null,
    formato: p.formato,
    penalidade_por_erro: p.penalidade_por_erro,
    caderno_tipo: p.tipo_caderno ?? null,
    aplicada_em: null,
    url_pdf: p.fonte_pdf ?? null,
    url_gabarito: p.fonte_gabarito ?? null,
    pdf_sha256: p.sha256_pdf ?? null,
  }

  const questoes: Questao[] = []
  const alternativas: Alternativa[] = []
  const vinculos: QuestaoAssunto[] = []
  const recusadas: { numero: number; motivo: string }[] = []
  const avisos: string[] = []

  for (const q of bruto.questoes ?? []) {
    const recusa = (motivo: string) => recusadas.push({ numero: q.numero, motivo })

    // Regra 3 — o portão. Anulada é a única que entra sem gabarito, e entra
    // marcada: nunca é servida e nunca conta estatística.
    if (!q.anulada) {
      if (vazio(q.gabarito)) {
        recusa(oficial ? 'sem gabarito definitivo casado' : 'sem gabarito')
        continue
      }
      if (!oficial && q.revisado_humano !== true) {
        recusa('falta revisão humana (revisado_humano)')
        continue
      }
      if (oficial) {
        const a = q.atribuicao
        const faltando = (['banca', 'ano', 'orgao', 'cargo', 'numero_original'] as const).filter(
          (c) => !a?.[c],
        )
        if (faltando.length > 0) {
          recusa(`atribuição incompleta: ${faltando.join(', ')} (regra 4)`)
          continue
        }
      }
    }

    if (q.tipo === 'multipla' && (q.alternativas ?? []).length < 2) {
      recusa('múltipla escolha com menos de 2 alternativas')
      continue
    }
    if (
      q.tipo === 'multipla' &&
      !q.anulada &&
      !(q.alternativas ?? []).some((a) => a.letra === q.gabarito)
    ) {
      recusa('gabarito aponta para alternativa inexistente')
      continue
    }
    if (typeof q.classificacao_confianca === 'number' && q.classificacao_confianca < LIMIAR_CONFIANCA) {
      recusa(`confiança de classificação ${q.classificacao_confianca.toFixed(2)} abaixo do limiar`)
      continue
    }

    const id = idQuestao(slug, q.numero)
    questoes.push({
      id,
      prova_id: prova.id,
      numero: q.numero,
      enunciado: q.enunciado,
      texto_apoio_id: null,
      gabarito: q.gabarito ?? null,
      // Apostila não tem definitivo de banca para casar: o gate dela é
      // `revisado_humano`, e mentir uma data de casamento aqui apagaria essa
      // diferença justamente onde ela importa.
      gabarito_casado_em: oficial && !q.anulada ? bruto.gerado_em : null,
      anulada: q.anulada,
      comentario: q.comentario ?? null,
      desatualizada: q.desatualizada ?? false,
      motivo_desatualizacao: null,
      status: 'publicada',
      origem_fonte: origem,
      autor_fonte: oficial ? null : (p.autor_fonte ?? null),
      titulo_fonte: oficial ? null : (p.titulo_fonte ?? null),
      revisado_humano: q.revisado_humano ?? false,
      dificuldade_b: 0,
    })

    for (const alt of q.alternativas ?? []) {
      alternativas.push({
        id: idAlternativa(slug, q.numero, alt.letra),
        questao_id: id,
        letra: alt.letra,
        texto: alt.texto,
      })
    }

    const assuntoId = q.assunto ? assuntoPorSlug.get(q.assunto) : undefined
    if (assuntoId) {
      vinculos.push({
        questao_id: id,
        assunto_id: assuntoId,
        principal: true,
        confianca: q.classificacao_confianca ?? null,
      })
    } else if (q.assunto) {
      avisos.push(`questão ${q.numero}: assunto '${q.assunto}' não existe na taxonomia`)
    } else {
      avisos.push(`questão ${q.numero}: sem assunto classificado`)
    }
  }

  return { ok: true, registros: { concurso, cargo, prova, questoes, alternativas, vinculos, recusadas, avisos } }
}

// ── carga no banco local ────────────────────────────────────────────────────

export interface ResumoAcervo {
  provas: number
  questoes: number
  recusadas: number
  /** Artefato recusado inteiro (problema da prova, não da questão). */
  artefatosRecusados: { slug: string; motivos: string[] }[]
  avisos: string[]
}

/**
 * Versão da carga. Muda quando o conteúdo dos artefatos muda OU quando a
 * normalização acima muda — sem a segunda parte, corrigir um bug de mapeamento
 * não reprocessaria nada em quem já tem o banco montado.
 */
const VERSAO_CARGA = 1

export function versaoDoAcervo(artefatos: ArtefatoBruto[] = ARTEFATOS): string {
  const partes = artefatos
    .map((a) => `${a.prova?.slug}@${a.gerado_em}#${a.questoes?.length ?? 0}`)
    .sort()
  return `v${VERSAO_CARGA}:${partes.join('|')}`
}

/**
 * Tira do ar o que saiu do repositório — questão retirada do acervo (gabarito
 * errado, por exemplo) não pode continuar sendo servida.
 *
 * Questão que o usuário já respondeu não é apagada: vira `em_revisao`, some da
 * prática e mantém o histórico dele intacto.
 */
async function podarAcervo(idsVivos: Set<string>): Promise<void> {
  const doAcervo = await db.questao.filter((q) => ehAcervo(q.prova_id)).toArray()
  const respondidas = new Set((await db.resposta.toArray()).map((r) => r.questao_id))

  for (const q of doAcervo) {
    if (idsVivos.has(q.id)) continue
    if (respondidas.has(q.id)) {
      if (q.status !== 'em_revisao') await db.questao.put({ ...q, status: 'em_revisao' })
      continue
    }
    await db.alternativa.where('questao_id').equals(q.id).delete()
    await db.questao_assunto.where('questao_id').equals(q.id).delete()
    await db.questao.delete(q.id)
  }

  const provas = await db.prova.filter((p) => ehAcervo(p.id)).toArray()
  for (const p of provas) {
    const restam = await db.questao.where('prova_id').equals(p.id).count()
    if (restam === 0) await db.prova.delete(p.id)
  }
}

/** Carrega (ou recarrega) todo o acervo do repositório no banco local. */
export async function carregarAcervo(artefatos: ArtefatoBruto[] = ARTEFATOS): Promise<ResumoAcervo> {
  const assuntos = await db.assunto.toArray()
  const porSlug = new Map(assuntos.map((a) => [a.slug, a.id]))

  const resumo: ResumoAcervo = {
    provas: 0,
    questoes: 0,
    recusadas: 0,
    artefatosRecusados: [],
    avisos: [],
  }
  const idsVivos = new Set<string>()

  await db.transaction(
    'rw',
    [db.concurso, db.cargo, db.prova, db.questao, db.alternativa, db.questao_assunto, db.resposta, db.ajuste],
    async () => {
      for (const bruto of artefatos) {
        const r = normalizarArtefato(bruto, porSlug)
        if (!r.ok) {
          resumo.artefatosRecusados.push({ slug: r.slug, motivos: r.motivos })
          continue
        }
        const { concurso, cargo, prova, questoes, alternativas, vinculos, recusadas, avisos } = r.registros
        if (questoes.length === 0) {
          resumo.artefatosRecusados.push({
            slug: bruto.prova.slug,
            motivos: ['nenhuma questão passou no portão de publicação'],
          })
          resumo.recusadas += recusadas.length
          continue
        }

        if (concurso) await db.concurso.put(concurso)
        if (cargo) await db.cargo.put(cargo)
        await db.prova.put(prova)
        await db.questao.bulkPut(questoes)
        await db.alternativa.bulkPut(alternativas)
        await db.questao_assunto.bulkPut(vinculos)

        for (const q of questoes) idsVivos.add(q.id)
        resumo.provas++
        resumo.questoes += questoes.length
        resumo.recusadas += recusadas.length
        resumo.avisos.push(...avisos.map((a) => `${bruto.prova.slug}: ${a}`))
        for (const rec of recusadas) {
          resumo.avisos.push(`${bruto.prova.slug}: questão ${rec.numero} não entrou — ${rec.motivo}`)
        }
      }

      await podarAcervo(idsVivos)
      await db.ajuste.put({ chave: 'acervo_versao', valor: versaoDoAcervo(artefatos) })
    },
  )

  return resumo
}

/** Só recarrega quando os artefatos (ou o mapeamento) mudaram. */
export async function garantirAcervo(): Promise<ResumoAcervo | null> {
  const aplicada = await db.ajuste.get('acervo_versao')
  if (aplicada?.valor === versaoDoAcervo()) return null
  return carregarAcervo()
}
