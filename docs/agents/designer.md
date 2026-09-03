# Diário — designer

> Preenchido pelo próprio agente conforme o projeto anda. Ver `docs/agents/00-protocolo.md`.

## Estado atual

O sistema visual existe e as telas o consomem — nenhuma tela pinta cor à mão.

**Tokens** — `app/src/styles/tokens.css` (101 declarações), `theme.css` para os três estados de
tema (claro no `:root`, escuro em `prefers-color-scheme` guardado por `:not([data-theme="light"])`,
e `[data-theme="dark"]` para o botão vencer nos dois sentidos). Alternância em
`app/src/features/tema/`.

**Kit** — `app/src/ui/`: `Atribuicao` (+ `AssinaturaComentario`), `Button`, `Card`, `EstadoVazio`,
`Field` (com `Input` e `Select`), `IconButton`, `InlineAlert`, `NivelMeter`, `Stat`, `TopBar`.

**Telas** — `app/src/app/routes/`: Hoje, Mapa, Ciclo, Questões, Revisão, Estatísticas, Caderno,
Mais. Em 2026-08-31 (pivô do motor de domínio, ver `docs/agents/dados.md`), `Caderno`, `Revisão` e
`Estatísticas` saíram de stub e passaram a ler dado de verdade — mas a reescrita foi funcional, feita
por quem mexeu no motor, não uma passada de design. Estão com o kit visual (`Card`, `Button`,
`EstadoVazio`) e o layout é simples de lista, sem polimento de hierarquia visual, sem gráfico de
evolução e sem os textos re-trabalhados que essas telas merecem. Tratar como rascunho funcional.

## Decisões

- **2026-09-03 — Crédito da fonte aparece sempre, e o vazio dele é aviso, não silêncio.** Com o
  acervo real na tela (100 questões de apostila), a regra 4 do `CLAUDE.md` deixou de ser só schema:
  `Atribuicao` fica logo abaixo do enunciado, em `text-caption`, e quando o dado falta ela imprime
  "origem não registrada" em tom de aviso em vez de sumir. Questão sem crédito visível é o problema
  que o projeto se comprometeu a não ter — esconder a linha esconderia o problema, não o resolveria.
- **2026-09-03 — Comentário de terceiro nunca aparece sem assinatura.** `AssinaturaComentario`
  ("Comentário de {autor}, em {título}") é renderizada junto do veredito sempre que o texto vem de
  `apostila_comentada`. É a condição da exceção temporária da regra 5 — não é enfeite, é o que
  sustenta a permissão de exibir o texto.
- **2026-08-20 — `EstadoVazio` exige o motivo** (`acervo` · `uso` · `filtro` · `erro`). "Nada" não é
  uma coisa só: acervo vazio é falha do produto, fila vazia é você que ainda não usou, e as duas
  pedem textos e ações diferentes. `carregando` ficou de fora de propósito — skeleton nunca
  representa dado inexistente.
- **2026-08-20 — Nada some da navegação.** Questões e Estatísticas ficam em *Mais* com selo de
  estado enquanto não têm conteúdo, e sobem para a barra quando tiverem. Item que aparece e
  desaparece destrói o mapa mental de quem abre o app todo dia.
- **2026-08-20 — Nível se lê sem cor.** Os quatro níveis do Mapa têm forma própria (`NivelMeter`),
  não só matiz.
- **2026-08-26 — Placar tem rótulo honesto.** Em prova com penalidade a tela mostra *Placar
  líquido* (`acertos − erros`); em múltipla escolha mostra *Percentual*. O rótulo muda junto com a
  conta — número certo com nome errado ainda é mentira.
- **2026-08-26 — Confiança antes de confirmar.** O botão *Confirmar* fica desabilitado até o
  usuário declarar chute/dúvida/certeza. É um toque a mais que sustenta o diagnóstico de falso
  domínio; sem ele a estatística mede sorte.

## Armadilhas

- **Estado vazio escrito em HTML fixo mente no dia em que o dado chega.** A tela `Hoje` renderizava
  "Nenhuma questão no acervo ainda" sem consultar nada — na hora em que o acervo entrou, a home
  passou a negar 100 questões que existiam duas telas adiante (corrigido em 2026-09-03). Todo
  `EstadoVazio` precisa ser ramo de uma condição, nunca parágrafo fixo.
- Cor definida **dentro** de bloco de tema não existe no estado "sistema" (sem `data-theme`) — todo
  valor nasce no `:root` e é só redefinido nos outros blocos.
- `Button` tem `tamanho="sm"`, mas ele é para barra de filtro. Ação principal de tela em `sm`
  encolhe o alvo de toque abaixo do confortável no celular.

## Pendências

- `Caderno`, `Revisão` e `Estatísticas` precisam de uma passada de design de verdade (ver Estado
  atual) — hoje são rascunho funcional em lista simples.
- **XP, sequência e conquistas não têm NENHUMA interface ainda.** O motor existe
  (`app/src/features/dominio/gamification.ts`, tabelas `sequencia`/`evento_xp`/`conquista_usuario`
  no Dexie) mas nada na tela mostra XP ganho, sequência atual ou conquista desbloqueada — é dado
  sendo calculado no vácuo. Tom sóbrio (CLAUDE.md regra 7): mecânica de jogo sim, estética de jogo
  infantil não — nada de confete, mascote ou emoji de celebração.
- Faltou passar o contraste do tema escuro no medidor de nível com olho de acessibilidade.
- `NivelMeter`/`classeArestaNivel` (`app/src/ui/NivelMeter.tsx`) continuam com 4 níveis (0–3), mas o
  motor novo tem 5 (`inicial/desenvolvimento/intermediario/bom/dominado`, em
  `features/dominio/mastery.ts`) — `dados/nivel.ts` faz a compressão 5→4 hoje. Vale decidir se o Mapa
  merece os 5 níveis do motor em vez dessa compressão.
