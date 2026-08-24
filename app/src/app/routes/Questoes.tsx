import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { estadoAcervo, type EstadoAcervo } from '@/dados/consultas'
import { AVISO_EXEMPLO, carregarExemplo, ehExemplo, temExemplo } from '@/dados/exemplo'
import {
  placar, proximaQuestao, responder,
  type Placar, type QuestaoCompleta, type Veredito,
} from '@/features/questoes/pratica'
import type { Confianca } from '@/dados/tipos'
import { Button, Card, EstadoVazio, InlineAlert, Stat, TopBar } from '@/ui'

const CONFIANCAS: { valor: Confianca; rotulo: string }[] = [
  { valor: 'chutei', rotulo: 'Chutei' },
  { valor: 'duvida', rotulo: 'Fiquei na dúvida' },
  { valor: 'certeza', rotulo: 'Tinha certeza' },
]

const CE = [
  { letra: 'C', texto: 'Certo' },
  { letra: 'E', texto: 'Errado' },
]

export function Questoes() {
  const [acervo, setAcervo] = useState<EstadoAcervo | null>(null)
  const [comExemplo, setComExemplo] = useState(false)
  const [alvo, setAlvo] = useState<QuestaoCompleta | null>(null)
  const [marcada, setMarcada] = useState<string | null>(null)
  const [confianca, setConfianca] = useState<Confianca | null>(null)
  const [veredito, setVeredito] = useState<Veredito | null>(null)
  const [sessao, setSessao] = useState<{ correta: boolean }[]>([])
  const [carregando, setCarregando] = useState(true)

  const puxar = useCallback(async () => {
    const [estado, exemploAtivo, proxima] = await Promise.all([
      estadoAcervo(), temExemplo(), proximaQuestao(),
    ])
    setAcervo(estado)
    setComExemplo(exemploAtivo)
    setAlvo(proxima)
    setMarcada(null)
    setConfianca(null)
    setVeredito(null)
    setCarregando(false)
  }, [])

  useEffect(() => { void puxar() }, [puxar])

  async function confirmar() {
    if (!alvo || !marcada || !confianca) return
    const v = await responder(alvo, marcada, confianca)
    setVeredito(v)
    setSessao((s) => [...s, { correta: v.correta }])
  }

  async function carregarAndaime() {
    setCarregando(true)
    await carregarExemplo()
    await puxar()
  }

  if (carregando) return <><TopBar titulo="Questões" /><div className="py-4 text-sm text-muted">Carregando…</div></>

  // ---------------------------------------------------------------- sem acervo
  if (!alvo) {
    return (
      <>
        <TopBar titulo="Questões" />
        <div className="flex flex-col gap-4 py-4">
          <EstadoVazio
            motivo="acervo"
            titulo="Nenhuma questão no acervo ainda."
            corpo="As questões vêm de provas oficiais em PDF. Uma questão só é publicada depois de casar com o gabarito definitivo da banca — sem isso, ela nem entra."
            detalhe={
              <Card className="p-4 grid grid-cols-3 gap-4">
                <Stat rotulo="Provas ingeridas" valor={String(acervo?.provas ?? 0)} />
                <Stat rotulo="Questões publicadas" valor={String(acervo?.questoesPublicadas ?? 0)} />
                <Stat rotulo="Anuladas" valor={String(acervo?.anuladas ?? 0)} nota="fora da estatística" />
              </Card>
            }
            acao={<Button onClick={() => void carregarAndaime()}>Carregar questões de exemplo</Button>}
          />

          <Card className="p-4 flex flex-col gap-3">
            <h2 className="text-h3 font-semibold text-text">Como as questões reais entram</h2>
            <ol className="flex flex-col gap-2 text-sm text-muted list-decimal pl-5">
              <li>Você baixa o PDF da prova e o gabarito definitivo do site da banca.</li>
              <li>Larga os dois em <code className="text-mono text-caption">data/00_manual/&lt;slug&gt;/</code>, sem renomear.</li>
              <li>Roda <code className="text-mono text-caption">python scripts/ingest/run.py &lt;slug&gt;</code>.</li>
              <li>O pipeline extrai, segmenta, casa com o gabarito e classifica por assunto.</li>
              <li>Classificação duvidosa vai para a sua fila de revisão, não para o ar.</li>
              <li>Só então a questão aparece aqui, com banca, ano, órgão, cargo e número originais.</li>
            </ol>
          </Card>
        </div>
      </>
    )
  }

  // ---------------------------------------------------------------- praticando
  const { questao, prova, alternativas, assunto } = alvo
  const opcoes = prova.formato === 'ce' ? CE : alternativas
  const p: Placar = placar(sessao, prova.penalidade_por_erro)

  const estilo = (letra: string) => {
    const base = 'w-full text-left rounded-md border px-4 py-3 text-sm transition-colors min-h-11'
    if (!veredito) {
      return marcada === letra
        ? `${base} border-primary bg-primary/10 text-text`
        : `${base} border-border bg-surface text-text hover:border-border-strong`
    }
    if (letra === questao.gabarito) return `${base} border-ok bg-ok-bg text-ok-fg`
    if (letra === marcada) return `${base} border-err bg-err-bg text-err-fg`
    return `${base} border-border bg-surface text-muted`
  }

  return (
    <>
      <TopBar titulo="Questões" />
      <div className="flex flex-col gap-4 py-4">
        {ehExemplo(prova.id) && (
          <InlineAlert tom="warn" titulo="Questões de exemplo">
            {AVISO_EXEMPLO}
          </InlineAlert>
        )}

        <Card className="p-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-subtle">
            <span>{assunto?.nome ?? 'sem assunto vinculado'}</span>
            <span>·</span>
            <span>{prova.formato === 'ce' ? 'certo/errado' : 'múltipla escolha'}</span>
            {prova.penalidade_por_erro && <><span>·</span><span>erro anula acerto</span></>}
          </div>

          <p className="text-base leading-relaxed text-text">{questao.enunciado}</p>

          <div className="flex flex-col gap-2">
            {opcoes.map((o) => (
              <button
                key={o.letra}
                type="button"
                className={estilo(o.letra)}
                disabled={!!veredito}
                onClick={() => setMarcada(o.letra)}
              >
                {prova.formato !== 'ce' && <span className="text-mono text-caption mr-2 text-primary">{o.letra}</span>}
                {o.texto}
              </button>
            ))}
          </div>

          {!veredito ? (
            <div className="flex flex-col gap-2">
              <span className="text-caption text-subtle">Antes de confirmar: quanta certeza você tem?</span>
              <div className="flex flex-wrap gap-2">
                {CONFIANCAS.map((c) => (
                  <Button
                    key={c.valor}
                    variante={confianca === c.valor ? 'primary' : 'outline'}
                    tamanho="sm"
                    onClick={() => setConfianca(c.valor)}
                  >
                    {c.rotulo}
                  </Button>
                ))}
              </div>
              <Button
                largura="cheia"
                disabled={!marcada || !confianca}
                onClick={() => void confirmar()}
              >
                Confirmar
              </Button>
              {marcada && !confianca && (
                <span className="text-caption text-subtle">
                  A confiança é o que separa domínio de sorte — sem ela a resposta não conta direito.
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <InlineAlert tom={veredito.correta ? 'ok' : 'err'} titulo={veredito.correta ? 'Certo.' : `Errou — gabarito ${veredito.gabarito}.`}>
                {veredito.comentario}
                {veredito.virouCard && (
                  <span className="block mt-2 text-caption">Entrou na sua fila de revisão.</span>
                )}
                {veredito.correta && confianca === 'chutei' && (
                  <span className="block mt-2 text-caption">Acertou chutando — isso não conta como domínio no Mapa.</span>
                )}
              </InlineAlert>
              <Button largura="cheia" onClick={() => void puxar()}>Próxima</Button>
            </div>
          )}
        </Card>

        {p.respondidas > 0 && (
          <Card className="p-4 grid grid-cols-3 gap-4">
            <Stat rotulo="Nesta sessão" valor={String(p.respondidas)} unidade="q" />
            <Stat rotulo="Acertos" valor={`${p.acertos}`} nota={`${p.erros} erros`} />
            <Stat
              rotulo={p.liquido !== null ? 'Placar líquido' : 'Percentual'}
              valor={p.liquido !== null ? String(p.liquido) : `${p.percentual}%`}
              nota={p.liquido !== null ? 'acertos − erros' : 'sem penalidade'}
            />
          </Card>
        )}

        {comExemplo && (
          <p className="text-caption text-subtle">
            Terminou de testar? Tire as questões de exemplo em <Link className="underline" to="/mais">Mais</Link>.
          </p>
        )}
      </div>
    </>
  )
}
