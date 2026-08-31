# Diário — coletor

> Preenchido pelo próprio agente conforme o projeto anda. Ver `docs/agents/00-protocolo.md`.

## Estado atual

O pipeline existe inteiro e passa nos testes. `acervo/provas/` deixou de estar vazio: as duas
primeiras apostilas comentadas de terceiro (Gran Cursos) foram ingeridas de ponta a ponta e
publicadas, gate humano incluído. Nenhuma prova oficial Cebraspe foi ingerida ainda — isso segue
dependendo da banca da RFB sair ou do dono priorizar SEFAZ/TCU/PGDF por conta própria.

```
scripts/ingest/
├── run.py               orquestra o pipeline; detecta origem_fonte cedo e desvia pra apostila
├── 1_descobrir.py … 7_publicar.py
├── 8_revisar.py          gate humano leve (apostila_comentada): amostra + --aprovar
├── lib/                  cache, caminhos, modelos, perfil, rede, regioes, validador, apostila
├── perfis/               _base · ce_bloco · multipla_5 · tcu_25_aufc · apostila_generico ·
│                         apostila_auditoria_amostragem · apostila_civil_obrigacoes_1
├── schema/               fontes.schema.json · prova.schema.json
└── tests/                42 testes, todos passando (pytest, ~0,7 s)
```

Perfil por prova, não regex único: `_base.yaml` traz o comum do Cebraspe, `apostila_generico.yaml`
traz o comum da apostila comentada (Gran Cursos), e cada prova/apostila específica ganha o seu.

**Provas/apostilas já ingeridas:**

| slug | tipo | autor/banca | assunto | questões | gabarito casado | data |
|---|---|---|---|---|---|---|
| `apostila_auditoria_amostragem_ce` | apostila_comentada | Marcelo Aragão (Gran) | `auditoria-amostragem` | 18 | 18/18 (gabarito próprio + revisado_humano) | 2026-08-31 |
| `apostila_auditoria_amostragem_multipla` | apostila_comentada | Marcelo Aragão (Gran) | `auditoria-amostragem` | 45 | 45/45 | 2026-08-31 |
| `apostila_civil_obrigacoes_1_ce` | apostila_comentada | Carlos Elias (Gran) | `civil-obrigacoes` | 33 | 33/33 | 2026-08-31 |
| `apostila_civil_obrigacoes_1_multipla` | apostila_comentada | Carlos Elias (Gran) | `civil-obrigacoes` | 4 | 4/4 | 2026-08-31 |

PDF de origem (fora do git, `data/00_manual/<slug>/`, um único arquivo por apostila — sem separação
caderno/gabarito): "Amostragem em Auditoria Contábil, NBC TA 530" (99 páginas) e "Obrigações – Parte
I" (61 páginas). As 18 questões de auditoria sem comentário completo (itens 1-14, seção "Questões
Comentadas em Aula") são esperadas — ver Armadilhas.

## Decisões

