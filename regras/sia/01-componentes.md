---
type: spec
status: draft
tags: [sia, regras, componentes]
---

# Componentes

Do kit físico (ver [../kit.md](../kit.md)), o Sia usa:

- 9 dados de um **naipe**, que são os **marcos**;
- 2 dados desse mesmo naipe, que são os **coringas**, um por jogador;
- uma **bolsa** com dados dos outros 4 naipes, de onde os dados saem sem que se
  veja qual;
- o tabuleiro de 11 por 11 casas do Seks.

Um **naipe** é uma cor de dado. O jogo tem 5 naipes: um é o dos marcos e dos
coringas, e os outros 4 são os da bolsa.

> **Proposta:** a bolsa não tem limite de dados. No físico, o kit decide
> depois quantos dados cada naipe tem. No digital, a bolsa nunca acaba.

## O coringa

Cada jogador tem um **coringa**: um dado da cor dos marcos que vale como
qualquer naipe na formação de naipe. O número dele é rolado na preparação e
vale normalmente.

- O coringa começa na mão do jogador e é um dado da mão como os outros: o
  dono pode pô-lo num lado, rolá-lo de novo e escolhê-lo como o dado que
  perde ao rolar de novo.
- O adversário **não** pode rolar o coringa, quando rola a mão do dono. Se a
  mão do dono só tem o coringa, não há o que rolar nela.
- Posto num lado, o coringa fica ali com o número que mostra, como qualquer
  dado.
- O jogador não ganha outro coringa. Um coringa posto ou perdido não é
  reposto, e o jogador segue sem ele até o fim.

> **Proposta:** o coringa perdido ao rolar de novo sai da partida: ele não
> volta para a bolsa, porque a bolsa só tem dados dos 4 naipes. Os outros
> dados perdidos voltam para ela.

> **Design:** o coringa deixa a formação de naipe possível sem depender da
> sorte da bolsa, e é uma razão para o dono guardá-lo ou gastá-lo.

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
