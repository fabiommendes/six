---
titulo: Seks
resumo: Estratégia abstrata em que cada dado anda tantas casas quanto o seu valor.
jogo: seks
jogadores: "2"
secoes:
  visao-geral:
    fonte:
      - regras/seks/00-visao-geral.md
  componentes:
    fonte:
      - regras/seks/01-componentes.md
  preparacao:
    fonte:
      - regras/seks/02-preparacao.md
  o-turno:
    fonte:
      - regras/seks/03-turno.md
  captura:
    fonte:
      - regras/seks/04-captura.md
  fim-do-jogo:
    fonte:
      - regras/seks/05-fim-do-jogo.md
---

*Seks* quer dizer "seis" em dinamarquês e norueguês.

## Visão geral

Dois jogadores, 16 dados cada um, num tabuleiro de 11 por 11 casas. Não há
sorte: os dados nunca são rolados. O [[Valor]] na face de cima de um dado diz
até quantas casas ele anda.

No seu turno, você faz uma [[Jogada]] com um dos seus dados:

- **[[Mover]]**: o dado anda em linha reta e passa a mostrar o número de casas
  que andou. Andar pouco custa valor.
- **[[Incrementar]]**: o dado ganha 1 de valor e fica parado.

Prenda um dado adversário entre dois dados seus para capturá-lo. Vence quem
levar um dado até a [[Fileira de fundo]] do adversário, ou deixar o adversário
sem jogada.

## Componentes

- O tabuleiro de 11 por 11 casas.
- 32 dados: 16 de uma cor, as [[Brancas]], e 16 de outra, as [[Pretas]].

## Preparação

Cada jogador arruma os seus dados nas duas fileiras mais perto dele:

- na fileira de fundo, 6 dados com valor 1, um sim um não, começando pelo
  canto;
- na fileira da frente, 10 dados com valor 2, em todas as colunas menos a do
  centro.

<div class="diagrama--grande" markdown="1">

```tabuleiro
legenda: A posição inicial. As Pretas ficam em cima e as Brancas embaixo.
P1 . P1 . P1 . P1 . P1 . P1
P2 P2 P2 P2 P2 . P2 P2 P2 P2 P2
. . . . . . . . . . .
. . . . . . . . . . .
. . . . . . . . . . .
. . . . . . . . . . .
. . . . . . . . . . .
. . . . . . . . . . .
. . . . . . . . . . .
B2 B2 B2 B2 B2 . B2 B2 B2 B2 B2
B1 . B1 . B1 . B1 . B1 . B1
```

</div>

As Brancas jogam primeiro. Depois, os jogadores alternam os turnos.

## O turno

No seu turno, escolha um dos seus dados e faça **uma** destas jogadas. Não é
possível passar a vez.

### Mover

O dado anda em linha reta numa das 8 direções, retas ou diagonais, **de 1 até
tantas casas quanto o seu valor**. Ele não pula outros dados, nem os seus, e
não para numa casa ocupada.

```tabuleiro
legenda: O 3 branco pode parar em qualquer casa marcada. O 2 preto fecha o caminho para cima.
o . . . . . o
. o . P2 . o .
. . o o o . .
o o o B3* o o o
. . o o o . .
. o . o . o .
o . . o . . o
```

Depois de andar, gire o dado para mostrar **o número de casas que ele andou**.
Um 4 que anda 2 casas vira um 2. Um 4 que anda 4 casas continua 4.

<div class="diagramas" markdown="1">

```tabuleiro
legenda: O 4 branco anda duas casas...
seta: 2,1 -> 2,3
. . . . .
B4* . . . .
. . . . .
```

```tabuleiro
legenda: ...e vira um 2.
. . . . .
. . B2* . .
. . . . .
```

</div>

### Incrementar

Some 1 ao valor de um dos seus dados, sem movê-lo. Um 6 não pode ser
incrementado.

## Captura

Depois de mover um dado, olhe as quatro casas vizinhas da casa onde ele parou:
acima, abaixo, à esquerda e à direita. Um dado adversário numa dessas casas é
**capturado** quando, logo atrás dele, na mesma direção, há outro dado seu.
Tire o dado capturado do tabuleiro; ele não volta.

<div class="diagramas" markdown="1">

```tabuleiro
legenda: O 3 branco sobe duas casas...
seta: 5,2 -> 3,2
. . . . .
. . . . .
. . P2 B3 .
. . . . .
. B3* . . .
```

```tabuleiro
legenda: ...vira 2 e captura o 2 preto.
. . . . .
. . . . .
. B2* P2x B3 .
. . . . .
. . . . .
```

</div>

- O valor dos dados não importa: um 1 e um 2 capturam um 6.
- Um movimento pode capturar em várias direções de uma vez.
- Só um dado é capturado em cada direção: dois dados adversários seguidos
  entre dois dados seus ficam no tabuleiro.
- As diagonais não contam, e a borda do tabuleiro não faz o papel de um dado
  seu.
- Só quem move captura. Você pode parar o seu dado entre dois dados
  adversários sem perdê-lo.
- Incrementar nunca captura.

## Fim do jogo

Você vence assim que:

- um dado seu termina um movimento na **fileira de fundo do adversário**; ou
- depois da sua jogada, o adversário **não tem jogada**: perdeu todos os dados,
  ou só tem dados com valor 6 cercados nas 8 direções.

### Empate

A partida termina [[Empate|empatada]], como no xadrez, quando:

- a mesma [[Posição]] aparece pela terceira vez, com o mesmo jogador da vez;
  ou
- cada jogador fez 50 jogadas seguidas sem que nenhum dado fosse capturado.

No jogo físico, o empate vale quando um jogador o declara. Anote a partida se
quiser poder provar a repetição ou a contagem.
