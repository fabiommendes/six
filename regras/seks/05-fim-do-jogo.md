---
type: spec
status: draft
tags: [seks, regras, fim-do-jogo, vitoria]
---

# Fim do jogo

O jogo termina assim que um jogador vence, de uma destas formas.

## Chegar à fileira de fundo

O jogador vence quando um dado seu **termina um movimento na fileira de fundo
do adversário**, ou chega a ela depois de um tiro: a fileira 11 para as
Brancas, a fileira 1 para as Pretas.

> **Detalhe:** a vitória vale com o dado de qualquer valor, e o jogo acaba
> nesse movimento. As capturas do mesmo movimento não mudam o resultado.

## Deixar o adversário sem jogada

O jogador também vence quando, depois da sua jogada, **o adversário não tem
nenhuma jogada**: perdeu todos os dados, ou só tem 6 cercados nas 8 direções
que não podem atirar.

## Empate

O jogo empata, como no xadrez, em dois casos:

- **Repetição**: a mesma posição aparece pela terceira vez, com o mesmo
  jogador da vez. As três vezes não precisam ser seguidas.
- **50 turnos sem captura**: cada jogador fez 50 jogadas seguidas, 100 no
  total, sem que nenhum dado fosse capturado.

A posição é a casa, a cor e o valor de cada dado no tabuleiro.

> **Playtest:** os limites de 3 repetições e 50 turnos vêm do xadrez. Se não
> bastarem para acabar com partidas travadas, o designer escolhe outra regra.

> **Detalhe:** a vitória vale antes do empate. Uma jogada que leva um dado à
> fileira de fundo do adversário, ou deixa o adversário sem jogada, vence
> mesmo que seja a 100ª jogada sem captura ou repita uma posição pela
> terceira vez.

> **Detalhe:** no jogo físico, o empate só vale quando um jogador o declara,
> e precisa de anotação da partida para provar a repetição ou a contagem. Na
> versão digital, o empate é automático.

> **Design:** mover e incrementar sempre existem enquanto um jogador tiver um dado
> abaixo de 6, então, sem empate, uma partida podia não acabar se os dois
> jogadores evitassem o risco. Só a captura é irreversível no Seks: avançar e
> incrementar podem ser desfeitos. Por isso só ela zera a contagem de turnos.
