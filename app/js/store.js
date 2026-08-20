// Estado local do app. Sem backend por enquanto: tudo em localStorage.
// Quando o Supabase entrar, este módulo vira a camada de sincronização.

import { novoCard, agendar, estaDevido } from "./srs.js";

const CHAVE = "grifo.v1";
const vazio = () => ({
  versao: 1,
  criadoEm: Date.now(),
  respostas: [],   // {qid, assuntoId, correta, confianca, formato, penalidade, ts}
  cards: [],       // card do srs + {id, assuntoId, qid, frente, verso}
  sessoes: [],     // {disciplinaId, minutos, tipo, ts}
  ciclo: [],       // {disciplinaId, alvo, feitos}
  vistos: {},      // assuntoId -> índice da próxima questão
});

export const S = {
  edital: null,
  bancoQuestoes: [],   // questões achatadas, já com dados da prova
  avisoAcervo: "",
  dados: vazio(),
};

const salvarAgora = () => localStorage.setItem(CHAVE, JSON.stringify(S.dados));
let pendente = null;
export function salvar() {                    // agrupa gravações seguidas
  clearTimeout(pendente);
  pendente = setTimeout(salvarAgora, 120);
}

export async function iniciar() {
  const [edital, questoes] = await Promise.all([
    fetch("data/edital-afrfb.json").then((r) => r.json()),
    fetch("data/questoes-exemplo.json").then((r) => r.json()),
  ]);
  S.edital = edital;
  S.avisoAcervo = questoes.aviso || "";
  S.bancoQuestoes = questoes.provas.flatMap((p) =>
    p.questoes.map((q) => ({
      ...q,
      provaId: p.id, banca: p.banca, ano: p.ano, orgao: p.orgao, cargo: p.cargo,
      formato: p.formato, penalidade: p.penalidade_por_erro, origem: p.origem,
    }))
  );

  const bruto = localStorage.getItem(CHAVE);
  S.dados = bruto ? { ...vazio(), ...JSON.parse(bruto) } : vazio();
  if (!S.dados.ciclo.length) S.dados.ciclo = cicloPadrao();
  salvar();
}

function cicloPadrao() {
  // Ciclo, não cronograma: fila de blocos que espera por você (docs/03-plano-do-produto.md).
  return S.edital.disciplinas
    .slice()
    .sort((a, b) => b.peso - a.peso)
    .map((d) => ({ disciplinaId: d.id, alvo: d.peso >= 10 ? 60 : d.peso >= 8 ? 45 : 30, feitos: 0 }));
}

/* ---------- consultas ---------- */

export const disciplinas = () => S.edital.disciplinas;
export const assuntos = () => S.edital.disciplinas.flatMap((d) => d.assuntos.map((a) => ({ ...a, disciplina: d })));
export const acharAssunto = (id) => assuntos().find((a) => a.id === id);
export const acharDisciplina = (id) => S.edital.disciplinas.find((d) => d.id === id);
export const questoesDoAssunto = (id) => S.bancoQuestoes.filter((q) => q.assunto_id === id);

export function respostasDoAssunto(id) {
  return S.dados.respostas.filter((r) => r.assuntoId === id);
}

export function minutosDoAssunto(id) {
  const disc = assuntos().find((a) => a.id === id)?.disciplina;
  if (!disc) return 0;
  // sessões são registradas por disciplina; distribui entre os assuntos praticados
  const total = S.dados.sessoes.filter((s) => s.disciplinaId === disc.id).reduce((t, s) => t + s.minutos, 0);
  return Math.round(total / disc.assuntos.length);
}

// Nível é derivado, nunca digitado (invariante em docs/agents/dados.md).
export function nivel(assuntoId) {
  const rs = respostasDoAssunto(assuntoId);
  const min = minutosDoAssunto(assuntoId);
  if (!rs.length && !min) return 0;                                  // não estudado
  if (rs.length < 5) return 1;                                       // estudado
  const acerto = rs.filter((r) => r.correta).length / rs.length;
  const semChute = rs.filter((r) => r.correta && r.confianca !== "chutei").length / rs.length;
  if (rs.length >= 8 && acerto >= 0.75 && semChute >= 0.6) return 3; // dominado
  return 2;                                                          // praticado
}

