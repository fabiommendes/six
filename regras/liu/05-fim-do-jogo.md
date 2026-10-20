---
type: spec
status: draft
tags: [liu, regras, fim-do-jogo, pontuacao]
---

# Fim do jogo

O jogo acaba na hora, sem terminar a rodada, quando:

- um jogador completa a sua janela;
- o saco esvazia durante a compra do mercado;
- uma rodada inteira passa sem que nenhum jogador ponha dado na janela.

## Pontuação

No fim, cada jogador escolhe o seu **código**: quatro números diferentes, de 1
a 6. Ele o escolhe olhando a janela, para fazer o máximo de pontos.

Cada linha completa e cada coluna completa (com 4 dados) vale:

- **1 ponto** por estar completa;
- **1 ponto** a mais se os seus números formam uma **sequência**: quatro
  números seguidos, em qualquer ordem (1 2 3 4, 2 3 4 5 ou 3 4 5 6);
- **1 ponto** a mais se os seus números são exatamente os do código, em
  qualquer ordem.

Uma janela completa tem 4 linhas e 4 colunas, então a pontuação vai de 0 a
24.

Vence quem fizer mais pontos. No empate, vence quem tem mais dados na janela.
Se ainda empatar, os jogadores empatados dividem a vitória.

> **Detalhe:** o código pode ser uma sequência. Uma linha 2 3 4 5 com o código
> 2 3 4 5 vale 3 pontos.
