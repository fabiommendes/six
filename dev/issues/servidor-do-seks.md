---
type: issue
status: backlog
tags: [seks, digital, rede]
relatedTo: [dev/rfc/interface-do-seks.md]
kind: enhancement
created: 2026-10-17
creator: "F\xE1bio Mac\xEAdo Mendes"
---

# Servidor de rede do Seks

## Context

Modo pago, no futuro. O modo gratuito de rede não tem servidor: partida por
correspondência e partida ao vivo P2P (`dev/rfc/rede-sem-servidor.md`). O
servidor entra quando houver público para busca de adversário, ranking,
contas e um TURN próprio para as conexões que o P2P não alcança. Desenho de
partida pode partir do servidor autoritativo do Rio (ADR 0010 do Rio:
lugares por token, convite por link, bot do servidor).

## Requirements

A definir quando o modo pago for decidido. Pontos de partida: reaproveitar
o desenho do `rio-server`, sem desfazer em rede, e decidir se o código de
servidor já nasce em `digital/kit/`.

## Out of scope

- Partida por correspondência e partida ao vivo P2P (modo gratuito).
