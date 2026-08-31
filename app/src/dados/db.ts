import Dexie, { type EntityTable } from 'dexie'
import type {
  Ajuste, Alternativa, Assunto, BlocoCiclo, Cargo, Concurso, ConquistaUsuario, Disciplina,
  Edital, EstadoAssunto, EventoXP, ItemEdital, ItemEditalAssunto, Meta, Plano, Prova, Questao,
  QuestaoAssunto, Resposta, Sequencia, Sessao, TextoApoio,
} from './tipos'

/**
 * Banco local do Rito.
 *
 * Uma tabela por tabela do Postgres, com o mesmo nome. As tabelas de acervo
 * nascem vazias e só se enchem quando o pipeline de ingestão rodar.
 *
 * `estado_assunto`, `sequencia`, `evento_xp`, `conquista_usuario` e `meta`
 * substituem `card`/`revisao` desde 2026-08-31 (CLAUDE.md, regra 8) — motor
 * de domínio único por assunto, no molde do APP-CPA-YOHANNA.
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

  estado_assunto!: Dexie.Table<EstadoAssunto, string>
  sequencia!: Dexie.Table<Sequencia, string>
  evento_xp!: EntityTable<EventoXP, 'id'>
  conquista_usuario!: Dexie.Table<ConquistaUsuario, string>
  meta!: Dexie.Table<Meta, string>

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

    // v2 (2026-08-31): card/revisao (FSRS separado) saem; entram estado_assunto
    // e as tabelas de gamificação. CLAUDE.md regra 8.
    this.version(2)
      .stores({
        card: null,
        revisao: null,
        estado_assunto: 'assunto_id, revisar_em',
        // Chave de fora (sem campo `id` no tipo): 1 linha fixa sob 'local'
        // enquanto não há login — ver comentário no `.upgrade()` abaixo.
        sequencia: '',
        evento_xp: 'id, data',
        conquista_usuario: 'conquista_id, obtida_em',
        meta: '',
      })
      .upgrade(async (tx) => {
        // Sem usuário logado ainda, cada tabela de gamificação guarda 1 linha
        // fixa sob a chave 'local' — quando houver login, a chave vira usuario_id.
        await tx.table('sequencia').put({ atual: 0, recorde: 0, ultimo_dia: null, congelamentos: 0 }, 'local')
        await tx.table('meta').put({ minutos_dia: 0, questoes_dia: 0, dias_semana: 0, data_prova: null }, 'local')
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
