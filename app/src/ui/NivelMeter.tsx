import { NIVEIS, type Nivel } from '@/dados/nivel'

/**
 * Os quatro níveis de domínio, distinguíveis SEM cor.
 *
 * Quatro canais redundantes: contagem de segmentos preenchidos, contorno
 * (tracejado no zero), o ✓ recortado no terceiro segmento do "dominado" e o
 * rótulo em texto de verdade na linha. A cor é o quarto canal e é dispensável.
 *
 * Teste de aceite: screenshot do Mapa em escala de cinza. Se dois níveis
 * ficarem iguais, este componente está errado.
 */
interface Props {
  nivel: Nivel
  comRotulo?: boolean
}

export function NivelMeter({ nivel, comRotulo = true }: Props) {
  const cor = `var(--color-nivel-${nivel})`
  return (
    <span className="inline-flex items-center gap-2" data-nivel={nivel}>
      <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden="true" focusable="false">
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={i * 9}
            y="0.75"
            width="7"
            height="8.5"
            rx="2"
            fill={i < nivel ? cor : 'none'}
            stroke={i < nivel ? 'none' : 'var(--color-nivel-0)'}
            strokeWidth="1.5"
            strokeDasharray={nivel === 0 ? '2 2' : undefined}
          />
        ))}
        {nivel === 3 && (
          <path
            d="M19.6 5.2l1.4 1.5 2.6-2.9"
            stroke="var(--color-surface)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {comRotulo ? (
        <span className="text-sm text-subtle">{NIVEIS[nivel]}</span>
      ) : (
        <span className="sr-only">{NIVEIS[nivel]}</span>
      )}
    </span>
  )
}

/** A mesma informação na aresta da linha, legível de longe. */
export function classeArestaNivel(nivel: Nivel): string {
  return [
    'border-l border-dashed border-l-nivel-0',
    'border-l-2 border-l-nivel-1',
    'border-l-[3px] border-l-nivel-2',
    'border-l-[3px] border-l-nivel-3',
  ][nivel]
}
