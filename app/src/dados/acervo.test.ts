import { describe, expect, it } from 'vitest'
import { ARTEFATOS, normalizarArtefato, versaoDoAcervo, type ArtefatoBruto } from './acervo'

/**
 * Dois alvos aqui.
 *
 * 1. O portão de publicação (`normalizarArtefato`) — as regras 3 e 4 do
 *    `CLAUDE.md` reescritas em TypeScript. Cada caso abaixo é uma questão que
 *    NÃO pode chegar ao usuário.
 * 2. O acervo real do repositório — que ele continue carregável pelo app. Se
 *    alguém publicar um artefato que o app recusa, o teste conta a história
 *    antes do usuário descobrir na tela vazia.
 */

const ASSUNTOS = new Map([
  ['auditoria-amostragem', 'id-amostragem'],
  ['civil-obrigacoes', 'id-obrigacoes'],
])

function apostila(questoes: Partial<ArtefatoBruto['questoes'][number]>[] = []): ArtefatoBruto {
  return {
    versao_artefato: 1,
    gerado_em: '2026-08-31T13:48:43+00:00',
    status: 'publicavel',
    prova: {
      slug: 'apostila_teste_ce',
      origem_fonte: 'apostila_comentada',
      autor_fonte: 'Marcelo Aragão',
      titulo_fonte: 'Amostragem em Auditoria Contábil, NBC TA 530',
      formato: 'ce',
      penalidade_por_erro: true,
      fonte_pdf: 'arquivo local',
    },
    questoes: questoes.map((q, i) => ({
      numero: i + 1,
      tipo: 'ce',
      enunciado: 'Enunciado suficientemente longo para o schema.',
      pagina: 1,
      anulada: false,
      gabarito: 'C',
      revisado_humano: true,
      assunto: 'auditoria-amostragem',
      classificacao_confianca: 1,
      ...q,
    })),
  }
}

function oficial(questoes: Partial<ArtefatoBruto['questoes'][number]>[] = []): ArtefatoBruto {
  return {
    versao_artefato: 1,
    gerado_em: '2026-08-31T13:48:43+00:00',
    status: 'publicavel',
    prova: {
      slug: 'sefaz_rj_25',
      origem_fonte: 'prova_oficial',
      banca: 'CEBRASPE',
      ano: 2025,
      orgao: 'SEFAZ-RJ',
      cargo: 'Auditor Fiscal',
      formato: 'multipla',
      penalidade_por_erro: false,
      fonte_pdf: 'arquivo local',
      fonte_gabarito: 'Gab_Definitivo.pdf',
    },
    questoes: questoes.map((q, i) => ({
      numero: i + 1,
      tipo: 'multipla',
      enunciado: 'Enunciado suficientemente longo para o schema.',
      pagina: 1,
      anulada: false,
      gabarito: 'A',
      alternativas: [
        { letra: 'A', texto: 'primeira' },
        { letra: 'B', texto: 'segunda' },
      ],
      assunto: 'auditoria-amostragem',
      classificacao_confianca: 0.9,
      atribuicao: {
        banca: 'CEBRASPE',
        ano: 2025,
        orgao: 'SEFAZ-RJ',
        cargo: 'Auditor Fiscal',
        numero_original: i + 1,
        url_pdf: 'https://exemplo/prova.pdf',
      },
      ...q,
    })),
  }
}

function normalizar(a: ArtefatoBruto) {
  const r = normalizarArtefato(a, ASSUNTOS)
  if (!r.ok) throw new Error(`artefato recusado: ${r.motivos.join('; ')}`)
  return r.registros
}

