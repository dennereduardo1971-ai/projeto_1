import { cn } from '@/lib/cn'

interface Props {
  /** Obrigatório e específico: o rótulo tem que dizer QUAL métrica é. */
  rotulo: string
  valor: string
  unidade?: string
  nota?: string
  className?: string
}

export function Stat({ rotulo, valor, unidade, nota, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-caption uppercase tracking-wide text-subtle">{rotulo}</span>
      <span className="text-h2 font-semibold text-text num">
        {valor}
        {unidade && <span className="text-body font-normal text-muted"> {unidade}</span>}
      </span>
      {nota && <span className="text-caption text-subtle">{nota}</span>}
    </div>
  )
}
