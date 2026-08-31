# Fontes de questões — pesquisa profunda (Cebraspe)

Objetivo: saber exatamente **de onde** vêm as questões antes de escrever qualquer linha de código.
Alvo: **Auditor-Fiscal da Receita Federal do Brasil (AFRFB)**. Banca de origem das questões: **Cebraspe, exclusivamente.**

---

## 1. Dois achados que mudam o plano

### 1.1 A Receita Federal não é um concurso Cebraspe

- O concurso RFB **2026 foi autorizado** em 03/07/2026 (Portaria MGI nº 5.505/2026): **146 vagas — 30 de Auditor-Fiscal** e 116 de Analista-Tributário. Prazo para publicar o edital: **até 03/01/2027**.
- **A banca ainda não foi contratada.** O último concurso (2022/2023, 699 vagas) foi da **FGV**; antes disso, a ESAF.
- A prova de Auditor-Fiscal da FGV em 2023 teve **140 questões de múltipla escolha (A–E)**, em 16 disciplinas, com corte de 50% em Básicos e 50% em Específicos e nota zero eliminatória em qualquer disciplina. Auditoria valeu 8 questões; Direito Tributário é a maior fatia.

**O que isso significa:** treinar exclusivamente com Cebraspe para um concurso que provavelmente será de outra banca é uma escolha consciente de **conteúdo sobre estilo** — e é defensável, porque:
1. o **conteúdo** de Auditoria, Direito Civil e Direito Tributário é o mesmo, independente de quem escreve a prova;
2. o Cebraspe é hoje a banca com **mais provas fiscais recentes** (SEFAZ-RJ, SE e RN em 2025/26) e mais provas de auditoria (TCU, TCEs);
3. quando a banca da RFB for anunciada (até jan/2027), a arquitetura do app já suporta trocar/somar banca sem refazer nada — `banca` é uma coluna, não uma premissa.

> **Recomendação:** manter Cebraspe agora, como você decidiu, e reavaliar assim que sair a banca do edital. Deixo isso registrado como ponto de revisão, não como objeção.

### 1.2 Cebraspe **não** é sempre "Certo/Errado" — e isso corrige o plano anterior

No documento `03-plano-do-produto.md` eu escrevi que o placar do app seria sempre líquido (`acertos − erros`), porque erro anula acerto no Cebraspe. **Isso vale para parte das provas, não para todas.**

| Prova | Formato observado |
|---|---|
| TCU 2025 (AUFC) | Certo/Errado — erro anula acerto |
| SEFAZ-RJ 2025 (Auditor) | Múltipla escolha ("assinale a opção") — *a confirmar no caderno oficial* |
| AFRFB 2023 (FGV) | Múltipla escolha A–E, sem anulação por erro |

**Correção no produto:** a regra de pontuação passa a ser **atributo da prova**, não do app. Cada `prova` guarda `formato` (`ce` \| `multipla`) e `penalidade_por_erro` (bool). O placar líquido aparece só onde a prova realmente pune o erro — em prova de múltipla escolha, mostrar "líquido" seria mentir na direção oposta.

---

## 1.3 Nova origem: apostila comentada de terceiro (decisão de 2026-08-31)

O pipeline abaixo (seções 2–3) continua valendo **integralmente** para prova oficial Cebraspe — nada
foi apagado, porque volta a ser o caminho principal assim que a banca da RFB sair. Mas o gargalo real
era ingerir a primeira prova real, e o usuário decidiu destravar por outra via: alimentar o acervo com
**PDFs de apostilas comentadas de terceiros** (estilo "professora Tamayo" — questão, gabarito e
comentário da própria autora, tudo no mesmo documento), começando por Auditoria e Direito Civil.

Isso cria uma **segunda origem de questão**, `origem_fonte = 'apostila_comentada'`, ao lado da
`'prova_oficial'` descrita nas seções seguintes:

| | `prova_oficial` (Cebraspe) | `apostila_comentada` (terceiro) |
|---|---|---|
| Gabarito | casado com o definitivo da banca (regra 3) | não existe "definitivo da banca" — publica com `revisado_humano = true` |
| Comentário | nunca republica o da banca (regra 5); escrevemos o nosso | comentário do autor pode ser guardado e exibido, com atribuição obrigatória |
| Atribuição | banca, ano, órgão, cargo, número original | autor e título da apostila (`autor_fonte`, `titulo_fonte`) |
| Onde mora | `scripts/ingest/perfis/*` (perfil por prova Cebraspe) | `scripts/ingest/perfis/apostila_generico.yaml` (chute inicial de layout) |

**Pendência explícita:** o perfil `apostila_generico.yaml` foi escrito **sem PDF de amostra em mãos** —
é um chute de layout comum (nº da questão, marcador "Gabarito:", marcador "Comentário:"). Ajustar
assim que a primeira apostila real (Auditoria ou Direito Civil) chegar. Ver `docs/agents/coletor.md`.

