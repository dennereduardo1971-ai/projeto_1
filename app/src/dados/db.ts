import Dexie, { type EntityTable } from 'dexie'
import type {
  Ajuste, Alternativa, Assunto, BlocoCiclo, Card, Cargo, Concurso, Disciplina,
  Edital, ItemEdital, ItemEditalAssunto, Plano, Prova, Questao, QuestaoAssunto,
  Resposta, Revisao, Sessao, TextoApoio,
} from './tipos'

/**
 * Banco local do Rito.
 *
 * Uma tabela por tabela do Postgres, com o mesmo nome. As tabelas de acervo
 * nascem vazias e só se enchem quando o pipeline de ingestão rodar.
 */
class BancoRito extends Dexie {
  disciplina!: EntityTable<Disciplina, 'id'>
  assunto!: EntityTable<Assunto, 'id'>

  concurso!: EntityTable<Concurso, 'id'>
  cargo!: EntityTable<Cargo, 'id'>
  edital!: EntityTable<Edital, 'id'>
  item_edital!: EntityTable<ItemEdital, 'id'>
  item_edital_assunto!: Dexie.Table<ItemEditalAssunto, [string, string]>

  prova!: EntityTable<Prova, 'id'>
  texto_apoio!: EntityTable<TextoApoio, 'id'>
  questao!: EntityTable<Questao, 'id'>
  alternativa!: EntityTable<Alternativa, 'id'>
  questao_assunto!: Dexie.Table<QuestaoAssunto, [string, string]>

  plano!: EntityTable<Plano, 'id'>
  bloco_ciclo!: EntityTable<BlocoCiclo, 'id'>
  sessao!: EntityTable<Sessao, 'id'>
  resposta!: EntityTable<Resposta, 'id'>
  card!: EntityTable<Card, 'id'>
  revisao!: Dexie.Table<Revisao, string>

  ajuste!: Dexie.Table<Ajuste, string>

  constructor() {
    super('rito')
    this.version(1).stores({
      disciplina: 'id, &slug, ordem',
      assunto: 'id, &slug, disciplina_id, pai_id, [disciplina_id+profundidade]',

      concurso: 'id, &slug, banca, ano',
      cargo: 'id, concurso_id',
      edital: 'id, cargo_id, vigente',
      item_edital: 'id, edital_id, disciplina_id, [edital_id+ordem]',
      item_edital_assunto: '[item_edital_id+assunto_id], item_edital_id, assunto_id',

      prova: 'id, concurso_id, cargo_id, formato',
      texto_apoio: 'id, prova_id',
      questao: 'id, prova_id, status, anulada, [prova_id+numero]',
      alternativa: 'id, questao_id',
      questao_assunto: '[questao_id+assunto_id], questao_id, assunto_id',

      plano: 'id, ativo',
      bloco_ciclo: 'id, plano_id, disciplina_id, [plano_id+ordem]',
      sessao: 'id, assunto_id, bloco_ciclo_id, inicio, fim',
      resposta: 'id, questao_id, [questao_id+tentativa], respondida_em',
      card: 'id, questao_id, assunto_id, origem',
      revisao: 'card_id, devida_em',

      ajuste: 'chave',
    })
  }
}

export const db = new BancoRito()

export function novoId(): string {
  return crypto.randomUUID()
}

export function agora(): string {
  return new Date().toISOString()
}
