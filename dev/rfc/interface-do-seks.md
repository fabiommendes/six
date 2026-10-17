---
type: rfc
status: accepted
tags: [seks, digital, web, interface, wasm]
relatedTo: [dev/issues/motor-do-seks-em-rust.md, dev/issues/bots-do-seks.md, dev/rfc/identidade-visual.md]
created: 2026-10-17
decided: 2026-10-17
creator: claude
---

# Interface digital do Seks

## Problem

O Seks tem motor (`digital/seks/engine/`) e vai ter bots
(`digital/seks/bots/`), mas a única forma de jogar é o protótipo em Pyxel. A
versão digital precisa rodar no navegador, em hotseat e contra bot, e depois
em rede. É a primeira interface da coleção: o que ela fizer com dados e
tabuleiro serve de base para os outros cinco jogos.

## Proposal

### Pilha

A mesma do Rio: Vite, TypeScript e Three.js em `digital/seks/web/`. O motor e
os bots rodam no navegador compilados para WASM, num crate `seks-wasm` em
`digital/seks/wasm/`. Depois, o mesmo motor roda no servidor autoritativo,
como no ADR 0010 do Rio.

Three.js vale aqui pelo dado: ele é a peça e o contador ao mesmo tempo, e
girar o dado para mostrar o novo valor é o gesto central do jogo físico. Em
3D, isso vira a animação natural de mover e de incrementar.

### Ordem de entrega

1. `seks-wasm` e a interface web com hotseat e jogo contra bot, sem rede. É um
   site estático.
2. Servidor de rede com o mesmo motor, em issue própria.

### Interação

Sempre clicando nos dados, como no protótipo:

- clicar num dado seu seleciona o dado e destaca as casas aonde ele pode ir;
- clicar numa casa destacada move o dado;
- clicar de novo no dado selecionado o incrementa; num 6, só tira a seleção;
- clicar em outro dado seu troca a seleção;
- clicar em qualquer outro lugar tira a seleção.

A interface não mostra lista de jogadas. Como ela sabe quais casas destacar é
detalhe de implementação, desde que ela não reimplemente regra: quem decide o
que é legal é o motor.

### Tabuleiro e animação

- Câmera ortográfica vista de cima por padrão, para ler as 121 casas e os 32
  valores de uma vez.
- Mover: o dado desliza até o destino e gira para a face do número de casas
  que andou.
- Incrementar: o dado gira uma face no lugar.
- Captura: o dado sai do tabuleiro para uma área ao lado, como no protótipo.
- A última jogada fica marcada até a próxima.

### Bot

O bot roda num Web Worker, para a busca não travar a interface. O nível vem
dos parâmetros que a issue dos bots expõe (nós, profundidade, ruído).

### O que falta no motor

O motor não tem serde nem tipos TypeScript. Entram com `seks-wasm`: um
adaptador `wire` para o estado e os eventos, e tipos gerados com `ts-rs`, como
no Rio.

### Código comum

O tabuleiro e o dado em 3D são escritos para servir aos outros jogos, mas
ficam em `digital/seks/web/` até o segundo jogo chegar, como manda o RFC de
estrutura para `digital/kit/`.

## Alternatives

- **2D em SVG**: mais simples, mais acessível, e reaproveita o desenho de
  dados dos diagramas do manual. Perde a animação do dado girando e não deixa
  um tabuleiro 3D para os outros jogos.
- **Evoluir o protótipo em Pyxel**: não roda bem no navegador, não tem rede e
  o visual de pixel art foi limite técnico, não escolha (RFC de identidade
  visual).

## Decisions

Respostas do designer às perguntas abertas:

- **Câmera**: vista de cima por padrão; a inclinada fica como opção.
- **Desfazer**: sim em hotseat e contra bot; em rede, não.
- **Visual**: neutro (madeira clara, dados brancos e pretos com pontos) até o
  RFC de identidade visual decidir.
- **Toque**: entra na primeira entrega; tocar e clicar são o mesmo gesto.
- **Empate próximo**: a interface mostra o contador de jogadas sem captura a
  partir de 80 e avisa quando a próxima repetição da posição empata.

## Outcome

Aceito em 2026-10-17. Gerou:

- `dev/issues/seks-wasm.md` (`todo`);
- `dev/issues/interface-web-do-seks.md` (`todo`);
- `dev/issues/servidor-do-seks.md` (`backlog`).
