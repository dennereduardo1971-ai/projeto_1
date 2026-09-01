import { db } from './db'
import type { Alternativa, Cargo, Concurso, FormatoProva, OrigemFonte, Prova, Questao, TextoApoio } from './tipos'

/**
 * Carrega `acervo/provas/*.json` (artefatos publicados pelo pipeline de
 * ingestão — ver `scripts/ingest/` e `docs/agents/coletor.md`) nas tabelas
 * Dexie do acervo.
 *
 * Duas garantias que este módulo protege por conta própria, mesmo que o
 * pipeline já as tenha checado antes de gravar `status: "publicavel"`
 * (defesa em profundidade — CLAUDE.md, regra 3: "restrição no banco, não
 * confiança no app"):
 *
 * 1. Regra 3 do CLAUDE.md (com a exceção de 2026-08-31): questão de
 *    `origem_fonte = 'apostila_comentada'` só entra com `gabarito` E
 *    `revisado_humano = true`. Questão `prova_oficial` só entra com
 *    `gabarito` (o "casamento" com o gabarito definitivo já aconteceu no
 *    pipeline). Questão `anulada` entra sempre, marcada, sem exigir nenhum
 *    dos dois — nunca conta estatística (ver `consultas.ts`).
 * 2. Regra 4 do CLAUDE.md (atribuição obrigatória): artefato
 *    `apostila_comentada` sem `autor_fonte`/`titulo_fonte`, ou
 *    `prova_oficial` sem `banca`, não entra — o artefato inteiro é
 *    rejeitado (sem eles não dá pra montar o `Concurso` sintético que
 *    carrega a atribuição).
 *
 * Terceira garantia, do enunciado da tarefa: `questao.assunto` já vem como
 * slug da taxonomia. Slug que não existe em `assunto` local não vira
 * assunto novo — a questão é pulada e entra em `assuntosDesconhecidos` no
 * relatório.
 *
 * ## Atribuição: nível prova → nível questão (decisão registrada no diário)
 * O artefato guarda `autor_fonte`/`titulo_fonte`/`origem_fonte` na PROVA; a
 * migration 0015 (Postgres) e o tipo `Questao` local os querem na QUESTÃO.
 * Aqui eles são propagados da prova para CADA questão importada dela — é a
 * leitura mais simples do artefato (uma prova inteira tem uma origem só) e é
 * o que faz `questao.origem_fonte` valer por linha sem exigir join até
 * `prova`/`concurso` toda vez que uma tela precisar decidir se mostra
 * comentário de terceiro com atribuição.
 *
 * ## Concurso/Cargo sintéticos para apostila
 * `Prova.concurso_id`/`cargo_id` são FKs obrigatórias, mas apostila
 * comentada não tem concurso real. A chave sintética é
 * `apostila:${prova.perfil ?? prova.slug}` — o campo `perfil` é
 * compartilhado pelos dois artefatos gêmeos `{slug}_ce`/`{slug}_multipla`
 * gerados da mesma apostila (ver `docs/04-fontes-de-questoes.md` §1.3), então
 * os dois passam a apontar para o MESMO `Concurso`, com `banca = autor_fonte`
 * (regra 1: banca é dado, não premissa — mesmo quando o "autor" não é uma
 * banca de verdade) e `orgao = "Apostila comentada"` como marcador fixo.
 *
 * ## Idempotência
 * Todo id é determinístico (derivado de `prova.slug` e `numero`), nunca
 * `novoId()`. Reimportar o mesmo artefato faz `.put()` nas mesmas linhas —
 * não duplica. Um artefato atualizado substitui o conteúdo da prova/questão
 * sem tocar `resposta` nem `estado_assunto` (chaveados por `questao_id`/
 * `assunto_id`, nunca apagados por este módulo).
 *
 * Limite conhecido (ver Pendências no diário): a importação é só
 * upsert — se uma revisão do artefato REMOVE uma questão ou uma alternativa
 * que uma versão anterior tinha trazido, a linha antiga fica órfã no banco
 * local (não é apagada). Apagar exigiria decidir o que fazer com `resposta`
 * ligada a ela, e isso é decisão de produto, não deste módulo.
 */

// ------------------------------------------------------------- artefato

interface AlternativaArtefato {
  letra: string
  texto: string
}

interface AtribuicaoArtefato {
  banca: string
  ano: number
  orgao: string
  cargo: string
  numero_original: number
  url_pdf: string
}

