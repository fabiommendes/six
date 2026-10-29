---
type: rfc
status: draft
tags: [jogo-novo, design, corrida]
relatedTo: [dev/rfc/nomes-dos-jogos.md, dev/notes/referencias.md, regras/kit.md]
created: 2026-10-28
creator: claude
---

# Jogo de corrida: o Jogo Real de Ur com dados que lutam

## Problem

A coleção tem um abstrato sem sorte (Seks), um jogo de seleção de dados
(Liu) e um duelo de formações (Sia). Falta um jogo de corrida, o gênero mais
antigo dos jogos de dados.

O gamão foi a primeira ideia, mas ficou perto demais do original. O *Jogo
Real de Ur* é mais simples: uma rolagem por turno, uma peça movida, captura
ao cair na casa do adversário e rosetas que protegem e dão outra rolagem. Ele deixa espaço para
uma regra nova, e a regra nova vem do componente: a peça é um dado, e o valor
dele é ao mesmo tempo força e pontos.

## Proposal

### Componentes

- O tabuleiro de 11 por 11 do Seks.
- 6 dados de uma cor para cada jogador, mais dados de reserva da mesma cor
  (as capturas criam dados novos, ver [Comer](#comer)).
- 4 **dados binários**: dados de seis faces com 3 faces lisas (0) e 3 faces
  com 1 ponto (1). São
  componentes novos no kit; o deck builder planejado também pede dados de
  faces especiais.

### Trilha

A trilha é a do tabuleiro de Ur, nas fileiras 5, 6 e 7: as pistas próprias
têm um vão, e a pista do meio é compartilhada.

- **Pista de entrada**, própria: na fileira 5 para as Brancas e na 7 para as
  Pretas, da coluna 6 à coluna 3 (casas 1 a 4).
- **Pista do meio**, compartilhada: a fileira 6, da coluna 3 à 10 (casas 5 a
  12). Os dois jogadores andam no mesmo sentido.
- **Pista de saída**, própria: de volta à fileira de cada um, da coluna 10 à
  9 (casas 13 e 14).
- **Saída**: a casa 15, fora do tabuleiro.

As colunas 7 e 8 das fileiras 5 e 7 são o vão do tabuleiro de Ur. As
**rosetas** são as do Ur: a última casa da pista de entrada (casa 4), a
casa vermelha do centro (casa 8, a quarta da pista do meio) e a última casa
da pista de saída (casa 14).

### Preparação

Cada jogador põe os seus 6 dados na **reserva**, mostrando os valores de 1 a
6.

### Turno

1. O jogador rola os 4 dados binários e soma: o resultado vai de 1 a 4. Se
   todos derem 0, ele rola de novo, até sair um número diferente de 0. No
   Ur, os dados tetraédricos dão de 0 a 4, e com 0 o jogador passa.
2. Ele move um dado seu exatamente esse número de casas, ou entra com um dado
   da reserva na casa de mesmo número.
3. **Ordem de entrada**: da reserva, entra sempre o dado de menor valor.
4. Se houver jogada possível, ele é obrigado a jogar.

### Fundir

Um dado que termina numa casa com outro dado do mesmo jogador se funde com
ele: fica um dado só, com a soma dos valores. O que passar de 6 se perde.

### Comer e desgastar

Um dado que termina numa casa com um dado do adversário:

- **Come, se for maior**: o dado do adversário volta para a reserva dele. O
  seu fica na casa com o seu valor menos o do comido, mais 1, e você ganha
  na sua reserva um dado novo com o valor do comido. Um 5 que come um 2
  vira 4 e põe um 2 na reserva.
- **Desgasta, se for menor ou igual**: o seu dado volta para a sua reserva,
  e o dado do adversário perde o valor do seu para sempre. Um 2 que para
  num 5 deixa um 3. Um dado de mesmo valor zera o outro, que sai do jogo.

> **Design:** o desgaste impede que um dado grande sirva de barreira aos
> pequenos, e torna arriscado levar um dado grande até a saída.

### Encostar

Na pista do meio, um dado que termina na casa logo atrás de um dado do
adversário tira 1 do valor dele. Um 1 não perde. Passar por cima de dados do
adversário não custa nada.

### Rosetas

Um dado que termina numa roseta joga de novo. Um dado na roseta do centro
não pode ser comido, desgastado nem encostado, e o adversário não pode
terminar nela. As outras duas ficam nas pistas próprias, fora do alcance do
adversário.

### Saída e fim

- Um dado sai com o número exato que o leva à casa 15. O valor dele vira
  pontos do dono.
- Vence quem chegar a 10 pontos.
- Quem tira da trilha todos os seus dados, com a reserva vazia, encerra a
  partida: vence quem tem mais pontos e, no empate, quem encerrou.

> **Design:** os dois lados começam com 21 pontos. O desgaste e o encostar
> queimam pontos, e a perda acima de 6 na fusão também. Uma
> partida com muito contato pode deixar os dois abaixo de 10, e aí só a
> segunda condição decide. Ela não dá a vitória a quem leva todos os dados:
> sem isso, fundir os dados e queimar pontos para levar menos dados vencia
> (ver [Medições](#medições)).

### O que os dados acrescentam ao Ur

- O valor faz do dado ao mesmo tempo peça, força e pontos.
- Comer divide o seu dado, em vez de só atrasar o do adversário.
- Um dado pequeno pode se sacrificar para desgastar para sempre um dado
  grande perto da saída.
- A ordem de entrada força os dados pequenos a ir primeiro, e uma captura
  enche a reserva de dados pequenos, que atrasam os grandes.
- A fusão junta os pequenos num dado forte, perdendo o excesso.

## Alternatives

- **Gamão com a pilha no dado** (anel de 24 casas num quadrado 7x7, com o
  valor contando as peças da pilha): descartado por ficar perto demais do
  gamão.
- **Valor como pilha no Ur** (6 peças, pilhas de até 6): substituído pelo
  valor como força, que cria mais decisões a cada contato.
- **Rolagem com 4 dados comuns, contando os altos** (4 a 6): mesma
  distribuição, sem componente novo. Descartado porque o deck builder já pede
  dados especiais, e o dado binário é mais fácil de ler.

## Decisions

- 2026-10-28, designer: 4 dados binários; 6 dados por jogador, com os valores
  de 1 a 6; a jogada leva o dado inteiro; comer, ultrapassar e encostar como
  acima; vitória com 12 pontos ou com todos os dados levados.
- 2026-10-28, designer: entra primeiro o menor dado da reserva; dados do
  mesmo jogador se fundem, e o excesso acima de 6 se perde; a roseta protege
  de comer e de encostar; ultrapassar tira 1 por jogada; a saída pede número
  exato.
- 2026-10-28, designer: levar todos os dados encerra a partida, e vence
  quem tem mais pontos; no empate, quem encerrou.
- 2026-10-28, designer, depois das medições: sem lance extra, e a única
  roseta é a casa vermelha do centro; a entrada continua em ordem.
- 2026-10-28, designer: se os 4 dados binários derem 0, o jogador rola de
  novo até sair um número diferente de 0.
- 2026-10-28, designer, para cortar os ciclos longos de comer e ganhar dado
  e acabar com a barreira dos dados grandes: ultrapassar não custa nada;
  comer com um dado maior deixa o seu valor menos o do comido, mais 1; um
  dado menor ou igual volta para a reserva e desgasta para sempre o dado do
  adversário; a trilha passa a ser a do Ur (14 casas), com as três rosetas
  dando outra jogada e a do centro protegendo. Isso substitui as decisões
  anteriores sobre a trilha, o lance extra e a troca.
- 2026-10-28, designer: a meta cai de 12 para 10 pontos, para medir.

## Open questions

- **Meta de pontos**: com 10, 55% das partidas entre dois expectimax acabam
  na meta. Manter 10 ou tirar a meta? Ver [Medições](#medições).
- **O dado grande ainda domina?** Mesmo com a ordem de entrada, depois que
  todos entram, o 6 vence todo contato, menos o sacrifício. Medir nos bots.
- **Kit**: entram os 4 dados binários e dados extras por cor. Contar nos bots
  o número máximo de dados de um jogador numa partida.
- **Nome**: *Shesh* estava reservado para o gamão; o protótipo usa
  `shesh` por enquanto. A tábua de regras do Ur (Itti-Marduk-balatu, 177
  a.C.) é babilônica, em acádio, onde "seis" é *šeš* (a confirmar num
  dicionário).

## Medições

Protótipo em `digital/shesh/` (`shesh-engine` e `shesh-bots`), com bots
aleatório, guloso e expectimax de uma jogada. Lotes de 4.000 partidas
(`just shesh-batch A B --games 2000`), em 2026-10-28.

- **Furo na vitória por levar todos os dados**: o bot aleatório funde os
  seus dados, queima o excesso acima de 6 e fica com poucos dados para
  levar. Ele vence 41% contra o expectimax, e 40,2% dessas vitórias vêm de
  levar todos os dados, com média de 3,6 pontos. Com a variante "levar todos
  encerra, e vence quem tem mais pontos", hoje a regra, o expectimax vence
  82% contra o aleatório e 61% contra o guloso.
- **Duração**: 90 a 116 turnos por partida, contando os lances extras, com
  23 a 25 lances extras por partida entre os bots melhores.
- **Primeiro jogador**: vence de 51% a 53%.
- **O dado grande**: quem come é quase sempre um dado de 5 ou 6 antes de
  comer. Quem troca, voltando junto com o comido, é na maior parte um 1,
  então o sacrifício aparece nas partidas.
- **Kit**: no máximo 10 dados de um jogador em jogo ao mesmo tempo
  (percentil 99: 7). Os 16 dados por cor do Seks bastam.

### Lance extra e ordem de entrada

Lotes de 6.000 partidas, com a regra de vitória nova. "Expecti × guloso" é
a vitória do expectimax: quanto maior, mais a habilidade pesa. Turnos de
partidas entre dois expectimax, contando os lances extras. O erro padrão de
uma porcentagem é de uns 0,6 ponto.

| Lance extra | Entrada | Expecti × guloso | Primeiro jogador | Turnos | Lances extras |
|---|---|---|---|---|---|
| sim | em ordem | 60,5% | 52,0% | 124 | 25 |
| não | em ordem | 62,2% | 51,0% | 139 | 0 |
| sim | livre | 62,4% | 52,1% | 122 | 23 |
| não | livre | 65,5% | 54,1% | 140 | 0 |

- Com lance extra, quem tem mais lances extras vence 66% a 69% das
  partidas em que os dois não empatam em lances. É uma correlação, não só
  sorte: o bot melhor também busca as rosetas.
- Tirar o lance extra aumenta um pouco o peso da habilidade (+1,7 ponto) e
  alonga a partida: 139 turnos, contra uns 99 turnos normais mais 25 extras.
- A entrada em ordem tira de 2 a 3 pontos de habilidade. Ela simplifica a
  decisão de entrada.

### Rolar de novo com todos os dados em 0

Com a regra atual (sem lance extra, entrada em ordem), lotes de 6.000
partidas. Rolar de novo quando todos os dados dão 0 elimina o turno parado
que acontecia em 1 de cada 16 turnos: os passes caem de 10 para 1,4 por partida entre dois
expectimax, e a partida cai de 139 para 134 turnos. O expectimax vence o
guloso em 63,1% (antes, 62,2%), e o primeiro jogador vence 52,1%.

### Trilha do Ur e desgaste

Regra atual: trilha do Ur, rosetas com outra jogada, desgaste, comer com
+1, sem ultrapassar. Lotes de 6.000 partidas.

| Partida | Vitória do primeiro bot | Primeiro jogador | Turnos | Fim nos 12 pontos |
|---|---|---|---|---|
| expecti × aleatório | 78,4% | 54,0% | 63 | 42% |
| expecti × guloso | 60,4% | 53,1% | 71 | 43% |
| expecti × expecti | 50% | 54,1% | 70 | 36% |

- A partida cai pela metade: de 134 para 70 turnos, contando 19 jogadas
  extras.
- Por partida entre dois expectimax: 2,4 capturas e 2,6 desgastes, que
  queimam 10,5 pontos; mais 6,7 pontos perdidos acima de 6 nas fusões.
- Quem vence termina com 9,5 pontos em média. A meta de 12 só decide 36% das
  partidas; o resto acaba quando alguém leva todos os dados.
- O primeiro jogador vence 54%, contra 52% antes: as jogadas extras dão um
  pouco mais de vantagem a quem começa.
- A habilidade pesa um pouco menos que na regra anterior (60,4% contra
  63,1% do expectimax sobre o guloso).

### Meta de 10 pontos

Mesma regra, com a meta em 10. Lotes de 12.000 partidas, metade com cada bot
começando.

| Partida | Vitória do primeiro bot | Primeiro jogador | Turnos | Fim nos 10 pontos |
|---|---|---|---|---|
| expecti × aleatório | 79,7% | 53,8% | 59 | 57% |
| expecti × guloso | 59,1% | 53,7% | 66 | 63% |
| expecti × expecti | 50% | 53,8% | 66 | 55% |

- A meta passa a decidir mais da metade das partidas (36% com 12).
- A partida encurta uns 4 turnos.
- O resto quase não muda: o expectimax vence o guloso em 59,1% (60,4% com
  12), o primeiro jogador vence 54%, e quem vence termina com 8,9 pontos em
  média.
- Quem tem mais jogadas extras vence 63% das partidas entre dois expectimax.

## Outcome

(aberto)
