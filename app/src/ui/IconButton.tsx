import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obrigatório: um ícone sem nome é um botão mudo para quem usa leitor de tela. */
  rotulo: string
  children: ReactNode
}

export function IconButton({ rotulo, className, children, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        'inline-flex items-center justify-center rounded-md',
        'min-h-[44px] min-w-[44px] text-muted hover:text-text hover:bg-surface-2',
        'transition-colors duration-[var(--dur-fast)]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
