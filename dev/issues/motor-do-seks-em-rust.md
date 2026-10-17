---
type: issue
status: in_progress
tags: [seks, digital, rust]
relatedTo: [dev/adr/0001-monorepo-de-coordenacao.md, regras/seks]
kind: enhancement
created: 2026-10-17
creator: claude
---

# Motor do Seks em Rust

## Context

O Seks só existe como protótipo em Python e Pyxel
(`digital/seks/prototipo/`). A versão digital da coleção usa motores em Rust,
com bots e jogo em rede, seguindo os ADRs 0001, 0004, 0005 e 0010 do Rio. O
Seks é o primeiro motor; o código comum só sai para `digital/kit/` quando o
segundo jogo chegar.

## Requirements

- R1. Crate `seks-engine` em `digital/seks/`, puro e determinístico, sem I/O.
  O estado é um valor; aplicar um comando devolve o novo estado e os eventos.
  - Aceito quando os testes cobrem cada regra de `regras/seks/`, incluindo os
    casos de borda das notas `Detalhe`.
- R2. `legal_commands(state)` lista toda jogada legal (mover e incrementar), e
  `command` recusa qualquer outra.
- R3. Fim de jogo: fileira de fundo, adversário sem jogada, empate por tripla
  repetição e por 50 turnos de cada jogador sem captura.
- R4. Os casos de teste do protótipo (`digital/seks/prototipo/tests/`) que
  tratam de regras passam no motor novo, traduzidos.
- R5. Um bot simples (aleatório e um guloso com uma avaliação de material e
  avanço) jogando contra si mesmo termina partidas sem erro.

## Out of scope

- Interface, servidor de rede e WASM: issues próprias depois desta.
- Extrair `digital/kit/`.

## Plano

Propostas que o designer revisa antes da implementação estão marcadas com
**(revisar)**.

- [x] ADR 0003 do Six: o estado guarda, como estado de regra, o
  número de jogadas desde a última captura e o hash Zobrist (`u64`, com o
  jogador da vez) de cada posição desde a última captura, no máximo 101. A
  captura é a única jogada irreversível, então nenhuma posição anterior a ela
  pode se repetir. Não contradiz o ADR 0001 do Rio: não é histórico de
  eventos.
- [x] Workspace Cargo em `digital/Cargo.toml` e crate `seks-engine` em
  `digital/seks/engine/`, sem dependências. `cargo fmt --check`,
  `cargo clippy -- -D warnings` e `cargo test` entram no `just check` e no
  `AGENTS.md`.
- [x] Coordenadas **(revisar)**: `Cell { column, row }` com a numeração das
  regras, 1 a 11, fileira 1 das Brancas. O índice no vetor do tabuleiro sai de
  um só lugar (`Cell::index`). Documentado no `//!` de `cell.rs`.
- [x] Estado (`state.rs`, `board.rs`): `GameState` como valor, com tabuleiro
  `[Option<Die>; 121]`, jogador da vez, contagem sem captura, hashes e
  resultado. `Die { side, value }`. Posição inicial de
  `regras/seks/02-preparacao.md`.
- [ ] Jogadas (`command.rs`): `Command::Move { from, to }` e
  `Command::Increment { at }`, sem passar a vez. `legal_commands(state)` lista
  todas; `Engine::command(state, command)` devolve `Transition { state,
  events }` ou `GameError` para qualquer comando fora da lista.
- [ ] Captura (`capture.rs`) por custódia, só a partir do dado que se moveu.
- [ ] Fim de jogo (`outcome.rs`): vitória pela fileira de fundo e por
  adversário sem jogada; empate por tripla repetição e por 100 jogadas sem
  captura. Ordem **(revisar com o designer)**: vitória antes de empate, como o
  mate no xadrez vale na 50ª jogada. Se confirmada, vira nota `Detalhe` em
  `regras/seks/05-fim-do-jogo.md`.
- [ ] Eventos (`event.rs`): `Moved`, `Incremented`, `Captured`, `GameEnded`.
- [ ] `Engine::view(state, side)` devolve o estado inteiro: o Seks não tem
  informação oculta, mas a interface já é a do ADR 0005 do Rio.
- [ ] Testes de regra do protótipo traduzidos (`test_grid.py` e
  `test_game.py`, sem interface, save, seleção e desfazer), com as
  coordenadas convertidas, e um teste por nota `Detalhe` e por item de
  `regras/seks/04-captura.md`.
- [ ] Crate `seks-bots` em `digital/seks/bots/`: bot aleatório e guloso de um
  nível (material e avanço), RNG com semente próprio (splitmix64, sem
  dependência). Teste de autojogo: 200 partidas de cada par terminam sem erro.
