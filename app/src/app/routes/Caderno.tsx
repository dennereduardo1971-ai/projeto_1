import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { todosEstados } from '@/dados/consultas'
import { db } from '@/dados/db'
import { errosAbertos } from '@/features/dominio/scheduler'
import { Button, Card, EstadoVazio, TopBar } from '@/ui'

interface LinhaErro {
  assuntoId: string
  nome: string
  errosAbertos: number
}

/**
 * Caderno de erros. Desde 2026-08-31, "erro aberto" vive em `estado_assunto`
 * (zera sozinho quando você acerta de novo o assunto) — não existe mais um
 * card por questão errada.
 */
export function Caderno() {
  const [linhas, setLinhas] = useState<LinhaErro[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    void (async () => {
      const [estados, assuntos] = await Promise.all([todosEstados(), db.assunto.toArray()])
      const nomePorId = new Map(assuntos.map((a) => [a.id, a.nome]))
      const abertos = errosAbertos(estados)
      setLinhas(
        abertos.map((e) => ({
          assuntoId: e.assunto_id,
          nome: nomePorId.get(e.assunto_id) ?? 'assunto removido',
          errosAbertos: e.erros_abertos,
        })),
      )
      setCarregando(false)
    })()
  }, [])

  if (carregando) return <><TopBar titulo="Caderno de erros" /><div className="py-4 text-sm text-muted">Carregando…</div></>

  if (linhas.length === 0) {
    return (
      <>
        <TopBar titulo="Caderno de erros" />
        <div className="flex flex-col gap-4 py-4">
          <EstadoVazio
            motivo="uso"
            titulo="Sem erros em aberto."
            corpo="Ele se preenche sozinho quando você errar uma questão — você não precisa marcar nada. Acertar de novo o mesmo assunto fecha o erro."
          />
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar titulo="Caderno de erros" />
      <div className="flex flex-col gap-4 py-4">
        <p className="text-caption text-subtle">
          {linhas.length} assunto{linhas.length === 1 ? '' : 's'} com erro em aberto, do mais frequente
        </p>
        <Card>
          <ul>
            {linhas.map((l) => (
              <li key={l.assuntoId} className="border-b border-border last:border-b-0 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-body text-text">{l.nome}</span>
                    <span className="text-caption text-subtle num">
                      {l.errosAbertos} erro{l.errosAbertos === 1 ? '' : 's'} em aberto
                    </span>
                  </div>
                  <Link to={`/questoes?assunto=${l.assuntoId}`}>
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
