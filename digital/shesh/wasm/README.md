# shesh-wasm

Motor (`Game`) e bots (`Bot`) do Shesh em WebAssembly para a interface web. O
`Game` guarda uma partida e a pilha de desfazer; as regras ficam no motor.

Pré-requisitos e comandos são os do Seks (`digital/seks/wasm/README.md`):

- `just shesh-wasm`: gera o pacote em `digital/shesh/wasm/pkg` (fora do git).
- `just shesh-wasm-test`: gera o pacote e joga partidas inteiras pelo `Game` e
  pelo `Bot` no Node (`tests/`).
- `just shesh-types`: regenera os tipos TypeScript em `types/`. O `just check`
  falha se eles divergirem do motor.

## API do `Game`

Tudo o que é estruturado cruza como texto JSON, nos tipos de `types/`. Erros
viram exceção em JavaScript e não mudam a partida.

| Método | Devolve |
|---|---|
| `new Game(seed: bigint)` | partida nova: reservas de 1 a 6, primeiro jogador sorteado e primeira rolagem feita |
| `Game.withRules(rules: string, seed: bigint)` | o mesmo com `Rules` (lance extra nas rosetas, entrada livre, levar todos os dados vence), só para experimento |
| `Game.fromState(json: string)` | partida a partir de um `State`; recusa estados que o motor não alcança |
| `state(): string` | `State`: salvar a partida |
| `view(): string` | `View`: trilha e reserva de cada jogador, pontos, vez, rolagem, jogadas legais com os eventos de cada uma e fim |
| `legalCommands(): string` | `Command[]` do jogador da vez |
| `command(json: string): string` | joga um `Command` e devolve a `Transition` (eventos, fechados pela rolagem do turno seguinte, e nova `View`) |
| `canUndo(): boolean`, `undo(): string` | desfaz o último comando e devolve a `View` |

`Bot(name, seed)` (`random`, `greedy` ou `expecti`): `choose(game)` devolve o
`Command` JSON que o bot joga na posição do `Game`. O bot não lê o gerador do
estado, então não sabe as rolagens futuras.

As rolagens vêm de um gerador com semente guardado no `State`: desfazer e
jogar de novo o mesmo comando rola os mesmos números.
