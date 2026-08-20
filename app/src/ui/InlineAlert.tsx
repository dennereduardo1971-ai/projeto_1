import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tom = 'info' | 'warn' | 'err' | 'ok'

const TONS: Record<Tom, string> = {
  info: 'bg-info-bg text-info-fg border-info',
  warn: 'bg-warn-bg text-warn-fg border-warn',
  err: 'bg-err-bg text-err-fg border-err',
  ok: 'bg-ok-bg text-ok-fg border-ok',
}

const GLIFOS: Record<Tom, string> = { info: 'i', warn: '!', err: '✕', ok: '✓' }

export function InlineAlert({
  tom = 'info',
  titulo,
  children,
}: {
  tom?: Tom
  titulo?: string
  children: ReactNode
}) {
  return (
    <div
      role={tom === 'err' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md border-l-[3px] p-3 text-sm', TONS[tom])}
    >
      <span aria-hidden="true" className="font-bold leading-6">{GLIFOS[tom]}</span>
      <div className="flex flex-col gap-1">
        {titulo && <strong className="font-semibold">{titulo}</strong>}
        <div>{children}</div>
      </div>
    </div>
  )
}