describe('portão de publicação', () => {
  it('recusa o artefato inteiro quando o status não é publicável', () => {
    const r = normalizarArtefato({ ...apostila([{}]), status: 'pendente_definitivo' }, ASSUNTOS)
    expect(r.ok).toBe(false)
  })

  it('recusa apostila sem autor ou título — regra 4', () => {
    const semAutor = apostila([{}])
    semAutor.prova.autor_fonte = ''
    expect(normalizarArtefato(semAutor, ASSUNTOS).ok).toBe(false)

    const semTitulo = apostila([{}])
    semTitulo.prova.titulo_fonte = undefined
    expect(normalizarArtefato(semTitulo, ASSUNTOS).ok).toBe(false)
  })

  it('recusa prova oficial sem banca, órgão, cargo ou ano — regra 4', () => {
    const p = oficial([{}])
    p.prova.banca = undefined
    expect(normalizarArtefato(p, ASSUNTOS).ok).toBe(false)
  })

  it('recusa questão de apostila sem revisão humana — regra 3 (exceção de 2026-08-31)', () => {
    const { questoes, recusadas } = normalizar(apostila([{ revisado_humano: false }]))
    expect(questoes).toHaveLength(0)
    expect(recusadas[0].motivo).toContain('revisão humana')
  })

  it('recusa questão sem gabarito', () => {
    const { questoes, recusadas } = normalizar(apostila([{ gabarito: undefined }]))
    expect(questoes).toHaveLength(0)
    expect(recusadas[0].motivo).toContain('gabarito')
  })

  it('recusa questão oficial com atribuição incompleta — regra 4', () => {
    const semOrgao = oficial([{ atribuicao: { banca: 'CEBRASPE', ano: 2025, numero_original: 1, url_pdf: 'x' } }])
    const { questoes, recusadas } = normalizar(semOrgao)
    expect(questoes).toHaveLength(0)
    expect(recusadas[0].motivo).toContain('atribuição incompleta')
  })

  it('recusa classificação abaixo do limiar de confiança', () => {
    const { questoes, recusadas } = normalizar(oficial([{ classificacao_confianca: 0.5 }]))
    expect(questoes).toHaveLength(0)
    expect(recusadas[0].motivo).toContain('confiança')
  })

  it('recusa múltipla escolha cujo gabarito aponta para alternativa inexistente', () => {
    const { questoes } = normalizar(oficial([{ gabarito: 'E' }]))
    expect(questoes).toHaveLength(0)
  })

  it('uma questão recusada não derruba as outras do mesmo artefato', () => {
    const { questoes, recusadas } = normalizar(
      apostila([{}, { revisado_humano: false }, { numero: 7 }]),
    )
    expect(questoes).toHaveLength(2)
    expect(recusadas).toHaveLength(1)
  })

  it('aceita anulada sem gabarito, marcada e fora da estatística — regra 3', () => {
    const { questoes } = normalizar(apostila([{ anulada: true, gabarito: undefined, revisado_humano: false }]))
    expect(questoes).toHaveLength(1)
    expect(questoes[0].anulada).toBe(true)
    expect(questoes[0].gabarito).toBeNull()
  })
})

describe('atribuição e origem no registro gravado', () => {
  it('apostila guarda autor e título na questão, e não inventa concurso', () => {
    const { concurso, cargo, prova, questoes } = normalizar(apostila([{}]))
    expect(concurso).toBeNull()
    expect(cargo).toBeNull()
    expect(prova.concurso_id).toBeNull()
    expect(questoes[0].origem_fonte).toBe('apostila_comentada')
    expect(questoes[0].autor_fonte).toBe('Marcelo Aragão')
    expect(questoes[0].titulo_fonte).toContain('NBC TA 530')
  })

  it('apostila não finge casamento com gabarito de banca', () => {
    const { questoes } = normalizar(apostila([{}]))
    expect(questoes[0].gabarito_casado_em).toBeNull()
    expect(questoes[0].revisado_humano).toBe(true)
  })

  it('prova oficial cria concurso e cargo para carregar banca, órgão, cargo e ano', () => {
    const { concurso, cargo, questoes } = normalizar(oficial([{}]))
    expect(concurso?.banca).toBe('CEBRASPE')
    expect(concurso?.ano).toBe(2025)
    expect(cargo?.nome).toBe('Auditor Fiscal')
    expect(questoes[0].gabarito_casado_em).not.toBeNull()
    // Comentário em prova oficial seria justificativa de terceiro (regra 5).
    expect(questoes[0].autor_fonte).toBeNull()
  })

  it('ids são determinísticos: reprocessar atualiza, nunca duplica', () => {
    const a = normalizar(apostila([{}, {}]))
    const b = normalizar(apostila([{}, {}]))
    expect(a.questoes.map((q) => q.id)).toEqual(b.questoes.map((q) => q.id))
    expect(a.prova.id).toBe(b.prova.id)
  })

  it('assunto fora da taxonomia entra como aviso, sem vínculo inventado', () => {
    const { vinculos, avisos } = normalizar(apostila([{ assunto: 'assunto-que-nao-existe' }]))
    expect(vinculos).toHaveLength(0)
    expect(avisos[0]).toContain('não existe na taxonomia')
  })
})

