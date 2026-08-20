import { useEffect, useState } from 'react'
import { db } from '@/dados/db'
import { formatarRelogio } from '@/lib/tempo'
import { Button } from '@/ui'
import { useSessao } from './SessaoProvider'

/** Barra persistente: o cronômetro continua visível ao navegar entre telas. */
export function BarraCronometro() {
  const { sessao, segundos, parar } = useSessao()
  const [assunto, setAssunto] = useState<string | null>(null)

  useEffect(() => {
    if (!sessao?.assunto_id) { setAssunto(null); return }
    void db.assunto.get(sessao.assunto_id).then((a) => setAssunto(a?.nome ?? null))
  }, [sessao?.assunto_id])

  if (!sessao) return null

  return (
    <div
      className="fixed inset-x-0 z-30 border-t border-border bg-surface-2"
      style={{ bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
        <span className="text-h3 font-semibold text-text num tabular-nums" aria-live="off">
          {formatarRelogio(segundos)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          {assunto ?? 'Sessão em andamento'}
        </span>
        <Button tamanho="sm" variante="outline" onClick={() => void parar()}>
          Encerrar
        </Button>
      </div>
    </div>
  )
}
