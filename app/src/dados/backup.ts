import { db } from './db'

/**
 * Exportar e importar o progresso.
 *
 * Sem login, o banco vive num navegador só — limpar os dados do site apagaria
 * tudo. O arquivo JSON é a única ponte entre celular e computador hoje, e é
 * também o que vai migrar o progresso para o Supabase quando houver conta.
 */

const TABELAS = [
  'disciplina', 'assunto',
  'concurso', 'cargo', 'edital', 'item_edital', 'item_edital_assunto',
  'prova', 'texto_apoio', 'questao', 'alternativa', 'questao_assunto',
  'plano', 'bloco_ciclo', 'sessao', 'resposta', 'card', 'revisao', 'ajuste',
] as const

export interface Backup {
  app: 'rito'
  versao: 1
  exportado_em: string
  tabelas: Record<string, unknown[]>
}

export async function exportar(): Promise<Backup> {
  const tabelas: Record<string, unknown[]> = {}
  for (const nome of TABELAS) {
    tabelas[nome] = await db.table(nome).toArray()
  }
  return { app: 'rito', versao: 1, exportado_em: new Date().toISOString(), tabelas }
}

export async function baixarBackup(): Promise<void> {
  const dados = await exportar()
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const dia = dados.exportado_em.slice(0, 10)
  a.href = url
  a.download = `rito-${dia}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export class BackupInvalido extends Error {}

/** Substitui o conteúdo local pelo do arquivo. Operação destrutiva e assumida. */
export async function importar(texto: string): Promise<{ registros: number }> {
  let dados: Backup
  try {
    dados = JSON.parse(texto) as Backup
  } catch {
    throw new BackupInvalido('O arquivo não é um JSON válido.')
  }
  if (dados?.app !== 'rito' || dados?.versao !== 1) {
    throw new BackupInvalido('Este arquivo não é um backup do Rito.')
  }

  let registros = 0
  await db.transaction('rw', TABELAS.map((t) => db.table(t)), async () => {
    for (const nome of TABELAS) {
      const linhas = dados.tabelas[nome]
      if (!Array.isArray(linhas)) continue
      await db.table(nome).clear()
      await db.table(nome).bulkPut(linhas)
      registros += linhas.length
    }
  })
  return { registros }
}