interface QuestaoArtefato {
  numero: number
  tipo: 'ce' | 'multipla'
  enunciado: string
  pagina: number
  texto_apoio_id?: string
  alternativas?: AlternativaArtefato[]
  gabarito?: string
  anulada: boolean
  desatualizada?: boolean
  revisado_humano?: boolean
  comentario?: string
  assets?: unknown[]
  disciplina?: string
  assunto?: string
  classificacao_confianca?: number
  classificacao_metodo?: string
  atribuicao?: AtribuicaoArtefato
}

interface TextoApoioArtefato {
  id: string
  texto: string
  paginas?: number[]
  assets?: unknown[]
}

interface ProvaArtefato {
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
  fonte_pdf: string
  fonte_gabarito?: string
  sha256_pdf?: string
  sha256_gabarito?: string
  perfil?: string
}

export interface ArtefatoProva {
  versao_artefato: number
  gerado_em: string
  status: string
  avisos?: string[]
  prova: ProvaArtefato
  textos_apoio?: TextoApoioArtefato[]
  questoes: QuestaoArtefato[]
}

// -------------------------------------------------------------- relatório

export interface RelatorioProva {
  slug: string
  provaId: string
  origemFonte: OrigemFonte
  formato: FormatoProva
  penalidadePorErro: boolean
  questoesImportadas: number
  questoesRejeitadas: number
}

export interface QuestaoRejeitada {
  provaSlug: string
  numero: number
  motivo: string
}

export interface RelatorioCargaAcervo {
  artefatosLidos: number
  artefatosRejeitados: { slug: string; motivo: string }[]
  provas: RelatorioProva[]
  questoesImportadas: number
  /** Contagem por slug de assunto — só das questões efetivamente importadas. */
  porAssunto: Record<string, number>
  questoesRejeitadas: QuestaoRejeitada[]
  /** Slugs de `assunto` vistos no artefato que não existem na taxonomia local. */
  assuntosDesconhecidos: string[]
}

function relatorioVazio(): RelatorioCargaAcervo {
  return {
    artefatosLidos: 0,
    artefatosRejeitados: [],
    provas: [],
    questoesImportadas: 0,
    porAssunto: {},
    questoesRejeitadas: [],
    assuntosDesconhecidos: [],
  }
}

// --------------------------------------------------------------- ids

const PREFIXO_PROVA = 'acervo-prova-'

export const idProva = (slug: string): string => `${PREFIXO_PROVA}${slug}`
export const idQuestao = (provaId: string, numero: number): string => `${provaId}-q${numero}`
export const idAlternativa = (questaoId: string, letra: string): string => `${questaoId}-${letra}`

/** `prova.id` que veio deste módulo — usado pra separar acervo real de exemplo. */
export const ehAcervo = (provaId: string): boolean => provaId.startsWith(PREFIXO_PROVA)

export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ---------------------------------------------------------- validação

/**
 * Motivo de rejeição do ARTEFATO inteiro, ou `null` se pode prosseguir.
 * Espelha `problemas_de_regra` em `scripts/ingest/lib/validador.py` na parte
 * de atribuição de prova — mas só a parte que o importador precisa repetir
 * como defesa em profundidade (regra 3/4 do CLAUDE.md).
 */
export function motivoRejeicaoArtefato(artefato: ArtefatoProva): string | null {
  if (artefato.status !== 'publicavel') {
    return `status "${artefato.status}" não é publicável`
  }
  const origemFonte = artefato.prova.origem_fonte ?? 'prova_oficial'
  if (origemFonte === 'apostila_comentada') {
    if (!artefato.prova.autor_fonte?.trim()) {
      return "autor_fonte é obrigatório para apostila_comentada (regra 4)"
    }
    if (!artefato.prova.titulo_fonte?.trim()) {
      return "titulo_fonte é obrigatório para apostila_comentada (regra 4)"
    }
  } else if (!artefato.prova.banca?.trim()) {
    return 'banca é obrigatória (é dado, não premissa — regra 1)'
  }
  return null
}

/**
 * Motivo de rejeição de UMA questão, ou `null` se pode importar. Espelha o
 * mesmo bloco do validador Python (regra 3 do CLAUDE.md, exceção de
 * 2026-08-31): anulada entra sempre; `apostila_comentada` exige gabarito e
 * `revisado_humano`; `prova_oficial` exige só o gabarito (já casado antes de
 * publicar).
 */
