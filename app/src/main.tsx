import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { carregarAcervo } from './dados/acervo'
import { garantirSeeds } from './dados/seed'
import { SessaoProvider } from './features/ciclo/SessaoProvider'
import { TemaProvider } from './features/tema/TemaProvider'
import { router } from './app/router'
import './styles/theme.css'

/**
 * A taxonomia entra no banco local antes do primeiro render, e só depois o
 * acervo publicado pelo pipeline — a classificação por assunto de cada
 * questão depende dos assuntos já existirem. `carregarAcervo` é upsert por
 * slug/número: rodar de novo a cada boot é seguro e mantém o acervo local em
 * dia com o que o pipeline publicou por último.
 */
function Raiz() {
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    garantirSeeds()
      .then(() => carregarAcervo())
      .then((relatorio) => {
        if (relatorio.assuntosDesconhecidos.length > 0) {
          console.warn('Acervo: assuntos desconhecidos ignorados na carga', relatorio.assuntosDesconhecidos)
        }
        if (relatorio.questoesRejeitadas.length > 0) {
          console.warn('Acervo: questões rejeitadas na carga', relatorio.questoesRejeitadas)
        }
        setPronto(true)
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Falha ao preparar os dados.'))
  }, [])

  if (erro) {
    return (
      <div className="p-6 text-body text-text">
        <p>Não foi possível preparar os dados locais: {erro}</p>
      </div>
    )
  }
  if (!pronto) return null

  return (
    <TemaProvider>
      <SessaoProvider>
        <RouterProvider router={router} />
      </SessaoProvider>
    </TemaProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Raiz />
  </StrictMode>,
)
