---
type: issue
status: in_progress
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
- R7. "Desistir" (decisão em `dev/rfc/rede-sem-servidor.md`): quem desiste
  sai da partida; o outro jogador escolhe continuar contra o bot, a partir
  da posição atual, ou encerrar. Reaproveita o que a partida por
  correspondência fizer para isso.

## Out of scope

- TURN, busca de adversário, ranking: modo pago (`dev/issues/servidor-do-seks.md`).
- Chat, espectadores e relógio.

## Plano

Desenho: a camada de rede (`src/net/`) não conhece o DOM nem o Trystero. O
transporte é uma interface (`join(sala)` que devolve uma sala com `send`,
`onMessage`, presença do adversário e `leave`); há duas implementações: Trystero
com a estratégia Nostr (relays padrão da biblioteca) e uma em memória para os
testes. `LiveSession` fala o protocolo sobre o transporte e consulta um
`LiveGame` (as jogadas, o hash da posição, aplicar a jogada do outro). A partida
ao vivo é uma entrada da lista guardada (`MailGame` com `live`), com o mesmo
`id`; o `id` também dá o nome da sala. Isso faz o fallback para correspondência
ser só tirar o `live` da entrada.

Convite: fragmento `i1.<id>.<cor de quem convida>` (`w` ou `b`), distinto do
link de correspondência (`v1...`). Mensagens (JSON): `move` (`n` é o índice da
jogada, `cmd`, `h` é o hash da posição depois dela), `state` (a partida inteira
no formato de `link.ts`, enviada ao ligar e ao reconectar, e como resposta a
problema), `resign`. Quem convidou é a referência: num estado que diverge, o
convidado adota o do anfitrião; se um estado é prefixo do outro, vale o mais
longo.

- [ ] P1. Refatorar `GameScreen` (`src/ui/game.ts`) em componentes (painel de
  correspondência, diálogo de confirmação, cartão de fim), sem mudar
  comportamento. (`Refs: interface-web-do-seks`)
- [x] P2. "Terminar com bots": intervalo mínimo de 0,3 s contado do início da
  jogada anterior, em vez de 0,7 s de espera. Teste e README.
  (`Refs: interface-web-do-seks`)
- [ ] P3. Correção da correspondência: quem desiste e recarrega mantém a
  partida (marcada como desistida) até copiar ou compartilhar o link.
- [ ] P4. Painel da correspondência sem rolar em 1440x900 com o link e a dica
  juntos.
- [ ] P5. Transporte: interface, transporte em memória para os testes e
  transporte Trystero (Nostr). Dependência fixada.
- [ ] P6. Convite (`src/logic/invite.ts`), rota do fragmento e `live` na
  entrada guardada. Testes.
- [ ] P7. Protocolo e `LiveSession` com testes no transporte falso: conexão,
  jogadas, jogada ilegal, dessincronia e ressincronização, queda e reconexão,
  desistência.
- [ ] P8. `Match` em modo ao vivo (jogada do outro, sem desfazer), hash da
  posição no `SeksGame`, textos do glossário e cartão "Você venceu/perdeu".
- [ ] P9. Interface: criar partida ao vivo, painel (convite, conexão, vez,
  fallback para correspondência), entrar pelo convite, desistir e continuar
  contra o bot.
- [ ] P10. Verificação no navegador com duas abas (sinalização pública),
  README da web com a escolha da biblioteca, `just check`, issue em
  `in_review`.
