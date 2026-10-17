# Interface web do Seks

Vite, TypeScript e Three.js. O motor roda no navegador em WebAssembly
(`digital/seks/wasm`). Contexto: `dev/issues/interface-web-do-seks.md`.
Hotseat ou jogo contra o bot, com toque ou mouse, em retrato e paisagem.

## Comandos

- `just seks-wasm`: gera o pacote WASM em `digital/seks/wasm/pkg` (a interface
  importa dele; não vai para o git).
- `just seks-web-install`: instala as dependências (pnpm).
- `just seks-web-dev`: servidor de desenvolvimento.
- `just seks-web-check`: tipos, testes e build (`dist/`).

## Estrutura

- `src/engine`: carregador do WASM e invólucro tipado do `Game`.
- `src/logic`: seleção, partida (`Match`, desfazer, capturados), contador,
  textos ao jogador e posições de teste. Não depende de DOM nem de WebGL.
- `src/bot`: Web Worker do bot, protocolo, níveis e o bot provisório.
- `src/board`: tabuleiro e dados em Three.js, motivo da moldura.
- `src/ui`: telas (inicial e de jogo) e o painel, em DOM.
- `tests/`: vitest com o WASM real no Node, sem mock do motor.

## Posições de teste

`?fixture=NOME` abre uma posição pronta, para olhar a tela sem jogar até lá:

- `esboco`: a partida do esboço de arte (`arte/esbocos/c-motivos-por-lingua/jogo.png`),
  com o contador visível.
- `contador`: a mesma posição com 85 jogadas sem captura.
- `fim`: as Brancas ganham jogando c8 para c11.

## Bot provisório

O bot de verdade ainda não está no WASM. O Worker é real, mas o bot só sorteia
entre as jogadas legais, em qualquer nível. Trocar pelo bot de verdade é mudar
só `src/bot/chooser.ts` e o Worker.
