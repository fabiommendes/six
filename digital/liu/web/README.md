# Interface web do Liu

Partidas de 2 a 4 jogadores no mesmo aparelho, cada lugar com uma pessoa
ou um bot, em Vite e TypeScript, com o motor e os bots do Liu em
WebAssembly (`digital/liu/wasm`). A mesa é desenhada em 3D com Three.js:
uma mesa de madeira com a moldura, a janela e a mão de cada jogador, o
mercado numa bandeja no centro e o saco. Os painéis (jogadores, vez,
ações, histórico e fim do jogo) ficam por cima, em HTML. Segue a
identidade visual do ADR 0005: verde jade nas marcas, treliça de janela
na borda das molduras, seleção por quadrado grosso, destino por anel e a
última jogada por cantos.

## Comandos

- `just liu-wasm` antes de tudo: o pacote WASM não vai para o git.
- `just liu-web-dev`: servidor de desenvolvimento.
- `just liu-web-check`: tipos, testes (Vitest, com o motor real) e build em
  `dist/`. Faz parte do `just check`.
- `just site` publica o build em `out/site/liu/`.

## Organização

| Caminho | Conteúdo |
|---|---|
| `src/engine/` | `LiuGame` e `LiuBot`, o `Game` e o `Bot` do WASM com JSON tipado, e o carregamento do módulo |
| `src/bot/` | Os níveis (especificações de `liu-bots`), o Web Worker do bot e o cliente que fala com ele |
| `src/table/` | A mesa em 3D (`Table3D`): disposição dos lugares (`layout.ts`), texturas desenhadas em canvas, dados, animações de cada evento e sons feitos com Web Audio |
| `src/logic/feedback.ts` | O que a tela mostra de uma mudança: linhas completadas, dados do mercado com cada número de selo, dados que não cabem |
| `src/logic/selection.ts` | Cliques em comandos: dado do mercado e casa, ou dado da mão, casa e dado do mercado |
| `src/logic/texts.ts` | Todo texto mostrado ao jogador, com os termos de `regras/liu/GLOSSARY.md` |
| `src/logic/save.ts` | A partida salva no `localStorage` (nomes, quem é bot e o estado), para continuar depois |
| `src/ui/` | Tela inicial, tela do jogo (painéis sobre a mesa) e os ícones SVG dos dados |

As fontes vêm de `digital/seks/web/public/fonts` (com as licenças), pelo CSS
em `src/styles/fonts.css`.

## Detalhes da versão digital

- Todos os dados comuns são brancos, e o saco começa com 16 dados por
  jogador (`regras/liu/01-componentes.md`).
- O código de cada jogador é escolhido pelo jogo, o que faz mais pontos: o
  conjunto de números mais comum entre as linhas e colunas completas.
- Na vez de um bot, a jogada sai de um Web Worker e aparece depois de pelo
  menos 0,6 s; os cliques no jogo ficam parados até lá. Desfazer volta até a
  última vez de uma pessoa, passando pelas jogadas dos bots.
- O bot recebe o estado inteiro, com o gerador de dados, mas joga sobre
  cópias com outra semente: não sabe o que o saco e as rolagens vão dar.
- Os pontos mostrados durante a partida são os que o jogador faria se o jogo
  acabasse naquele momento.
- A janela fica sempre com o selo no centro de uma grade de 7 por 7; as casas
  claras são as que a janela ainda pode usar. A moldura cerca essas casas e
  se fecha, com a grade de dentro, quando a janela ocupa uma região de 4 por 4.
- Os lugares ficam em volta da mesa em sentido horário. A câmera fica atrás
  da pessoa da vez e gira até a próxima pessoa; arrastar gira e inclina a
  mesa, a roda do mouse ou o gesto de pinça aproximam da sua janela, e o
  duplo clique ou o botão de centralizar voltam à vista inicial. Em tela
  estreita a câmera enquadra só a sua janela e o mercado.
- Cada evento vira uma animação: os dados saem do saco para o mercado, o dado
  escolhido voa até a casa ou a mão, o mercado salta ao rolar de novo, as
  linhas completas sobem e mostram os pontos. Na vez de um bot, o dado que
  ele escolheu levanta e a casa de destino ganha um anel antes da jogada.
  Com "reduzir movimento" no sistema, as animações são puladas.
- No mercado, um disco da cor do jogador fica sob cada dado com o número do
  seu selo, e na vez de uma pessoa um traço marca os dados que não cabem na
  janela dela. Com um dado escolhido, passar o mouse numa casa marcada mostra
  o dado ali e acende a linha e a coluna.
- Em desenvolvimento, `window.liuTable` e `window.liuScreen` expõem a mesa e
  a tela para testes no navegador (`liuTable.screenOf(pick)` dá a posição
  de um dado ou de uma casa na página).
