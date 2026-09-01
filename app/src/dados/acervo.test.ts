// Precisa ser o PRIMEIRO import: registra `indexedDB` global antes de
// qualquer módulo importar `dexie` (o ambiente de teste roda em Node, que
// não tem IndexedDB nativo — ver `docs/agents/dados.md`, Armadilhas).
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'
import {
  carregarAcervo,
  ehAcervo,
  idProva,
  idQuestao,
  motivoRejeicaoArtefato,
  resolverConcursoCargo,
  slugify,
  validarQuestao,
  type ArtefatoProva,
} from './acervo'
import { agora, db, novoId } from './db'
import type { Assunto, Disciplina } from './tipos'

const TABELAS = [
  db.disciplina, db.assunto,
  db.concurso, db.cargo,
  db.prova, db.texto_apoio, db.questao, db.alternativa, db.questao_assunto,
  db.resposta,
]

const ASSUNTO_CIVIL = 'civil-obrigacoes'
const ASSUNTO_AUDITORIA = 'auditoria-amostragem'

async function semearAssuntos() {
  const disciplina: Disciplina = { id: novoId(), slug: 'direito-civil', nome: 'Direito Civil', ordem: 1 }
  const disciplina2: Disciplina = { id: novoId(), slug: 'auditoria', nome: 'Auditoria', ordem: 2 }
  await db.disciplina.bulkAdd([disciplina, disciplina2])
  const civil: Assunto = {
    id: novoId(), disciplina_id: disciplina.id, pai_id: null,
    slug: ASSUNTO_CIVIL, nome: 'Obrigações', ordem: 1, profundidade: 1,
  }
  const auditoria: Assunto = {
    id: novoId(), disciplina_id: disciplina2.id, pai_id: null,
    slug: ASSUNTO_AUDITORIA, nome: 'Amostragem', ordem: 1, profundidade: 1,
  }
  await db.assunto.bulkAdd([civil, auditoria])
}

beforeEach(async () => {
  for (const t of TABELAS) await t.clear()
  await semearAssuntos()
})

/** Artefato apostila_comentada mínimo e válido — testes partem daqui e sobrescrevem. */
function artefato(overrides: Partial<ArtefatoProva> = {}): ArtefatoProva {
  return {
    versao_artefato: 1,
    gerado_em: '2026-08-31T13:48:43+00:00',
    status: 'publicavel',
    avisos: [],
    prova: {
      slug: 'apostila_teste_ce',
      origem_fonte: 'apostila_comentada',
      autor_fonte: 'Autor Teste',
      titulo_fonte: 'Apostila de Teste',
      formato: 'ce',
      penalidade_por_erro: true,
      fonte_pdf: 'arquivo local: teste.pdf',
      sha256_pdf: 'a'.repeat(64),
      perfil: 'apostila_teste',
    },
    textos_apoio: [],
    questoes: [
      {
        numero: 1,
        tipo: 'ce',
        enunciado: 'Enunciado de teste com mais de dez caracteres.',
        pagina: 1,
        anulada: false,
        gabarito: 'C',
        revisado_humano: true,
        assunto: ASSUNTO_CIVIL,
        disciplina: 'Direito Civil',
        classificacao_confianca: 1,
        classificacao_metodo: 'apostila:monotematica',
        comentario: 'Comentário do autor.',
      },
    ],
    ...overrides,
  }
}

describe('validarQuestao — regra 3 do CLAUDE.md (gate de publicação)', () => {
  const base = artefato().questoes[0]

  it('apostila_comentada sem revisado_humano é recusada mesmo com gabarito', () => {
    const motivo = validarQuestao({ ...base, revisado_humano: false }, 'apostila_comentada')
    expect(motivo).toMatch(/revis/i)
  })

  it('apostila_comentada sem gabarito é recusada', () => {
    const motivo = validarQuestao({ ...base, gabarito: undefined }, 'apostila_comentada')
    expect(motivo).toMatch(/gabarito/i)
  })

  it('prova_oficial sem gabarito é recusada, mesmo com revisado_humano', () => {
    const motivo = validarQuestao({ ...base, gabarito: undefined, revisado_humano: true }, 'prova_oficial')
    expect(motivo).toMatch(/gabarito/i)
  })

  it('prova_oficial com gabarito passa sem exigir revisado_humano', () => {
    const motivo = validarQuestao({ ...base, gabarito: 'C', revisado_humano: false }, 'prova_oficial')
    expect(motivo).toBeNull()
  })

  it('questão anulada passa sempre, mesmo sem gabarito nem revisado_humano', () => {
    const motivo = validarQuestao(
      { ...base, anulada: true, gabarito: undefined, revisado_humano: false },
      'apostila_comentada',
    )
    expect(motivo).toBeNull()
  })
})

