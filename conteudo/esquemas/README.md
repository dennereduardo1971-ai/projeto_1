# Esquemas

Material de leitura esquematizado. Um arquivo JSON por assunto do edital, escrito **por
incidência**: cada bloco existe porque questão real do acervo cobrou aquilo. O esquema serve para
a pessoa acertar a questão, não para cobrir a matéria.

```
conteudo/esquemas/
  esquema.schema.json      formato (JSON Schema draft 2020-12)
  <assunto_slug>.json      um esquema por assunto
scripts/esquemas/validar.py  valida todos contra o schema + regras do CLAUDE.md
```

Rodar:

```
python3 scripts/esquemas/validar.py             # todos
python3 scripts/esquemas/validar.py civil-obrigacoes
```

Sai com código 1 e lista todos os problemas. Não para no primeiro.

## Como o formato funciona

Cada arquivo tem um envelope e uma lista de blocos.

| Campo | O que é |
|---|---|
| `assunto_slug` | Casa com `questao.assunto` no acervo. É a chave que liga esquema, questões e `estado_assunto`. |
| `disciplina` | Rótulo humano, para agrupar na tela. |
| `titulo` | Título do esquema. |
| `versao` | Inteiro. Sobe a cada reescrita de conteúdo. A tela usa para saber se o que o usuário leu envelheceu. |
| `atualizado_em` | `AAAA-MM-DD`. |
| `estado` | `publicado` \| `rascunho` \| `revisar`. Só `publicado` vai para a tela. |
| `motivo_revisar` | Obrigatório quando `estado = revisar`, proibido quando `publicado`. |
| `incidencia` | `{questoes, provas[], apurado_em}` — quantas questões do acervo sustentam o assunto. O validador confere contra o acervo de verdade. |
| `resumo` | Uma a três frases. É o que aparece antes de abrir o esquema. |
| `blocos[]` | O conteúdo. **A ordem do array é a ordem de renderização** — não existe campo `ordem`. |
| `fontes[]` | Atribuição: norma, acervo, apostila, jurisprudência. |

Todo bloco tem `tipo` e `id`. O `id` é âncora estável: é por ele que a tela vai destacar "o bloco
que explica a questão que você errou" (plano do produto, seção 4). Mudar `id` quebra esse vínculo —
prefira reescrever o texto e manter o `id`.

Todo bloco, exceto `alerta`, carrega `questoes[]` com pelo menos uma referência
`{prova_slug, numero}`. Isso não é enfeite: é o que permite reabrir o esquema quando o gabarito
daquelas questões mudar. O validador exige que a questão exista no acervo, não esteja anulada e
seja do mesmo `assunto`.

## Os oito tipos de bloco, e o que a tela faz com cada um

