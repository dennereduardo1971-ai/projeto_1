import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '@/dados/db'
import { resumoDeHoje, type ResumoDeHoje } from '@/dados/consultas'
import { blocoDaVez, minutosDoBloco } from '@/features/ciclo/ciclo'
import { useSessao } from '@/features/ciclo/SessaoProvider'
import { formatarMinutos } from '@/lib/tempo'
import { Button, Card, EstadoVazio, InlineAlert, Stat, TopBar } from '@/ui'
import type { BlocoCiclo, Disciplina } from '@/dados/tipos'

/** A home é a fila do dia. Se o usuário precisa decidir o que fazer, a tela falhou. */
export function Hoje() {
  const { sessao, iniciar } = useSessao()
  const [resumo, setResumo] = useState<ResumoDeHoje | null>(null)
  const [bloco, setBloco] = useState<BlocoCiclo | null>(null)
  const [disciplina, setDisciplina] = useState<Disciplina | null>(null)
  const [feitos, setFeitos] = useState(0)

  const carregar = async () => {
    setResumo(await resumoDeHoje())
    const b = await blocoDaVez()
    setBloco(b)
    if (b) {
      setDisciplina((await db.disciplina.get(b.disciplina_id)) ?? null)
      setFeitos(await minutosDoBloco(b.id, b.minutos))
    }
  }

  useEffect(() => { void carregar() }, [sessao])

  return (
    <>
      <TopBar titulo="Hoje" />
      <div className="flex flex-col gap-4 py-4">
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <Stat rotulo="Hoje" valor={String(resumo?.minutosHoje ?? 0)} unidade="min" />
            <Stat rotulo="7 dias" valor={String(resumo?.minutosSemana ?? 0)} unidade="min" />
            <Stat
              rotulo="Revisões devidas"
              valor={resumo?.revisoesDevidas ? String(resumo.revisoesDevidas) : '—'}
              nota={resumo?.revisoesDevidas ? 'toque em Revisão' : 'erre uma questão e a fila enche'}
            />
          </div>
        </Card>

        {bloco && disciplina ? (
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-caption uppercase tracking-wide text-subtle">Bloco da vez</span>
              <h2 className="text-h3 font-semibold text-text">{disciplina.nome}</h2>
              <p className="text-sm text-muted num">
                {formatarMinutos(feitos)} de {formatarMinutos(bloco.minutos)} nesta volta ·{' '}
                {bloco.voltas} {bloco.voltas === 1 ? 'volta fechada' : 'voltas fechadas'}
              </p>
            </div>
            <div
              className="h-2 rounded-full bg-sunken overflow-hidden"
              role="img"
              aria-label={`Progresso do bloco: ${feitos} de ${bloco.minutos} minutos`}
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, (feitos / bloco.minutos) * 100)}%` }}
              />
            </div>
            {sessao ? (
              <InlineAlert tom="info">
                Cronômetro rodando. A barra acima da navegação encerra a sessão.
              </InlineAlert>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void iniciar({ assuntoId: null, blocoId: bloco.id, tipo: 'teoria' })}>
                  Começar {formatarMinutos(bloco.minutos)}
                </Button>
                <Link to="/mapa">
                  <Button variante="outline">Escolher assunto</Button>
                </Link>
              </div>
            )}
          </Card>
        ) : (
          <EstadoVazio
            motivo="uso"
            titulo="Seu ciclo ainda não tem blocos."
            corpo="O ciclo é uma fila que não pune atraso: você monta os blocos por disciplina e cada um só avança quando você estuda. Não existe dia perdido."
            acao={<Link to="/ciclo"><Button>Montar o ciclo</Button></Link>}
          />
        )}

        <EstadoVazio
          motivo="acervo"
          titulo="Nenhuma questão no acervo ainda."
          corpo="As questões vêm de provas oficiais em PDF, com gabarito definitivo casado antes de publicar. Nenhuma prova foi ingerida até agora."
          acao={<Link to="/questoes"><Button variante="outline">Como as questões entram</Button></Link>}
        />
      </div>
    </>
  )
}
