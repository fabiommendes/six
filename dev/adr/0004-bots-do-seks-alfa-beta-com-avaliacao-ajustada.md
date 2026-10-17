---
type: adr
status: proposed
tags: [seks, bots, busca, treinamento, rust]
relatedTo: [dev/issues/bots-do-seks.md, dev/issues/motor-do-seks-em-rust.md]
created: 2026-10-17
deciders: [fabio, claude]
---

# Bots do Seks: alfa-beta próprio com avaliação linear ajustada por autojogo

## Context

O Seks tem informação completa, não tem sorte e tem fator de ramificação
perto de 100 (máximo observado de 150). A vitória pela fileira de fundo é uma
ameaça de uma jogada, e partidas sem plano terminam quase sempre empatadas
por 100 jogadas sem captura: 298 de 300 partidas aleatórias numa simulação.
O bot de jogo roda no servidor e em WASM no navegador, numa thread e com
pouca memória. O treino pode ser pesado e offline, mas a máquina só tem CPU
útil para isso: a GPU (RX 6600) está fora da lista oficial do ROCm e é
dividida com o desktop.

## Options

- Crate genérico de busca, `minimax` 0.6.0 (MIT): negamax, aprofundamento
  iterativo, tabela de transposição e MCTS. Projeto pequeno, de um
  mantenedor, que puxa `rayon`, `num_cpus`, `instant` e `getrandom` e não
  declara suporte a WASM. A busca útil para o Seks (quiescência sobre
  capturas, extensão por ameaça de vitória, LMR, parada por callback) teria
  de ser escrita por cima dele de qualquer jeito.
- MCTS com rollouts (crate `mcts` 0.3.0, parado desde 2019, ou próprio).
  Rollouts aleatórios quase só dão empate no Seks, e o MCTS é conhecido por
  errar armadilhas rasas, que é o que a ameaça de fileira de fundo cria.
- Estilo AlphaZero: MCTS/PUCT guiado por uma rede de política e valor
  treinada por autojogo (`burn` 0.22, `candle` 0.11, `tch` 0.26; `tract`
  0.23 ou `ort` 2.0-rc para inferência). O espaço de ações passa de 5900
  (121 casas x 8 direções x 6 distâncias, mais incrementos), o treino pede
  semanas de GPU para um tabuleiro 11 x 11, e a inferência em WASM limita a
  busca a poucas centenas de simulações por segundo. `tch` não compila para
  WASM; o `burn` mudou API, backends e formato de pesos na 0.22.
- Alfa-beta escrito à mão, com avaliação linear sobre features feitas à mão
  e pesos ajustados por Texel tuning em posições de autojogo.

## Decision

A última. O crate `seks-bots` implementa negamax com PVS, aprofundamento
iterativo, tabela de transposição pelo hash Zobrist do motor, quiescência e
extensão por ameaça. Não depende de crate de busca, de rede neural ou de
números aleatórios: só `seks-engine`, `serde` e `serde_json`, como o
`rio-bots`.

A avaliação é uma soma de pesos vezes features, da perspectiva de quem joga.
As features saem de uma função só, usada pela avaliação e pelo treino. Os
pesos ficam em JSON no git (`digital/seks/bots/weights/`) e entram no
binário por `include_str!`.

O treino roda no próprio crate, em CPU: autojogo com nós fixos gera
posições, o Texel tuning ajusta os pesos (regressão logística contra o
resultado da partida e a nota da busca, com Adam escrito à mão), e uma
partida em lote contra a geração anterior decide se os pesos novos são
promovidos. Os dados de treino ficam fora do git.

## Consequences

- O bot de jogo é um só código para servidor, navegador e treino, sem
  dependência pesada, e compila para `wasm32-unknown-unknown`.
- O núcleo da busca não lê relógio: quem chama passa um callback de parada,
  porque `std::time::Instant` não funciona em `wasm32-unknown-unknown`.
- A busca, a tabela e a ordenação são código nosso para manter, umas mil
  linhas.
- O teto do bot é o das features escritas à mão. Se não bastar, o passo
  seguinte é uma rede pequena estilo NNUE treinada com os mesmos dados de
  autojogo e com inferência escrita à mão; isso pede um ADR novo, com o
  formato dos pesos e a ferramenta de treino.
- Pesos promovidos são commits, com o Elo medido no `EVALUATOR.md`.