- **2026-08-31 — Parser de apostila comentada calibrado contra os dois PDFs de amostra reais**
  (Gran Cursos: Marcelo Aragão/Auditoria-Amostragem, Carlos Elias/Direito Civil-Obrigações). Substitui
  o chute anterior por `scripts/ingest/lib/apostila.py`, um módulo novo e independente do parser
  Cebraspe (`4_segmentar.py`/`5_gabarito.py` continuam intocados, servindo só `prova_oficial`):
    - `_desdobrar_negrito`: o "negrito" do template Gran é glifo duplicado (mesmo caractere renderizado
      duas vezes na mesma posição — truque de impressão, não fonte bold). Um `re.sub(r"(.)\1", r"\1")`
      de passada única desfaz, aplicado só a trechos curtos (prefixo de item, linha de cabeçalho).
    - `_cabecalho`: reconhece EXERCÍCIOS/QUESTÕES COMENTADAS EM AULA/QUESTÕES DE CONCURSO/GABARITO/
      GABARITO COMENTADO/RESUMO/SUMÁRIO/APRESENTAÇÃO comparando em MAIÚSCULAS depois de desdobrar —
      a fonte de título também troca a caixa de letras por conta própria (ver Armadilhas).
    - `extrair_itens`/`extrair_grade`/`extrair_comentarios` só processam linhas DENTRO de uma seção
      reconhecida — a mesma questão aparece de novo, embutida como exemplo na prosa do capítulo, ANTES
      da primeira seção, e é ignorada de propósito.
    - Tipo (CE vs múltipla) é decidido por item via `dividir_por_tipo`, cruzando presença de
      alternativas com a caixa da letra na grade — nunca por documento. As duas apostilas de amostra
      confirmaram a mistura: 18 CE + 45 múltipla (auditoria), 33 CE + 4 múltipla (civil).
    - Resultado: duas PROVAS por apostila (`{slug}_ce`/`{slug}_multipla`), CLAUDE.md regra 2
      (`formato`/`penalidade_por_erro` são atributo da prova).
  Perfil `apostila_generico.yaml` recalibrado com números medidos (não chutados): cabeçalho de 3
  linhas até ~73pt, corpo a partir de ~98pt (`margem_topo_frac: 0.11`); rodapé fixo a partir de
  ~780,6pt (`margem_rodape_frac: 0.08`). Os antigos marcadores `gabarito`/`comentario` de regex-por-
  perfil saíram do YAML — a lógica real mora inteira em `lib/apostila.py` agora.
- **2026-08-31 — `run.py` detecta `origem_fonte` cedo e desvia o fluxo.** Resolve o perfil da prova
  antes de rodar qualquer etapa; se `perfil.origem_fonte == "apostila_comentada"`, roda 1-3 normal e
  chama `lib.apostila.processar(...)` no lugar de 4/5/6 (não há gabarito de banca pra casar nem
  segmentação por marcador de item — é outro parser inteiro), grava `com_gabarito`/`classificado`
  para cada sub-slug (`{slug}_ce`/`{slug}_multipla`, omitindo o lado vazio) e roda 7 em cada um.
  `--ate`/`--de` não fazem sentido nesse fluxo (documentado no `--help`). Esse passo de "processar
  apostila" TEM cache próprio (chave `8_apostila` no manifesto, por `c.texto` + nome do perfil) —
  sem isso, rodar `run.py` de novo depois de `8_revisar.py --aprovar` reprocessaria do zero e
  DERRUBARIA o `revisado_humano=true` recém-aprovado (armadilha real, pega em teste manual, ver
  Armadilhas).
- **2026-08-31 — `8_revisar.py` (novo): gate humano leve, nunca automático.** Sem flag, mostra 3
  questões (enunciado, gabarito, início do comentário) do `classificado` de um sub-slug pra conferir
  contra o PDF. Com `--aprovar`, marca `revisado_humano=true` em toda questão não anulada e regrava —
  só depois disso `7_publicar.py` publica de verdade. A ingestão em si NUNCA marca `revisado_humano`.
- **2026-08-31 — `6_classificar.py`: atalho para confiança pré-setada em 1.0.** Apostila é
  monotemática (1 PDF = 1 assunto, vem do `prova.assunto` do perfil) — `lib/apostila.py` já classifica
  com confiança máxima, e gastar 2 passadas de LLM pra redescobrir o óbvio não faz sentido. O
  Cebraspe nunca produz confiança 1.0 nessa etapa (é sempre `min(passada1, passada2)` do LLM), então
  o atalho é zero risco de regressão pro fluxo `prova_oficial`.
- **2026-08-31 — `1_descobrir.py`: PDF único sem classe conhecida vira `apostila_comentada`.** Só
  quando é o ÚNICO PDF da pasta manual — duas ou mais fontes não classificadas continuam `ignorado`,
  porque não dá pra adivinhar qual é o principal.
- **2026-08-31 — bug pré-existente corrigido de passagem: `Prova.fonte_gabarito` default virou
  `None`** (era `""`). String vazia é campo PRESENTE pro schema (falha `minLength: 1`); o default
  antigo já quebrava silenciosamente qualquer prova Cebraspe em `pendente_definitivo` que passasse
  por `validador.validar()` antes da etapa 5 setar o valor de verdade — só não aparecia porque nenhum
  teste checava `problemas == []` nesse caminho. Descoberto ao rodar a apostila (nunca seta
  `fonte_gabarito`, não tem "definitivo da banca"). `sha256_gabarito` já era `None` por padrão;
  só `fonte_gabarito` tinha esse `""` deslizado.
