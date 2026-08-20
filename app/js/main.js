import * as St from "./store.js";
import * as V from "./views.js";

const TABS = [
  ["#/hoje", "◎", "Hoje"],
  ["#/edital", "▤", "Edital"],
  ["#/questoes", "?", "Questões"],
  ["#/revisar", "↻", "Revisar"],
  ["#/dados", "▦", "Dados"],
];

function rota() {
  const partes = (location.hash || "#/hoje").replace(/^#\/?/, "").split("/");
  return { tela: partes[0] || "hoje", arg: partes[1] || null };
}

export function render() {
  const { tela, arg } = rota();
  ({
    hoje: V.hoje,
    edital: V.edital,
    questoes: () => V.questoes(arg),
    revisar: V.revisar,
    ciclo: V.ciclo,
    dados: V.dados,
  }[tela] || V.hoje)();

  document.querySelectorAll("nav.tabs a").forEach((a) => {
    const ativo = a.getAttribute("href").slice(2) === tela || (tela === "ciclo" && a.getAttribute("href") === "#/hoje");
    ativo ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
}

document.addEventListener("click", (e) => {
  const ir = e.target.closest("[data-ir]");
  if (ir) { location.hash = ir.dataset.ir; return; }
  if (e.target.closest("[data-tema]")) { alternarTema(); return; }
  if (V.acaoQuestao(e.target) || V.acaoRevisar(e.target) || V.acaoCiclo(e.target) || V.acaoDados(e.target)) render();
});

window.addEventListener("hashchange", render);

function alternarTema() {
  const atual = document.documentElement.getAttribute("data-theme");
  const escuroDoSistema = matchMedia("(prefers-color-scheme: dark)").matches;
  const novo = atual ? (atual === "dark" ? "light" : "dark") : escuroDoSistema ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", novo);
  localStorage.setItem("grifo.tema", novo);
}

const temaSalvo = localStorage.getItem("grifo.tema");
if (temaSalvo) document.documentElement.setAttribute("data-theme", temaSalvo);

document.querySelector("nav.tabs").innerHTML = TABS.map(
  ([href, g, rot]) => `<a href="${href}"><span class="g" aria-hidden="true">${g}</span>${rot}</a>`
).join("");

St.iniciar()
  .then(render)
  .catch((e) => {
    document.getElementById("app").innerHTML =
      `<div class="empty"><p><b>Não consegui carregar os dados.</b></p>
       <p class="sm">${e.message}</p>
       <p class="sm">Abra o app por um servidor local, não por duplo clique no arquivo:<br>
       <code class="mono">python3 -m http.server 8080</code></p></div>`;
  });
