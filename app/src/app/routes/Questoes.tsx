import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { estadoAcervo, type EstadoAcervo } from '@/dados/consultas'
import { Button, Card, EstadoVazio, Stat, TopBar } from '@/ui'

/**
 * Estado vazio de ACERVO: o produto ainda não tem o dado.
 *
 * Os contadores são consulta de verdade, não texto fixo. No dia em que a
 * primeira prova entrar, o número muda sozinho e este mesmo bloco vira o painel
 * de ingestão — o estado vazio não é jogado fora, ele cresce.
 */
export function Questoes() {
  const [acervo, setAcervo] = useState<EstadoAcervo | null>(null)
  useEffect(() => { void estadoAcervo().then(setAcervo) }, [])

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
          acao={<Link to="/mapa"><Button>Ver o Mapa</Button></Link>}
        />

        <Card className="p-4 flex flex-col gap-3">
          <h2 className="text-h3 font-semibold text-text">Como as questões entram</h2>
          <ol className="flex flex-col gap-2 text-sm text-muted list-decimal pl-5">
            <li>Você baixa o PDF da prova e o gabarito definitivo do site da banca.</li>
            <li>Larga os dois em <code className="text-mono text-caption">data/00_manual/&lt;slug&gt;/</code>, sem renomear.</li>
            <li>Roda <code className="text-mono text-caption">python scripts/ingest/run.py &lt;slug&gt;</code>.</li>
            <li>O pipeline extrai, segmenta, casa com o gabarito e classifica por assunto.</li>
            <li>Classificação com divergência entre as duas passadas vai para a sua fila de revisão.</li>
            <li>Só então a questão fica disponível aqui, com banca, ano, órgão, cargo e número originais.</li>
          </ol>
          <p className="text-caption text-subtle">
            Prova sem gabarito definitivo público não é publicada — para em “pendente_definitivo”.
          </p>
        </Card>
      </div>
    </>
  )
}
