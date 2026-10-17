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
