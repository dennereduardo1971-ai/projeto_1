import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variante = 'primary' | 'outline' | 'ghost' | 'danger'

const VARIANTES: Record<Variante, string> = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover border border-transparent',
  outline: 'bg-surface text-text border border-border-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-muted border border-transparent hover:bg-surface-2 hover:text-text',
  danger: 'bg-transparent text-err border border-err hover:bg-err-bg',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  /** `sm` só em barra de filtro — nunca como ação principal de uma tela. */
  tamanho?: 'md' | 'sm'
  largura?: 'auto' | 'cheia'
}

export function Button({
  variante = 'primary',
  tamanho = 'md',
  largura = 'auto',
  className,
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'transition-colors duration-[var(--dur-fast)]',
        'disabled:opacity-50 disabled:pointer-events-none',
        tamanho === 'md' ? 'min-h-[44px] px-4 text-body' : 'min-h-[36px] px-3 text-sm',
        largura === 'cheia' && 'w-full',
        VARIANTES[variante],
        className,
      )}
      {...props}
    />
  )
}