export function validarQuestao(q: QuestaoArtefato, origemFonte: OrigemFonte): string | null {
  if (q.anulada) return null
  if (origemFonte === 'prova_oficial') {
    if (!q.gabarito) return 'sem gabarito definitivo casado — não importa'
    return null
  }
  if (!q.gabarito) return 'sem gabarito — não importa'
  if (!q.revisado_humano) return 'falta revisão humana (revisado_humano) — não importa'
  return null
}

// ----------------------------------------------------- concurso/cargo sintéticos

function extrairAno(geradoEm: string, anoDaProva?: number): number {
  if (anoDaProva) return anoDaProva
  const ano = Number(geradoEm.slice(0, 4))
  return Number.isFinite(ano) && ano > 0 ? ano : new Date().getFullYear()
}

export function resolverConcursoCargo(
  artefato: ArtefatoProva,
  origemFonte: OrigemFonte,
): { concurso: Concurso; cargo: Cargo } {
  const p = artefato.prova
  const ano = extrairAno(artefato.gerado_em, p.ano)

  let chave: string
  let nome: string
  let orgao: string
  let banca: string
  let nomeCargo: string

  if (origemFonte === 'apostila_comentada') {
    // Mesmo perfil (apostila-fonte) => mesmo Concurso sintético, mesmo entre
    // os artefatos gêmeos `{slug}_ce` / `{slug}_multipla`.
    chave = `apostila:${p.perfil ?? p.slug}`
    nome = p.titulo_fonte ?? p.slug
    orgao = 'Apostila comentada'
    banca = p.autor_fonte ?? 'Autor não informado'
    nomeCargo = 'Apostila comentada'
  } else {
    chave = `oficial:${p.banca ?? ''}:${p.orgao ?? ''}:${p.cargo ?? ''}:${ano}`
    orgao = p.orgao ?? ''
    banca = p.banca ?? 'Banca não informada'
    nomeCargo = p.cargo ?? 'Não informado'
    nome = orgao ? `${orgao}${p.cargo ? ` — ${p.cargo}` : ''}` : p.slug
  }

  const id = slugify(chave)
  const concurso: Concurso = { id, slug: id, nome, orgao, banca, ano }
  const cargo: Cargo = { id: `${id}-cargo`, concurso_id: id, nome: nomeCargo }
  return { concurso, cargo }
}

// -------------------------------------------------------------- artefatos reais

// `import.meta.glob` é estático (Vite resolve em build-time): os 4 artefatos
// publicados em `acervo/provas/*.json` hoje, e qualquer um novo que o
// pipeline de ingestão gerar depois, sem precisar tocar neste arquivo.
const modulosReais = import.meta.glob<ArtefatoProva>('@acervo/provas/*.json', {
  eager: true,
  import: 'default',
})
const ARTEFATOS_REAIS: ArtefatoProva[] = Object.values(modulosReais)

// ------------------------------------------------------------------- carga

/**
 * Carrega os artefatos publicados nas tabelas Dexie do acervo.
 *
 * Sem argumento, lê `acervo/provas/*.json` de verdade. O parâmetro existe
 * para teste: injeta artefatos sintéticos sem precisar de arquivo no disco.
 */
