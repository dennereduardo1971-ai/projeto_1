import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { estadoAcervo, todosEstados, type EstadoAcervo } from '@/dados/consultas'
import { baixarBackup, importar, BackupInvalido } from '@/dados/backup'
import { carregarExemplo, removerExemplo, temExemplo } from '@/dados/exemplo'
import { filaDeRevisao } from '@/features/dominio/scheduler'
import { ThemeToggle } from '@/features/tema/ThemeToggle'
import { Button, Card, InlineAlert, TopBar } from '@/ui'

/**
 * Nada some da navegação: Questões e Estatísticas ficam aqui com selo de estado
 * e sobem para a barra quando tiverem conteúdo. Item que aparece e desaparece
 * destrói o mapa mental de quem usa o app todo dia.
 */
export function Mais() {
  const [acervo, setAcervo] = useState<EstadoAcervo | null>(null)
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'err'; texto: string } | null>(null)
  const [comExemplo, setComExemplo] = useState(false)
  const [revisoesDevidas, setRevisoesDevidas] = useState(0)
  const arquivo = useRef<HTMLInputElement>(null)

  const recarregar = async () => {
    const [estado, exemplo, estados] = await Promise.all([
      estadoAcervo(), temExemplo(), todosEstados(),
    ])
    setAcervo(estado)
    setComExemplo(exemplo)
    setRevisoesDevidas(filaDeRevisao(estados, Date.now()).length)
  }

  useEffect(() => { void recarregar() }, [])

  const semAcervo = (acervo?.questoesPublicadas ?? 0) === 0

  const aoEscolherArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const { registros } = await importar(await f.text())
      setAviso({ tom: 'ok', texto: `Importado: ${registros} registros. Recarregue a tela para ver.` })
    } catch (erro) {
      setAviso({
        tom: 'err',
        texto: erro instanceof BackupInvalido ? erro.message : 'Não foi possível ler o arquivo.',
      })
    } finally {
      e.target.value = ''
    }
  }

  const destinos = [
    { para: '/questoes', rotulo: 'Questões', selo: semAcervo ? 'sem acervo' : null },
    { para: '/estatisticas', rotulo: 'Estatísticas', selo: semAcervo ? 'sem dados' : null },
    { para: '/caderno', rotulo: 'Caderno de erros', selo: semAcervo ? 'sem acervo' : null },
    { para: '/revisao', rotulo: 'Revisão', selo: revisoesDevidas ? `${revisoesDevidas} devida${revisoesDevidas === 1 ? '' : 's'}` : null },
  ]

  return (
    <>
      <TopBar titulo="Mais" />
      <div className="flex flex-col gap-4 py-4">
        <Card>
          <ul>
            {destinos.map((d) => (
              <li key={d.para} className="border-b border-border last:border-b-0">
                <Link
                  to={d.para}
                  className="flex items-center justify-between gap-3 p-4 min-h-[44px] hover:bg-surface-2"
                >
                  <span className="text-body text-text">{d.rotulo}</span>
                  <span className="flex items-center gap-2">
                    {d.selo && <span className="text-caption text-subtle">{d.selo}</span>}
                    <span aria-hidden="true" className="text-muted">›</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-h3 font-semibold text-text">Seu progresso</h2>
            <p className="text-sm text-muted max-w-[var(--measure-read)]">
              Sem conta, tudo fica gravado neste navegador. Limpar os dados do site apaga o progresso
              e não há como recuperar. Exporte de vez em quando — o mesmo arquivo leva seu histórico
              para outro aparelho e vai migrar para a conta quando houver login.
            </p>
          </div>
          {aviso && <InlineAlert tom={aviso.tom}>{aviso.texto}</InlineAlert>}
          <div className="flex flex-wrap gap-2">
            <Button variante="outline" onClick={() => void baixarBackup()}>Exportar arquivo</Button>
            <Button variante="outline" onClick={() => arquivo.current?.click()}>Importar arquivo</Button>
            <input
              ref={arquivo}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => void aoEscolherArquivo(e)}
            />
          </div>
          <p className="text-caption text-subtle">
            Importar substitui o que está neste aparelho pelo conteúdo do arquivo.
          </p>
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-h3 font-semibold text-text">Questões de exemplo</h2>
            <p className="text-sm text-muted max-w-[var(--measure-read)]">
              Dez questões escritas para este projeto — não são de prova e não têm banca. Existem só
              para você exercitar o laço de resolver, errar e revisar enquanto o acervo Cebraspe não
              é ingerido. Remover apaga também as respostas e o domínio de assunto que vieram delas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {comExemplo ? (
              <Button
                variante="danger"
                onClick={async () => {
                  await removerExemplo()
                  await recarregar()
                  setAviso({ tom: 'ok', texto: 'Questões de exemplo removidas.' })
                }}
              >
                Remover exemplo
              </Button>
            ) : (
              <Button
                variante="outline"
                onClick={async () => {
                  const n = await carregarExemplo()
                  await recarregar()
                  setAviso({ tom: 'ok', texto: `${n} questões de exemplo carregadas.` })
                }}
              >
                Carregar exemplo
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <ThemeToggle />
        </Card>

        <Card className="p-4 flex flex-col gap-2">
          <h2 className="text-h3 font-semibold text-text">Sobre</h2>
          <p className="text-sm text-muted max-w-[var(--measure-read)]">
            Rito organiza o estudo para concurso em volta de uma ideia: uma linha do edital carrega o
            esquema de leitura, as questões que já caíram, o seu desempenho e as revisões agendadas.
          </p>
          <p className="text-caption text-subtle">
            Sem conta · acervo real entra pelo pipeline de ingestão.
          </p>
        </Card>
      </div>
    </>
  )
}