export const SIMBOLO = ["○", "◔", "◑", "●"];
export const ROTULO = ["não estudado", "estudado", "praticado", "dominado"];

export function placar(respostas) {
  const certas = respostas.filter((r) => r.correta).length;
  const erradas = respostas.length - certas;
  const punido = respostas.some((r) => r.penalidade);
  return {
    certas, erradas, total: respostas.length, punido,
    liquido: certas - erradas,
    pct: respostas.length ? Math.round((certas / respostas.length) * 100) : 0,
  };
}

export const cardsDevidos = () => S.dados.cards.filter((c) => estaDevido(c));

export function proximaQuestao(assuntoId) {
  const pool = questoesDoAssunto(assuntoId);
  if (!pool.length) return null;
  const respondidas = new Set(respostasDoAssunto(assuntoId).map((r) => r.qid));
  return pool.find((q) => !respondidas.has(q.id)) || pool[(S.dados.vistos[assuntoId] || 0) % pool.length];
}

/* ---------- comandos ---------- */

export function registrarResposta(q, escolha, confianca) {
  const correta = escolha === q.gabarito;
  S.dados.respostas.push({
    qid: q.id, assuntoId: q.assunto_id, correta, confianca,
    formato: q.formato, penalidade: !!q.penalidade, ts: Date.now(),
  });
  S.dados.vistos[q.assunto_id] = (S.dados.vistos[q.assunto_id] || 0) + 1;

  // Todo erro vira revisão — é a regra que sustenta o produto.
  if (!correta && !S.dados.cards.some((c) => c.qid === q.id)) {
    S.dados.cards.push(
      novoCard({
        id: "c-" + q.id, qid: q.id, assuntoId: q.assunto_id,
        frente: q.enunciado,
        verso: q.comentario || `Gabarito: ${q.gabarito}`,
        gabarito: q.gabarito,
      })
    );
  }
  salvar();
  return correta;
}

export function revisar(cardId, nota) {
  const i = S.dados.cards.findIndex((c) => c.id === cardId);
  if (i < 0) return;
  S.dados.cards[i] = agendar(S.dados.cards[i], nota);
  salvar();
}

export function registrarSessao(disciplinaId, minutos, tipo = "teoria") {
  if (minutos <= 0) return;
  S.dados.sessoes.push({ disciplinaId, minutos, tipo, ts: Date.now() });
  const b = S.dados.ciclo.find((c) => c.disciplinaId === disciplinaId);
  if (b) b.feitos += minutos;
  if (S.dados.ciclo.every((c) => c.feitos >= c.alvo)) S.dados.ciclo.forEach((c) => (c.feitos = 0)); // fecha a volta
  salvar();
}

export const blocoAtual = () =>
  S.dados.ciclo.find((c) => c.feitos < c.alvo) || S.dados.ciclo[0];

export function diasSeguidos() {
  const dias = new Set(
    [...S.dados.sessoes.map((s) => s.ts), ...S.dados.respostas.map((r) => r.ts)]
      .map((t) => new Date(t).toDateString())
  );
  let n = 0;
  for (let i = 0; ; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (dias.has(d.toDateString())) n++;
    else if (i > 0) break;                 // hoje ainda pode estar vazio
  }
  return n;
}

export function exportar() {
  const blob = new Blob([JSON.stringify(S.dados, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `grifo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importar(texto) {
  const d = JSON.parse(texto);
  if (!d || typeof d !== "object" || !Array.isArray(d.respostas)) throw new Error("arquivo não parece um backup do app");
  S.dados = { ...vazio(), ...d };
  salvarAgora();
}

export function zerar() {
  localStorage.removeItem(CHAVE);
  S.dados = vazio();
  S.dados.ciclo = cicloPadrao();
  salvarAgora();
}
