import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Sessao, TipoSessao } from '@/dados/tipos'
import { fecharSessao, descartarSessao, iniciarSessao, sessaoAberta } from './ciclo'

/**
 * O cronômetro vive acima das telas porque o estudo acontece FORA do app:
 * o usuário liga o timer, sai para o PDF ou para o livro e volta depois.
 *
 * O tempo é sempre calculado a partir de `inicio` gravado no banco, nunca de
 * um contador em memória — fechar a aba, trocar de app ou o celular dormir não
 * pode custar o registro. Se ainda assim a sessão se perder, existe o
 * lançamento manual de minutos.
 */

interface Contexto {
  sessao: Sessao | null
  segundos: number
  iniciar: (e: { assuntoId: string | null; blocoId: string | null; tipo: TipoSessao }) => Promise<void>
  parar: () => Promise<number | null>
  descartar: () => Promise<void>
  recarregar: () => Promise<void>
}

const SessaoCtx = createContext<Contexto | null>(null)

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null)
  const [segundos, setSegundos] = useState(0)

  const recarregar = useCallback(async () => {
    setSessao(await sessaoAberta())
  }, [])

  useEffect(() => { void recarregar() }, [recarregar])

  useEffect(() => {
    if (!sessao) { setSegundos(0); return }
    const calcular = () =>
      setSegundos(Math.floor((Date.now() - new Date(sessao.inicio).getTime()) / 1000))
    calcular()
    const id = window.setInterval(calcular, 1000)
    // Voltar de segundo plano recalcula pelo relógio, não pelo contador.
    const aoVoltar = () => calcular()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [sessao])

  const iniciar = useCallback<Contexto['iniciar']>(async (e) => {
    setSessao(await iniciarSessao(e))
  }, [])

  const parar = useCallback(async () => {
    if (!sessao) return null
    const fechada = await fecharSessao(sessao.id)
    setSessao(null)
    return fechada?.minutos ?? null
  }, [sessao])

  const descartar = useCallback(async () => {
    if (!sessao) return
    await descartarSessao(sessao.id)
    setSessao(null)
  }, [sessao])

  const valor = useMemo(
    () => ({ sessao, segundos, iniciar, parar, descartar, recarregar }),
    [sessao, segundos, iniciar, parar, descartar, recarregar],
  )
  return <SessaoCtx.Provider value={valor}>{children}</SessaoCtx.Provider>
}

export function useSessao(): Contexto {
  const ctx = useContext(SessaoCtx)
  if (!ctx) throw new Error('useSessao fora do SessaoProvider')
  return ctx
}
