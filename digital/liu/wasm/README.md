# liu-wasm

Motor do Liu (`liu-engine`) em WebAssembly para a interface web. O `Game`
guarda uma partida e a pilha de desfazer; as regras ficam no motor.

Pré-requisitos e comandos são os do Seks (`digital/seks/wasm/README.md`):

- `just liu-wasm`: gera o pacote em `digital/liu/wasm/pkg` (fora do git).
- `just liu-wasm-test`: gera o pacote e joga partidas inteiras de 2 a 4
  jogadores pelo `Game` no Node (`tests/game.test.mjs`).
- `just liu-types`: regenera os tipos TypeScript em `types/`. O `just check`
  falha se eles divergirem do motor.

## API do `Game`

Tudo o que é estruturado cruza como texto JSON, nos tipos de `types/`. Erros
viram exceção em JavaScript e não mudam a partida.

| Método | Devolve |
|---|---|
| `new Game(players: number, seed: bigint)` | partida nova: selos rolados, um dado na mão de cada jogador e o primeiro mercado |
| `Game.fromState(json: string)` | partida a partir de um `State`; recusa estados que o motor não alcança |
| `openingEvents(): string` | `Event[]` da preparação e do primeiro mercado |
| `state(): string` | `State`: salvar a partida |
| `view(): string` | `View`: janelas, mãos, mercado, saco, vez, casas de cada número e pontos |
| `legalCommands(): string` | `Command[]` do jogador da vez |
| `command(json: string): string` | joga um `Command` e devolve a `Transition` (eventos e nova `View`) |
| `canUndo(): boolean`, `undo(): string` | desfaz o último comando e devolve a `View` |

Os dados rolados vêm de um gerador com semente guardado no `State`: desfazer
e jogar de novo o mesmo comando rola os mesmos números.
