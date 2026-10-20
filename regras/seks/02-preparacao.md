---
type: spec
status: draft
tags: [seks, regras, preparacao]
---

# Preparação

Os jogadores sentam em lados opostos do tabuleiro. As Brancas ficam com a
fileira 1 à sua frente e as Pretas com a fileira 11.

## Posição inicial

Cada jogador arruma os seus 16 dados nas duas fileiras mais perto dele:

- **Fileira de fundo** (1 para as Brancas, 11 para as Pretas): 6 dados com
  valor **1**, um sim um não, começando pelo canto. Ocupam as colunas 1, 3, 5,
  7, 9 e 11.
- **Fileira da frente** (2 para as Brancas, 10 para as Pretas): 10 dados com
  valor **2**, em todas as colunas menos a do centro, a coluna 6.

A posição é simétrica: cada dado branco tem um dado preto de mesmo valor na
mesma coluna, do outro lado.

> **Design:** a casa vazia no centro da fileira da frente abre um caminho para
> a fileira de fundo do adversário, que o jogador precisa vigiar desde o
> primeiro turno.

## Jogador inicial

As **Brancas** jogam primeiro. Depois, os jogadores alternam os turnos.

No primeiro turno da partida, as Brancas precisam **mover** um dado: não
podem incrementar.

> **Proposta:** o primeiro turno com movimento foi aprovado para teste e ainda
> não foi jogado.

> **Design:** incrementar no primeiro turno dava vantagem às Brancas. Nos
> bots, da posição inicial, as Brancas venciam 54,5% das partidas decididas;
> com o primeiro turno obrigado a mover, 51,2% (ver
> `dev/notes/bots-do-seks.md`, "Vantagem de quem joga primeiro").
