import { createBrowserRouter, createHashRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { Bemvindo } from './routes/Bemvindo'
import { Caderno } from './routes/Caderno'
import { Ciclo } from './routes/Ciclo'
import { Estatisticas } from './routes/Estatisticas'
import { Hoje } from './routes/Hoje'
import { Mais } from './routes/Mais'
import { Mapa } from './routes/Mapa'
import { Questoes } from './routes/Questoes'
import { Revisao } from './routes/Revisao'

/**
 * Build normal usa caminho de verdade (/mapa). O build `VITE_ROUTER=hash` gera
 * a versão de arquivo único, que roda de qualquer lugar — inclusive servida de
 * uma subpasta, onde caminho absoluto quebraria.
 */
const criar = import.meta.env.VITE_ROUTER === 'hash' ? createHashRouter : createBrowserRouter

export const router = criar([
  // Fora do AppShell: sem barra de navegação, tela cheia. AppShell redireciona
  // para cá quando não existe perfil local ainda (ver AppShell.tsx).
  { path: '/bemvindo', element: <Bemvindo /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Hoje /> },
      { path: 'mapa', element: <Mapa /> },
      { path: 'ciclo', element: <Ciclo /> },
      { path: 'mais', element: <Mais /> },
      { path: 'questoes', element: <Questoes /> },
      { path: 'estatisticas', element: <Estatisticas /> },
      { path: 'caderno', element: <Caderno /> },
      { path: 'revisao', element: <Revisao /> },
    ],
  },
])
