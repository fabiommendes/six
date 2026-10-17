# Glossário

Definições dos termos do Seks e o termo em inglês de cada um. As regras em
`regras/` usam estes termos sempre com o sentido definido aqui.

Formato (o mesmo do glossário do Rio, que o build do manual lê): cada termo é
um título `##`, seguido de um parágrafo com a definição. Linhas opcionais:

- `en:` o termo em inglês, usado em identificadores e comentários de código.
  Não é publicado;
- `Ver também:` termos relacionados, separados por vírgula;
- `Não usar:` sinônimos proibidos, separados por vírgula, que nunca devem
  aparecer no manual, no site ou no jogo. Não é publicado.

## Brancas

O jogador que joga primeiro, e os seus dados. Começa com a fileira 1 à sua
frente.

en: white
Ver também: Pretas

## Captura

Retirada de um dado adversário do tabuleiro, quando um movimento o deixa
entre o dado que se moveu e outro dado do jogador, na mesma linha ou coluna.
O dado capturado não volta ao jogo.

en: capture
Ver também: Mover
Não usar: comer, tomar

## Casa

Um dos 121 quadrados do tabuleiro. Uma casa está vazia ou tem um dado.

en: cell
Ver também: Fileira
Não usar: quadrado, célula

## Dado

Uma peça do jogo: um dado de seis faces, branco ou preto. O valor na face de
cima diz até quantas casas ele anda.

en: die
Ver também: Valor
Não usar: peça

## Empate

Fim do jogo sem vencedor: a mesma posição aparece pela terceira vez, ou cada
jogador faz 50 jogadas seguidas sem captura.

en: draw
Ver também: Posição

## Fileira

Uma linha de 11 casas paralela ao lado do jogador. As fileiras são numeradas
de 1, a mais perto das Brancas, a 11, a mais perto das Pretas.

en: row
Ver também: Fileira de fundo

## Fileira de fundo

A fileira mais perto de cada jogador: a 1 para as Brancas, a 11 para as
Pretas. Um dado que termina um movimento na fileira de fundo do adversário dá
a vitória.

en: back row
Ver também: Fileira

## Incrementar

Jogada que soma 1 ao valor de um dado, sem movê-lo. Um 6 não pode ser
incrementado.

en: increment
Ver também: Jogada, Valor
Não usar: carregar, aumentar

## Jogada

O que o jogador faz no seu turno: mover ou incrementar um dos seus dados.

en: play
Ver também: Incrementar, Mover
Não usar: lance

## Mover

Jogada que leva um dado em linha reta, numa das 8 direções, por 1 até tantas
casas quanto o seu valor. O dado termina mostrando o número de casas que
andou.

en: move
Ver também: Jogada, Captura

## Posição

A casa, a cor e o valor de cada dado no tabuleiro.

en: position
Ver também: Empate

## Pretas

O jogador que joga em segundo, e os seus dados. Começa com a fileira 11 à
sua frente.

en: black
Ver também: Brancas

## Valor

O número na face de cima de um dado, de 1 a 6.

en: value
Ver também: Dado
Não usar: força
