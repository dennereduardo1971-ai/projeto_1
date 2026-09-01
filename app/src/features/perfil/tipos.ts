import type { NivelDominio } from '@/features/dominio/mastery'

/** Os três ritmos oferecidos em `/bemvindo`. Presets em `perfil.ts` (`RITMOS`). */
export type Ritmo = 'leve' | 'moderado' | 'intenso'

/**
 * Perfil local do usuário — porta de entrada do app enquanto não há login.
 *
 * 1 registro fixo em `db.perfil`, chave `'local'` (mesma convenção de
 * `sequencia`/`meta` em `dados/db.ts`). Ritmo é espelhado em `db.meta`
 * (`minutos_dia`/`questoes_dia`/`dias_semana`/`data_prova`) porque é essa
 * tabela que o resto do app já lê — `Perfil` guarda o preset escolhido, não
 * reinventa a meta.
 */
export interface Perfil {
  nome: string
  ritmo: Ritmo
  /** Domínio inicial DECLARADO por disciplina — chave = `disciplina.slug`. */
  nivel_inicial: Record<string, NivelDominio>
  data_prova: string | null
  criado_em: string
  atualizado_em: string
}