export async function carregarAcervo(
  artefatos: ArtefatoProva[] = ARTEFATOS_REAIS,
): Promise<RelatorioCargaAcervo> {
  const assuntos = await db.assunto.toArray()
  const porSlug = new Map(assuntos.map((a) => [a.slug, a.id]))

  const relatorio = relatorioVazio()
  const assuntosDesconhecidos = new Set<string>()

  await db.transaction(
    'rw',
    [db.concurso, db.cargo, db.prova, db.texto_apoio, db.questao, db.alternativa, db.questao_assunto],
    async () => {
      for (const artefato of artefatos) {
        relatorio.artefatosLidos++

        const motivoArtefato = motivoRejeicaoArtefato(artefato)
        if (motivoArtefato) {
          relatorio.artefatosRejeitados.push({ slug: artefato.prova.slug, motivo: motivoArtefato })
          continue
        }

        const origemFonte: OrigemFonte = artefato.prova.origem_fonte ?? 'prova_oficial'
        const { concurso, cargo } = resolverConcursoCargo(artefato, origemFonte)
        await db.concurso.put(concurso)
        await db.cargo.put(cargo)

        const provaId = idProva(artefato.prova.slug)
        const prova: Prova = {
          id: provaId,
          concurso_id: concurso.id,
          cargo_id: cargo.id,
          formato: artefato.prova.formato,
          penalidade_por_erro: artefato.prova.penalidade_por_erro,
          caderno_tipo: artefato.prova.tipo_caderno ?? null,
          aplicada_em: null,
          url_pdf: artefato.prova.fonte_pdf ?? null,
          url_gabarito: artefato.prova.fonte_gabarito ?? null,
          pdf_sha256: artefato.prova.sha256_pdf ?? null,
        }
        await db.prova.put(prova)

        const textoApoioIds = new Map<string, string>()
        for (const t of artefato.textos_apoio ?? []) {
          const textoApoioId = `${provaId}-t${t.id}`
          textoApoioIds.set(t.id, textoApoioId)
          const textoApoio: TextoApoio = {
            id: textoApoioId,
            prova_id: provaId,
            rotulo: t.id,
            conteudo_md: t.texto,
          }
          await db.texto_apoio.put(textoApoio)
        }

        let importadasNestaProva = 0
        let rejeitadasNestaProva = 0

        for (const q of artefato.questoes) {
          const assuntoSlug = q.assunto

          if (!assuntoSlug || !porSlug.has(assuntoSlug)) {
            if (assuntoSlug) assuntosDesconhecidos.add(assuntoSlug)
            relatorio.questoesRejeitadas.push({
              provaSlug: artefato.prova.slug,
              numero: q.numero,
              motivo: assuntoSlug ? `assunto desconhecido na taxonomia: ${assuntoSlug}` : 'sem assunto classificado',
            })
            rejeitadasNestaProva++
            continue
          }

          const motivoQuestao = validarQuestao(q, origemFonte)
          if (motivoQuestao) {
            relatorio.questoesRejeitadas.push({
              provaSlug: artefato.prova.slug,
              numero: q.numero,
              motivo: motivoQuestao,
            })
            rejeitadasNestaProva++
            continue
          }

          const questaoId = idQuestao(provaId, q.numero)
          const questao: Questao = {
            id: questaoId,
            prova_id: provaId,
            numero: q.numero,
            enunciado: q.enunciado,
            texto_apoio_id: q.texto_apoio_id ? (textoApoioIds.get(q.texto_apoio_id) ?? null) : null,
            gabarito: q.gabarito ?? null,
            gabarito_casado_em: origemFonte === 'prova_oficial' && q.gabarito ? artefato.gerado_em : null,
            anulada: q.anulada,
            comentario: q.comentario ?? null,
            desatualizada: q.desatualizada ?? false,
            motivo_desatualizacao: null,
            status: 'publicada',
            origem_fonte: origemFonte,
            autor_fonte: origemFonte === 'apostila_comentada' ? (artefato.prova.autor_fonte ?? null) : null,
            titulo_fonte: origemFonte === 'apostila_comentada' ? (artefato.prova.titulo_fonte ?? null) : null,
            revisado_humano: q.revisado_humano ?? false,
            dificuldade_b: 0,
          }
          await db.questao.put(questao)

          for (const alt of q.alternativas ?? []) {
            const alternativa: Alternativa = {
              id: idAlternativa(questaoId, alt.letra),
              questao_id: questaoId,
              letra: alt.letra,
              texto: alt.texto,
            }
            await db.alternativa.put(alternativa)
          }

          const assuntoId = porSlug.get(assuntoSlug)!
          await db.questao_assunto.put({
            questao_id: questaoId,
            assunto_id: assuntoId,
            principal: true,
            confianca: q.classificacao_confianca ?? null,
          })

          importadasNestaProva++
          relatorio.questoesImportadas++
          relatorio.porAssunto[assuntoSlug] = (relatorio.porAssunto[assuntoSlug] ?? 0) + 1
        }

        relatorio.provas.push({
          slug: artefato.prova.slug,
          provaId,
          origemFonte,
          formato: artefato.prova.formato,
          penalidadePorErro: artefato.prova.penalidade_por_erro,
          questoesImportadas: importadasNestaProva,
          questoesRejeitadas: rejeitadasNestaProva,
        })
      }
    },
  )

  relatorio.assuntosDesconhecidos = [...assuntosDesconhecidos].sort()
  return relatorio
}
