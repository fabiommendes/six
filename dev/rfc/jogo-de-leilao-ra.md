---
type: rfc
status: draft
tags: [jogo-novo, design, leilao]
relatedTo: [dev/rfc/nomes-dos-jogos.md, dev/notes/referencias.md, regras/kit.md]
created: 2026-10-21
creator: claude
---

# Jogo novo: uma releitura do *Ra* com dados

## Problem

A coleção prevê um jogo de leilão (`dev/rfc/nomes-dos-jogos.md`). O *Ra*
(Reiner Knizia, 1999) é um clássico do gênero, e a sua estrutura passa
quase inteira para dados:

- um lote que cresce, peça por peça, até alguém chamar o leilão;
- um cronômetro escondido no saco: cada peça de Ra tirada aproxima o fim
  da era e força um leilão;
- uma moeda que circula: quem vence o leilão dá o sol que usou para o
  centro e leva o sol que estava lá. Um lance alto custa caro mais tarde;
- categorias que pontuam de jeitos diferentes: maioria, variedade,
  conjuntos e itens que só valem acompanhados.

No *Ra*, 30 das 180 peças são de Ra: 1 em cada 6. Um dado mostra 1 com a
mesma chance. O cronômetro vira a face 1, e a cor e o número de cada dado
fazem o papel das peças.

## Proposal

Premissas desta fase: até 5 naipes (cores) de dados, e nenhum limite de
dados. O kit final sai depois de o jogo ser validado. Os naipes têm nomes
provisórios, pela categoria do *Ra* de que tomam o papel.

### Componentes

- Um saco com dados dos 5 naipes, em proporções diferentes (abaixo).
- Uma trilha do lote, com 8 casas, e uma trilha de Ra.
- Os sóis: dados que ficam fora do saco.

### Os naipes

| Naipe | Papel no *Ra* | Fica entre as eras? | Pontua |
|---|---|---|---|
| Faraó | faraós | sim | no fim de cada era, maior soma dos números: +5; menor: -2 |
| Nilo | Nilo e cheias | sim; as cheias saem | um dado com 5 ou 6 é cheia. Cada cheia vale 1. Cada Nilo vale 1, se o jogador tem uma cheia |
| Civilização | civilizações | não | os números de 2 a 6 são os 5 tipos. Nenhum dado: -5; 3 tipos: +5; 4: +10; 5: +15 |
| Monumento | monumentos | sim | só no fim do jogo: 3 do mesmo número valem 5, 4 valem 10, 5 valem 15. Mais 1 por número diferente, e 10 se tiver os 5 |
| Deus | deuses | não | no turno, em vez de tirar, descarte um Deus para pegar um dado do lote. Cada Deus que sobrar no fim da era vale 2 |

O ouro do *Ra* sai: com 5 naipes, ele é o que menos acrescenta.

Proporções propostas para o saco, perto das do *Ra*: Monumento 3, Nilo 3,
Faraó 2, Civilização 2 e Deus 1, em 11.

### Os sóis

Cada sol é um dado com um número e um naipe fixos, e um sol vence outro
pelo número; com o mesmo número, pelo naipe, numa ordem fixa entre 3
naipes. Isso dá 18 valores diferentes, e os sóis repetem os conjuntos do
*Ra*:

| Jogadores | Sóis de cada um | Postos do *Ra* |
|---|---|---|
| 3 | 4 | (13, 8, 5, 2), (12, 9, 6, 3), (11, 10, 7, 4) |
| 4 | 3 | (13, 6, 2), (12, 7, 3), (11, 8, 4), (10, 9, 5) |
| 5 | 3 | (16, 7, 2), (15, 8, 3), (14, 9, 4), (13, 10, 5), (12, 11, 6) |

O posto 1 é o sol do centro no começo. O posto `p` é o número
`(p + 2) / 3`, arredondado para baixo, com o naipe dado pelo resto da
divisão de `p - 1` por 3.

### Turno

O jogador faz uma de três coisas:

1. **Tirar**: tira um dado do saco e o rola.
   - Com um número de 2 a 6, o dado entra no lote.
   - Com 1, é um Ra: o dado vai para a trilha de Ra e começa um leilão. O
     lote desse leilão leva um desastre do naipe do Ra: quem vencer descarta
     1 dado desse naipe da sua coleção.
   - Com o lote cheio (8 dados), não se pode tirar.
