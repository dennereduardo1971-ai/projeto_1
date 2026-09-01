# Diário — esquemas

> Preenchido pelo próprio agente conforme o projeto anda. Ver `docs/agents/00-protocolo.md`.

## Estado atual

**Dois esquemas prontos, formato e validador de pé.** Fase 4 saiu do zero no conteúdo; a tela
continua não existindo (é de outro agente).

```
conteudo/esquemas/esquema.schema.json     formato (JSON Schema draft 2020-12)
conteudo/esquemas/README.md               como o formato funciona e como a tela consome
conteudo/esquemas/auditoria-amostragem.json
conteudo/esquemas/civil-obrigacoes.json
scripts/esquemas/validar.py               schema + regras + barreira anti-cópia
```

`python3 scripts/esquemas/validar.py` passa nos dois.

**Prontos (`estado: publicado`)**

| Assunto | Questões no acervo | Blocos |
|---|---|---|
| `auditoria-amostragem` | 63 | 35 — 16 pegadinha, 6 definição, 5 tabela, 4 texto, 2 lei_seca, 2 alerta |
| `civil-obrigacoes` | 37 | 28 — 10 pegadinha, 9 lei_seca, 3 tabela, 2 texto, 2 alerta, 1 definição, 1 lista |

**Em rascunho:** nenhum.

**Fila:** vazia. O acervo inteiro tem só esses dois assuntos (63 + 37 = 100 questões, apuração de
2026-09-01). Assunto novo só entra na fila quando o `coletor` publicar prova que o cubra — a
taxonomia de `seeds/taxonomia.json` tem 28 assuntos, 26 deles sem uma única questão e portanto sem
direito a esquema.

## Decisões

- **2026-08-26 — Incidência manda na fila.** O assunto com mais questões no acervo ganha esquema
  primeiro; assunto que nunca caiu não ganha esquema.
- **2026-08-26 — A taxonomia é provisória.** Esquema referencia `slug`, nunca nome.
- **2026-09-01 — O esquema é arquivo JSON em `conteudo/esquemas/`, não linha de banco.** O plano do
  produto prevê as tabelas `esquema`/`esquema_secao`; o arquivo é a fonte que alimenta o banco, do
  mesmo jeito que `acervo/provas/*.json` alimenta as questões. Conteúdo revisável em diff vale mais
  do que conteúdo digitado direto no Supabase.
- **2026-09-01 — Oito tipos de bloco, discriminados por `tipo`, em `oneOf`.** Aos cinco tipos de
  `esquema_secao` do plano somei `alerta` (norma que mudou / posição controversa) e mantive
  `sumula` definido mas sem uso. A tela renderiza por `switch (bloco.tipo)` e nada mais — nenhuma
  decisão de layout depende de interpretar texto.
- **2026-09-01 — A ordem do array é a ordem de renderização.** Sem campo `ordem`: campo de ordem em
  JSON versionado só cria chance de dessincronizar do que o olho lê no diff.
- **2026-09-01 — `id` de bloco é âncora estável.** É por ele que a tela vai ligar "questão que você
  errou" ao bloco que a explica (plano do produto, seção 4). Reescrever o texto e manter o `id` é o
  comportamento esperado; trocar o `id` quebra o vínculo.
- **2026-09-01 — Nenhum campo de texto aceita markdown ou HTML.** O validador rejeita `**`, `##`,
  `<tag>` e pipe de tabela. Ênfase se faz com CAIXA ALTA na `isca` da pegadinha (é o ponto exato da
  troca semântica) e com o array `grifo` no `lei_seca`.
- **2026-09-01 — `incidencia.questoes` é conferido contra o acervo, não declarado.** O validador
  recontou 63 e 37; número inventado reprova.
