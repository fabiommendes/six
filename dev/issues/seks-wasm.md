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

## Plano

Decisões de desenho:

- `wire` é uma feature do `seks-engine` (serde, serde_json e ts-rs opcionais).
  Os tipos de domínio não ganham serde: o adaptador define tipos espelho e
  as conversões.
- O `Game` cruza a fronteira com JSON em texto (como o `rio-wasm`) e com a
  notação do motor (`b2-b4`, `b2+`) para casas e comandos. Erros viram
  exceção em JS.
- Os hashes de repetição cruzam como texto hexadecimal (um `u64` não cabe
  num número JSON do JavaScript).
- Desfazer fica no `Game` (pilha de estados `Copy`); o motor continua sem
  histórico.
- Pontos de extensão do bot (R4): o `Game` guarda um `GameState` acessível
  por Rust e se reconstrói do JSON do `wire`, então um Worker recria a
  partida com `Game.fromState` e um módulo `bot` acrescenta métodos num
  segundo bloco `#[wasm_bindgen] impl Game`.

Passos:

- [x] R1. Feature `wire` no `seks-engine`: estado completo (tabuleiro, vez,
  contador, hashes), comando, evento e resultado, com validação ao ler.
- [x] R1. Testes de ida e volta estado, JSON e estado em posições do meio da
  partida, com hashes e contador.
- [x] R2. Visão para a interface (`View`) no `wire`: dados, vez, contador de
  jogadas sem captura, repetições da posição, aviso de que a próxima
  repetição empata, resultado.
- [x] R2. Tipos TypeScript com `ts-rs` e receita `just seks-types`; teste
  que falha se os arquivos gerados estão desatualizados.
- [ ] R3. Crate `seks-wasm` (`digital/seks/wasm/`) com `Game`: criar, ler
  estado, aplicar comando com eventos, destinos e incremento de um dado,
  comandos legais, desfazer, visão.
- [x] R3. Testes do `Game` em Rust (nativo).
- [ ] R3. `wasm-pack build` e teste em Node que joga uma partida inteira
  pelo `Game`; README com pré-requisitos e comandos.
- [ ] R5. Receita `just seks-wasm` e build WASM no `just check`.
- [ ] R4. (Fora desta rodada: depende da API dos bots.) O `Game` expõe o
  bot de `seks-bots`.
