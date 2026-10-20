---
type: spec
status: draft
tags: [liu, regras, janela, colocacao]
---

# Janela

A janela de um jogador são os dados que ele pôs na mesa, em linhas e colunas,
a partir do selo. Ela começa só com o selo, e o selo nunca sai dela.

Um dado posto na janela precisa:

- **encostar** pelo lado em um dado da janela; encostar só pela diagonal não
  basta;
- **caber** numa região de 4 por 4 casas junto com todos os dados da janela.
  A região não é fixa: ela pode ficar em qualquer lugar, desde que todos os
  dados caibam nela;
- **não repetir** número: nenhum outro dado da mesma linha ou da mesma coluna
  da janela pode ter o mesmo número.

Um dado posto não se move e não muda de número até o fim da partida.

A janela está **completa** com 16 dados, que preenchem as 4 por 4 casas.

> **Detalhe:** na mesa, a moldura marca a região. O jogador pode arrastá-la
> enquanto todos os dados da janela continuam dentro dela.

> **Detalhe:** cada linha e cada coluna tem no máximo 4 dados de 6 números
> possíveis, então sempre faltam 2 números em cada linha completa.
