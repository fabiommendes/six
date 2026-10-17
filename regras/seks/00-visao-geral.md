---
type: spec
status: draft
tags: [seks, regras, visao-geral]
---

# Visão geral

Jogo de estratégia abstrata para 2 jogadores, sem sorte. Cada jogador tem 16
dados num tabuleiro de 11 por 11 casas, e nada mais: o valor na face de cima
de um dado diz até quantas casas ele anda.

No seu turno, o jogador move um dado ou incrementa um dado. Mover custa valor:
o dado termina mostrando o número de casas que andou. Incrementar soma 1 ao
valor, mas gasta o turno.

Um dado inimigo cercado por dois dados do jogador, na mesma linha ou coluna, é
capturado. Vence quem levar um dado até a fileira de fundo do adversário, ou
deixar o adversário sem jogada.

> **Design:** o jogo gira em torno de uma escolha a cada turno: avançar agora,
> e perder valor, ou incrementar dados para depois. Um 6 alcança longe, mas um 6
> que anda duas casas vira 2.

## Nome

*Seks* é "seis" em dinamarquês, norueguês e feroês, a face mais alta de um
dado.
