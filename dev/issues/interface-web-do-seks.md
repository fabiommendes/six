---
type: issue
status: in_review
tags: [seks, digital, web, interface]
relatedTo: [dev/rfc/interface-do-seks.md, dev/issues/seks-wasm.md]
kind: enhancement
created: 2026-10-17
creator: "F\xE1bio Mac\xEAdo Mendes"
---

# Interface web do Seks

## Context

Primeira interface digital do Seks e da coleção, decidida em
`dev/rfc/interface-do-seks.md`: Vite, TypeScript e Three.js em
`digital/seks/web/`, com o motor e o bot em WASM (`dev/issues/seks-wasm.md`).
Site estático, sem rede. Leia a seção "Decisions" do RFC.

## Requirements

- R1. Hotseat e jogo contra bot, escolhidos numa tela inicial, com a cor do
  jogador humano e o nível do bot.
- R2. Interação sempre clicando ou tocando nos dados, como no protótipo:
  selecionar um dado seu destaca os destinos; clicar num destino move;
  clicar de novo no selecionado incrementa (num 6, tira a seleção); clicar em
  outro dado seu troca a seleção; clicar fora tira a seleção. Sem lista de
  jogadas na tela. A interface não reimplementa regra: os destinos vêm do
  motor.
  - Aceito quando testes de interface cobrem cada caso acima.
- R3. Tabuleiro 11 por 11 em Three.js, câmera ortográfica vista de cima, com
  câmera inclinada como opção. Visual da direção "motivo por língua" (ADR
  0005), a partir de `arte/esbocos/c-motivos-por-lingua/jogo.html`: moldura
  com a malha nórdica do Seks, paleta e fontes do `LEIAME.md` da mesma pasta,
  dados com pontos e marcas de jogada por forma (seleção, destino, origem e
  destino da última jogada).
  - Aceito quando uma captura da tela de jogo, lado a lado com
    `arte/esbocos/c-motivos-por-lingua/jogo.png`, mostra os mesmos elementos
    na mesma posição da partida do esboço.
- R4. Animações: mover desliza o dado e gira para a face do número de casas
  andadas; incrementar gira uma face no lugar; o dado capturado vai para uma
  área ao lado do tabuleiro; a última jogada fica marcada.
- R5. O bot roda num Web Worker; a interface continua respondendo enquanto
  ele pensa.
- R6. Desfazer em hotseat e contra bot (contra bot, desfaz até a última
  jogada humana).
- R7. Fim de jogo: vencedor e motivo, ou empate e motivo. A partir de 80
  jogadas sem captura, a interface mostra o contador; quando a próxima
  repetição de uma posição empataria, avisa.
- R8. Funciona com toque em celular, em retrato e paisagem.
- R9. Textos ao jogador em português, com os termos do glossário
  `regras/seks/GLOSSARY.md` e nenhuma palavra de `Não usar:`.
- R10. `typecheck`, testes e build da interface entram no `just check`.

## Out of scope

- Jogo em rede: `dev/issues/servidor-do-seks.md`.
- Extrair o tabuleiro e o dado para `digital/kit/`.
- Temas alternativos (as outras direções de `arte/esbocos/`).
- Ajustes de desenho dos motivos dos outros cinco jogos.

## Plano

Decisões de desenho:

- `digital/seks/web/` com pnpm, na estrutura do Rio. O pacote WASM não é
  copiado: a interface importa de `digital/seks/wasm/pkg` (gerado por
  `just seks-wasm`) e os tipos, de `digital/seks/wasm/types`.
- Três camadas, para testar sem WebGL: `src/engine` (carregador do WASM e
  invólucro tipado sobre o `Game`), `src/logic` (seleção, partida, desfazer,
  contador, textos), `src/bot` (Worker e bot); `src/board` (Three.js) e
  `src/ui` (DOM) só desenham e repassam cliques.
- A lógica roda nos testes com o WASM real no Node (vitest), sem mock do
  motor.
- Para carregar posições (R3), `seks-wasm` ganha `Game.fromDiagram` (o
  diagrama de texto que o motor já lê), com teste. A interface abre uma
  posição de teste com `?fixture=esboco`: a partida do esboço de arte.
- O bot de verdade ainda não está no WASM (R4 do `seks-wasm`). O Worker é
  real e recebe `Game.state()`, mas o bot provisório só sorteia de
  `legalCommands()`. Os níveis da tela inicial guardam nós, profundidade e
  ruído, que o provisório ignora; trocar pelo bot real é mudar só o Worker.
- O dado capturado voa do tabuleiro até a área "capturado" do painel, ao lado
  do tabuleiro, como no esboço.

Passos:

- [x] R10. Esqueleto de `digital/seks/web/`: Vite, TypeScript, vitest, fontes
  da Alegreya empacotadas, receitas do `just` e `just check`, mapa e comandos
  do `AGENTS.md`.
- [x] `seks-wasm`: `Game.fromDiagram`, com teste em Rust e em Node.
- [x] Invólucro tipado do `Game`, carregador do WASM e testes.
- [x] R2. Máquina de seleção pura, ligada às opções do motor, com testes de
  cada caso (selecionar, mover, incrementar, 6, trocar, clicar fora).
- [x] R1, R6. Partida (`Match`): hotseat, jogo contra bot, desfazer em laço até
  a vez do humano, capturados e última jogada, com testes.
- [x] R7. Contador a partir de 80, aviso de repetição, vencedor e motivo, empate
  e motivo, com testes.
- [x] R9. Textos ao jogador com os termos do glossário e teste contra as
  palavras de `Não usar:`.
- [x] R5. Web Worker do bot e bot provisório, níveis, com testes.
- [x] R3. Tabuleiro em Three.js: moldura com a malha nórdica, casas, dados com
  pontos, marcas por forma, câmera de cima e inclinada, clique e toque.
- [x] R4. Animações: mover (desliza e gira), incrementar (gira no lugar),
  captura (voa para a área do painel), marcas da última jogada.
- [x] R1, R7, R8. Telas: inicial, jogo (painel do esboço), fim de jogo, retrato e
  paisagem, toque.
- [x] R3. `?fixture=esboco` e captura de tela ao lado de `jogo.png`.
- [x] R10. `just check` inteiro, conferência de termos proibidos, issue em
  `in_review`.
- [x] R5. Troca do bot provisório pelo bot de `seks-bots` no WASM (R4 de
  `dev/issues/seks-wasm.md`): o Worker guarda um `Bot` por partida, os níveis
  viram orçamentos de busca (Fácil 200 nós e ruído 100; Médio 2000 nós e ruído
  30; Difícil o padrão dos bots), o aviso de bot provisório saiu da tela
  inicial e do README. Medido no Chromium: o nível Difícil leva cerca de 58 ms
  por jogada no Worker.
