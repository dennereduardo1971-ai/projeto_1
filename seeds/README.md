# Seeds

Conteúdo canônico que o app precisa para existir, mas que **não é estrutura**.
Hoje há um só: a taxonomia de assuntos.

| Arquivo | O que é |
|---|---|
| `taxonomia.json` | Árvore `disciplina → assunto → tópico` de **Auditoria** e **Direito Civil** |
| `aplicar_seeds.sql` | Carrega o JSON no banco, por upsert de `slug` |

## Por que é seed e não migration

Migration é **estrutura** — tabela, coluna, índice, política. Ela é aplicada uma
vez, na ordem, e nunca se reescreve.

A taxonomia é **conteúdo**, e conteúdo provisório: esta árvore foi desenhada
antes da primeira ingestão de provas. A regra do projeto é que **é a prova quem
revela o que a banca chama de assunto**, não o índice do livro — então ela vai
ser remapeada assim que as provas Cebraspe entrarem. Se ela estivesse dentro de
uma migration, cada correção viraria uma migration nova de `UPDATE`, e o
histórico de estrutura ficaria enterrado em ajuste de texto.

Como seed, a árvore vive num JSON legível, versionado no git, com `diff`
inteligível, e é recarregada quantas vezes for preciso.

## Como rodar (quando houver banco)

**Nenhum projeto Supabase foi criado ainda.** Isto aqui é para quando houver.
As migrations de `supabase/migrations/` precisam estar aplicadas antes.

A partir da **raiz do repositório**:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f seeds/aplicar_seeds.sql
```

De qualquer outro diretório, passando o JSON na mão:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
     -v taxonomia="$(cat seeds/taxonomia.json)" \
     -f seeds/aplicar_seeds.sql
```

O script roda numa transação só e imprime, no fim, a contagem por disciplina.

**Permissão:** as políticas de RLS (migration `0012_rls.sql`) não abrem escrita
no acervo para ninguém. Rode como dono das tabelas — no Supabase, com a chave
`service_role`.

## Regras do arquivo

1. **`slug` é a chave.** O upsert é por `slug`. Renomear `nome` é de graça;
   trocar um `slug` cria um assunto novo e deixa o antigo órfão, levando junto
   as questões, esquemas e o progresso que já apontavam para ele.
2. **Nunca reaproveitar um `slug`** para outro conteúdo. Prefira criar um novo.
3. **O script não apaga nada.** Slug que sumir do JSON continua no banco e é
   listado no fim da execução como órfão. Remapear é decisão humana — pode haver
   progresso de estudo pendurado ali.
4. **Um tópico é um assunto com pai.** No banco não existe tabela `topico`:
   `assunto` é uma árvore. O JSON usa a chave `topicos` só porque é mais fácil de
   ler e de revisar.
5. **Suba a `versao`** do JSON a cada alteração relevante, e atualize a `nota`
   quando a origem da árvore mudar (por exemplo, depois do remapeamento pelas
   provas).

## Estado atual

| Disciplina | Assuntos | Tópicos |
|---|---|---|
| Auditoria | 14 | 72 |
| Direito Civil | 14 | 72 |

Provisória, versão 1, gerada em 2026-08-20. Sem nenhuma questão ainda ligada a
ela — o custo de remapear hoje é zero, e vai crescendo a cada prova ingerida.
