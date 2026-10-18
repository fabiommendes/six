---
type: spec
status: draft
tags: [seks, regras, captura, custodia]
---

# Captura

Um dado é capturado de dois jeitos: **por custódia**, depois de um
movimento, ou por um **tiro** de um 6 na casa central (ver
[03-turno.md](03-turno.md#atirar)). Esta seção trata da custódia.

Depois que um dado do jogador termina um movimento, ou chega à casa do alvo
depois de um tiro, o jogador olha as 4 casas ortogonais vizinhas da casa onde
ele parou: acima, abaixo, à esquerda e à direita. Um dado adversário numa dessas
casas é capturado quando a casa seguinte, na mesma direção, tem um dado do
jogador. O dado capturado sai do tabuleiro e não volta.

- Um só movimento pode capturar em várias direções ao mesmo tempo, até 4 dados.
- O valor dos dados não importa: um 1 e um 2 capturam um 6.
- Só um dado é capturado por direção. Dois dados adversários seguidos entre
  dois dados do jogador não são capturados.
- Diagonais não capturam nem são capturadas.
- A borda do tabuleiro não conta como um dado do jogador.
- Só quem move, ou atira, captura. Um dado que para entre dois dados
  adversários está a salvo.
- Incrementar nunca captura, mesmo que o dado já esteja ao lado de um dado
  adversário cercado.

> **Detalhe:** o dado que se move é sempre uma das duas pontas do cerco. Um
> dado adversário que já estava entre dois dados do jogador antes do
> movimento, sem que nenhum deles tenha se movido para formar o cerco, não é
> capturado.
