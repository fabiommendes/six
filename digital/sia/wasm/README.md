# sia-wasm

Motor (`Game`) e bots (`Bot`) do Sia em WebAssembly para a interface web. O
`Game` guarda uma partida e a pilha de desfazer; as regras ficam no motor.

Pré-requisitos e comandos são os do Seks (`digital/seks/wasm/README.md`):

- `just sia-wasm`: gera o pacote em `digital/sia/wasm/pkg` (fora do git).
- `just sia-wasm-test`: gera o pacote e joga partidas inteiras pelo `Game` e
  pelo `Bot` no Node (`tests/`); o teste do `pimc` mede o tempo por decisão
  (`SIA_BENCH=N` mede N decisões).
- `just sia-types`: regenera os tipos TypeScript em `types/`. O `just check`
  falha se eles divergirem do motor.

## API do `Game`

Tudo o que é estruturado cruza como texto JSON, nos tipos de `types/`. Erros
viram exceção em JavaScript e não mudam a partida.

| Método | Devolve |
|---|---|
| `new Game(seed: bigint)` | partida nova: marcos rolados, mãos de 6 dados (o coringa e 5 da bolsa), primeiro jogador sorteado |
| `Game.withHandSize(size: number, seed: bigint)` | o mesmo com mãos de 2 a 10 dados, só para experimento |
| `Game.fromState(json: string)` | partida a partir de um `State`; recusa estados que o motor não alcança |
| `openingEvents(): string` | `Event[]` da preparação |
| `state(): string` | `State`: salvar a partida |
| `view(): string` | `View`: marcos, lados, mãos, vez, marcos que aceitam dado, reivindicações provadas e o que cada lado ainda pode virar |
| `legalCommands(): string` | `Command[]` do jogador da vez (rolar de novo tem centenas de variantes; a interface monta a sua pela `View`) |
| `command(json: string): string` | joga um `Command` e devolve a `Transition` (eventos e nova `View`) |
| `canUndo(): boolean`, `undo(): string` | desfaz o último comando e devolve a `View` |

`Bot(spec)`: `name()` e `choose(game, seed)` devolvem o `Command` JSON que o
bot joga na posição do `Game`.

Os dados vêm de um gerador com semente guardado no `State`: desfazer e jogar
de novo o mesmo comando rola os mesmos números.
