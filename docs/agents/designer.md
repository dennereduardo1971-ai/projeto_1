# Diário — designer

> Preenchido pelo próprio agente conforme o projeto anda. Ver `docs/agents/00-protocolo.md`.

## Estado atual

O sistema visual existe e as telas o consomem — nenhuma tela pinta cor à mão.

**Tokens** — `app/src/styles/tokens.css` (101 declarações), `theme.css` para os três estados de
tema (claro no `:root`, escuro em `prefers-color-scheme` guardado por `:not([data-theme="light"])`,
e `[data-theme="dark"]` para o botão vencer nos dois sentidos). Alternância em
`app/src/features/tema/`.

**Kit** — `app/src/ui/`: `Button`, `Card`, `EstadoVazio`, `Field` (com `Input` e `Select`),
`IconButton`, `InlineAlert`, `NivelMeter`, `Stat`, `TopBar`.

**Telas** — `app/src/app/routes/`: Hoje, Mapa, Ciclo, Questões, Revisão, Estatísticas, Caderno,
Mais. Em 2026-08-31 (pivô do motor de domínio, ver `docs/agents/dados.md`), `Caderno`, `Revisão` e
`Estatísticas` saíram de stub e passaram a ler dado de verdade — mas a reescrita foi funcional, feita
por quem mexeu no motor, não uma passada de design. Estão com o kit visual (`Card`, `Button`,
`EstadoVazio`) e o layout é simples de lista, sem polimento de hierarquia visual, sem gráfico de
evolução e sem os textos re-trabalhados que essas telas merecem. Tratar como rascunho funcional.

**2026-09-01 — `/bemvindo`, onboarding sem login.** Rota nova, fora do `AppShell` (sem barra de
navegação — ver `app/src/app/routes/Bemvindo.tsx`). `AppShell` (`app/src/app/AppShell.tsx`) lê
`db.perfil.get('local')` ao montar: `null` enquanto pendente (não renderiza nada), `<Navigate
to="/bemvindo" replace/>` se não existe perfil, segue normal se existe. A mesma tela vira edição
quando já há perfil salvo (pré-preenche, botão final vira "Salvar" em vez de "Começar"). Fluxo de 3
passos (nome → ritmo → domínio inicial por disciplina), um `<form>` só, indicador "Passo X de 3" em
texto + 3 barrinhas lisas (`bg-primary`/`bg-sunken`, mesmo vocabulário da barra de progresso do bloco
em `Hoje.tsx` — não é um componente novo). Ritmo usa `<fieldset>/<legend>` com `<input type="radio">`
nativo dentro de `<label>` (radiogroup grátis de teclado, sem reimplementar `role="radiogroup"` à
mão). Lógica pura (presets de ritmo, prior de theta, validação de nome) em
`app/src/features/perfil/perfil.ts`, testada em `perfil.test.ts` sem tocar Dexie. Tipo `Perfil` mora
em `app/src/features/perfil/tipos.ts` — fora de `dados/tipos.ts` de propósito (ver comentário em
`db.ts`), candidato a migrar quando o modelo de usuário consolidar. Dexie subiu para v3 só com a
tabela `perfil: ''` (mesma convenção de 1 linha fixa sob `'local'` de `sequencia`/`meta`).

## Decisões

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
- **2026-09-01 — Ritmo "intenso" caiu de 180 para 120 min/dia.** A sugestão original excedia o teto
  da própria persona do produto (adulto ansioso, 2h/dia, cansado). 120 min é o limite dessa persona
  e ainda assim o ritmo mais exigente dos três — prometer 3h/dia no preset "mais puxado" venderia um
  hábito que a pesquisa de mercado já descartou como realista. `leve` (45/10/4) e `moderado`
  (90/20/5) ficaram como sugeridos. Ver `app/src/features/perfil/perfil.ts` (`RITMOS`).
- **2026-09-01 — Domínio inicial é prior de `theta`, nunca estatística.** `estadoInicialDoNivel`
  grava o prior do nível declarado mas mantém `n = 0`/`acertos = 0`/`ultima_pratica = null` — como
  `dominioEfetivo` só liga com `n > 0` (`features/dominio/mastery.ts`), a autodeclaração calibra
  dificuldade/prioridade sem nunca aparecer como desempenho real. Reabrir `/bemvindo` depois de já
  ter respondido questões não sobrescreve `estado_assunto` com `n > 0` — edição de perfil não apaga
  histórico.

## Armadilhas

- Cor definida **dentro** de bloco de tema não existe no estado "sistema" (sem `data-theme`) — todo
  valor nasce no `:root` e é só redefinido nos outros blocos.
- `Button` tem `tamanho="sm"`, mas ele é para barra de filtro. Ação principal de tela em `sm`
  encolhe o alvo de toque abaixo do confortável no celular.
- `accent-color` de `<input type="radio">`/`checkbox` não tem utilitário Tailwind confiável para
  apontar pra uma custom property sem risco de purga/arbitrary-value quebrar — usei
  `style={{ accentColor: 'var(--primary)' }}` em `Bemvindo.tsx` (token, não hex; mesma regra de "cor
  só nasce no `:root`" continua valendo, só o mecanismo de aplicar é `style` em vez de classe).

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
- **`/bemvindo` (2026-09-01) fechou sem tocar em arquivo de outro agente — três pontas soltas para
  quem mexer em `Mais.tsx`/`Hoje.tsx` a seguir:**
  - `Mais.tsx` não tem link para editar o perfil depois do onboarding. Reabrir `/bemvindo` (a
    própria rota já detecta perfil existente e vira modo edição) precisa de uma entrada — sugestão:
    um item de lista "Perfil" no topo da mesma `<Card><ul>` de destinos, mostrando `perfil.nome` e o
    ritmo atual como selo, no mesmo padrão dos outros itens (`Link` + selo em `text-caption
    text-subtle`).
  - `Hoje.tsx` (TopBar `titulo="Hoje"`) não usa `perfil.nome` em lugar nenhum — dá pra personalizar
    o cabeçalho ("Hoje, {nome}" ou similar) lendo `obterPerfil()` de
    `@/features/perfil/perfil`, mantendo o tom sóbrio (sem "Bem-vindo de volta, campeão!").
  - Ritmo (`db.meta`) hoje só é gravado pelo onboarding. Quando `Ciclo.tsx`/`Mais.tsx` ganharem uma
    tela de ajuste de meta independente do onboarding, ela deve escrever direto em `db.meta` (mesmo
    formato) — não precisa passar por `/bemvindo`, que é sobre nome + ritmo + domínio inicial juntos,
    não um editor de meta avulso.
  - Não criei nenhum "pular onboarding" — hoje é obrigatório responder ao menos o nome (único campo
    sem default) para sair de `/bemvindo`. Se isso for fricção demais em teste com usuário real, a
    saída mais simples é dar ao nome um default vazio-mas-aceito ("Sem nome" implícito) em vez de
    um botão de pular — ainda não decidido, registrar aqui quando for.
