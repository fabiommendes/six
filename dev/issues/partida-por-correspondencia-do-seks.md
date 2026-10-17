---
type: issue
status: in_progress
tags: [seks, digital, web, rede]
relatedTo: [dev/rfc/rede-sem-servidor.md, dev/issues/interface-web-do-seks.md]
kind: enhancement
created: 2026-10-17
creator: "F\xE1bio Mac\xEAdo Mendes"
---

# Partida por correspondência do Seks

## Context

Primeiro modo de rede do Seks, decidido em `dev/rfc/rede-sem-servidor.md`:
a partida viaja num link, sem servidor. Leia as seções Proposal e Decisions
do RFC.

## Requirements

- R1. Formato da partida no link: versão do formato, posição inicial e
  jogadas em forma compacta. Ida e volta testada em partidas inteiras.
  - Aceito quando uma partida de 300 jogadas cabe num link de até 2000
    caracteres.
- R2. Ao abrir um link, a interface refaz a partida com o motor, mostra a
  posição atual e a última jogada, e deixa jogar só a cor da vez. Link
  inválido (jogada ilegal, versão desconhecida, texto corrompido) mostra um
  aviso e não quebra a interface.
- R3. Depois de jogar, a interface mostra o link da nova posição com um
  botão de copiar e, onde houver, o compartilhamento nativo do navegador.
- R4. Tela inicial: criar partida por correspondência, escolhendo a cor.
- R5. O navegador guarda as partidas em andamento (uma lista na tela
  inicial), para voltar a elas sem o link.
- R6. Sem desfazer depois de mandar a jogada (decisão do RFC da interface:
  sem desfazer em rede). Antes de copiar o link, a jogada pode ser desfeita.
- R7. Textos com os termos de `regras/seks/GLOSSARY.md`, sem palavras de
  `Não usar:`; testes no `just check`.
- R8. Desistir (decisão do designer no RFC: é sair da partida, não há regra
  de resultado). Botão "Desistir", com confirmação; o link enviado marca a
  desistência. Quem abre o link vê que o outro saiu e escolhe "Continuar
  contra o bot" (da posição atual, com a mesma cor e o nível escolhido ali) ou
  "Encerrar". A partida guardada acompanha: sai da lista de quem desistiu e,
  em quem recebe, sai da lista ao encerrar ou vira partida contra o bot.

## Out of scope

- Prazo por jogada: pergunta aberta do RFC. (A desistência virou o R8.)
- Partida ao vivo: `dev/issues/partida-ao-vivo-do-seks.md`.

## Plano

Desenho: o formato do link é genérico (não importa o motor nem a UI) e fica
num módulo próprio; um adaptador do Seks liga o formato ao `SeksGame`. O link
é um fragmento (`#`): `v1.<id>.<posição>.<jogadas>`. A posição vazia é a
inicial padrão; as jogadas são o índice de cada uma na lista de
`legalCommands()` (ordem fixa do motor, travada por um vetor de teste), em
varint de 7 bits e base64url. Quem abre o link joga a cor da vez; o
navegador guarda a cor, o id e as jogadas de cada partida.

- [x] P1. Módulo genérico do formato (`src/logic/link.ts`): codifica e
  decodifica versão, id, posição inicial e jogadas contra um motor
  abstrato; erros com código (formato, versão, posição, jogada). Testes de
  ida e volta, de erros e vetor fixo.
- [x] P2. Adaptador do Seks (`src/logic/seks-link.ts`): motor do link sobre
  `SeksGame`, posição inicial padrão vazia e posição de diagrama/fixture
  compacta. Testes com partidas inteiras (jogadas aleatórias com semente),
  vetor fixo partida a link, tamanho de 300 jogadas.
- [x] P3. Partidas guardadas (`src/logic/mail-games.ts`): lista no
  `localStorage` (id, cor, posição, jogadas, quantas o outro já tem), e a
  regra de abrir um link (partida nova, link velho, link que avança, link
  que diverge). Rotas do fragmento (`#v1...` e `#g.<id>`). Testes.
- [x] P4. `Match` com o modo por correspondência (só a cor do jogador joga,
  desfazer até o "piso" travado por copiar ou compartilhar). Testes.
- [x] P5. Interface: tela inicial (escolha de cor e lista das partidas
  guardadas), painel de jogo com o link, copiar e compartilhar, aviso de
  link inválido, rota por `hashchange`; textos do glossário e teste de
  textos.
- [x] P6. Verificação no navegador com dois contextos (criar, jogar,
  copiar, abrir no outro, responder, voltar), tamanho do link de 300
  jogadas, README da web, `just check`, issue em `in_review`.