describe('o acervo publicado no repositório', () => {
  it('tem artefato para carregar', () => {
    expect(ARTEFATOS.length).toBeGreaterThan(0)
  })

  it('carrega inteiro, sem nenhuma questão recusada pelo portão', () => {
    for (const bruto of ARTEFATOS) {
      const r = normalizarArtefato(bruto, ASSUNTOS)
      expect(r, `artefato ${bruto.prova?.slug} recusado`).toMatchObject({ ok: true })
      if (!r.ok) continue
      expect(r.registros.recusadas, `questões recusadas em ${bruto.prova.slug}`).toEqual([])
      expect(r.registros.questoes.length).toBe(bruto.questoes.length)
    }
  })

  it('toda questão publicada sai com origem e crédito preenchidos — regra 4', () => {
    for (const bruto of ARTEFATOS) {
      const r = normalizarArtefato(bruto, ASSUNTOS)
      if (!r.ok) continue
      for (const q of r.registros.questoes) {
        if (q.origem_fonte === 'apostila_comentada') {
          expect(q.autor_fonte, `questão ${q.id}`).toBeTruthy()
          expect(q.titulo_fonte, `questão ${q.id}`).toBeTruthy()
        } else {
          expect(r.registros.concurso?.banca, `questão ${q.id}`).toBeTruthy()
        }
      }
    }
  })

  it('todo comentário exibido é de origem que permite exibir — regra 5', () => {
    for (const bruto of ARTEFATOS) {
      const r = normalizarArtefato(bruto, ASSUNTOS)
      if (!r.ok) continue
      for (const q of r.registros.questoes) {
        if (!q.comentario) continue
        expect(q.origem_fonte, `questão ${q.id} exibe comentário`).toBe('apostila_comentada')
        expect(q.autor_fonte, `questão ${q.id} exibe comentário sem assinatura`).toBeTruthy()
      }
    }
  })

  it('todas as questões se ligam a um assunto da taxonomia real', async () => {
    const taxonomia = (await import('@seeds/taxonomia.json')).default as {
      disciplinas: { assuntos: { slug: string; topicos?: { slug: string }[] }[] }[]
    }
    const slugs = new Set(
      taxonomia.disciplinas.flatMap((d) =>
        d.assuntos.flatMap((a) => [a.slug, ...(a.topicos ?? []).map((t) => t.slug)]),
      ),
    )
    for (const bruto of ARTEFATOS) {
      for (const q of bruto.questoes) {
        expect(slugs.has(q.assunto ?? ''), `${bruto.prova.slug} q${q.numero}: '${q.assunto}'`).toBe(true)
      }
    }
  })

  it('a versão da carga muda quando o acervo muda', () => {
    const antes = versaoDoAcervo(ARTEFATOS)
    const depois = versaoDoAcervo([...ARTEFATOS, apostila([{}])])
    expect(antes).not.toBe(depois)
    expect(versaoDoAcervo(ARTEFATOS)).toBe(antes)
  })
})
