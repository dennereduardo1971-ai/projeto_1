import { NavLink, Outlet } from 'react-router-dom'
import { BarraCronometro } from '@/features/ciclo/BarraCronometro'
import { useSessao } from '@/features/ciclo/SessaoProvider'
import { cn } from '@/lib/cn'

const DESTINOS = [
  { para: '/', rotulo: 'Hoje', glifo: '◧' },
  { para: '/mapa', rotulo: 'Mapa', glifo: '☰' },
  { para: '/ciclo', rotulo: 'Ciclo', glifo: '◔' },
  { para: '/mais', rotulo: 'Mais', glifo: '⋯' },
]

export function AppShell() {
  const { sessao } = useSessao()

  return (
    <div className="min-h-dvh bg-bg">
      <a className="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>

      <main
        id="conteudo"
        className="mx-auto max-w-3xl px-4 pt-4"
        style={{
          paddingBottom: sessao
            ? 'calc(var(--tabbar-h) + 64px + env(safe-area-inset-bottom, 0px))'
            : 'calc(var(--tabbar-h) + 24px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <Outlet />
      </main>

      <BarraCronometro />

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <ul className="mx-auto flex max-w-3xl">
          {DESTINOS.map((d) => (
            <li key={d.para} className="flex-1">
              <NavLink
                to={d.para}
                end={d.para === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-0.5 text-caption',
                    'min-h-[var(--tabbar-h)] transition-colors duration-[var(--dur-fast)]',
                    isActive ? 'text-primary font-medium' : 'text-subtle hover:text-text',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span aria-hidden="true" className="text-body leading-none">{d.glifo}</span>
                    <span>{d.rotulo}</span>
                    {isActive && <span className="sr-only">(tela atual)</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
