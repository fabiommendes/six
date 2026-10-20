# Interface web do Liu

Hotseat de 2 a 4 jogadores no mesmo aparelho, em Vite e TypeScript, com o
motor do Liu em WebAssembly (`digital/liu/wasm`). A tela é desenhada em SVG,
sem Three.js. Segue a identidade visual do ADR 0005: verde jade nas marcas,
treliça de janela na faixa do painel, seleção por quadrado grosso, destino
por anel e a última jogada por cantos.

## Comandos

- `just liu-wasm` antes de tudo: o pacote WASM não vai para o git.
- `just liu-web-dev`: servidor de desenvolvimento.
- `just liu-web-check`: tipos, testes (Vitest, com o motor real) e build em
  `dist/`. Faz parte do `just check`.
- `just site` publica o build em `out/site/liu/`.

## Organização

| Caminho | Conteúdo |
|---|---|
| `src/engine/` | `LiuGame`, o `Game` do WASM com JSON tipado, e o carregamento do módulo |
| `src/logic/selection.ts` | Cliques em comandos: dado do mercado e casa, ou dado da mão, casa e dado do mercado |
| `src/logic/texts.ts` | Todo texto mostrado ao jogador, com os termos de `regras/liu/GLOSSARY.md` |
| `src/logic/save.ts` | A partida salva no `localStorage`, para continuar depois |
| `src/ui/` | Tela inicial, tela do jogo e desenho em SVG dos dados e das janelas |

As fontes vêm de `digital/seks/web/public/fonts` (com as licenças), pelo CSS
em `src/styles/fonts.css`.

## Detalhes da versão digital

- Todos os dados comuns são brancos, e o saco começa com 15 dados por
  jogador (`regras/liu/01-componentes.md`).
- O código de cada jogador é escolhido pelo jogo, o que faz mais pontos: o
  conjunto de números mais comum entre as linhas e colunas completas.
- Os pontos mostrados durante a partida são os que o jogador faria se o jogo
  acabasse naquele momento.
- A janela fica sempre com o selo no centro de uma grade de 7 por 7; as casas
  desenhadas são as que a janela ainda pode usar, e a moldura aparece quando
  a janela ocupa uma região de 4 por 4.
