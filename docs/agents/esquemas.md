# Diário — esquemas

> Preenchido pelo próprio agente conforme o projeto anda. Ver `docs/agents/00-protocolo.md`.

## Estado atual

**Nenhum esquema escrito.** Não há tela de material de leitura no app e não há conteúdo em lugar
nenhum do repositório.

O terreno já está preparado: `seeds/taxonomia.json` traz a árvore provisória de assuntos, com
**Auditoria** (14 assuntos, de estrutura normativa a auditoria governamental) e **Direito Civil**
(14 assuntos, de LINDB a sucessões) — as duas matérias-piloto escolhidas.

## Decisões

- **2026-08-26 — Incidência manda na fila.** O assunto com mais questões no acervo ganha esquema
  primeiro; assunto que nunca caiu não ganha esquema. Como o acervo está vazio, **a fila ainda não
  pode ser calculada** — escrever esquema agora seria chutar prioridade.
- **2026-08-26 — A taxonomia é provisória.** Ela vai ser remapeada quando as provas chegarem e
  revelarem o que a banca de fato chama de assunto. O `slug` é o que segura as ligações enquanto os
  nomes mudam — esquema novo deve referenciar slug, nunca nome.

## Armadilhas

- Os comentários das 10 questões de exemplo (`seeds/questoes-exemplo.json`) foram escritos por nós
  e servem de referência de tom — curto, direto, apontando a troca de definições que a banca usa.
  Não confundir com esquema: são explicação de questão, não material de leitura.

## Pendências

- Tudo. O primeiro esquema só faz sentido depois da primeira prova ingerida.
- A tela que exibe esquema vinculado ao assunto não existe no app (Fase 4 do roadmap).