| `tipo` | Campos próprios | Como renderizar |
|---|---|---|
| `texto` | `titulo?`, `texto` | Parágrafo. O `texto` é texto puro — sem markdown, sem HTML (o validador rejeita). Quebra de linha não existe: um bloco, um parágrafo. |
| `lista` | `titulo?`, `ordenada`, `itens[]`, `nota?` | `<ol>` se `ordenada`, `<ul>` se não. `nota` é uma linha menor abaixo. |
| `tabela` | `titulo?`, `colunas[2..4]`, `linhas[][]`, `nota?` | Tabela. Toda linha tem exatamente o número de colunas declarado (validado). Máximo de 4 colunas de propósito: precisa caber em tela de celular sem rolagem horizontal. |
| `definicao` | `termo`, `texto`, `literal`, `fonte_norma?`, `nao_confundir_com[]?` | Termo em destaque + definição. `literal: true` significa que o `texto` é a redação da norma — a tela deve marcar visualmente que ali é texto de lei, não nosso. `nao_confundir_com` são pares `{termo, texto}` renderizados como contraste ao lado. |
| `lei_seca` | `norma`, `dispositivos[{rotulo, texto, grifo[]?}]`, `comentario?` | Citação da norma. `rotulo` é "Art. 279" ou "NBC TA 530, item 5(a)". `grifo` é uma lista de trechos literais que ocorrem dentro de `texto` (validado) — a tela destaca cada ocorrência. `comentario` é nosso, vai depois. |
| `pegadinha` | `isca`, `correcao`, `explicacao?`, `troca[2]?` | Dois lados: a afirmação errada como a banca escreve (`isca`) e o que está certo (`correcao`). `troca` é o par semântico que a banca inverteu (`["só responde o culpado", "respondem todos"]`) — renderize como "onde se lê X, a banca pôs Y". Palavras em CAIXA ALTA dentro da `isca` são o ponto exato da troca; mantenha o caixa alta, não é grito. |
| `alerta` | `nivel`, `titulo`, `texto`, `vigencia?`, `questoes?` | `nivel` ∈ `mudanca_de_norma` \| `controversia` \| `atencao`. Único bloco em que `questoes` é opcional — ele fala do terreno, não de uma questão. Deve ficar visualmente distinto do corpo do esquema. |
| `sumula` | `identificador`, `orgao`, `texto`, `situacao`, `comentario?` | Súmula/tese. `situacao` ∈ `vigente` \| `superada` \| `cancelada`; súmula superada aparece riscada ou com tarja. Definido no schema, ainda sem uso nos dois primeiros esquemas. |

Regras que a tela pode assumir sem checar:

- Nenhum campo de texto contém markdown, HTML ou marcação de negrito. Renderize como texto.
- Nenhum bloco depende de outro para fazer sentido. Dá para mostrar um bloco isolado (é o caso de
  uso "você errou a questão 31, leia este bloco").
- `blocos` nunca é vazio; `fontes` nunca é vazio.

## Como nasce um esquema novo

1. **Conte as questões.** `grep`/script no `acervo/provas/*.json` pelo `assunto`. O assunto com
   mais questões ganha esquema primeiro. Assunto que nunca caiu não ganha esquema. Diga o número
   antes de escrever.
2. **Leia as questões.** Todas. Mais o comentário do autor quando a prova é
   `origem_fonte = apostila_comentada`. O comentário é **pista**, não fonte de texto.
3. **Confira a norma na fonte primária.** Planalto para lei, CFC para NBC, DOU. Cursinho e apostila
   servem para achar o ponto que cai, nunca para citar. Vigência conferida entra em `fontes` com
   `consultado_em`.
4. **Escreva os blocos a partir do que a banca pediu.** Cada bloco aponta as questões que o
   originaram. Se você não consegue apontar nenhuma, o bloco não entra — é índice de livro.
5. **Rode o validador.** Ele reprova, entre outras coisas, trecho de 12 palavras seguidas igual ao
   comentário de terceiro que está no acervo (CLAUDE.md, regra 5).
6. **Atualize `docs/agents/esquemas.md`** no mesmo commit.

## A barreira anti-cópia

`scripts/esquemas/validar.py` compara janelas de 12 palavras (sem acento, só alfanumérico) de todo
campo autoral do esquema — `resumo`, `texto`, `comentario`, `isca`, `correcao`, `explicacao`,
`nota` — contra o corpus de `comentario` de terceiro guardado no acervo. Coincidência reprova.

Exceção: texto de norma não é obra protegida (Lei 9.610/1998, art. 8º, IV). Ficam de fora da
barreira `lei_seca.dispositivos`, `sumula.texto` e, quando `literal: true`, o `texto` da
`definicao`. Fora desses lugares, redação de norma citada ao pé da letra é sinal de que o bloco
está no tipo errado.

## Fronteiras

- Esquema não decide gabarito. Divergiu do acervo, aciona o agente `gabarito` e registra em
  Pendências.
- Esquema não cria questão. O acervo é de prova oficial (ou apostila, com atribuição).
- Assunto cuja lei mudou vira `estado: revisar` com `motivo_revisar` preenchido até alguém
  reescrever. Aviso é melhor do que texto errado no ar.
