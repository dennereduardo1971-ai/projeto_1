import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/cn'

/** Rótulo é sempre visível. Placeholder não é rótulo: some quando mais importa. */
export function Field({
  rotulo,
  descricao,
  erro,
  children,
}: {
  rotulo: string
  descricao?: string
  erro?: string
  children: (props: { id: string; 'aria-describedby': string | undefined }) => ReactNode
}) {
  const id = useId()
  const idDesc = descricao ? `${id}-desc` : undefined
  const idErro = erro ? `${id}-erro` : undefined
  const describedBy = [idDesc, idErro].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">{rotulo}</label>
      {descricao && <p id={idDesc} className="text-caption text-subtle">{descricao}</p>}
      {children({ id, 'aria-describedby': describedBy })}
      {erro && <p id={idErro} className="text-caption text-err">{erro}</p>}
    </div>
  )
}

const CAMPO =
  'min-h-[44px] w-full rounded-sm border border-border-strong bg-surface px-3 text-body text-text ' +
  'placeholder:text-subtle'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  // 16px de fonte não é estética: abaixo disso o iOS dá zoom ao focar.
  return <input className={cn(CAMPO, className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CAMPO, 'pr-8', className)} {...props} />
}
