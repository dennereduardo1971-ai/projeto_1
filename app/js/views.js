import * as St from "./store.js";
import { NOTAS, textoIntervalo } from "./srs.js";

const el = document.getElementById("app");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const min = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m}min`);
const pintar = (html) => (el.innerHTML = html);

/* ---------------- HOJE ---------------- */

export function hoje() {
  const devidos = St.cardsDevidos();
  const bloco = St.blocoAtual();
  const disc = St.acharDisciplina(bloco.disciplinaId);
  const hojeTs = new Date().toDateString();
  const respHoje = St.S.dados.respostas.filter((r) => new Date(r.ts).toDateString() === hojeTs);
  const minHoje = St.S.dados.sessoes.filter((s) => new Date(s.ts).toDateString() === hojeTs).reduce((t, s) => t + s.minutos, 0);

  pintar(`
    <h1>Hoje</h1>
    <p class="mut sm">${respHoje.length} questões · ${min(minHoje)} de estudo · ${St.diasSeguidos()} dias seguidos</p>

    <div class="card">
      <div class="row spread">
        <div class="grow">
          <h3>Revisar</h3>
          <p class="mut sm" style="margin:0">${devidos.length ? `${devidos.length} ${devidos.length === 1 ? "item vencido" : "itens vencidos"} — vieram dos seus erros` : "Nada vencido. A fila enche sozinha conforme você erra."}</p>
        </div>
        ${devidos.length ? `<button class="primary" data-ir="#/revisar">Começar</button>` : ""}
      </div>
    </div>

    <div class="card">
      <div class="row spread">
        <div class="grow">
          <h3>Bloco do ciclo</h3>
          <p class="mut sm" style="margin:0 0 8px">${esc(disc.nome)} — ${min(bloco.feitos)} de ${min(bloco.alvo)}</p>
          <div class="bar"><i style="width:${Math.min(100, (bloco.feitos / bloco.alvo) * 100)}%"></i></div>
        </div>
        <button data-ir="#/ciclo">Estudar</button>
      </div>
    </div>

    <div class="card">
      <div class="row spread">
        <div class="grow">
          <h3>Questões</h3>
          <p class="mut sm" style="margin:0">Resolver pelo assunto mais atrasado do edital.</p>
        </div>
        <button data-ir="#/questoes">Resolver</button>
      </div>
    </div>

    <h2>Prioridade agora</h2>
    ${prioridades()}
  `);
}

function prioridades() {
  const lista = St.assuntos()
    .map((a) => {
      const rs = St.respostasDoAssunto(a.id);
      const pct = rs.length ? rs.filter((r) => r.correta).length / rs.length : 0;
      const temQ = St.questoesDoAssunto(a.id).length;
      // pouco praticado e com muito peso na prova sobe; assunto sem questão no acervo desce
      const score = a.disciplina.peso * (1 - pct) * (rs.length < 5 ? 1.4 : 1) * (temQ ? 1 : 0.15);
      return { a, rs, pct, temQ, score };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 5);

  return `<div class="card tight">${lista
    .map(
      ({ a, rs, pct, temQ }) => `
      <div class="assunto" style="border-top:${lista[0].a.id === a.id ? "none" : ""}">
        <span class="nivel n${St.nivel(a.id)}">${St.SIMBOLO[St.nivel(a.id)]}</span>
        <div class="grow">
          <div>${esc(a.nome)}</div>
          <div class="xs mut">${esc(a.disciplina.nome)}</div>
        </div>
        <span class="meta">${rs.length ? `${Math.round(pct * 100)}% · ${rs.length}q` : temQ ? "sem prática" : "sem acervo"}</span>
      </div>`
    )
    .join("")}</div>`;
}

/* ---------------- MAPA DO EDITAL ---------------- */

export function edital() {
  const todos = St.assuntos();
  const dominados = todos.filter((a) => St.nivel(a.id) === 3).length;
  const tocados = todos.filter((a) => St.nivel(a.id) > 0).length;

  pintar(`
    <h1>Mapa do edital</h1>
    <p class="mut sm">${esc(St.S.edital.concurso)}</p>
    <div class="stats">
      <div class="stat"><div class="n">${tocados}/${todos.length}</div><div class="l">assuntos iniciados</div></div>
      <div class="stat"><div class="n">${dominados}</div><div class="l">dominados</div></div>
    </div>
    <div class="row wrap xs mut" style="margin-bottom:14px">
      ${St.SIMBOLO.map((s, i) => `<span><span class="nivel n${i}">${s}</span> ${St.ROTULO[i]}</span>`).join("")}
    </div>
    ${St.disciplinas().map(cartaoDisciplina).join("")}
    <p class="xs mut">${esc(St.S.edital.observacao)}</p>
  `);
}

function cartaoDisciplina(d) {
  const niveis = d.assuntos.map((a) => St.nivel(a.id));
  const pronto = niveis.filter((n) => n === 3).length;
  return `
    <details class="disc">
      <summary>
        <span class="grow"><b>${esc(d.nome)}</b>
          <span class="xs mut"> · ${d.peso} questões estimadas</span></span>
        <span class="xs mut">${pronto}/${d.assuntos.length}</span>
      </summary>
      ${d.assuntos
        .map((a) => {
          const n = St.nivel(a.id);
          const rs = St.respostasDoAssunto(a.id);
          const qs = St.questoesDoAssunto(a.id).length;
          return `<div class="assunto">
            <span class="nivel n${n}" title="${St.ROTULO[n]}">${St.SIMBOLO[n]}</span>
            <span class="grow">${esc(a.nome)}</span>
            <span class="meta">${rs.length ? `${Math.round((rs.filter((r) => r.correta).length / rs.length) * 100)}%` : "—"} · ${qs}q</span>
            ${qs ? `<button class="iconbtn" data-ir="#/questoes/${a.id}">abrir</button>` : ""}
          </div>`;
        })
        .join("")}
    </details>`;
}

/* ---------------- QUESTÕES ---------------- */

let atual = null;   // {q, escolha, confianca, revelado}

export function questoes(assuntoId) {
  if (!assuntoId) return escolherAssunto();
  const a = St.acharAssunto(assuntoId);
  if (!a) return escolherAssunto();
  if (!atual || atual.q?.assunto_id !== assuntoId || atual.consumido) {
    const q = St.proximaQuestao(assuntoId);
    if (!q) return pintar(`<h1>${esc(a.nome)}</h1><div class="empty">Sem questões deste assunto no acervo ainda.</div><button data-ir="#/questoes">Escolher outro</button>`);
    atual = { q, escolha: null, confianca: null, revelado: false };
  }
  desenharQuestao(a);
}

function escolherAssunto() {
  atual = null;
  const comQ = St.assuntos().filter((a) => St.questoesDoAssunto(a.id).length);
  pintar(`
    <h1>Questões</h1>
    ${St.S.avisoAcervo ? `<div class="aviso">${esc(St.S.avisoAcervo)}</div>` : ""}
    <div class="card tight">
      ${comQ
        .map((a) => {
          const rs = St.respostasDoAssunto(a.id);
          return `<div class="assunto">
            <span class="nivel n${St.nivel(a.id)}">${St.SIMBOLO[St.nivel(a.id)]}</span>
            <div class="grow"><div>${esc(a.nome)}</div><div class="xs mut">${esc(a.disciplina.nome)}</div></div>
            <span class="meta">${St.questoesDoAssunto(a.id).length}q${rs.length ? ` · ${Math.round((rs.filter((r) => r.correta).length / rs.length) * 100)}%` : ""}</span>
            <button class="iconbtn" data-ir="#/questoes/${a.id}">abrir</button>
          </div>`;
        })
        .join("")}
    </div>`);
}

function desenharQuestao(a) {
  const { q, escolha, confianca, revelado } = atual;
  const ce = q.formato === "ce";
  const opcoes = ce
    ? [{ letra: "C", texto: "Certo" }, { letra: "E", texto: "Errado" }]
    : q.alternativas;

  const classe = (letra) => {
    if (!revelado) return escolha === letra ? "alt sel" : "alt";
    if (letra === q.gabarito) return "alt certa";
    if (letra === escolha) return "alt errada";
    return "alt";
  };

  pintar(`
    <div class="row spread" style="margin-bottom:10px">
      <div><h1 style="font-size:1.15rem">${esc(a.nome)}</h1>
        <div class="xs mut">${esc(a.disciplina.nome)} · ${q.banca ? `${esc(q.banca)} ${q.ano}` : "questão de exemplo"} · ${ce ? "certo/errado" : "múltipla escolha"}${q.penalidade ? " · erro anula acerto" : ""}</div>
      </div>
      <button class="iconbtn" data-ir="#/questoes">trocar</button>
    </div>

    <div class="card">
      <p class="enun">${esc(q.enunciado)}</p>
      ${opcoes.map((o) => `<button class="${classe(o.letra)}" data-alt="${o.letra}" ${revelado ? "disabled" : ""}>${ce ? "" : `<b>${o.letra}</b>`}${esc(o.texto)}</button>`).join("")}

      ${!revelado ? `
        <div style="margin-top:16px">
          <label class="fld">Antes de confirmar: quanta certeza você tem?</label>
          <div class="btns">
            ${[["chutei", "Chutei"], ["duvida", "Fiquei na dúvida"], ["certeza", "Tinha certeza"]]
              .map(([v, r]) => `<button class="${confianca === v ? "alt sel" : ""}" data-conf="${v}" style="min-height:44px">${r}</button>`).join("")}
          </div>
          <div class="btns" style="margin-top:12px">
            <button class="primary" data-confirmar ${escolha && confianca ? "" : "disabled"}>Confirmar</button>
          </div>
          ${escolha && !confianca ? `<p class="xs mut" style="margin:8px 0 0">Marque a confiança — é ela que revela o falso domínio.</p>` : ""}
        </div>`
      : `
        <div class="feed ${escolha === q.gabarito ? "ok" : "no"}">
          <b>${escolha === q.gabarito ? "Certo." : `Errou — gabarito ${q.gabarito}.`}</b>
          ${q.comentario ? `<br>${esc(q.comentario)}` : ""}
          ${escolha !== q.gabarito ? `<br><span class="xs mut">Já entrou na sua fila de revisão.</span>` : ""}
          ${escolha === q.gabarito && confianca === "chutei" ? `<br><span class="xs mut">Acertou chutando — não conta como domínio.</span>` : ""}
        </div>
        <div class="btns"><button class="primary" data-proxima>Próxima</button></div>`}
    </div>
    ${sessaoPlacar(a)}
  `);
}

function sessaoPlacar(a) {
  const rs = St.respostasDoAssunto(a.id);
  if (!rs.length) return "";
  const p = St.placar(rs);
  return `<div class="card tight row spread">
    <span class="sm mut">Neste assunto</span>
    <span class="mono sm">${p.certas}✓ ${p.erradas}✗ · ${p.punido ? `líquido ${p.liquido}` : `${p.pct}%`}</span>
  </div>`;
}

export function acaoQuestao(t) {
  if (!atual) return false;
  const alt = t.closest("[data-alt]");
  if (alt && !atual.revelado) { atual.escolha = alt.dataset.alt; return true; }
  const cf = t.closest("[data-conf]");
  if (cf && !atual.revelado) { atual.confianca = cf.dataset.conf; return true; }
  if (t.closest("[data-confirmar]")) {
    St.registrarResposta(atual.q, atual.escolha, atual.confianca);
    atual.revelado = true;
    return true;
  }
  if (t.closest("[data-proxima]")) { atual.consumido = true; return true; }
  return false;
}

/* ---------------- REVISAR ---------------- */

let cardAberto = null;

export function revisar() {
  const fila = St.cardsDevidos();
  if (!fila.length) {
    const prox = St.S.dados.cards.slice().sort((a, b) => a.devidaEm - b.devidaEm)[0];
    return pintar(`<h1>Revisar</h1>
      <div class="empty">
        <p>Fila vazia.</p>
        <p class="sm">${prox ? `Próxima revisão ${textoIntervalo(prox)}.` : "Erre uma questão e ela aparece aqui."}</p>
      </div>
      <button data-ir="#/questoes">Ir para questões</button>`);
  }
  const c = fila[0];
  const mostrando = cardAberto === c.id;
  pintar(`
    <div class="row spread" style="margin-bottom:10px">
      <h1 style="font-size:1.15rem">Revisar</h1>
      <span class="pill">${fila.length} na fila</span>
    </div>
    <div class="card">
      <div class="xs mut" style="margin-bottom:8px">${esc(St.acharAssunto(c.assuntoId)?.nome || "")}</div>
      <p class="enun">${esc(c.frente)}</p>
      ${mostrando
        ? `<div class="feed"><b>Gabarito ${esc(c.gabarito || "")}.</b><br>${esc(c.verso)}</div>
           <label class="fld">Quanto custou lembrar?</label>
           <div class="btns">${NOTAS.map((n) => `<button data-nota="${n.n}" class="${n.n === 1 ? "" : ""}"><span>${n.rot}</span></button>`).join("")}</div>`
        : `<div class="btns"><button class="primary" data-mostrar="${c.id}">Mostrar resposta</button></div>`}
    </div>
    <p class="xs mut">Revisado ${c.revisoes || 0}× · intervalo atual ${c.estab} ${c.estab === 1 ? "dia" : "dias"}</p>
  `);
}

export function acaoRevisar(t) {
  const m = t.closest("[data-mostrar]");
  if (m) { cardAberto = m.dataset.mostrar; return true; }
  const n = t.closest("[data-nota]");
  if (n && cardAberto) { St.revisar(cardAberto, Number(n.dataset.nota)); cardAberto = null; return true; }
  return false;
}

/* ---------------- CICLO ---------------- */

let cron = { rodando: false, seg: 0, disciplinaId: null, t: null };

export function ciclo() {
  const b = St.blocoAtual();
  if (!cron.disciplinaId) cron.disciplinaId = b.disciplinaId;
  const d = St.acharDisciplina(cron.disciplinaId);
  const mm = String(Math.floor(cron.seg / 60)).padStart(2, "0");
  const ss = String(cron.seg % 60).padStart(2, "0");

  pintar(`
    <h1>Ciclo de estudos</h1>
    <p class="mut sm">A fila não pune atraso: o bloco espera por você.</p>

    <div class="card" style="text-align:center">
      <label class="fld" style="text-align:left">Matéria do bloco</label>
      <select id="disc" style="width:100%;margin-bottom:16px">
        ${St.disciplinas().map((x) => `<option value="${x.id}" ${x.id === cron.disciplinaId ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}
      </select>
      <div class="timer">${mm}:${ss}</div>
      <p class="xs mut">${esc(d.nome)} · ${min(St.S.dados.ciclo.find((c) => c.disciplinaId === d.id).feitos)} de ${min(St.S.dados.ciclo.find((c) => c.disciplinaId === d.id).alvo)} no ciclo</p>
      <div class="btns" style="margin-top:12px">
        <button class="primary" data-cron="${cron.rodando ? "pausar" : "rodar"}">${cron.rodando ? "Pausar" : "Iniciar"}</button>
        <button data-cron="salvar" ${cron.seg < 60 ? "disabled" : ""}>Registrar ${Math.floor(cron.seg / 60)}min</button>
      </div>
      <div class="btns" style="margin-top:8px">
        <button class="ghost sm" data-cron="manual">Lançar tempo à mão</button>
      </div>
    </div>

    <h2>A volta do ciclo</h2>
    <div class="card tight">
      ${St.S.dados.ciclo.map((c) => {
        const dd = St.acharDisciplina(c.disciplinaId);
        return `<div class="assunto">
          <div class="grow"><div>${esc(dd.nome)}</div>
            <div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, (c.feitos / c.alvo) * 100)}%"></i></div>
          </div>
          <span class="meta">${min(c.feitos)}/${min(c.alvo)}</span>
        </div>`;
      }).join("")}
    </div>
  `);

  document.getElementById("disc")?.addEventListener("change", (e) => {
    cron.disciplinaId = e.target.value;
    ciclo();
  });
}

