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

## Out of scope

- Desistência e prazo por jogada: perguntas abertas do RFC.
- Partida ao vivo: `dev/issues/partida-ao-vivo-do-seks.md`.
