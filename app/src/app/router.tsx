import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { Caderno } from './routes/Caderno'
import { Ciclo } from './routes/Ciclo'
import { Estatisticas } from './routes/Estatisticas'
import { Hoje } from './routes/Hoje'
import { Mais } from './routes/Mais'
import { Mapa } from './routes/Mapa'
import { Questoes } from './routes/Questoes'
import { Revisao } from './routes/Revisao'

export const router = createBrowserRouter([
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
