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

O jogo empata por **repetição**, como no xadrez: a mesma posição aparece pela
terceira vez, com o mesmo jogador da vez. As três vezes não precisam ser
seguidas.

A posição é a casa, a cor e o valor de cada dado no tabuleiro.

> **Playtest:** o limite de 3 repetições vem do xadrez. Não há empate por
> falta de captura: o tiro da casa central (ver [03-turno.md](03-turno.md#atirar))
> cobre as partidas travadas, mas ele ainda é uma **Proposta**. Se o tiro não
> bastar para acabar com elas, o designer reavalia a regra de empate.

> **Detalhe:** a vitória vale antes do empate. Uma jogada que leva um dado à
> fileira de fundo do adversário, ou deixa o adversário sem jogada, vence
> mesmo que repita uma posição pela terceira vez.

> **Detalhe:** no jogo físico, o empate só vale quando um jogador o declara,
> e precisa de anotação da partida para provar a repetição. Na
> versão digital, o empate é automático.

> **Design:** mover e incrementar sempre existem enquanto um jogador tiver um dado
> abaixo de 6, então uma partida podia não acabar se os dois jogadores
> evitassem o risco. O tiro do centro quebra as posições travadas: quem
> segura a casa central com um 6 captura sem depender de o adversário se
> expor. Os ciclos de posições que sobram, com os dois lados andando em
> círculos, a repetição cobre.
