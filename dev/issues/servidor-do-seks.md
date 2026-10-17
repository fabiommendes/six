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

Jogo em rede do Seks, com o mesmo motor, como o servidor autoritativo do Rio
(ADR 0010 do Rio: lugares por token, convite por link, bot do servidor,
agentes de LLM atrás de flag). Previsto em `dev/rfc/interface-do-seks.md`
depois da interface offline.

## Requirements

A definir quando a interface offline estiver pronta. Pontos de partida:
reaproveitar o desenho do `rio-server`, sem desfazer em rede, e decidir se o
código de servidor já nasce em `digital/kit/`.

## Out of scope

- Contas de usuário e ranking.
