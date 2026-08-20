# Protocolo de memória viva

Todo agente deste projeto é obrigado a **chegar sabendo** e **sair registrando**. Sem isso, cada sessão
recomeça do zero e o projeto perde a memória do que já foi decidido, tentado e descartado.

## Ao começar (sempre, antes da primeira ação)

1. Ler `CLAUDE.md` — as regras do projeto.
2. Ler `docs/03-plano-do-produto.md` — o que estamos construindo e em que fase estamos.
3. Ler **o próprio diário** em `docs/agents/<nome>.md`.
4. Ler o diário dos agentes vizinhos quando a tarefa cruzar a fronteira deles (a tabela em `CLAUDE.md` diz quem cuida do quê).

## Ao terminar (no mesmo commit da mudança, nunca depois)

Atualizar o próprio diário com o que mudou de verdade. As quatro seções são fixas:

```markdown
## Estado atual
O que existe hoje na minha área. Substitua o texto antigo — isto é um retrato, não um histórico.

## Decisões
Decisão + data + por quê. Só entra o que muda o comportamento de quem vier depois. Nunca apague uma
decisão: se ela for revertida, escreva a reversão embaixo com a data.

## Armadilhas
O que quebrou, o que enganou, o que parecia certo e não era. É a seção mais valiosa do arquivo.

## Pendências
O que ficou por fazer, com contexto suficiente para outra pessoa pegar.
```

**Regra de ouro:** se você aprendeu algo que faria a próxima sessão perder menos tempo, registre.
Se não aprendeu nada novo, não escreva nada — diário inflado com obviedade é pior que diário vazio.

## Quando a mudança é maior que o diário

- Mudou uma **decisão de produto** → atualizar `docs/03-plano-do-produto.md` também.
- Mudou uma **regra que todo agente precisa obedecer** → atualizar `CLAUDE.md`.
- Mudou o **jeito de trabalhar da sua lane** → atualizar a **sua própria definição** em `.claude/agents/<nome>.md`.
  Isso é permitido e esperado: os agentes evoluem com o projeto. Só não mexa na definição de outro agente
  sem avisar no diário por quê.

## Fronteiras

Cada agente manda na sua lane e **não edita a lane alheia**. Precisou de algo do vizinho: registre em
**Pendências** e diga no relatório final. Exceção: um bug que trava o seu trabalho pode ser corrigido
na hora — mas registre o que você mexeu e por quê.
