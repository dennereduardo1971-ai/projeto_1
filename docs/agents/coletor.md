# Diário — coletor

> Preenchido pelo próprio agente conforme o projeto anda. Ver `docs/agents/00-protocolo.md`.

## Estado atual

O pipeline existe inteiro e passa nos testes; o **acervo está vazio**. Nenhuma prova real foi
ingerida até hoje — `acervo/provas/` e `acervo/fila_revisao/` estão sem conteúdo e não há nenhum
PDF em `data/`.

```
scripts/ingest/
├── run.py               orquestra as 7 etapas, respeita cache, --ate N, --check
├── 1_descobrir.py … 7_publicar.py
├── lib/                 cache, caminhos, modelos, perfil, rede, regioes, validador
├── perfis/              _base.yaml · ce_bloco.yaml · multipla_5.yaml · tcu_25_aufc.yaml
├── schema/              fontes.schema.json · prova.schema.json
└── tests/               16 testes, todos passando (pytest, 1,5 s)
```

Perfil por prova, não regex único: `_base.yaml` traz o comum, e cada layout ganha o seu. Já existem
perfis para bloco Certo/Errado, múltipla escolha de 5 alternativas e o TCU 2025 AUFC.

## Decisões

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

- **Nome de arquivo no CDN não é adivinhável.** Editais e retificações vêm com hash SHA-256
  (`54AC3A8B…​.html`). Só os cadernos e gabaritos seguem padrão legível (`MATRIZ_*.PDF`,
  `Gab_Definitivo_*.pdf`). O jeito é abrir a página do concurso e extrair
  `cdn\.cebraspe\.org\.br/concursos/[^"']+`.
- **Alguns gabaritos ficam atrás de `security.cebraspe.org.br`**, em consulta individual com CPF.
  Esses não entram: só o gabarito definitivo público em PDF.
- **Texto de apoio compartilhado** entre várias questões é o padrão do Cebraspe e é onde a
  segmentação ingênua quebra — amarrar por `texto_apoio_id`, nunca duplicar o texto.
- Os cadernos `*_COM_JUSTIFICATIVA.PDF` são ouro para os esquemas, mas são **texto autoral da
  banca**: servem de fonte, nunca de cópia (regra 5 do `CLAUDE.md`).

## Pendências

- Ingerir a primeira prova de verdade. Candidatas por prioridade em `docs/04-fontes-de-questoes.md`:
  SEFAZ-RJ, SE e RN 2025/26; depois TCU 2025 AUFC; PGDF para Direito Civil.
- Isso depende do usuário baixar os PDFs e rodar o pipeline localmente — está combinado, não feito.
- Perfis de layout para as provas da SEFAZ ainda não existem; só o do TCU foi escrito.
