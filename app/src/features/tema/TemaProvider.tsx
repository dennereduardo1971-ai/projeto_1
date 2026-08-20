import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Tema = 'sistema' | 'claro' | 'escuro'

const CHAVE = 'rito.tema'

interface Contexto {
  tema: Tema
  definir: (t: Tema) => void
}

const TemaCtx = createContext<Contexto | null>(null)

function aplicar(tema: Tema) {
  const raiz = document.documentElement
  if (tema === 'sistema') delete raiz.dataset.theme
  else raiz.dataset.theme = tema === 'claro' ? 'light' : 'dark'
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(
    () => (localStorage.getItem(CHAVE) as Tema | null) ?? 'sistema',
  )

  useEffect(() => { aplicar(tema) }, [tema])

  const definir = useCallback((t: Tema) => {
    if (t === 'sistema') localStorage.removeItem(CHAVE)
    else localStorage.setItem(CHAVE, t)
    setTema(t)
  }, [])

  const valor = useMemo(() => ({ tema, definir }), [tema, definir])
  return <TemaCtx.Provider value={valor}>{children}</TemaCtx.Provider>
}

export function useTema(): Contexto {
  const ctx = useContext(TemaCtx)
  if (!ctx) throw new Error('useTema fora do TemaProvider')
  return ctx
}
