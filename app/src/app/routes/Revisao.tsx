import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '@/dados/db'
import { agendar, estaDevida, NOTAS, textoProxima, type Nota } from '@/features/revisao/fsrs'
import type { Card as CardTipo, Revisao as RevisaoTipo } from '@/dados/tipos'
import { Button, Card, EstadoVazio, TopBar } from '@/ui'

interface ItemFila {
  card: CardTipo
  revisao: RevisaoTipo
  assunto: string | null
}

export function Revisao() {
  const [fila, setFila] = useState<ItemFila[]>([])
  const [proxima, setProxima] = useState<RevisaoTipo | null>(null)
  const [mostrando, setMostrando] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const puxar = useCallback(async () => {
    const revisoes = (await db.revisao.toArray()).sort(
      (a, b) => new Date(a.devida_em).getTime() - new Date(b.devida_em).getTime(),
    )
    const devidas = revisoes.filter((r) => estaDevida(r))
    const itens: ItemFila[] = []
    for (const r of devidas) {
      const card = await db.card.get(r.card_id)
      if (!card || card.suspenso) continue
      const assunto = card.assunto_id ? await db.assunto.get(card.assunto_id) : null
      itens.push({ card, revisao: r, assunto: assunto?.nome ?? null })
    }
    setFila(itens)
    setProxima(revisoes.find((r) => !estaDevida(r)) ?? null)
    setMostrando(false)
    setCarregando(false)
  }, [])

  useEffect(() => { void puxar() }, [puxar])

  async function nota(n: Nota) {
    const item = fila[0]
    if (!item) return
    await db.revisao.put(agendar(item.revisao, n))
    await puxar()
  }

  if (carregando) return <><TopBar titulo="Revisão" /><div className="py-4 text-sm text-muted">Carregando…</div></>

  const item = fila[0]

  if (!item) {
    return (
      <>
        <TopBar titulo="Revisão" />
        <div className="flex flex-col gap-4 py-4">
          <EstadoVazio
            motivo="uso"
            titulo="Nada vencido agora."
            corpo={
              proxima
                ? `A próxima revisão vence ${textoProxima(proxima)}. Cada erro em questão vira um card automaticamente — a fila enche sozinha.`
                : 'Cada erro em questão vira um card automaticamente. Resolva algumas questões e a fila se forma sozinha.'
            }
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
          <span>{item.assunto ?? 'sem assunto'}</span>
          <span>{fila.length} na fila</span>
        </div>

        <Card className="p-4 flex flex-col gap-4">
          <p className="text-base leading-relaxed text-text">{item.card.frente}</p>

          {!mostrando ? (
            <Button largura="cheia" onClick={() => setMostrando(true)}>Mostrar resposta</Button>
          ) : (
            <>
              <div className="rounded-md border border-border bg-surface-2 p-3 text-sm text-text">
                {item.card.verso}
              </div>
              <span className="text-caption text-subtle">Quanto custou lembrar?</span>
              <div className="grid grid-cols-2 gap-2">
                {NOTAS.map((n) => (
                  <Button
                    key={n.n}
                    variante={n.n === 1 ? 'danger' : 'outline'}
                    onClick={() => void nota(n.n)}
                  >
                    {n.rotulo}
                  </Button>
                ))}
              </div>
            </>
          )}
        </Card>

        <p className="text-caption text-subtle">
          Revisado {item.revisao.repeticoes}× · {item.revisao.lapsos} lapso{item.revisao.lapsos === 1 ? '' : 's'}
        </p>
      </div>
    </>
  )
}
