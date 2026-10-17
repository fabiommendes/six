---
type: adr
status: accepted
tags: [seks, engine, empate, estado]
relatedTo: [dev/issues/motor-do-seks-em-rust.md, regras/seks/05-fim-do-jogo.md]
created: 2026-10-17
decided: 2026-10-17
deciders: [fabio, claude]
---

# O estado do Seks guarda os hashes das posições desde a última captura

## Context

O Seks empata quando a mesma posição aparece pela terceira vez com o mesmo
jogador da vez, ou depois de 100 jogadas seguidas sem captura
(`regras/seks/05-fim-do-jogo.md`). O motor segue o ADR 0001 do Rio: o estado
é um valor e não guarda histórico, porque a busca clona um estado por ramo.
Sem histórico, o motor não sabe se uma posição já apareceu.

## Options

- Deixar o empate para quem chama, que guarda as posições. Cada chamador (busca,
  servidor, testes) teria de reimplementar a regra.
- Guardar no estado as posições completas desde a última captura: sem colisão,
  mas cerca de 6 KB por estado, o que pesa nos clones da busca.
- Guardar no estado o hash Zobrist de cada posição desde a última captura.

## Decision

A terceira. A captura é a única jogada irreversível do Seks: depois dela o
tabuleiro tem um dado a menos, e nenhuma posição anterior volta. Por isso
bastam as posições desde a última captura, no máximo 101 (a posição depois da
captura e mais 100 jogadas). O estado guarda o contador de jogadas sem captura
e o hash Zobrist `u64` de cada uma dessas posições, incluindo o jogador da vez.
A captura zera os dois. A posição inicial conta como a primeira aparição.

Isso é estado de regra, como o contador de jogadas, e não um registro de
eventos: o ADR 0001 do Rio continua valendo.

## Consequences

- Cada estado carrega até 101 hashes, cerca de 800 bytes por clone.
- Uma colisão de hash daria um empate falso. Com 64 bits e no máximo 101
  posições comparadas, a chance é desprezível.
- Um save ou uma posição montada no meio da partida precisa trazer os hashes e
  o contador, ou começa a contagem do zero.