- **2026-09-01 — Barreira anti-cópia por janela de 12 palavras.** Todo campo autoral do esquema é
  comparado com o corpus de `comentario` de terceiro do acervo (CLAUDE.md, regra 5). Texto de norma
  fica de fora da barreira: não é obra protegida (Lei 9.610/1998, art. 8º, IV). A isenção vale só
  em `lei_seca.dispositivos`, `sumula.texto` e `definicao.texto` com `literal: true`.

## Armadilhas

- **A barreira anti-cópia pega mesmo.** Reprovou quatro trechos meus nesta rodada — três em
  auditoria, um em civil — em que eu tinha, sem perceber, reescrito o comentário do autor da
  apostila palavra por palavra. Escrever "com as próprias palavras" logo depois de ler o comentário
  de terceiro não é confiável; a checagem mecânica é. Não afrouxe a janela de 12.
- **A `isca` da pegadinha é a armadilha da armadilha.** Ela precisa soar como a banca, e a banca
  cita a lei. Foi ali que caíram três das quatro reprovações. Quando a isca for basicamente a
  redação do artigo, reescreva a frase inteira mudando a estrutura (voz, ordem dos termos), não só
  uma palavra ou outra.
- **Material de cursinho erra e o erro se propaga.** O comentário da questão 20 de
  `apostila_auditoria_amostragem_multipla` diz que os métodos de seleção estão no Apêndice 3 da
  NBC TA 530. Estão no **Apêndice 4** (1 = estratificação e seleção por valor, 2 = fatores para
  testes de controles, 3 = fatores para testes de detalhes, 4 = métodos de seleção). Conferido na
  norma. O esquema traz o número certo e um bloco `alerta` avisando do erro que circula.
- **A Revisão NBC 11/2021 mexeu na NBC TA 530, mas quase nada do que cai.** Alterou o item A7 e o
  Apêndice 2; as definições do item 5, os itens 6-15 e o Apêndice 4 continuam como na Resolução CFC
  1.222/2009. Vale saber para não marcar o esquema inteiro como `revisar` por causa de uma revisão
  que não toca no que a banca pergunta.
- **`curl` para planalto.gov.br morre no proxy (`CONNECT tunnel failed, 403`).** Conferência de
  vigência de lei foi toda por `WebSearch`. Não perca tempo tentando baixar a página.
- **O `jsonschema` não vem instalado no ambiente,** apesar de estar em `requirements.txt`
  (`python3 -m pip install jsonschema`). O validador quebra com `ModuleNotFoundError` antes de
  qualquer mensagem útil.

## Pendências

- **`esquema_secao.tipo` no banco precisa de mais um valor.** O plano do produto lista
  `conceito | lei_seca | tabela_comparativa | pegadinha_da_banca | sumula`; o formato em arquivo usa
  oito tipos e inclui `alerta`, que não tem correspondente. Ou o enum do banco ganha `alerta`, ou o
  importador precisa de um mapa. É decisão do agente `dados` — não mexi em migration.
- **Ninguém importa `conteudo/esquemas/` para o Supabase ainda.** O arquivo é a fonte; falta o
  equivalente ao importador do acervo.
- **A tela não existe.** `conteudo/esquemas/README.md` descreve o que cada tipo de bloco espera de
  renderização — é o contrato que o agente de interface deve consumir.
- **Súmula sem uso.** O tipo `sumula` está no schema e nunca foi exercitado por um arquivo real.
  Primeiro assunto de direito com súmula decisiva vai ser o teste de fogo.
- **Nenhum gabarito do acervo me pareceu errado nesta rodada.** Nada para o agente `gabarito`.
- **Reler os dois esquemas quando o acervo crescer.** `incidencia` é apurada em data fixa
  (2026-09-01) e o validador vai reprovar assim que entrar questão nova desses assuntos — de
  propósito: número de incidência desatualizado é dado falso na tela.
- **Reforma do Código Civil (PL 4/2025) está em tramitação no Congresso.** `civil-obrigacoes.json`
  já traz bloco `alerta` sobre isso. Se for aprovada, o esquema vira `estado: revisar` na hora.
