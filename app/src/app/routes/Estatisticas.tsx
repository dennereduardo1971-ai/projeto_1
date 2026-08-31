import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { respostasValidas, todosEstados } from '@/dados/consultas'
import { db } from '@/dados/db'
import { ROTULO_NIVEL } from '@/features/dominio/mastery'
import { prontidao, ranking, type Prontidao, type RankingLinha } from '@/features/dominio/stats'
import { Button, Card, EstadoVazio, TopBar } from '@/ui'

/**
 * Estatísticas do desempenho, calculadas pelo motor de domínio
 * (`features/dominio/stats.ts`). A prontidão só aparece com amostra
 * suficiente — abaixo disso a tela diz o que falta, nunca inventa um número.
 */
export function Estatisticas() {
  const [carregando, setCarregando] = useState(true)
  const [totalRespostas, setTotalRespostas] = useState(0)
  const [rankingDisciplinas, setRankingDisciplinas] = useState<RankingLinha[]>([])
  const [prontidaoGeral, setProntidaoGeral] = useState<Prontidao | null>(null)

  useEffect(() => {
    void (async () => {
      const [estados, disciplinas, assuntos, respostas] = await Promise.all([
        todosEstados(), db.disciplina.orderBy('ordem').toArray(), db.assunto.toArray(), respostasValidas(),
      ])
      const agoraMs = Date.now()

      const ramosPorDisciplina = disciplinas.map((d) => ({
        id: d.id,
        nome: d.nome,
        idsDoRamo: assuntos.filter((a) => a.disciplina_id === d.id).map((a) => a.id),
      }))

      setTotalRespostas(respostas.length)
      setRankingDisciplinas(ranking(ramosPorDisciplina, estados, agoraMs))
      setProntidaoGeral(
        prontidao(
          respostas.length,
          assuntos.map((a) => a.id),
          ramosPorDisciplina.map((r) => ({ id: r.id, peso: 1 / (disciplinas.length || 1), idsDoRamo: r.idsDoRamo })),
          estados,
          agoraMs,
        ),
      )
      setCarregando(false)
    })()
  }, [])

  if (carregando) return <><TopBar titulo="Estatísticas" /><div className="py-4 text-sm text-muted">Carregando…</div></>

  if (totalRespostas === 0) {
    return (
      <>
        <TopBar titulo="Estatísticas" />
        <div className="flex flex-col gap-4 py-4">
          <EstadoVazio
            motivo="acervo"
            titulo="Ainda não há respostas para medir."
            corpo="Sem questões respondidas não há desempenho para calcular."
            acao={<Link to="/questoes"><Button>Ir para questões</Button></Link>}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar titulo="Estatísticas" />
      <div className="flex flex-col gap-4 py-4">
        <Card className="p-4 flex flex-col gap-2">
          <h2 className="text-h3 font-semibold text-text">Prontidão geral</h2>
          {prontidaoGeral?.valor !== null && prontidaoGeral?.valor !== undefined ? (
            <p className="text-h2 font-semibold text-text num">{Math.round(prontidaoGeral.valor * 100)}%</p>
          ) : (
            <p className="text-sm text-muted max-w-[var(--measure-read)]">
              {prontidaoGeral?.motivo ?? 'Cobertura insuficiente.'}
            </p>
          )}
          <p className="text-caption text-subtle">
            {totalRespostas} questões respondidas · indicador pedagógico, nunca previsão de aprovação
          </p>
        </Card>

        <Card>
          <ul>
            {rankingDisciplinas.map((r) => (
              <li key={r.id} className="border-b border-border last:border-b-0 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body text-text">{r.nome}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-caption text-subtle">{ROTULO_NIVEL[r.nivel]}</span>
                    <span className="text-caption text-subtle num">{Math.round(r.dominio * 100)}%</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
