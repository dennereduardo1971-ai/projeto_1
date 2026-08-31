import type { EstadoAssunto, TipoErro } from '@/dados/tipos'

/**
 * Motor de domínio — Elo/IRT de um parâmetro, unificado com retenção estilo
 * FSRS num único estado por assunto (`EstadoAssunto`).
 *
 * Portado do motor do APP-CPA-YOHANNA (`src/lib/engine/mastery.ts`), adaptado
 * ao vocabulário do Rito: onde lá é "conceito", aqui é "assunto" — a árvore de
 * 2 níveis que o Rito já tem (`Disciplina → Assunto`), sem introduzir um
 * terceiro nível.
 *
 * Deliberadamente simples e auditável: com uma conta de duas linhas dá para
 * explicar por que o domínio subiu ou caiu. Um IRT de três parâmetros exigiria
 * milhares de respostas por questão para calibrar — e o acervo está começando.
 */

const DIA_MS = 86_400_000

/** Probabilidade de acerto dada a habilidade `theta` e a dificuldade `b`. */
export function probabilidadeAcerto(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-(theta - b)))
}

/** Passo de aprendizado: alto no início, estabiliza com a experiência. */
function fatorK(n: number): number {
  return 0.8 / (1 + n / 12)
}

/**
 * Peso do erro conforme o `tipo_erro` declarado (`dados/tipos.ts`).
 * Errar por leitura apressada não é o mesmo que não conhecer o conteúdo — e
 * tratar os dois igual degrada o modelo. Sem `tipo_erro` declarado, o peso é
 * cheio (o mesmo comportamento de antes de existir a taxonomia de erro).
 */
export const PESO_TIPO_ERRO: Record<TipoErro, number> = {
  conteudo_desconhecido: 1,
  leitura_apressada: 0.45,
  pegadinha_semantica: 0.8,
  lei_mudou: 0.5,
  outro: 1,
}

export function estadoInicial(assuntoId: string): EstadoAssunto {
  return {
    assunto_id: assuntoId,
    theta: 0,
    // Sem informação, a estimativa honesta é 50% — é o que `theta = 0`
    // significa. O "0% de domínio" da interface vem de `n === 0`, tratado em
    // `dominioEfetivo`; deixar `m` em 0 aqui tornaria o primeiro erro um
    // ganho de domínio.
    m: 0.5,
    n: 0,
    acertos: 0,
    estabilidade: 1,
    ultima_pratica: null,
    revisar_em: null,
    esquema_concluido: false,
    erros_abertos: 0,
  }
}

export interface ResultadoAtualizacao {
  estado: EstadoAssunto
  /** Variação do domínio, para exibir feedback ao usuário. */
  deltaM: number
}

/**
 * Atualiza o estado do assunto após uma resposta.
 * `b` é a dificuldade latente da questão (`questao.dificuldade_b`); `tipoErro`
 * só é usado em erros.
 */
export function registrarResposta(
  anterior: EstadoAssunto,
  acertou: boolean,
  b: number,
  agoraMs: number,
  tipoErro?: TipoErro | null,
): ResultadoAtualizacao {
  const p = probabilidadeAcerto(anterior.theta, b)
  const y = acertou ? 1 : 0
  const peso = acertou ? 1 : (tipoErro ? PESO_TIPO_ERRO[tipoErro] : 1)
  const k = fatorK(anterior.n)

  const theta = anterior.theta + k * peso * (y - p)
  const n = anterior.n + 1
  const acertos = anterior.acertos + (acertou ? 1 : 0)

  // Domínio: chance de acertar uma questão de dificuldade média.
  const m = probabilidadeAcerto(theta, 0)

  // Estabilidade da memória: cresce com acerto, encolhe com erro.
  const estabilidade = acertou
    ? Math.min(180, Math.max(1, anterior.estabilidade * (1.6 + m * 0.8)))
    : Math.max(0.5, anterior.estabilidade * 0.4)

  return {
    estado: {
      ...anterior,
      theta,
      n,
      acertos,
      m,
      estabilidade,
      ultima_pratica: new Date(agoraMs).toISOString(),
      revisar_em: new Date(agoraMs + estabilidade * DIA_MS).toISOString(),
      erros_abertos: acertou
        ? Math.max(0, anterior.erros_abertos - 1)
        : anterior.erros_abertos + 1,
    },
    deltaM: m - anterior.m,
  }
}

/**
 * Retenção estimada — curva de esquecimento em potência (FSRS).
 * Retorna 1 logo após a prática e decai conforme a estabilidade.
 */
export function retencao(estado: EstadoAssunto, agoraMs: number): number {
  if (!estado.ultima_pratica) return 0
  const dias = (agoraMs - new Date(estado.ultima_pratica).getTime()) / DIA_MS
  if (dias <= 0) return 1
  return 1 / (1 + dias / (9 * Math.max(estado.estabilidade, 0.5)))
}

/**
 * Domínio efetivo: o quanto ainda está acessível na memória.
 * O piso de 0,35 evita modelar como zerado o que foi bem aprendido.
 */
export function dominioEfetivo(estado: EstadoAssunto, agoraMs: number): number {
  if (!estado.n) return 0
  return estado.m * Math.max(retencao(estado, agoraMs), 0.35)
}

export type NivelDominio = 'inicial' | 'desenvolvimento' | 'intermediario' | 'bom' | 'dominado'

export function nivelDominio(valor: number): NivelDominio {
  if (valor >= 0.9) return 'dominado'
  if (valor >= 0.75) return 'bom'
  if (valor >= 0.6) return 'intermediario'
  if (valor >= 0.4) return 'desenvolvimento'
  return 'inicial'
}

export const ROTULO_NIVEL: Record<NivelDominio, string> = {
  inicial: 'Inicial',
  desenvolvimento: 'Em desenvolvimento',
  intermediario: 'Intermediário',
  bom: 'Bom',
  dominado: 'Dominado',
}

/** Dificuldade sugerida para manter a chance de acerto perto de 80%. */
export function dificuldadeAlvo(theta: number): number {
  // b tal que P(acerto) = 0,8  =>  b = theta - ln(4)
  return theta - Math.log(4)
}
