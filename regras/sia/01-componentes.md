---
type: spec
status: draft
tags: [sia, regras, componentes]
---

# Componentes

Do kit físico (ver [../kit.md](../kit.md)), o Sia usa:

- 9 dados de um **naipe**, que são os **marcos**;
- uma **bolsa** com dados dos outros 4 naipes, de onde os dados saem sem que se
  veja qual;
- o tabuleiro de 11 por 11 casas do Seks.

Um **naipe** é uma cor de dado. O jogo tem 5 naipes: um é o dos marcos, e os
outros 4 são os da bolsa.

> **Proposta:** a bolsa não tem limite de dados. No físico, o kit decide
> depois quantos dados cada naipe tem. No digital, a bolsa nunca acaba.

## O tabuleiro

> **Detalhe:** o tabuleiro só organiza a mesa.

- Os 9 marcos ficam nas 9 casas do meio da fileira central, da esquerda para
  a direita.
- As 3 fileiras de cada lado da central são do jogador daquele lado. Os
  dados de um jogador, em cada marco, ficam na coluna do marco, no lado dele.
- Um marco tomado é arrastado, junto com a formação de quem o tomou, para o
  lado dessa pessoa. Ele continua no tabuleiro e conta como vizinho dos
  marcos que estavam ao lado dele (ver
  [05-fim-do-jogo.md](05-fim-do-jogo.md#vitória-por-marcos)).