2. **Chamar Ra**: começa um leilão, mesmo com o lote vazio.
3. **Usar um Deus** (acima).

### Leilão

- A partir do jogador seguinte a quem começou o leilão, cada um dá um
  lance com um sol, maior que o lance mais alto até ali, ou passa. Quem
  começou o leilão fala por último.
- Quem chamou Ra e viu todos passarem é obrigado a dar um lance, se tiver
  sol.
- Quem vence leva os dados do lote para a sua coleção e leva o sol do
  centro, que só pode usar na era seguinte. O sol do lance vai para o
  centro.
- Se todos passarem, o lote fica, a não ser que esteja cheio: aí é
  descartado.
- Quem já usou todos os sóis da era não joga mais nela.

### Fim da era e do jogo

A era acaba quando a trilha de Ra se completa (8, 9 ou 10 Ras com 3, 4 ou
5 jogadores; o Ra que completa a trilha não abre leilão) ou quando ninguém
tem mais sol. Cada era pontua faraós, Nilo, civilização e deuses. Depois,
saem as cheias, as civilizações, os deuses e o lote.

O jogo tem 3 eras. No fim, pontuam os monumentos e os sóis: a maior soma
de postos ganha 5 pontos, e a menor perde 5.

Com o Ra saindo em 1 de cada 6 dados, a era dura em média 48 a 60 dados
tirados, como no *Ra*.

### O que os dados acrescentam

- O número de cada dado é um segundo eixo da peça: o tipo na civilização e
  no monumento, o peso nos faraós e a cheia no Nilo. Com peças, é preciso
  um tipo diferente para cada coisa.
- Sem limite de dados, nada se esgota: cada dado tirado tem as mesmas
  chances. No *Ra*, quem conta as peças que já saíram sabe o que ainda
  vem.
- O desastre está na cor do Ra que abre o leilão. Assim todo leilão
  forçado tem um risco visível desde o começo.

### Versão digital

A informação escondida são os dados futuros, como no Liu. O leilão é um
lance por jogador, numa ordem fixa, então há poucas jogadas: no turno,
três ações; no leilão, um dos sóis ou passar. O motor, o PIMC e a calibração do Liu servem de
molde.

## Alternatives

- **Sóis de um número só**, sem desempate pelo naipe: os empates se
  resolvem pela ordem dos lances (quem fala primeiro leva). Os sóis ficam
  mais simples, mas grossos demais para 3 a 5 jogadores, com 13 a 16
  sóis.
- **Sóis rolados**: quando o sol do lance vai para o centro, ele é rolado
  de novo. Traz mais sorte e tira a decisão central do *Ra*, que é saber
  quanto se entrega ao próximo.
- **Desastres como no *Ra***, só com alguns dados do saco (por exemplo, o
  Ra de um naipe só). Aproxima a frequência da do *Ra*.
- **Ouro no lugar do Deus**: um naipe que vale o número do dado e sai no
  fim da era. É mais simples, mas o Deus é a única jogada que tira um dado
  do lote sem leilão.
- **Leilão holandês** (o lote cresce e o preço desce a cada turno), a ideia
  anterior. Mais curto e mais simples, mas sem o sol que circula.

## Open questions

- O desastre em todo leilão forçado é frequente demais? No *Ra*, cerca de 1
  lote em 5 tem um desastre; aqui, todo leilão forçado tem. A proposta de
  descartar 1 dado, e não 2 como no *Ra*, compensa só em parte.
- As proporções do saco e a pontuação do monumento, que tem 5 números
  contra 8 tipos no *Ra*.
- O número do Faraó soma ou conta? Somar dá peso ao número; contar é
  mais simples e mais perto do *Ra*.
- Versão para 2 jogadores, como na edição de 2009 do *Ra*.
- O físico precisa de um bloco de pontos e de um jeito de marcar o sol que
  só vale na próxima era.
- Nome. *Zes* (holandês) vinha do leilão holandês. Com o *Ra*, o tema é o
  Egito, e o candidato é **Sitta** (árabe, "síta"). Falta conferir no
  BoardGameGeek.

## Outcome