- **2026-08-20 — O coletor não roda em ambiente remoto.** O egresso desta sessão bloqueia
  `cebraspe.org.br`, `cdn.cebraspe.org.br`, `pciconcursos`, `qconcursos` e `fgv.br` (todos deram
  `000` no teste). Por isso o pipeline lê de `data/00_manual/<slug>/`: o usuário baixa os PDFs na
  máquina dele e roda `python scripts/ingest/run.py <slug>`. Isso também é o certo em si — ingestão
  de acervo não pode depender de container efêmero.
- **2026-08-20 — Artefato intermediário em JSON versionado**, um por prova, validado contra
  `schema/prova.schema.json`. O banco não é auditável; o arquivo é. Reprocessar não rebaixa dado
  já conferido.
- **2026-08-20 — Um tipo de caderno por prova.** Cadernos de cor diferente trazem a mesma questão
  em ordem diferente. Registrar qual tipo foi usado e deduplicar por enunciado.

## Armadilhas

- **Negrito duplicado engana `_cabecalho` se o limite de tamanho for medido antes de desdobrar.**
  `"QUESTÕES COMENTADAS EM AULA"` dobrada tem ~51 caracteres crus mas só 28 depois de desdobrar — um
  corte de comprimento no texto CRU rejeita esse cabeçalho por engano (bug real, pego no primeiro
  teste contra o PDF real: itens 1-14 inteiros desapareceram porque a seção nunca era reconhecida).
  O corte tem que ser no texto JÁ desdobrado.
- **A fonte de título troca a caixa de letra por conta própria, independente de negrito.** O
  cabeçalho fixo de página ("Noções de AudiToriA GoverNAmeNTAl") e os subtítulos internos usam uma
  fonte cujo mapeamento de glifo produz maiúscula/minúscula alternada mesmo sem duplicação de
  caractere. `_cabecalho` compara em maiúsculas depois de desdobrar — isso resolve os dois problemas
  (duplicação E caixa esquisita) de uma vez, sem precisar tratar cada um separado.
- **Marcador de alternativa dentro do COMENTÁRIO (não da repetição do item) engana detecção por
  regex.** O autor às vezes analisa cada alternativa em linha própria dentro do próprio comentário
  ("a) Certa. ...", "b) Errada. ..."), que bate com o regex de alternativa (`^[a-e]\)\s+`). Se
  `extrair_comentarios` decidir "é repetição, não comentário" só pelo formato da linha, o comentário
  inteiro (item 17 da amostra de auditoria) some. A decisão tem que ser SÓ pelo salto vertical entre
  linhas (`_GAP_PARAGRAFO`), nunca pelo formato do texto.
- **Um comentário pode começar bem no topo de uma página nova — e ainda assim carregar o salto de
  parágrafo.** Esperava-se que a quebra de página "resetasse" a posição e escondesse o salto (como
  acontece quando uma ALTERNATIVA simplesmente continua na página seguinte, começando exatamente no
  topo padrão do corpo, ~98pt). Só que quando é de fato um COMENTÁRIO novo que calha de cair no topo
  de uma página (item 16, auditoria), o gerador do PDF NÃO recolhe o espaço "antes do parágrafo" —
  a linha ainda fica uns 20pt mais abaixo do topo padrão (~117pt em vez de ~98pt). `_TOPO_CORPO_PAGINA`
  em `lib/apostila.py` existe pra isso: ao cruzar página, usa um "bottom anterior" sintético baseado
  nesse topo padrão medido, em vez de simplesmente zerar o salto.
- **Reprocessar a apostila sem cache derruba `revisado_humano`.** `run.py` reconstrói
  `com_gabarito`/`classificado` chamando `lib.apostila.processar(...)` de novo a cada execução — sem
  uma entrada de manifesto própria (`"8_apostila"`, chave em `c.texto` + nome do perfil), rodar
  `run.py` depois de `8_revisar.py --aprovar` reescreve os JSONs do zero e volta todo mundo pra
  `revisado_humano=false`. Pego rodando o fluxo completo duas vezes em sequência durante a
  verificação manual deste trabalho — corrigido, mas é o tipo de regressão fácil de reintroduzir se
  alguém "simplificar" esse trecho depois.
