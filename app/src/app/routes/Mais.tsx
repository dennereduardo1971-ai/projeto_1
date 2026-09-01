import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { estadoAcervo, todosEstados, type EstadoAcervo } from '@/dados/consultas'
import { baixarBackup, importar, BackupInvalido } from '@/dados/backup'
import { carregarExemplo, removerExemplo, temExemplo } from '@/dados/exemplo'
import { filaDeRevisao } from '@/features/dominio/scheduler'
import { obterPerfil, RITMOS } from '@/features/perfil/perfil'
import type { Perfil } from '@/features/perfil/tipos'
import { ThemeToggle } from '@/features/tema/ThemeToggle'
import { Button, Card, InlineAlert, TopBar } from '@/ui'

const rotuloFonte = (f: EstadoAcervo['fontes'][number]) =>
  f.origemFonte === 'prova_oficial'
    ? `${f.banca ?? 'banca não informada'}`
    : `${f.autorFonte ?? 'autor não informado'} — ${f.tituloFonte ?? 'título não informado'}`

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
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)

  const recarregar = async () => {
    const [estado, exemplo, estados, p] = await Promise.all([
      estadoAcervo(), temExemplo(), todosEstados(), obterPerfil(),
    ])
    setAcervo(estado)
    setComExemplo(exemplo)
    setRevisoesDevidas(filaDeRevisao(estados, Date.now()).length)
    setPerfil(p)
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
        {perfil && (
          <Card>
            {/* Leva de volta a `/bemvindo`, que se abre em modo edição quando já
                existe perfil — não há um segundo formulário para sair de sincronia. */}
            <Link
              to="/bemvindo"
              className="flex items-center justify-between gap-3 p-4 min-h-[44px] hover:bg-surface-2"
            >
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="text-body font-medium text-text truncate">{perfil.nome}</span>
                <span className="text-caption text-subtle">
                  Ritmo {RITMOS[perfil.ritmo].rotulo.toLowerCase()} · {RITMOS[perfil.ritmo].descricao}
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-caption text-subtle">editar</span>
                <span aria-hidden="true" className="text-muted">›</span>
              </span>
            </Link>
          </Card>
        )}

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

        {acervo && acervo.provas > 0 && (
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-h3 font-semibold text-text">Acervo</h2>
              <p className="text-sm text-muted max-w-[var(--measure-read)]">
                {acervo.questoesPublicadas} questão{acervo.questoesPublicadas === 1 ? '' : 'ões'} publicada
                {acervo.questoesPublicadas === 1 ? '' : 's'} em {acervo.provas} prova
                {acervo.provas === 1 ? '' : 's'}
                {acervo.anuladas > 0 && `, ${acervo.anuladas} anulada${acervo.anuladas === 1 ? '' : 's'} (fora da estatística)`}.
              </p>
            </div>
            {acervo.fontes.length > 0 && (
              <ul className="flex flex-col gap-1 text-caption text-subtle">
                {acervo.fontes.map((f) => (
                  <li key={`${f.origemFonte}-${f.banca ?? ''}-${f.autorFonte ?? ''}-${f.tituloFonte ?? ''}`}>
                    {rotuloFonte(f)} · {f.questoes} questão{f.questoes === 1 ? '' : 'ões'}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-h3 font-semibold text-text">Questões de exemplo</h2>
            <p className="text-sm text-muted max-w-[var(--measure-read)]">
              Dez questões escritas para este projeto — não são de prova e não têm banca. Servem só
              para exercitar o laço de resolver, errar e revisar, independente do acervo real acima.
              Remover apaga também as respostas e o domínio de assunto que vieram delas.
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
            Sem conta · o acervo publicado pelo pipeline de ingestão entra sozinho ao abrir o app.
          </p>
        </Card>
      </div>
    </>
  )
}
