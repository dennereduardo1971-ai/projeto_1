// Agendamento de revisões.
//
// INTERINO: implementação compacta inspirada no FSRS, sem dependência, para o app rodar
// sem build. A decisão do projeto é usar `ts-fsrs` quando entrar o Supabase e o bundler
// (ver docs/agents/dados.md). O estado guardado aqui já é o do FSRS — estabilidade,
// dificuldade, data devida — então a troca depois não perde histórico.

const DIA = 86400000;

export const NOTAS = [
  { n: 1, rot: "Errei",   desc: "não lembrei" },
  { n: 2, rot: "Difícil", desc: "lembrei com esforço" },
  { n: 3, rot: "Bom",     desc: "lembrei" },
  { n: 4, rot: "Fácil",   desc: "imediato" },
];

export function novoCard(base) {
  return { estab: 1, dific: 5, devidaEm: Date.now(), ultimaNota: null, revisoes: 0, ...base };
}

export function agendar(card, nota, agora = Date.now()) {
  const dific = Math.min(10, Math.max(1, card.dific + (3 - nota) * 0.6));
  let estab;
  if (nota === 1) {
    estab = Math.max(0.4, card.estab * 0.4);          // lapso: encolhe, não zera
  } else {
    const facilidade = { 2: 1.25, 3: 1.9, 4: 2.7 }[nota];
    const freio = 1 - (dific - 5) * 0.06;              // card difícil cresce mais devagar
    estab = Math.max(0.6, card.estab * facilidade * freio);
  }
  const intervalo = nota === 1 ? Math.min(estab, 1) : estab;
  return {
    ...card,
    dific: +dific.toFixed(2),
    estab: +estab.toFixed(2),
    ultimaNota: nota,
    revisoes: (card.revisoes || 0) + 1,
    devidaEm: agora + Math.round(intervalo * DIA),
  };
}

export const estaDevido = (card, agora = Date.now()) => card.devidaEm <= agora;

export function textoIntervalo(card) {
  const d = Math.round((card.devidaEm - Date.now()) / DIA);
  if (d <= 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d < 30) return `em ${d} dias`;
  return `em ${Math.round(d / 30)} meses`;
}
