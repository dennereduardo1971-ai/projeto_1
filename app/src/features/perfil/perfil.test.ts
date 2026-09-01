import { describe, expect, it } from 'vitest'
import {
  MAX_NOME, PRIORS_THETA, RITMOS, estadoInicialDoNivel, metaDoRitmo, nomeValido,
  normalizarNome, thetaInicial,
} from './perfil'

/**
 * Cobre só as funções puras do onboarding (`/bemvindo`) — nada aqui toca o
 * Dexie (`obterPerfil`/`salvarPerfil`), no molde de `features/dominio/dominio.test.ts`.
 */

describe('normalizarNome / nomeValido', () => {
  it('corta espaços nas pontas e repetidos no meio', () => {
    expect(normalizarNome('  Ana   Paula  ')).toBe('Ana Paula')
  })

  it('nome só de espaço não é válido', () => {
    expect(nomeValido('   ')).toBe(false)
    expect(normalizarNome('   ')).toBe('')
  })

  it('nome com conteúdo é válido', () => {
    expect(nomeValido('Ana')).toBe(true)
  })

  it('trava em MAX_NOME caracteres', () => {
    const longo = 'a'.repeat(MAX_NOME + 20)
    expect(normalizarNome(longo)).toHaveLength(MAX_NOME)
  })
})

describe('metaDoRitmo', () => {
  it('leve, moderado e intenso batem com os presets de RITMOS', () => {
    for (const chave of Object.keys(RITMOS) as (keyof typeof RITMOS)[]) {
      const preset = RITMOS[chave]
      const meta = metaDoRitmo(chave, null)
      expect(meta.minutos_dia).toBe(preset.minutos_dia)
      expect(meta.questoes_dia).toBe(preset.questoes_dia)
      expect(meta.dias_semana).toBe(preset.dias_semana)
    }
  })

  it('carrega a data da prova quando informada', () => {
    expect(metaDoRitmo('leve', '2027-03-01').data_prova).toBe('2027-03-01')
  })

  it('data da prova nula quando não informada', () => {
    expect(metaDoRitmo('moderado', null).data_prova).toBeNull()
  })

  it('nenhum ritmo passa de 120 minutos por dia — teto da persona (2h/dia)', () => {
    for (const preset of Object.values(RITMOS)) {
      expect(preset.minutos_dia).toBeLessThanOrEqual(120)
    }
  })
})

describe('thetaInicial / estadoInicialDoNivel', () => {
  it('a ordem dos priors acompanha a ordem dos níveis', () => {
    expect(PRIORS_THETA.inicial).toBeLessThan(PRIORS_THETA.desenvolvimento)
    expect(PRIORS_THETA.desenvolvimento).toBeLessThan(PRIORS_THETA.intermediario)
    expect(PRIORS_THETA.intermediario).toBeLessThan(PRIORS_THETA.bom)
    expect(PRIORS_THETA.bom).toBeLessThan(PRIORS_THETA.dominado)
  })

  it('thetaInicial lê direto do preset', () => {
    expect(thetaInicial('dominado')).toBe(PRIORS_THETA.dominado)
  })

  it('estado gerado nunca conta como estatística: n, acertos e última prática zerados', () => {
    const estado = estadoInicialDoNivel('assunto-1', 'bom')
    expect(estado.n).toBe(0)
    expect(estado.acertos).toBe(0)
    expect(estado.ultima_pratica).toBeNull()
    expect(estado.assunto_id).toBe('assunto-1')
  })

  it('m sobe junto com o nível declarado (prior calibra dificuldade, não estatística)', () => {
    const inicial = estadoInicialDoNivel('a', 'inicial')
    const dominado = estadoInicialDoNivel('a', 'dominado')
    expect(dominado.m).toBeGreaterThan(inicial.m)
  })

  it('m fica sempre em (0, 1)', () => {
    for (const nivel of Object.keys(PRIORS_THETA) as (keyof typeof PRIORS_THETA)[]) {
      const estado = estadoInicialDoNivel('a', nivel)
      expect(estado.m).toBeGreaterThan(0)
      expect(estado.m).toBeLessThan(1)
    }
  })
})
