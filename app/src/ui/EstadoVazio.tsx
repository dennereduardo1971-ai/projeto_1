import type { ReactNode } from 'react'
import { Card } from './Card'

/**
 * "Nada" não é uma coisa só. Cada motivo pede uma tela diferente, e o motivo
 * é obrigatório justamente para impedir o vazio errado:
 *
 * - `acervo`   o PRODUTO ainda não tem o dado (não há questões ingeridas)
 * - `uso`      o produto tem, VOCÊ ainda não gerou (caderno de erros vazio)
 * - `filtro`   há dado, o filtro zerou
 * - `erro`     o carregamento falhou
 *
 * `carregando` não está aqui de propósito: skeleton nunca representa dado
 * inexistente. Skeleton eterno é a tela morta clássica.
 */
interface Props {
  motivo: 'acervo' | 'uso' | 'filtro' | 'erro'
  titulo: string
  corpo?: ReactNode
  /** Uma única ação primária, e ela leva a algo que funciona hoje. */
  acao?: ReactNode
  detalhe?: ReactNode
}

export function EstadoVazio({ motivo, titulo, corpo, acao, detalhe }: Props) {
  return (
    <Card className="p-6 flex flex-col gap-4" data-motivo={motivo}>
      <div className="flex flex-col gap-2">
        <h2 className="text-h3 font-semibold text-text">{titulo}</h2>
        {corpo && <div className="text-body text-muted max-w-[var(--measure-read)]">{corpo}</div>}
      </div>
      {detalhe}
      {acao && <div className="flex flex-wrap gap-2">{acao}</div>}
    </Card>
  )
}
