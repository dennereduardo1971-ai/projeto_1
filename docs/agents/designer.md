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
Mais. `Caderno` ainda é stub (16 linhas).

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

## Armadilhas

- Cor definida **dentro** de bloco de tema não existe no estado "sistema" (sem `data-theme`) — todo
  valor nasce no `:root` e é só redefinido nos outros blocos.
- `Button` tem `tamanho="sm"`, mas ele é para barra de filtro. Ação principal de tela em `sm`
  encolhe o alvo de toque abaixo do confortável no celular.

## Pendências

- `Caderno` é stub e precisa de tela de verdade.
- Não há streak nem lembrete na interface, embora o tom sóbrio com streak seja decisão travada.
- Faltou passar o contraste do tema escuro no medidor de nível com olho de acessibilidade.
