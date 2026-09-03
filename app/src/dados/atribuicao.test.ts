import { describe, expect, it } from 'vitest'
import { atribuicaoDaQuestao } from './atribuicao'
import type { Cargo, Concurso, Questao } from './tipos'

const base: Questao = {
  id: 'q1',
  prova_id: 'p1',
  numero: 8,
  enunciado: 'Enunciado.',
  texto_apoio_id: null,
  gabarito: 'C',
  gabarito_casado_em: null,
  anulada: false,
  comentario: null,
  desatualizada: false,
  motivo_desatualizacao: null,
  status: 'publicada',
  origem_fonte: 'apostila_comentada',
  autor_fonte: 'Marcelo Aragão',
  titulo_fonte: 'Amostragem em Auditoria Contábil',
  revisado_humano: true,
  dificuldade_b: 0,
}

const concurso: Concurso = {
  id: 'c1', slug: 'sefaz-rj-2025', nome: 'SEFAZ-RJ 2025',
  orgao: 'SEFAZ-RJ', banca: 'CEBRASPE', ano: 2025,
}
const cargo: Cargo = { id: 'cargo1', concurso_id: 'c1', nome: 'Auditor Fiscal' }

describe('atribuição da questão', () => {
  it('credita autor e título da apostila, com o número original', () => {
    const a = atribuicaoDaQuestao(base)
    expect(a.linha).toBe('Marcelo Aragão · Amostragem em Auditoria Contábil · questão 8')
    expect(a.completa).toBe(true)
  })

  it('credita banca, órgão, cargo e ano da prova oficial', () => {
    const q: Questao = { ...base, origem_fonte: 'prova_oficial', autor_fonte: null, titulo_fonte: null }
    const a = atribuicaoDaQuestao(q, { concurso, cargo })
    expect(a.linha).toBe('CEBRASPE · SEFAZ-RJ · Auditor Fiscal · 2025 · questão 8')
    expect(a.completa).toBe(true)
  })

  it('assina o comentário quando o texto é do autor da apostila — regra 5', () => {
    const a = atribuicaoDaQuestao({ ...base, comentario: 'A banca cobrou o art. 5º…' })
    expect(a.autorDoComentario).toBe('Marcelo Aragão')
  })

  it('não assina comentário de prova oficial: ali o texto é nosso', () => {
    const q: Questao = {
      ...base, origem_fonte: 'prova_oficial', autor_fonte: null, titulo_fonte: null,
      comentario: 'Nosso comentário.',
    }
    expect(atribuicaoDaQuestao(q, { concurso, cargo }).autorDoComentario).toBeNull()
  })

  it('avisa em vez de esconder quando falta o crédito', () => {
    const a = atribuicaoDaQuestao({ ...base, autor_fonte: null })
    expect(a.completa).toBe(false)
    expect(a.linha).toBe('origem não registrada')
  })

  it('descarta preenchimento de campo vazio ("—") em vez de exibi-lo', () => {
    const q: Questao = { ...base, origem_fonte: 'prova_oficial', autor_fonte: null, titulo_fonte: null }
    const a = atribuicaoDaQuestao(q, { concurso: { ...concurso, orgao: '—' }, cargo })
    expect(a.linha).toBe('CEBRASPE · Auditor Fiscal · 2025 · questão 8')
  })
})
