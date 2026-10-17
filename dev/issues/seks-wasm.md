---
type: issue
status: in_progress
tags: [seks, digital, wasm]
relatedTo: [dev/rfc/interface-do-seks.md, dev/issues/bots-do-seks.md]
kind: enhancement
created: 2026-10-17
creator: "F\xE1bio Mac\xEAdo Mendes"
---

# seks-wasm: motor e bots do Seks no navegador

## Context

A interface web do Seks roda o motor e os bots no navegador
(`dev/rfc/interface-do-seks.md`). O motor não tem serde nem tipos
TypeScript. O Rio resolve isso com `rio-wasm`, um adaptador `wire` e
`ts-rs` (ADR 0008 do Rio); o Seks segue o mesmo caminho.

## Requirements

- R1. Adaptador `wire` no `seks-engine`: estado, comandos, eventos e
  resultado em JSON, com a notação de texto do motor para casas e comandos.
  JSON só cruza a fronteira do motor por esse adaptador (ADR 0001 do Rio).
  - Aceito quando a ida e volta estado, JSON e estado é testada em posições
    do meio da partida, com os hashes de repetição e o contador.
- R2. Tipos TypeScript gerados com `ts-rs` para tudo o que o `wire` expõe,
  com uma receita no `justfile`.
- R3. Crate `seks-wasm` em `digital/seks/wasm/` com `wasm-bindgen`: um `Game`
  que cria a partida, aplica comandos, diz os destinos de um dado e se ele
  pode ser incrementado, desfaz a última jogada e devolve a visão e os
  eventos da transição.
  - Aceito quando `wasm-pack build` passa e um teste em Node joga uma
    partida inteira pelo `Game`.
- R4. O `Game` expõe o bot de `seks-bots` com os parâmetros da issue dos bots
  (nós, profundidade, ruído), para rodar num Web Worker.
- R5. O build do WASM entra no `just check`.

## Out of scope

- A interface: `dev/issues/interface-web-do-seks.md`.
- O servidor: `dev/issues/servidor-do-seks.md`.