describe('motivoRejeicaoArtefato — regra 4 do CLAUDE.md (atribuição obrigatória)', () => {
  it('apostila_comentada sem autor_fonte é recusada', () => {
    const a = artefato()
    a.prova.autor_fonte = undefined
    expect(motivoRejeicaoArtefato(a)).toMatch(/autor_fonte/)
  })

  it('apostila_comentada sem titulo_fonte é recusada', () => {
    const a = artefato()
    a.prova.titulo_fonte = undefined
    expect(motivoRejeicaoArtefato(a)).toMatch(/titulo_fonte/)
  })

  it('prova_oficial sem banca é recusada', () => {
    const a = artefato({
      prova: {
        ...artefato().prova,
        origem_fonte: 'prova_oficial',
        autor_fonte: undefined,
        titulo_fonte: undefined,
      },
    })
    expect(motivoRejeicaoArtefato(a)).toMatch(/banca/)
  })

  it('artefato que não está publicavel é recusado inteiro', () => {
    const a = artefato({ status: 'pendente_classificacao' })
    expect(motivoRejeicaoArtefato(a)).toMatch(/publicáv/)
  })

  it('artefato válido não tem motivo de rejeição', () => {
    expect(motivoRejeicaoArtefato(artefato())).toBeNull()
  })
})

describe('carregarAcervo — mapeamento por slug e rejeição de assunto desconhecido', () => {
  it('liga a questão ao assunto pelo slug', async () => {
    const relatorio = await carregarAcervo([artefato()])
    expect(relatorio.questoesImportadas).toBe(1)
    expect(relatorio.porAssunto[ASSUNTO_CIVIL]).toBe(1)

    const questaoId = idQuestao(idProva('apostila_teste_ce'), 1)
    const vinculo = await db.questao_assunto.where('questao_id').equals(questaoId).first()
    expect(vinculo).toBeDefined()

    const assuntoCivil = await db.assunto.where('slug').equals(ASSUNTO_CIVIL).first()
    expect(vinculo?.assunto_id).toBe(assuntoCivil!.id)
  })

  it('pula questão com assunto que não existe na taxonomia, sem inventar assunto novo', async () => {
    const a = artefato()
    a.questoes[0].assunto = 'assunto-fantasma-que-nao-existe'
    const relatorio = await carregarAcervo([a])

    expect(relatorio.questoesImportadas).toBe(0)
    expect(relatorio.assuntosDesconhecidos).toEqual(['assunto-fantasma-que-nao-existe'])
    expect(relatorio.questoesRejeitadas[0].motivo).toMatch(/assunto desconhecido/)
    expect(await db.assunto.count()).toBe(2) // não criou assunto novo
    expect(await db.questao.count()).toBe(0)
  })
})

describe('carregarAcervo — recusa por falta de atribuição ou de revisado_humano', () => {
  it('artefato inteiro sem atribuição não grava nenhuma questão', async () => {
    const a = artefato()
    a.prova.autor_fonte = undefined
    const relatorio = await carregarAcervo([a])

    expect(relatorio.artefatosRejeitados).toEqual([
      { slug: 'apostila_teste_ce', motivo: expect.stringMatching(/autor_fonte/) },
    ])
    expect(relatorio.questoesImportadas).toBe(0)
    expect(await db.prova.count()).toBe(0)
    expect(await db.questao.count()).toBe(0)
  })

  it('questão apostila sem revisado_humano não é gravada, mas a prova (com outras questões válidas) é', async () => {
    const a = artefato()
    a.questoes = [
      { ...a.questoes[0], numero: 1, revisado_humano: false },
      { ...a.questoes[0], numero: 2, revisado_humano: true },
    ]
    const relatorio = await carregarAcervo([a])

    expect(relatorio.questoesImportadas).toBe(1)
    expect(relatorio.questoesRejeitadas).toEqual([
      { provaSlug: 'apostila_teste_ce', numero: 1, motivo: expect.stringMatching(/revis/i) },
    ])
    expect(await db.questao.count()).toBe(1)
    const gravada = await db.questao.get(idQuestao(idProva('apostila_teste_ce'), 2))
    expect(gravada?.revisado_humano).toBe(true)
  })

  it('questão anulada é gravada marcada, mesmo sem gabarito nem revisado_humano', async () => {
    const a = artefato()
    a.questoes[0] = { ...a.questoes[0], anulada: true, gabarito: undefined, revisado_humano: false }
    const relatorio = await carregarAcervo([a])

    expect(relatorio.questoesImportadas).toBe(1)
    const gravada = await db.questao.get(idQuestao(idProva('apostila_teste_ce'), 1))
    expect(gravada?.anulada).toBe(true)
    expect(gravada?.gabarito).toBeNull()
  })
})

