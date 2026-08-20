import { useEffect, useState } from 'react'
import { db } from '@/dados/db'
import {
  adicionarBloco, blocoDaVez, listarBlocos, minutosDoBloco, moverBloco, registrarMinutos, removerBloco,
} from '@/features/ciclo/ciclo'
import { useSessao } from '@/features/ciclo/SessaoProvider'
import { formatarMinutos } from '@/lib/tempo'
import { Button, Card, EstadoVazio, Field, IconButton, InlineAlert, Select, TopBar } from '@/ui'
import type { Assunto, BlocoCiclo, Disciplina } from '@/dados/tipos'

const MINUTOS_SUGERIDOS = [25, 30, 45, 60, 90]

export function Ciclo() {
  const { sessao, iniciar } = useSessao()
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [assuntos, setAssuntos] = useState<Assunto[]>([])
  const [blocos, setBlocos] = useState<BlocoCiclo[]>([])
  const [feitos, setFeitos] = useState<Record<string, number>>({})
  const [daVez, setDaVez] = useState<string | null>(null)

  const [novaDisciplina, setNovaDisciplina] = useState('')
  const [novosMinutos, setNovosMinutos] = useState('45')

  const [assuntoManual, setAssuntoManual] = useState('')
  const [minutosManual, setMinutosManual] = useState('')
  const [avisoManual, setAvisoManual] = useState<string | null>(null)

  const carregar = async () => {
    const [ds, as, bs, vez] = await Promise.all([
      db.disciplina.orderBy('ordem').toArray(),
      db.assunto.filter((a) => a.profundidade === 1).toArray(),
      listarBlocos(),
      blocoDaVez(),
    ])
    setDisciplinas(ds)
    setAssuntos(as.sort((a, b) => a.ordem - b.ordem))
    setBlocos(bs)
    setDaVez(vez?.id ?? null)
    if (ds[0] && !novaDisciplina) setNovaDisciplina(ds[0].id)
    const parciais: Record<string, number> = {}
    for (const b of bs) parciais[b.id] = await minutosDoBloco(b.id, b.minutos)
    setFeitos(parciais)
  }

  useEffect(() => { void carregar() }, [sessao])

  const nomeDisciplina = (id: string) => disciplinas.find((d) => d.id === id)?.nome ?? '—'

  const lancarManual = async (e: React.FormEvent) => {
    e.preventDefault()
    const minutos = Number(minutosManual)
    if (!Number.isFinite(minutos) || minutos < 1 || minutos > 480) {
      setAvisoManual('Informe de 1 a 480 minutos.')
      return
    }
    const assunto = assuntos.find((a) => a.id === assuntoManual)
    const bloco = blocos.find((b) => b.disciplina_id === assunto?.disciplina_id)
    await registrarMinutos({
      assuntoId: assuntoManual || null,
      blocoId: bloco?.id ?? null,
      tipo: 'teoria',
      minutos,
    })
    setMinutosManual('')
    setAvisoManual(null)
    await carregar()
  }

  return (
    <>
      <TopBar titulo="Ciclo" />
      <div className="flex flex-col gap-4 py-4">
        <InlineAlert tom="info" titulo="O ciclo é uma fila, não um calendário">
          Nenhum bloco tem dia marcado. O próximo é sempre o que fechou menos voltas — sumir uma
          semana não gera dívida nem replanejamento.
        </InlineAlert>

        {blocos.length === 0 ? (
          <EstadoVazio
            motivo="uso"
            titulo="Nenhum bloco no ciclo."
            corpo="Um bloco é uma disciplina e uma duração. Comece com dois: as duas matérias-piloto do projeto."
          />
        ) : (
          <Card>
            <ul>
              {blocos.map((b, i) => (
                <li key={b.id} className="border-b border-border last:border-b-0 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="text-body text-text">
                        {nomeDisciplina(b.disciplina_id)}
                        {b.id === daVez && (
                          <span className="ml-2 text-caption rounded-sm border border-primary px-1.5 py-0.5 text-primary">
                            da vez
                          </span>
                        )}
                      </span>
                      <span className="text-caption text-subtle num">
                        {formatarMinutos(feitos[b.id] ?? 0)} de {formatarMinutos(b.minutos)} nesta volta ·{' '}
                        {b.voltas} {b.voltas === 1 ? 'volta' : 'voltas'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <IconButton
                        rotulo={`Subir ${nomeDisciplina(b.disciplina_id)} na ordem`}
                        disabled={i === 0}
                        onClick={() => void moverBloco(b.id, -1).then(carregar)}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        rotulo={`Descer ${nomeDisciplina(b.disciplina_id)} na ordem`}
                        disabled={i === blocos.length - 1}
                        onClick={() => void moverBloco(b.id, 1).then(carregar)}
                      >
                        ↓
                      </IconButton>
                      <IconButton
                        rotulo={`Remover bloco de ${nomeDisciplina(b.disciplina_id)}`}
                        onClick={() => void removerBloco(b.id).then(carregar)}
                      >
                        ✕
                      </IconButton>
                    </div>
                  </div>
                  {!sessao && (
                    <Button
                      tamanho="sm"
                      variante="outline"
                      className="mt-2"
                      onClick={() => void iniciar({ assuntoId: null, blocoId: b.id, tipo: 'teoria' })}
                    >
                      Começar este bloco
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="p-4 flex flex-col gap-3">
          <h2 className="text-h3 font-semibold text-text">Adicionar bloco</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field rotulo="Disciplina">
              {(p) => (
                <Select {...p} value={novaDisciplina} onChange={(e) => setNovaDisciplina(e.target.value)}>
                  {disciplinas.map((d) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field rotulo="Duração">
              {(p) => (
                <Select {...p} value={novosMinutos} onChange={(e) => setNovosMinutos(e.target.value)}>
                  {MINUTOS_SUGERIDOS.map((m) => (
                    <option key={m} value={m}>{formatarMinutos(m)}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Button
            className="w-fit"
            disabled={!novaDisciplina}
            onClick={() => void adicionarBloco(novaDisciplina, Number(novosMinutos)).then(carregar)}
          >
            Adicionar ao ciclo
          </Button>
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-h3 font-semibold text-text">Lançar minutos à mão</h2>
            <p className="text-sm text-muted">
              Para quando você estudou sem ligar o cronômetro. O tempo entra na mesma conta.
            </p>
          </div>
          <form className="flex flex-col gap-3" onSubmit={lancarManual}>
            <Field rotulo="Assunto">
              {(p) => (
                <Select {...p} value={assuntoManual} onChange={(e) => setAssuntoManual(e.target.value)}>
                  <option value="">Sem assunto definido</option>
                  {assuntos.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field rotulo="Minutos" erro={avisoManual ?? undefined}>
              {(p) => (
                <input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={480}
                  value={minutosManual}
                  onChange={(e) => setMinutosManual(e.target.value)}
                  className="min-h-[44px] w-full rounded-sm border border-border-strong bg-surface px-3 text-body text-text"
                />
              )}
            </Field>
            <Button type="submit" variante="outline" className="w-fit">Registrar</Button>
          </form>
        </Card>
      </div>
    </>
  )
}
