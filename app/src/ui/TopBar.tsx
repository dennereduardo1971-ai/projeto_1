import type { ReactNode } from 'react'

export function TopBar({ titulo, acao }: { titulo: string; acao?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-surface border-b border-border shadow-[var(--shadow-sticky)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4"
           style={{ minHeight: 'var(--header-h)' }}>
        <h1 className="text-h3 font-semibold text-text truncate">{titulo}</h1>
        {acao}
      </div>
    </header>
  )
}
