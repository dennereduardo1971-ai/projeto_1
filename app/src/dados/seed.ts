import taxonomia from '@seeds/taxonomia.json'
import { db, novoId } from './db'
import type { Assunto, Disciplina } from './tipos'

/**
 * Carrega a taxonomia de `seeds/taxonomia.json` no banco local.
 *
 * Idempotente por `slug`: rodar de novo atualiza nome e ordem sem quebrar
 * nenhuma ligação já feita (sessão apontando para assunto, por exemplo).
 * A árvore é PROVISÓRIA — vai ser remapeada quando as provas chegarem e
 * revelarem o que a banca de fato chama de assunto. O `slug` é o que segura
 * as ligações enquanto os nomes mudam.
 */

interface TopicoSeed { slug: string; nome: string; ordem: number }
interface AssuntoSeed { slug: string; nome: string; ordem: number; topicos?: TopicoSeed[] }
interface DisciplinaSeed { slug: string; nome: string; ordem: number; assuntos: AssuntoSeed[] }
interface Taxonomia { versao: number; disciplinas: DisciplinaSeed[] }

export const VERSAO_TAXONOMIA = (taxonomia as Taxonomia).versao

export async function aplicarSeeds(): Promise<{ disciplinas: number; assuntos: number }> {
  const dados = taxonomia as Taxonomia
  let disciplinas = 0
  let assuntos = 0

  await db.transaction('rw', db.disciplina, db.assunto, db.ajuste, async () => {
    for (const d of dados.disciplinas) {
      const existente = await db.disciplina.where('slug').equals(d.slug).first()
      const disciplina: Disciplina = {
        id: existente?.id ?? novoId(),
        slug: d.slug,
        nome: d.nome,
        ordem: d.ordem,
      }
      await db.disciplina.put(disciplina)
      disciplinas++

      for (const a of d.assuntos) {
        const jaTem = await db.assunto.where('slug').equals(a.slug).first()
        const assunto: Assunto = {
          id: jaTem?.id ?? novoId(),
          disciplina_id: disciplina.id,
          pai_id: null,
          slug: a.slug,
          nome: a.nome,
          ordem: a.ordem,
          profundidade: 1,
        }
        await db.assunto.put(assunto)
        assuntos++

        for (const t of a.topicos ?? []) {
          const jaTemT = await db.assunto.where('slug').equals(t.slug).first()
          await db.assunto.put({
            id: jaTemT?.id ?? novoId(),
            disciplina_id: disciplina.id,
            pai_id: assunto.id,
            slug: t.slug,
            nome: t.nome,
            ordem: t.ordem,
            profundidade: 2,
          })
          assuntos++
        }
      }
    }
    await db.ajuste.put({ chave: 'taxonomia_versao', valor: dados.versao })
  })

  return { disciplinas, assuntos }
}

/** Roda os seeds só se a versão do arquivo for mais nova que a já aplicada. */
export async function garantirSeeds(): Promise<void> {
  const aplicada = await db.ajuste.get('taxonomia_versao')
  if (aplicada?.valor === VERSAO_TAXONOMIA) return
  await aplicarSeeds()
}