Ambas as exceções (regras 3 e 5 do `CLAUDE.md`) estão marcadas como **temporárias — revisar antes de
lançamento público ou monetização**. A pesquisa jurídica da seção 4 abaixo, sobre justificativa da
banca, não muda: ela é sobre uma origem diferente e mais delicada (texto oficial da banca), não sobre
o comentário de um professor terceiro em material próprio dele.

---

## 2. Onde as provas moram (mapeado)

### 2.1 Padrão de URL do Cebraspe

```
Página do concurso:  https://www.cebraspe.org.br/concursos/{slug}
Arquivos:            https://cdn.cebraspe.org.br/concursos/{slug}/arquivos/{arquivo}
```

Slugs são previsíveis (`sefaz_rj_25_auditor`, `sefaz_se_25_auditor`, `sefaz_rn_25_auditor`, `tcu_25_aufc`, `tce_mg_25`, `sefaz_ce_21`) e **case-insensitive na prática** (aparecem em maiúsculas e minúsculas).

**Nomes de arquivo — três famílias observadas:**

| Padrão | Exemplo real | O que é |
|---|---|---|
| `MATRIZ_{cod}_{SIGLA}_{cargo}_{tipo}.PDF` | `540_PMBC_029_MATRIZ.PDF` · `MATRIZ_579_ANM.PDF` | Caderno de provas |
| `..._COM_JUSTIFICATIVA.PDF` | `MATRIZ_521_PGDF_006_COM_JUSTIFICATIVA.PDF` | **Caderno + justificativa oficial da banca** |
| `Gab_Definitivo_{cod}_{SIGLA}_{...}.pdf` | `Gab_Definitivo_060_SEFAZRJAUDITOR_002_01.pdf` | Gabarito definitivo |
| `{SHA256}.pdf` / `.html` | `54AC3A8B24...CD7.html` | Editais e retificações |

**Consequência prática:** o nome do arquivo **não é adivinhável** nos casos com hash. O coletor precisa **abrir a página do concurso e extrair os links** com regex `cdn\.cebraspe\.org\.br/concursos/[^"']+`. Se a página for renderizada por JavaScript, cai para Playwright (já instalado no ambiente de desenvolvimento).

**Achado valioso:** os cadernos `COM_JUSTIFICATIVA` trazem a **justificativa da própria banca** para cada item. É o melhor insumo possível para os esquemas — mas é texto autoral da banca: **serve de fonte para escrever nosso próprio esquema, não para republicar literalmente.**

**Ponto de atenção:** alguns gabaritos ficam em `security.cebraspe.org.br` em consulta individual (exige CPF/inscrição). Esses não entram no pipeline — só o **gabarito definitivo público em PDF**.

### 2.2 Catálogo alvo — provas Cebraspe que servem ao perfil AFRFB

| Prioridade | Concurso | Slug provável | Por que interessa |
|---|---|---|---|
| **1** | SEFAZ-RJ 2025 — Auditor Fiscal | `sefaz_rj_25_auditor` | Prova fiscal mais recente e completa; 40 questões só de Tributário/Legislação |
| **1** | SEFAZ-SE 2025 — Auditor Fiscal Tributário | `sefaz_se_25_auditor` | Mesmo perfil, três especialidades |
| **1** | SEFAZ-RN 2025/26 — Auditor Fiscal | `sefaz_rn_25_auditor` | Provas em março/2026 — material novíssimo |
| **2** | TCU 2025 — AUFC | `tcu_25_aufc` | Auditoria em profundidade; formato Certo/Errado |
| **2** | SEFAZ-CE 2021 — Auditor Fiscal | `sefaz_ce_21` | Fiscal, mesma banca |
| **2** | SEFAZ-AL 2020/2021 — Auditor Fiscal | a confirmar | Fiscal |
| **2** | SEFAZ-RR 2021 — Auditor Fiscal | a confirmar | Fiscal |
| **3** | TCE-RS 2025, TCE-MG 2025, TC-DF | `tce_mg_25` etc. | Auditoria e controle |
| **3** | PGDF 2019 e correlatos | `pg_df_19` | **Direito Civil denso** — e com `COM_JUSTIFICATIVA` |

Isso cobre as duas matérias-piloto: **Auditoria** vem de TCU/TCEs e das provas fiscais; **Direito Civil** vem das provas fiscais e das procuradorias.

### 2.3 Restrição do ambiente (verificada agora)

Testei o acesso a partir desta sessão remota:

```
000  https://www.cebraspe.org.br/      000  https://cdn.cebraspe.org.br/
000  https://www.pciconcursos.com.br/  000  https://www.qconcursos.com/
000  https://conhecimento.fgv.br/      000  https://www.gov.br/receitafederal/
```

