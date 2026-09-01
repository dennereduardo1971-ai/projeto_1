import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { db } from '@/dados/db'
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
  // `null` = ainda não sabemos. Não é lido de `useSessao`/contexto nenhum
  // porque só este componente precisa da checagem — o resto do app assume
  // perfil existente, é essa a garantia que o redirecionamento abaixo dá.
  const [temPerfil, setTemPerfil] = useState<boolean | null>(null)

  useEffect(() => {
    void db.perfil.get('local').then((p) => setTemPerfil(!!p))
  }, [])

  // Enquanto pende, não renderiza nada — evita piscar Hoje.tsx (ou pior, a
  // barra de navegação) antes de saber se o destino é `/bemvindo`.
  if (temPerfil === null) return null
  if (!temPerfil) return <Navigate to="/bemvindo" replace />

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
