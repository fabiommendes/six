---
type: adr
status: accepted
tags: [liu, bots, pimc, calibracao, rust]
relatedTo: [dev/issues/bots-do-liu.md, dev/notes/bots-do-liu.md, digital/liu/bots/README.md]
created: 2026-10-20
decided: 2026-10-20
deciders: [fabio, claude]
---

# Bots do Liu: Monte Carlo com informação perfeita e avaliação linear calibrada por CMA-ES

## Context

O Liu tem sorte e nada escondido além dela: as janelas, as mãos e o
mercado são públicos, e só os números que o saco e as rolagens vão dar são
desconhecidos. O motor guarda o gerador de dados no estado, então um bot
que lesse o estado inteiro saberia o futuro. Uma partida de 2 jogadores
tem cerca de 29 comandos, com dezenas de comandos legais por vez. O bot
roda em WASM num Web Worker, junto com a interface.

O designer pediu o padrão dos outros projetos: bot em Rust com PIMC, como o
`rio-bots`, e uma sessão de calibração.

## Options

- Expectimax com nós de sorte: o mercado de uma rodada tem um número
  variável de dados e cada rolagem de novo sorteia o mercado inteiro, então
  os nós de sorte têm centenas de filhos e a busca não passa de um turno.
- MCTS com nós de sorte (ISMCTS): mais forte em teoria, mas cada simulação
  passa por várias rolagens e pede uma árvore por decisão; mais código e
  mais difícil de calibrar.
- PIMC: amostrar futuros (o estado com outro gerador), jogar cada comando
  candidato seguido de rollouts gulosos e escolher a maior média. É o que
  o Rio faz, e no Liu o defeito clássico do PIMC (fusão de estratégias por
  ver as cartas escondidas) quase não existe, porque o que a amostra fixa
  são rolagens futuras, que ninguém conhece.

## Decision

PIMC, no crate `liu-bots`, que depende só de `liu-engine`, `serde` e
`serde_json`. O motor ganha `GameState::reseeded`, e todo bot joga sobre
cópias com a semente dele: nenhum lê o gerador verdadeiro. A raiz guarda os
melhores comandos do guloso (`top`) e os rollouts usam o mesmo guloso para
todos os jogadores.

A avaliação é uma soma de pesos vezes features da janela e da mão, com a
unidade no ponto da pontuação final. Os pesos ficam em
`digital/liu/bots/weights/default.json` e entram no binário por
`include_str!`. A calibração é a do Rio: CMA-ES (`tune/tune.py`, `cma` pelo
`uv`) sobre o guloso, que é rápido, com a aptidão pela parte média da
vitória contra um oponente fixo, e validação em sementes que a busca não
usou, no guloso e no PIMC.

## Consequences

- O mesmo código serve a web, os lotes e a calibração, e compila para
  `wasm32-unknown-unknown`; o `liu-wasm` expõe `Bot`.
- O teto do PIMC é o do guloso que faz os rollouts. Melhorar as features
  melhora os dois.
- O custo cresce com `samples × top × comandos até o fim`: o nível da web é
  um orçamento fixo, não um tempo, então máquinas lentas só demoram mais.
- Calibrar pesos pelo guloso supõe que o que ajuda o guloso ajuda os
  rollouts; a validação no PIMC confere isso a cada vez.
