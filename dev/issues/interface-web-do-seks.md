---
type: issue
status: todo
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
  câmera inclinada como opção. Dados com pontos, brancos e pretos, sobre
  madeira clara, até o RFC de identidade visual decidir.
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
- Identidade visual definitiva.
