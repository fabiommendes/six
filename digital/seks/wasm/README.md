# seks-wasm

Motor do Seks (`seks-engine`) em WebAssembly para a interface web. O `Game`
guarda uma partida e a pilha de desfazer; as regras ficam no motor. Contexto:
`dev/issues/seks-wasm.md`.

## Pré-requisitos

- Rust com o alvo `wasm32-unknown-unknown`: `rustup target add wasm32-unknown-unknown`.
- `wasm-pack`: `cargo install wasm-pack`.
- Node 22 ou mais novo, para o teste.

## Comandos

- `just seks-wasm`: gera o pacote em `digital/seks/wasm/pkg` (alvo `web`, com
  `.d.ts`). Não vai para o git.
- `just seks-wasm-test`: gera o pacote e roda `tests/game.test.mjs`, que joga duas
  partidas inteiras pelo `Game` (sementes fixas; `SEKS_GAMES=N` joga N a mais),
  e `tests/bot.test.mjs`, que joga o `Bot` contra um jogador aleatório e contra si.
  As receitas rodam com `nice -n 19` e `CARGO_BUILD_JOBS=4`.
- `just seks-types`: regenera os tipos TypeScript em `types/`. O `just check`
  falha se eles divergirem do `wire` do motor.

Para outro destino do pacote:
`cd digital && wasm-pack build seks/wasm --target web --out-dir CAMINHO`.

## API do `Game`

Tudo o que é estruturado cruza como texto JSON, nos tipos de `types/`. Casas e
comandos usam a notação do motor: `b2`, `b2-b4` (mover) e `b2+` (incrementar).
Erros viram exceção em JavaScript e não mudam a partida.

| Método | Devolve |
|---|---|
| `new Game()` | partida nova, Brancas a jogar |
| `Game.fromState(json: string)` | partida a partir de um `State`; recusa estados que o motor não alcança |
| `Game.fromDiagram(diagram: string, toMove: string)` | partida a partir do diagrama de texto do motor (11 linhas, da fileira 11 à 1, `..`, `w3`, `b5`) e da vez (`"white"` ou `"black"`); para fixtures e testes |
| `state(): string` | `State`: salvar a partida ou passar a um Worker |
| `view(): string` | `View`: dados, vez, jogadas sem captura, repetições, jogadas que empatam por repetição, resultado |
| `options(cell: string): string` | `DieOptions`: destinos do dado e se ele pode ser incrementado |
| `legalCommands(): string` | `Command[]`; vazio com a partida acabada |
| `command(text: string): string` | `Transition`: eventos, na ordem, e a nova `View` |
| `canUndo(): boolean` | há jogada para desfazer |
| `undo(): string` | `View` depois de desfazer uma jogada (inclusive a que acabou a partida) |

## API do `Bot`

O bot alfa-beta de `seks-bots`, com os pesos e o contempt padrão. Roda no mesmo
Worker da partida, que recria o `Game` com `Game.fromState`. A força é um
orçamento de nós, não de tempo (`ms` e arquivo de pesos não existem no
navegador). Um `Bot` guarda a tabela de transposição (16 MiB) entre as
jogadas: use um por partida.

| Método | Devolve |
|---|---|
| `new Bot(nodes?, depth?, noise)` | bot de `nodes` nós por jogada, no máximo `depth` lances de profundidade e `noise` de ruído (0: sempre a melhor; 100 vale um dado). Sem `nodes` nem `depth`: o nível padrão. Só `depth`: sem limite de nós. Lança se `depth` é 0 ou `noise` é negativo |
| `Bot.defaultNodes(): number` | nós por jogada do nível padrão (`AlphaBeta::DEFAULT_NODES`) |
| `bot.newGame()` | limpa a tabela de transposição; chame ao começar outra partida |
| `bot.choose(game: Game, seed: number): string` | o comando (`b2-b4`, `b2+`) da vez do `game`; a mesma semente e posição dão o mesmo comando; lança com a partida acabada |

`Bot` é uma classe à parte, e não métodos de `Game`: lê a posição por
`Game::game_state()` (Rust), sem repetir o estado em JSON.

```js
const bot = new Bot(undefined, undefined, 0); // nível padrão
const command = bot.choose(game, 1);
game.command(command);
```
