---
type: issue
status: todo
tags: [seks, digital, web, rede, webrtc]
relatedTo: [dev/rfc/rede-sem-servidor.md, dev/issues/partida-por-correspondencia-do-seks.md]
kind: enhancement
created: 2026-10-17
creator: "F\xE1bio Mac\xEAdo Mendes"
---

# Partida ao vivo do Seks (P2P)

## Context

Segundo modo de rede do Seks, decidido em `dev/rfc/rede-sem-servidor.md`:
WebRTC direto entre os navegadores, com sinalização por infraestrutura
pública (Trystero). Depende do formato da partida de
`dev/issues/partida-por-correspondencia-do-seks.md`.

## Requirements

- R1. Criar partida ao vivo gera um link de convite (sala aleatória e cor de
  quem convida). Quem abre o link entra na partida com a outra cor.
- R2. Cada jogada viaja com o número da jogada e o hash da posição; cada lado
  valida com o próprio motor. Dessincronia ou jogada ilegal: quem convidou é
  a referência e manda a partida inteira no formato do link.
- R3. Queda de conexão: a partida fica guardada nos dois navegadores; ao
  voltar, os dois se reconectam pela mesma sala e conferem a posição.
- R4. Se a conexão não sair em um tempo razoável, ou cair sem volta, a
  interface oferece continuar por correspondência com a partida atual.
- R5. Indicação de conexão (conectando, conectado, adversário fora) e da vez.
  Sem desfazer.
- R6. Testes da camada de sala com um transporte falso (sem rede); teste no
  navegador com duas abas conectadas de verdade, fora do `just check`.

## Out of scope

- TURN, busca de adversário, ranking: modo pago (`dev/issues/servidor-do-seks.md`).
- Chat, espectadores e relógio.
