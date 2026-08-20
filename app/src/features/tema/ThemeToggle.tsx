import { useTema, type Tema } from './TemaProvider'
import { cn } from '@/lib/cn'

const OPCOES: Array<{ valor: Tema; rotulo: string }> = [
  { valor: 'sistema', rotulo: 'Sistema' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
]

export function ThemeToggle() {
  const { tema, definir } = useTema()
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-text mb-2">Tema</legend>
      <div className="inline-flex rounded-md border border-border-strong overflow-hidden w-fit">
        {OPCOES.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-pressed={tema === o.valor}
            onClick={() => definir(o.valor)}
            className={cn(
              'min-h-[44px] px-4 text-sm border-r border-border-strong last:border-r-0',
              tema === o.valor
                ? 'bg-primary-soft text-text font-medium'
                : 'bg-surface text-muted hover:bg-surface-2',
            )}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
