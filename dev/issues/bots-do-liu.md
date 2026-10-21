---
type: issue
status: in_review
tags: [liu, digital, rust, bots]
relatedTo: [dev/adr/0006-bots-do-liu-pimc.md, dev/notes/bots-do-liu.md, regras/liu]
kind: enhancement
created: 2026-10-20
creator: claude
---

# Bots do Liu

## Context

A versão digital do Liu (`digital/liu/`) tem motor, WASM e hotseat, mas
nenhum bot. O designer quer jogar contra bots na web e um bot calibrado,
no padrão do Rio: PIMC em Rust e um módulo WASM (ADR 0006).

## Requisitos

- R1. Crate `liu-bots` com `random`, `greedy` e `pimc`, lidos de uma
  especificação de texto, e arquivos de bot com pesos.
- R2. Nenhum bot lê o gerador de dados do estado: escolher sobre o estado
  com outra semente dá o mesmo comando.
- R3. `liu-bots batch`: lotes em threads, com rotação dos assentos, de 2 a 4
  jogadores, resumo por bot (vitórias com intervalo, pontos, ms por
  decisão, Elo em 2 jogadores) e um JSON por partida.
- R4. Calibração por CMA-ES dos pesos, que retoma se parar, com os
  resultados em `digital/liu/bots/tune/runs/` e as medições em
  `dev/notes/bots-do-liu.md`.
- R5. `liu-wasm` expõe `Bot`, testado no Node.
- R6. A web deixa escolher pessoa ou bot (fácil, médio, difícil) em cada
  lugar; o bot joga num Web Worker; desfazer volta até a vez de uma
  pessoa; a partida salva guarda quem é bot.
- R7. O nível difícil vence o médio com intervalo acima de 50% e responde
  em média abaixo de 0,5 s por decisão no WASM.

## Fora do escopo

- Bots com estilo (agressivo, defensivo) e partidas em rede.
