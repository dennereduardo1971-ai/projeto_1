import { describe, expect, it } from 'vitest'
import { dominioEfetivo, estadoInicial, registrarResposta, retencao } from './mastery'
import { atualizarSequencia } from './gamification'
import { filaDeRevisao } from './scheduler'
import type { Sequencia } from '@/dados/tipos'

/**
 * Cobre o núcleo do motor de domínio — pura, sem DOM e sem Dexie. Atende à
 * pendência do `inspetor` ("nenhum teste automatizado cobre o app React").
 */

describe('mastery', () => {
  it('domínio (m) fica sempre em [0, 1]', () => {
    let estado = estadoInicial('assunto-1')
    const agora = Date.now()
    for (let i = 0; i < 30; i++) {
      const acertou = i % 3 !== 0
      estado = registrarResposta(estado, acertou, 0, agora + i * 1000).estado
      expect(estado.m).toBeGreaterThanOrEqual(0)
      expect(estado.m).toBeLessThanOrEqual(1)
    }
  })

  it('acerto aumenta o domínio; erro reduz', () => {
    const base = estadoInicial('assunto-1')
    const agora = Date.now()
    const acerto = registrarResposta(base, true, 0, agora)
    const erro = registrarResposta(base, false, 0, agora)
    expect(acerto.deltaM).toBeGreaterThan(0)
    expect(erro.deltaM).toBeLessThan(0)
  })

  it('retenção decai com o tempo e nunca ultrapassa 1', () => {
    const agora = Date.now()
    const estado = registrarResposta(estadoInicial('a'), true, 0, agora).estado
    const logo = retencao(estado, agora)
    const depois = retencao(estado, agora + 30 * 86_400_000)
    expect(logo).toBeLessThanOrEqual(1)
    expect(depois).toBeLessThan(logo)
  })

  it('domínio efetivo é 0 sem nenhuma resposta', () => {
    expect(dominioEfetivo(estadoInicial('a'), Date.now())).toBe(0)
  })
})

describe('scheduler', () => {
  it('fila de revisão só lista assunto com revisão vencida e já praticado', () => {
    const agora = Date.now()
    const vencido = registrarResposta(estadoInicial('a'), true, 0, agora - 200 * 86_400_000).estado
    const emDia = registrarResposta(estadoInicial('b'), true, 0, agora).estado
    const fila = filaDeRevisao({ a: vencido, b: emDia }, agora)
    expect(fila.map((e) => e.assunto_id)).toEqual(['a'])
  })
})

describe('gamification — sequência', () => {
  const base: Sequencia = { atual: 0, recorde: 0, ultimo_dia: null, congelamentos: 0 }

  it('primeiro dia começa a sequência em 1', () => {
    const r = atualizarSequencia(base, '2026-08-01')
    expect(r.atual).toBe(1)
  })

  it('dia seguido soma; lacuna de 2+ sem congelamento quebra', () => {
    const dia1 = atualizarSequencia(base, '2026-08-01')
    const dia2 = atualizarSequencia(dia1, '2026-08-02')
    expect(dia2.atual).toBe(2)

    const quebrado = atualizarSequencia(dia2, '2026-08-10')
    expect(quebrado.atual).toBe(1)
    expect(quebrado.quebrou).toBe(true)
  })

  it('congelamento cobre exatamente um dia perdido', () => {
    const comRede: Sequencia = { atual: 5, recorde: 5, ultimo_dia: '2026-08-05', congelamentos: 1 }
    const r = atualizarSequencia(comRede, '2026-08-07')
    expect(r.usouCongelamento).toBe(true)
    expect(r.atual).toBe(6)
    expect(r.congelamentos).toBe(0)
  })
})