export function acaoCiclo(t, rerender) {
  const b = t.closest("[data-cron]");
  if (!b) return false;
  const a = b.dataset.cron;
  if (a === "rodar") {
    cron.rodando = true;
    cron.t = setInterval(() => { cron.seg++; if (location.hash.startsWith("#/ciclo")) ciclo(); }, 1000);
  } else if (a === "pausar") {
    cron.rodando = false; clearInterval(cron.t);
  } else if (a === "salvar") {
    St.registrarSessao(cron.disciplinaId, Math.floor(cron.seg / 60));
    cron.rodando = false; clearInterval(cron.t); cron.seg = 0;
  } else if (a === "manual") {
    const v = prompt("Quantos minutos você estudou?");
    const m = parseInt(v, 10);
    if (m > 0) St.registrarSessao(cron.disciplinaId, m);
  }
  return true;
}

/* ---------------- DADOS ---------------- */

export function dados() {
  const rs = St.S.dados.respostas;
  const p = St.placar(rs);
  const totalMin = St.S.dados.sessoes.reduce((t, s) => t + s.minutos, 0);
  const chutesCertos = rs.filter((r) => r.correta && r.confianca === "chutei").length;
  const porConf = ["certeza", "duvida", "chutei"].map((c) => {
    const sub = rs.filter((r) => r.confianca === c);
    return { c, n: sub.length, pct: sub.length ? Math.round((sub.filter((r) => r.correta).length / sub.length) * 100) : null };
  });

  pintar(`
    <h1>Seus dados</h1>
    <div class="stats">
      <div class="stat"><div class="n">${p.total}</div><div class="l">questões</div></div>
      <div class="stat"><div class="n">${p.total ? p.pct + "%" : "—"}</div><div class="l">acerto bruto</div></div>
      <div class="stat"><div class="n">${min(totalMin)}</div><div class="l">estudadas</div></div>
      <div class="stat"><div class="n">${St.S.dados.cards.length}</div><div class="l">itens em revisão</div></div>
    </div>

    <h2>Acerto por confiança</h2>
    <div class="card tight">
      ${porConf.map(({ c, n, pct }) => `<div class="assunto">
        <span class="grow">${{ certeza: "Tinha certeza", duvida: "Fiquei na dúvida", chutei: "Chutei" }[c]}</span>
        <span class="meta">${n ? `${pct}% · ${n}q` : "—"}</span>
      </div>`).join("")}
    </div>
    ${chutesCertos ? `<p class="xs mut">${chutesCertos} ${chutesCertos === 1 ? "acerto veio de chute" : "acertos vieram de chute"} — não contam como domínio no mapa.</p>` : ""}

    <h2>Backup</h2>
    <div class="card">
      <p class="sm mut">Tudo fica no seu navegador. Limpar o navegador apaga. Exporte de vez em quando.</p>
      <div class="btns">
        <button data-acao="exportar">Exportar</button>
        <button data-acao="importar">Importar</button>
        <button data-acao="zerar" class="ghost">Zerar</button>
      </div>
      <input type="file" id="arq" accept="application/json" hidden>
    </div>
    <p class="xs mut">Grifo · versão de teste local · sem conta, sem servidor.</p>
  `);

  document.getElementById("arq")?.addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { St.importar(await f.text()); location.hash = "#/hoje"; location.reload(); }
    catch (err) { alert("Não deu para importar: " + err.message); }
  });
}

export function acaoDados(t) {
  const b = t.closest("[data-acao]");
  if (!b) return false;
  if (b.dataset.acao === "exportar") St.exportar();
  if (b.dataset.acao === "importar") document.getElementById("arq").click();
  if (b.dataset.acao === "zerar" && confirm("Apagar todo o seu progresso deste navegador?")) { St.zerar(); location.reload(); }
  return true;
}
