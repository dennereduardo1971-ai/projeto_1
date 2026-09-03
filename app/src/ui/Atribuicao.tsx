import type { Atribuicao as Credito } from '@/dados/atribuicao'
import { cn } from '@/lib/cn'

/**
 * A linha de crédito da questão (regra 4 do `CLAUDE.md`).
 *
 * Fica discreta — é crédito, não conteúdo de estudo — mas nunca some: questão
 * sem origem visível é exatamente o que o projeto se comprometeu a não fazer.
 * Quando o dado falta, aparece o aviso em vez do silêncio.
 */
export function Atribuicao({ atribuicao, className }: { atribuicao: Credito; className?: string }) {
  return (
    <p
      className={cn(
        'text-caption',
        atribuicao.completa ? 'text-subtle' : 'text-warn-fg',
        className,
      )}
    >
      <span className="text-subtle">Fonte: </span>
      <cite className="not-italic">{atribuicao.linha}</cite>
      {atribuicao.origem === 'apostila_comentada' && atribuicao.completa && (
        <span className="text-subtle"> · apostila de terceiro</span>
      )}
    </p>
  )
}

/**
 * Assinatura do comentário. Só aparece quando o texto é de terceiro — é a
 * condição que sustenta a exceção temporária da regra 5: comentário de autor de
 * apostila pode ser exibido, mas nunca sem assinatura.
 */
export function AssinaturaComentario({ autor, titulo }: { autor: string; titulo?: string | null }) {
  return (
    <span className="block mt-2 text-caption opacity-80">
      Comentário de {autor}{titulo ? `, em ${titulo}` : ''}.
    </span>
  )
}
