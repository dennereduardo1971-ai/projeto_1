# Largue os PDFs aqui

Esta é a única pasta de `data/` que existe no git — e ela existe só para você
saber onde colocar os arquivos.

## Como usar

Crie uma subpasta com o **slug da prova** e jogue os PDFs dentro:

```
data/00_manual/
└── tcu_25_aufc/
    ├── MATRIZ_xxx_TCU_001.PDF              ← caderno de provas  (obrigatório)
    ├── Gab_Definitivo_xxx_TCU_001_01.pdf   ← gabarito DEFINITIVO (obrigatório)
    └── MATRIZ_xxx_TCU_001_COM_JUSTIFICATIVA.PDF   ← opcional
```

Nome do arquivo não importa; o pipeline identifica pelo conteúdo:

| Contém | É tratado como |
|---|---|
| `GAB` + `DEFINITIVO` no nome, ou tabela de gabarito no texto | gabarito definitivo |
| `COM_JUSTIFICATIVA` no nome | caderno com justificativa da banca |
| o resto | caderno de provas |

**Gabarito preliminar não serve.** Se só houver preliminar, a prova para em
`pendente_definitivo` e nada é publicado.

Depois: `python3 scripts/ingest/run.py tcu_25_aufc --local`

Tudo o mais dentro de `data/` é gerado pelo pipeline e está no `.gitignore`,
inclusive `data/justificativas/` — que é texto autoral da banca e **nunca** entra
no git nem no app.