**Todos bloqueados pela política de rede desta sessão** (`EGRESS_BLOCKED` no proxy). Só a busca na web funciona aqui.

**Portanto:** o coletor é um script Python versionado no repositório, que **você roda na sua máquina** (ou em qualquer ambiente com rede liberada). Ele grava os PDFs e um JSON normalizado; o app consome o JSON. Isso é bom para o projeto de qualquer forma — a ingestão não deve depender de um ambiente efêmero.

---

## 3. Pipeline de ingestão (desenho)

```
scripts/ingest/
├── 1_descobrir.py     lê a página do concurso, extrai links do CDN, grava fontes.json
├── 2_baixar.py        baixa PDFs (prova, gabarito, edital) com cache por hash
├── 3_extrair.py       pdfplumber → texto com coordenadas; OCR só se necessário
├── 4_segmentar.py     quebra em itens/questões + amarra textos de apoio compartilhados
├── 5_gabarito.py      casa cada questão com o gabarito definitivo e marca anuladas
├── 6_classificar.py   atribui disciplina/assunto (LLM) e grava confiança da classificação
└── 7_publicar.py      valida e envia para o Supabase
```

Formato intermediário (um arquivo por prova, versionado em JSON — auditável e reprocessável):

```json
{
  "prova": {
    "banca": "CEBRASPE", "ano": 2025, "orgao": "SEFAZ-RJ",
    "cargo": "Auditor Fiscal da Receita Estadual (3ª categoria)",
    "formato": "multipla", "penalidade_por_erro": false,
    "fonte_pdf": "https://cdn.cebraspe.org.br/concursos/sefaz_rj_25_auditor/arquivos/…",
    "fonte_gabarito": "https://cdn.cebraspe.org.br/…/Gab_Definitivo_060_SEFAZRJAUDITOR_002_01.pdf"
  },
  "questoes": [{
    "numero": 37, "enunciado": "…", "texto_apoio_id": "TA-3",
    "alternativas": [{"letra":"A","texto":"…"}],
    "gabarito": "C", "anulada": false,
    "disciplina": "Auditoria", "assunto": "Amostragem em auditoria (NBC TA 530)",
    "classificacao_confianca": 0.86
  }]
}
```

### Regras de qualidade (não negociáveis)
1. Questão só entra no app depois de **casar com o gabarito definitivo**. Sem gabarito, não publica.
2. **Anuladas** são importadas e marcadas — servem para estudo, não para estatística.
3. Classificação com confiança abaixo de um limiar vai para **fila de revisão sua**, não direto ao ar.
4. Toda questão guarda **banca, ano, órgão, cargo e número original** — atribuição obrigatória.
5. Provas têm **cadernos por cor/tipo** (Tipo 1 Branca, Tipo 4 Azul…) com a mesma questão em ordem diferente: usar **um tipo por prova** e deduplicar pelo enunciado.

### Riscos técnicos já identificados
- **Texto de apoio compartilhado** entre várias questões (padrão Cebraspe) — a segmentação ingênua duplica ou perde contexto. É o ponto que mais vai exigir ajuste manual.
- **Tabelas, fórmulas e imagens** em Contabilidade/Auditoria não sobrevivem a extração de texto puro. Precisa de captura da região da página como imagem.
- **Provas antigas escaneadas** exigem OCR, com taxa de erro maior.
- **Mudança de layout** entre anos: o parser precisa ser por prova, com um "perfil" ajustável, não um regex único.

---

## 4. Regras jurídicas do projeto

- **Questões:** o TJ-SP (3ª Câmara de Direito Privado, 2024) firmou que questão de prova, por si só, **não tem proteção autoral** — falta originalidade e o acervo não é base de dados protegida. Uso liberado **com atribuição**.
- **Justificativas e comentários da banca:** são texto autoral. **Não republicar literalmente.** Usar como fonte para escrever esquema próprio, citando a prova de origem.
- **Editais:** atos oficiais, sem proteção autoral. Podem ser reproduzidos.
- **Agregadores (Qconcursos, PCI, Provas Brasil):** usar apenas como **índice para descobrir** qual prova existe. O download vem da fonte oficial. Não raspar acervo de concorrente.
- Coletor com `User-Agent` identificável, 1 requisição a cada 2 segundos e cache local — sem martelar o servidor da banca.

---

## 5. O que preciso de você para a Fase 2

1. Confirmar se topa que o acervo inicial seja **fiscal estadual + controle** (SEFAZ-RJ/SE/RN, TCU, TCEs) — já que a RFB não tem prova Cebraspe.
2. Rodar o coletor na sua máquina quando ele estiver pronto (é um comando só; eu documento).
3. Revisar por amostragem a classificação por assunto das primeiras 200 questões — depois disso o classificador já tem calibragem.
