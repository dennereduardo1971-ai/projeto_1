import { Link } from 'react-router-dom'
import { Button, Card, EstadoVazio, TopBar } from '@/ui'

/**
 * A tela ensina a leitura antes de existir o número — por isso não é tela morta.
 * Nenhum gráfico de mentira, nenhuma curva ilustrativa.
 */
const METRICAS = [
  {
    nome: 'Líquido por assunto',
    def: 'Acertos − erros. Aparece só em prova que pune o erro; em prova de múltipla escolha o campo fica vazio, porque ali o líquido não existe.',
  },
  {
    nome: 'Acerto bruto',
    def: 'Acertos sobre respondidas. Sem resposta nenhuma, mostra “—” em vez de 0% — número sem base engana.',
  },
  {
    nome: 'Falso domínio',
    def: 'Acertos marcados como “chutei” contra erros marcados como “tinha certeza”. É o que separa saber de ter tido sorte.',
  },
  {
    nome: 'Tipo de erro',
    def: 'Conteúdo desconhecido, leitura apressada, pegadinha semântica ou lei mudou. Erra-se por motivos diferentes e cada um pede remédio diferente.',
  },
  {
    nome: 'Tempo por assunto',
    def: 'Minutos registrados no ciclo. É a única métrica que já se move hoje.',
  },
]

export function Estatisticas() {
  return (
    <>
      <TopBar titulo="Estatísticas" />
      <div className="flex flex-col gap-4 py-4">
        <EstadoVazio
          motivo="acervo"
          titulo="Ainda não há respostas para medir."
          corpo="Sem questões no acervo não há desempenho para calcular. O que já se move é o tempo registrado no ciclo."
          acao={<Link to="/ciclo"><Button>Abrir o Ciclo</Button></Link>}
        />
        <Card className="p-4 flex flex-col gap-4">
          <h2 className="text-h3 font-semibold text-text">O que vai ser medido</h2>
          <dl className="flex flex-col gap-3">
            {METRICAS.map((m) => (
              <div key={m.nome} className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-text">{m.nome}</dt>
                <dd className="text-sm text-muted max-w-[var(--measure-read)]">{m.def}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  )
}
