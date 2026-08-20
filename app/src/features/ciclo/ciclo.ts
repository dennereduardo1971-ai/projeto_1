import { agora, db, novoId } from '@/dados/db'
import { minutosEntre } from '@/lib/tempo'
import type { BlocoCiclo, Plano, Sessao, TipoSessao } from '@/dados/tipos'

/**
 * Ciclo de estudos: uma fila que não pune atraso.
 *
 * Não existe "dia certo" para um bloco. O bloco da vez é o de menor número de
 * voltas — quem sumiu uma semana volta exatamente de onde parou, sem dívida
 * acumulada e sem replanejamento.
 */

export async function garantirPlano(): Promise<Plano> {
  const ativo = await db.plano.filter((p) => p.ativo).first()
  if (ativo) return ativo
  const plano: Plano = {
    id: novoId(),
    edital_id: null,
    tipo: 'ciclo',
    horas_semana: null,
    data_prova: null,
    ativo: true,
  }
  await db.plano.add(plano)
  return plano
}

export async function listarBlocos(): Promise<BlocoCiclo[]> {
  const plano = await garantirPlano()
  const blocos = await db.bloco_ciclo.where('plano_id').equals(plano.id).toArray()
  return blocos.sort((a, b) => a.ordem - b.ordem)
}

export async function adicionarBloco(disciplinaId: string, minutos: number): Promise<BlocoCiclo> {
  const plano = await garantirPlano()
  const blocos = await listarBlocos()
  const bloco: BlocoCiclo = {
    id: novoId(),
    plano_id: plano.id,
    disciplina_id: disciplinaId,
    minutos,
    ordem: (blocos.at(-1)?.ordem ?? 0) + 1,
    peso: 1,
    voltas: 0,
  }
  await db.bloco_ciclo.add(bloco)
  return bloco
}

export async function removerBloco(id: string): Promise<void> {
  await db.bloco_ciclo.delete(id)
}

export async function moverBloco(id: string, direcao: -1 | 1): Promise<void> {
  const blocos = await listarBlocos()
  const i = blocos.findIndex((b) => b.id === id)
  const j = i + direcao
  if (i < 0 || j < 0 || j >= blocos.length) return
  const a = blocos[i]
  const b = blocos[j]
  await db.transaction('rw', db.bloco_ciclo, async () => {
    await db.bloco_ciclo.update(a.id, { ordem: b.ordem })
    await db.bloco_ciclo.update(b.id, { ordem: a.ordem })
  })
}

/** O bloco da vez: menos voltas fechadas; empate desempata pela ordem. */
export async function blocoDaVez(): Promise<BlocoCiclo | null> {
  const blocos = await listarBlocos()
  if (blocos.length === 0) return null
  return blocos.reduce((melhor, b) =>
    b.voltas < melhor.voltas || (b.voltas === melhor.voltas && b.ordem < melhor.ordem) ? b : melhor,
  )
}

export async function sessaoAberta(): Promise<Sessao | null> {
  return (await db.sessao.filter((s) => s.fim === null).first()) ?? null
}

export async function iniciarSessao(entrada: {
  assuntoId: string | null
  blocoId: string | null
  tipo: TipoSessao
}): Promise<Sessao> {
  const jaAberta = await sessaoAberta()
  if (jaAberta) return jaAberta
  const sessao: Sessao = {
    id: novoId(),
    bloco_ciclo_id: entrada.blocoId,
    assunto_id: entrada.assuntoId,
    tipo: entrada.tipo,
    inicio: agora(),
    fim: null,
    minutos: null,
    manual: false,
    nota: null,
  }
  await db.sessao.add(sessao)
  return sessao
}

export async function descartarSessao(id: string): Promise<void> {
  await db.sessao.delete(id)
}

export async function fecharSessao(id: string): Promise<Sessao | null> {
  const sessao = await db.sessao.get(id)
  if (!sessao || sessao.fim) return sessao ?? null
  const fim = agora()
  const minutos = minutosEntre(sessao.inicio, fim)
  await db.transaction('rw', db.sessao, db.bloco_ciclo, async () => {
    await db.sessao.update(id, { fim, minutos })
    if (sessao.bloco_ciclo_id) await fecharVoltaSeCompletou(sessao.bloco_ciclo_id)
  })
  return (await db.sessao.get(id)) ?? null
}

/** Lançar minutos à mão: o cronômetro esquecido não pode custar o registro. */
export async function registrarMinutos(entrada: {
  assuntoId: string | null
  blocoId: string | null
  tipo: TipoSessao
  minutos: number
  quando?: Date
}): Promise<Sessao> {
  const fim = entrada.quando ?? new Date()
  const inicio = new Date(fim.getTime() - entrada.minutos * 60000)
  const sessao: Sessao = {
    id: novoId(),
    bloco_ciclo_id: entrada.blocoId,
    assunto_id: entrada.assuntoId,
    tipo: entrada.tipo,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    minutos: entrada.minutos,
    manual: true,
    nota: null,
  }
  await db.transaction('rw', db.sessao, db.bloco_ciclo, async () => {
    await db.sessao.add(sessao)
    if (entrada.blocoId) await fecharVoltaSeCompletou(entrada.blocoId)
  })
  return sessao
}

/** Fecha a volta do bloco quando os minutos acumulados desde a última alcançam a meta. */
async function fecharVoltaSeCompletou(blocoId: string): Promise<void> {
  const bloco = await db.bloco_ciclo.get(blocoId)
  if (!bloco) return
  const sessoes = await db.sessao.where('bloco_ciclo_id').equals(blocoId).toArray()
  const total = sessoes.reduce((s, x) => s + (x.minutos ?? 0), 0)
  const voltas = Math.floor(total / bloco.minutos)
  if (voltas !== bloco.voltas) await db.bloco_ciclo.update(blocoId, { voltas })
}

export async function minutosDoBloco(blocoId: string, minutosMeta: number): Promise<number> {
  const sessoes = await db.sessao.where('bloco_ciclo_id').equals(blocoId).toArray()
  const total = sessoes.reduce((s, x) => s + (x.minutos ?? 0), 0)
  return total % minutosMeta
}