- **Página de propaganda no fim do livro (Gran) não tem o rodapé padrão.** A última página de cada
  apostila é uma capa de propaganda ("Abra caminhos, crie futuros, gran.com.br") sem o aviso de
  licença nem "N de M" — não é cortada pela margem de rodapé e, se o último item do documento estiver
  em `GABARITO COMENTADO`, o comentário dele "vaza" pra dentro desse texto de propaganda (sem próximo
  marcador de item pra fechar o buffer). Corrigido com `descartar` explícito no perfil
  (`^abra$`/`^caminhos$`/`^crie$`/`^futuros$`), não no parser — é ruído de rodapé, mesma categoria do
  aviso de licença.
- **Itens sem comentário em `GABARITO COMENTADO` podem ser esperados, não bug.** Na apostila de
  auditoria, a seção "Questões Comentadas em Aula" (itens 1-14) não ganha comentário elaborado no
  final — só a grade de letra. `GABARITO COMENTADO` começa direto no item 15 ("Questões de
  Concurso"). Antes de tratar `itens sem comentário` como falha do parser, confira se o item
  realmente aparece em `GABARITO COMENTADO` no PDF — pode ser assim mesmo.
- **Nome de arquivo no CDN não é adivinhável (Cebraspe).** Editais e retificações vêm com hash
  SHA-256 (`54AC3A8B…​.html`). Só os cadernos e gabaritos seguem padrão legível (`MATRIZ_*.PDF`,
  `Gab_Definitivo_*.pdf`). O jeito é abrir a página do concurso e extrair
  `cdn\.cebraspe\.org\.br/concursos/[^"']+`.
- **Alguns gabaritos ficam atrás de `security.cebraspe.org.br`**, em consulta individual com CPF.
  Esses não entram: só o gabarito definitivo público em PDF.
- **Texto de apoio compartilhado** entre várias questões é o padrão do Cebraspe e é onde a
  segmentação ingênua quebra — amarrar por `texto_apoio_id`, nunca duplicar o texto.
- Os cadernos `*_COM_JUSTIFICATIVA.PDF` são ouro para os esquemas, mas são **texto autoral da
  banca**: servem de fonte, nunca de cópia (regra 5 do `CLAUDE.md`).

## Pendências

- Mapear individualmente os ~9 restantes de Auditoria e ~65 de Direito Civil que o dono ainda vai
  trazer. Vários "Parte I..VI" de Direito Civil **podem não ser monotemáticos** — conferir caso a
  caso antes de assumir 1 apostila = 1 assunto (a suposição de `classificacao_confianca = 1.0` direto
  do perfil só vale enquanto isso for verdade; uma apostila que misture assunto precisa segmentar por
  trecho, não pelo arquivo inteiro — ainda não há código pra isso).
- Ingerir a primeira prova oficial Cebraspe de verdade continua pendente. Candidatas por prioridade
  em `docs/04-fontes-de-questoes.md`: SEFAZ-RJ, SE e RN 2025/26; depois TCU 2025 AUFC; PGDF para
  Direito Civil. Depende do usuário baixar os PDFs e rodar o pipeline localmente — combinado, não
  feito.
- Perfis de layout para as provas da SEFAZ ainda não existem; só o do TCU foi escrito (e nunca
  testado contra PDF real).
- `7_publicar.py` ainda não escreve no Supabase (`--banco` desligado) — quando escrever, precisa
  decidir como `Prova.origem_fonte`/`autor_fonte`/`titulo_fonte` (nível artefato) viram
  `questao.origem_fonte`/`autor_fonte`/`titulo_fonte` (nível linha, ver `docs/agents/dados.md`,
  migration 0015) — hoje são a mesma informação em dois níveis diferentes de propósito.
- `acervo/provas/apostila_*.json` foram publicados nesta sessão mas ainda não foram conferidos pelo
  agente `esquemas` nem usados por nenhuma tela do app — só existem como artefato JSON no repo.
