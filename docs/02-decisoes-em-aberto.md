# Decisões em aberto — perguntas que definem o produto

Agrupadas por tema. As marcadas com ⭐ são as que travam o resto (serão perguntadas primeiro, em rodadas).

---

## A. Posicionamento e público

1. ⭐ O app é **"organizador de estudos"** (plano, ciclo, revisão — o Anki + planilha bem feitos), **"banco de questões"** (concorrer com Qconcursos), ou **"os dois integrados"** (mais valioso e mais caro)?
2. Público principal: **quem trabalha e estuda 2h/dia** (microlearning, áudio, offline) ou **quem estuda em tempo integral** (ciclo pesado, simulados longos)?
3. Nicho de largada: **concursos gerais**, **uma carreira específica** (policiais / tribunais / fiscal / bancário / área da saúde) ou **um edital específico** para validar rápido?
4. O app precisa funcionar para **qualquer edital cadastrado pelo usuário** desde o dia 1, ou basta um catálogo curado de concursos populares?
5. Vamos atender também **ENEM/vestibular/OAB** (mercado maior, foco menor) ou só concurso público?
6. Qual é a única frase que descreve o app na loja? ("O app que transforma seu edital em um plano diário" vs "1 milhão de questões no seu bolso" — as duas levam a produtos diferentes.)

## B. Conteúdo e questões

7. ⭐ De onde vêm as questões: **coletar provas oficiais em PDF** (fiel à banca, trabalhoso), **gerar com IA** a partir de lei seca/ementas (rápido, menos fiel), **colaborativo** (usuários cadastram), ou **começar sem questões próprias** (só organização)?
8. Se for coleta: começamos com **quantas bancas e quantos anos**? (sugestão: Cebraspe + FGV, últimos 5 anos, 3–4 disciplinas)
9. Quem escreve o **comentário/explicação** da questão: IA revisada, comunidade, ninguém (só gabarito) ou professor contratado?
10. Vamos ter **conteúdo teórico** próprio (resumos, lei seca, mapas mentais) ou o app só organiza o material que o aluno já tem?
11. Aceitamos **upload de PDF do aluno** (apostila do cursinho) para vincular ao edital — sabendo que isso é material de terceiro no nosso servidor?
12. Como garantimos **qualidade e correção** do gabarito (questões anuladas, mudança de lei, jurisprudência superada)? Precisa de fluxo de "reportar erro"?
13. As questões precisam suportar **texto de apoio compartilhado**, imagem, tabela e fórmula? (Muda bastante o esforço do parser e do app.)

## C. Escopo do MVP

14. ⭐ Se o MVP tiver **só 3 funcionalidades**, quais? (candidatas: edital verticalizado + ciclo de estudos + revisão espaçada automática do erro)
15. **Offline** é requisito do MVP ou fica para depois? (é caro, mas é uma das maiores fraquezas dos concorrentes)
16. Precisa de **login/conta** no MVP ou o primeiro app pode ser 100% local no aparelho?
17. Entra **simulado cronometrado** no MVP ou só resolução avulsa de questões?
18. **Notificações push** (lembrete de revisão) entram no MVP? Elas são o principal motor de retenção.
19. Qual o critério de sucesso do MVP: número de usuários, retenção em 7/30 dias, ou só "eu uso e funciona"?

## D. Metodologia de estudo

20. ⭐ O padrão do app é **ciclo de estudos** (fila que não pune atraso) ou **cronograma** (dia fixo/matéria fixa)? Suportar os dois dobra o trabalho.
21. Algoritmo de revisão: **FSRS** (moderno, melhor), **SM-2** (clássico do Anki) ou o esquema fixo **24h / 7d / 30d** (simples e familiar ao concurseiro)?
22. Todo **erro em questão** vira automaticamente item de revisão, ou o usuário escolhe o que revisar?
23. Vamos coletar **confiança declarada** ("chutei / dúvida / certeza") em cada resposta? Custa um toque a mais e habilita o diagnóstico de "falso domínio".
24. O plano de estudo é **gerado automaticamente** (data da prova + horas disponíveis + peso do assunto) ou **montado à mão** pelo usuário?
25. Como o app trata **atraso** no plano: replaneja sozinho, mostra dívida acumulada, ou ignora e segue?

## E. Monetização

26. ⭐ Modelo: **freemium** (grátis organiza, Pro libera questões/IA/estatísticas), **assinatura pura**, **pacotes avulsos**, ou **grátis mesmo** (projeto pessoal/portfólio)?
27. Se freemium: **o que exatamente fica de graça**? (limite de questões/dia? estatísticas básicas? sem simulado?)
28. Faixa de preço do Pro: R$ 9,90 / R$ 14,90 / R$ 19,90 / R$ 24,90 por mês? Anual com quantos % de desconto?
29. Pagamento por **loja (Google/Apple, taxa 15–30%)** ou **fora do app (Pix/cartão via web)**, que é mais barato e permitido para assinatura externa com ressalvas?
30. O objetivo é **negócio** (precisa de CNPJ, suporte, nota fiscal, LGPD levada a sério) ou **projeto pessoal/portfólio** primeiro?
31. Aceitamos **anúncios** em alguma parte do app? (recomendo que não — atrapalha o foco)

## F. Tecnologia e plataforma

32. ⭐ Plataforma: **Android primeiro**, **Android + iOS juntos** (Flutter/React Native) ou **web/PWA** primeiro?
33. Backend: **Supabase** (já conectado neste ambiente), Firebase, ou API própria?
34. Precisa de **versão web** para estudar no computador, ou o app é só mobile?
35. Você quer **código gerado por IA em ambiente visual** (ex.: Lovable, também conectado aqui) ou **repositório de código tradicional** que você versiona e roda localmente?
36. Qual seu nível de familiaridade com programação? Isso muda completamente a escolha de stack e o quanto o app pode crescer sem trava.
37. **LGPD**: vamos armazenar dados de desempenho de estudo (dado pessoal). Precisamos de política de privacidade e exclusão de conta desde o lançamento — ok?

## G. Recursos, prazo e execução

38. ⭐ Qual o **prazo** que você tem em mente para ter algo utilizável na mão? (2 semanas, 2 meses, 6 meses)
39. Quantas **horas por semana** você consegue dedicar ao projeto?
40. É você sozinho ou tem **sócio/designer/professor** envolvido?
41. Tem **orçamento** para custo mensal (servidor, API de IA, conta de desenvolvedor Google R$ ~130 uma vez / Apple US$ 99/ano)?
42. O nome e a marca já existem, ou faz parte do trabalho definir?
43. A intenção é **publicar nas lojas** ou pode começar como app web enviado por link?
