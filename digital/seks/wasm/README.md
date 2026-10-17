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
  partidas inteiras pelo `Game` (sementes fixas; `SEKS_GAMES=N` joga N a mais).
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
| `state(): string` | `State`: salvar a partida ou passar a um Worker |
| `view(): string` | `View`: dados, vez, jogadas sem captura, repetições, jogadas que empatam por repetição, resultado |
| `options(cell: string): string` | `DieOptions`: destinos do dado e se ele pode ser incrementado |
| `legalCommands(): string` | `Command[]`; vazio com a partida acabada |
| `command(text: string): string` | `Transition`: eventos, na ordem, e a nova `View` |
| `canUndo(): boolean` | há jogada para desfazer |
| `undo(): string` | `View` depois de desfazer uma jogada (inclusive a que acabou a partida) |

## Bot (R4, em aberto)

O `Game` não depende de `seks-bots`. O ponto de extensão é `Game::game_state()`
(Rust), mais um segundo bloco `#[wasm_bindgen] impl Game` num módulo `bot`. Um
Web Worker recria a partida com `Game.fromState(game.state())`.
