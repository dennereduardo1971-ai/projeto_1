import type { Cargo, Concurso, OrigemFonte, Questao } from './tipos'

/**
 * A linha de crédito de uma questão.
 *
 * Regra 4 do `CLAUDE.md`: toda questão guarda banca, ano, órgão, cargo e número
 * original — e, em `apostila_comentada`, o par equivalente é autor e título da
 * apostila. Guardar não basta: se a tela não mostra, o crédito não existe para
 * quem lê. Esta função é a fonte única dessa linha, para nenhuma tela inventar
 * um formato próprio.
 *
 * O comentário exibido junto do gabarito depende dela. Em `prova_oficial` o
 * comentário é NOSSO (a justificativa da banca é fonte, nunca cópia — regra 5);
 * em `apostila_comentada` ele é do autor da apostila e só pode aparecer
 * assinado — é a condição da exceção temporária de 2026-08-31.
 */

export interface Atribuicao {
  origem: OrigemFonte
  /** Linha pronta: "Autor · Título · questão 8". */
  linha: string
  /** Assina o comentário quando ele é texto de terceiro. `null` = comentário nosso. */
  autorDoComentario: string | null
  /**
   * `false` quando faltou dado para creditar a origem. A tela avisa em vez de
   * esconder: questão sem crédito visível é problema, não detalhe.
   */
  completa: boolean
}

/** Descarta pedaço vazio ou de preenchimento ("—"), que só sujaria a linha. */
const util = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== '' && v.trim() !== '—' && v.trim() !== '-'

export function atribuicaoDaQuestao(
  questao: Questao,
  contexto: { concurso?: Concurso | null; cargo?: Cargo | null } = {},
): Atribuicao {
  const numero = `questão ${questao.numero}`

  if (questao.origem_fonte === 'apostila_comentada') {
    const partes = [questao.autor_fonte, questao.titulo_fonte].filter(util)
    const completa = partes.length === 2
    return {
      origem: 'apostila_comentada',
      linha: completa ? [...partes, numero].join(' · ') : 'origem não registrada',
      autorDoComentario: questao.comentario && util(questao.autor_fonte) ? questao.autor_fonte : null,
      completa,
    }
  }

  const { concurso, cargo } = contexto
  const ano = typeof concurso?.ano === 'number' ? String(concurso.ano) : undefined
  const partes = [concurso?.banca, concurso?.orgao, cargo?.nome, ano].filter(util)
  const completa = util(concurso?.banca) && typeof concurso?.ano === 'number'
  return {
    origem: 'prova_oficial',
    linha: completa ? [...partes, numero].join(' · ') : 'origem não registrada',
    autorDoComentario: null,
    completa,
  }
}
