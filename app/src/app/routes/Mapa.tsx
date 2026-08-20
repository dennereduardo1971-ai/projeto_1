import { useEffect, useState } from 'react'
import { mapa, type GrupoDisciplina, type LinhaAssunto } from '@/dados/consultas'
import { NIVEIS } from '@/dados/nivel'
import { useSessao } from '@/features/ciclo/SessaoProvider'
import { formatarMinutos } from '@/lib/tempo'
import { cn } from '@/lib/cn'
import { Button, Card, InlineAlert, NivelMeter, TopBar, classeArestaNivel } from '@/ui'

/**
 * O Mapa. Uma linha é a unidade de tudo.
 *
 * Enquanto o edital do concurso alvo não existe (o da RFB só sai até jan/2027),
 * a linha visível é o ASSUNTO. Quando o edital entrar, cada frase literal dele
 * aponta para estes mesmos assuntos e o progresso acumulado aqui continua valendo.
 */
export function Mapa() {
  const [grupos, setGrupos] = useState<GrupoDisciplina[]>([])
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const { sessao } = useSessao()

  useEffect(() => {
    void mapa().then((g) => { setGrupos(g); setCarregando(false) })
  }, [sessao])

  const alternar = (id: string) =>
    setAbertos((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })

  const totalLinhas = grupos.reduce((s, g) => s + g.linhas.length, 0)
  const estudadas = grupos.reduce((s, g) => s + g.linhas.filter((l) => l.nivel > 0).length, 0)

  return (
    <>
      <TopBar titulo="Mapa" />
      <div className="flex flex-col gap-4 py-4">
        <p className="text-sm text-muted num">
          {totalLinhas} assuntos · {estudadas} com estudo registrado
        </p>

        <InlineAlert tom="info" titulo="Ainda sem edital cadastrado">
          O edital do concurso alvo será publicado até janeiro de 2027. Até lá o mapa é a árvore de
          assuntos. Quando o edital sair, cada linha literal dele passa a apontar para estes mesmos
          assuntos — nada do que você registrar agora se perde.
        </InlineAlert>

        {carregando ? (
          <p className="text-sm text-subtle">Carregando…</p>
        ) : (
          grupos.map((g) => {
            const aberto = abertos.has(g.disciplina.id)
            return (
              <Card key={g.disciplina.id} className="overflow-hidden">
                <h2>
                  <button
                    type="button"
                    onClick={() => alternar(g.disciplina.id)}
                    aria-expanded={aberto}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left min-h-[44px] hover:bg-surface-2"
                  >
                    <span className="flex flex-col gap-1">
                      <span className="text-h3 font-semibold text-text">{g.disciplina.nome}</span>
                      <span className="text-caption text-subtle num">
                        {g.linhas.length} assuntos · {formatarMinutos(g.minutos)} registrados
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <ResumoNiveis porNivel={g.porNivel} />
                      <span aria-hidden="true" className="text-muted">{aberto ? '▴' : '▾'}</span>
                    </span>
                  </button>
                </h2>
                {aberto && (
                  <ul className="border-t border-border">
                    {g.linhas.map((linha) => (
                      <LinhaDoMapa key={linha.assunto.id} linha={linha} />
                    ))}
                  </ul>
                )}
              </Card>
            )
          })
        )}
      </div>
    </>
  )
}

function ResumoNiveis({ porNivel }: { porNivel: [number, number, number, number] }) {
  const rotulo = porNivel
    .map((n, i) => (n > 0 ? `${n} ${NIVEIS[i].toLowerCase()}` : null))
    .filter(Boolean)
    .join(', ')
  const bordas = [
    'border-nivel-0 text-subtle',
    'border-nivel-1 text-muted',
    'border-nivel-2 text-muted',
    'border-nivel-3 text-muted',
  ]
  return (
    <span className="flex items-center gap-1">
      <span className="sr-only">{rotulo || 'nenhum assunto estudado'}</span>
      {porNivel.map((n, i) =>
        n === 0 ? null : (
          <span
            key={i}
            aria-hidden="true"
            className={cn('text-caption num rounded-sm px-1.5 py-0.5 border', bordas[i])}
          >
            {n}
          </span>
        ),
      )}
    </span>
  )
}

function LinhaDoMapa({ linha }: { linha: LinhaAssunto }) {
  const { sessao, iniciar } = useSessao()
  const [aberto, setAberto] = useState(false)

  return (
    <li className={cn('border-b border-border last:border-b-0 pl-3', classeArestaNivel(linha.nivel))}>
      <div className="flex flex-col gap-2 p-3">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="text-left min-h-[44px] flex flex-col gap-1.5"
        >
          <span className="text-body text-text">{linha.assunto.nome}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <NivelMeter nivel={linha.nivel} />
            <span className="text-caption text-subtle num">
              {linha.minutos > 0 ? formatarMinutos(linha.minutos) : 'sem tempo registrado'}
            </span>
            <span className="text-caption text-subtle num">
              {linha.questoesNoAcervo > 0
                ? `${linha.questoesNoAcervo} questões`
                : 'sem questões no acervo'}
            </span>
          </span>
        </button>

        {aberto && (
          <div className="flex flex-col gap-3 pb-1">
            {linha.topicos.length > 0 && (
              <ul className="flex flex-col gap-1 border-l border-border pl-3">
                {linha.topicos.map((t) => (
                  <li key={t.id} className="text-sm text-muted">{t.nome}</li>
                ))}
              </ul>
            )}
            {!sessao && (
              <Button
                tamanho="sm"
                variante="outline"
                className="w-fit"
                onClick={() => void iniciar({ assuntoId: linha.assunto.id, blocoId: null, tipo: 'teoria' })}
              >
                Estudar este assunto
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