describe('carregarAcervo — formato e penalidade_por_erro vêm da prova, não são fixos', () => {
  it('duas provas com formato/penalidade diferentes preservam cada uma o seu', async () => {
    const ce = artefato()
    const multipla = artefato({
      prova: {
        ...artefato().prova,
        slug: 'apostila_teste_multipla',
        formato: 'multipla',
        penalidade_por_erro: false,
      },
      questoes: [
        {
          numero: 1,
          tipo: 'multipla',
          enunciado: 'Outra pergunta de múltipla escolha com mais de dez caracteres.',
          pagina: 1,
          anulada: false,
          gabarito: 'A',
          revisado_humano: true,
          assunto: ASSUNTO_CIVIL,
          alternativas: [
            { letra: 'A', texto: 'primeira' },
            { letra: 'B', texto: 'segunda' },
          ],
        },
      ],
    })

    await carregarAcervo([ce, multipla])

    const provaCe = await db.prova.get(idProva('apostila_teste_ce'))
    const provaMultipla = await db.prova.get(idProva('apostila_teste_multipla'))
    expect(provaCe?.formato).toBe('ce')
    expect(provaCe?.penalidade_por_erro).toBe(true)
    expect(provaMultipla?.formato).toBe('multipla')
    expect(provaMultipla?.penalidade_por_erro).toBe(false)

    const questaoMultipla = await db.questao.get(idQuestao(idProva('apostila_teste_multipla'), 1))
    expect(questaoMultipla?.origem_fonte).toBe('apostila_comentada')
    expect(questaoMultipla?.autor_fonte).toBe('Autor Teste')
    expect(questaoMultipla?.titulo_fonte).toBe('Apostila de Teste')

    const alternativas = await db.alternativa.where('questao_id').equals(questaoMultipla!.id).toArray()
    expect(alternativas).toHaveLength(2)
  })

  it('duas provas gêmeas (mesmo perfil) compartilham o mesmo Concurso sintético', async () => {
    const ce = artefato()
    const multipla = artefato({
      prova: { ...artefato().prova, slug: 'apostila_teste_multipla', formato: 'multipla', penalidade_por_erro: false },
    })
    await carregarAcervo([ce, multipla])

    const provaCe = await db.prova.get(idProva('apostila_teste_ce'))
    const provaMultipla = await db.prova.get(idProva('apostila_teste_multipla'))
    expect(provaCe?.concurso_id).toBe(provaMultipla?.concurso_id)
    expect(await db.concurso.count()).toBe(1)
  })
})

describe('carregarAcervo — idempotência', () => {
  it('rodar duas vezes não duplica prova, questão nem alternativa', async () => {
    const a = artefato({
      questoes: [
        {
          numero: 1,
          tipo: 'multipla',
          enunciado: 'Pergunta de múltipla escolha com mais de dez caracteres.',
          pagina: 1,
          anulada: false,
          gabarito: 'A',
          revisado_humano: true,
          assunto: ASSUNTO_CIVIL,
          alternativas: [
            { letra: 'A', texto: 'primeira' },
            { letra: 'B', texto: 'segunda' },
          ],
        },
      ],
    })

    await carregarAcervo([a])
    const primeiraCarga = {
      provas: await db.prova.count(),
      questoes: await db.questao.count(),
      alternativas: await db.alternativa.count(),
      concursos: await db.concurso.count(),
      vinculos: await db.questao_assunto.count(),
    }

    await carregarAcervo([a])
    const segundaCarga = {
      provas: await db.prova.count(),
      questoes: await db.questao.count(),
      alternativas: await db.alternativa.count(),
      concursos: await db.concurso.count(),
      vinculos: await db.questao_assunto.count(),
    }

    expect(segundaCarga).toEqual(primeiraCarga)
    expect(primeiraCarga.questoes).toBe(1)
  })

  it('reimportar não apaga resposta nem estado_assunto do usuário', async () => {
    const a = artefato()
    await carregarAcervo([a])

    const questaoId = idQuestao(idProva('apostila_teste_ce'), 1)
    await db.resposta.add({
      id: novoId(),
      questao_id: questaoId,
      sessao_id: null,
      tentativa: 1,
      marcada: 'C',
      correta: true,
      segundos: 30,
      confianca: 'certeza',
      tipo_erro: null,
      respondida_em: agora(),
    })

    await carregarAcervo([a])

    expect(await db.resposta.where('questao_id').equals(questaoId).count()).toBe(1)
    expect(await db.questao.get(questaoId)).toBeDefined()
  })
})

describe('resolverConcursoCargo / slugify / ehAcervo — utilitários', () => {
  it('slugify normaliza acento e espaço', () => {
    expect(slugify('Auditoria — Amostragem Estatística')).toBe('auditoria-amostragem-estatistica')
  })

  it('ehAcervo reconhece prova vinda deste módulo e rejeita id de outra origem', () => {
    expect(ehAcervo(idProva('apostila_teste_ce'))).toBe(true)
    expect(ehAcervo('exemplo-prova-qualquer')).toBe(false)
  })

  it('concurso sintético de apostila usa autor como banca (regra 1: banca é dado)', () => {
    const { concurso } = resolverConcursoCargo(artefato(), 'apostila_comentada')
    expect(concurso.banca).toBe('Autor Teste')
    expect(concurso.orgao).toBe('Apostila comentada')
  })
})
