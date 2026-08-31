import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { todosEstados } from '@/dados/consultas'
import { db } from '@/dados/db'
import { filaDeRevisao } from '@/features/dominio/scheduler'
import type { EstadoAssunto } from '@/dados/tipos'
import { Button, Card, EstadoVazio, TopBar } from '@/ui'

interface ItemFila {
  estado: EstadoAssunto
  nome: string
  diasAtraso: number
}

const DIA_MS = 86_400_000

/**
 * A fila de revisão. Desde 2026-08-31 não existe mais card/flashcard: a
 * unidade é o ASSUNTO — cada linha vencida leva direto para praticar questão
 * daquele assunto, que é o que atualiza o domínio e reagenda a revisão.
 */
export function Revisao() {
  const [fila, setFila] = useState<ItemFila[]>([])
  const [carregando, setCarregando] = useState(true)

  const puxar = useCallback(async () => {
    const [estados, assuntos] = await Promise.all([todosEstados(), db.assunto.toArray()])
    const nomePorId = new Map(assuntos.map((a) => [a.id, a.nome]))
    const agoraMs = Date.now()

    const vencidos = filaDeRevisao(estados, agoraMs)
    setFila(
      vencidos.map((estado) => ({
        estado,
        nome: nomePorId.get(estado.assunto_id) ?? 'assunto removido',
        diasAtraso: Math.max(0, Math.round((agoraMs - new Date(estado.revisar_em!).getTime()) / DIA_MS)),
      })),
    )
    setCarregando(false)
  }, [])

  useEffect(() => { void puxar() }, [puxar])

  if (carregando) return <><TopBar titulo="Revisão" /><div className="py-4 text-sm text-muted">Carregando…</div></>

  if (fila.length === 0) {
    return (
      <>
        <TopBar titulo="Revisão" />
        <div className="flex flex-col gap-4 py-4">
          <EstadoVazio
            motivo="uso"
            titulo="Nada vencido agora."
            corpo="Cada questão respondida atualiza o domínio do assunto e agenda a próxima revisão sozinha. Resolva algumas questões e a fila se forma."
            acao={<Link to="/questoes"><Button>Ir para questões</Button></Link>}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar titulo="Revisão" />
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between text-caption text-subtle">
          <span>{fila.length} assunto{fila.length === 1 ? '' : 's'} vencido{fila.length === 1 ? '' : 's'}</span>
        </div>

        <Card>
          <ul>
            {fila.map((item) => (
              <li key={item.estado.assunto_id} className="border-b border-border last:border-b-0 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-body text-text">{item.nome}</span>
                    <span className="text-caption text-subtle num">
                      {item.diasAtraso === 0 ? 'vence hoje' : `${item.diasAtraso} dia${item.diasAtraso === 1 ? '' : 's'} de atraso`}
                      {item.estado.erros_abertos > 0 &&
                        ` · ${item.estado.erros_abertos} erro${item.estado.erros_abertos === 1 ? '' : 's'} em aberto`}
                    </span>
                  </div>
                  <Link to={`/questoes?assunto=${item.estado.assunto_id}`}>
                    <Button tamanho="sm" variante="outline">Praticar</Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
