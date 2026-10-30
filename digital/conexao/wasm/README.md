# conexao-wasm

Motor (`Game`) e bots (`Bot`) do jogo de conexão (protótipo sem nome, regras
em `dev/rfc/jogo-de-conexao.md`) em WebAssembly, para a interface web. O
`Game` guarda uma partida e a pilha de desfazer; as regras ficam no motor
(`conexao-engine`).

O motor não tem serde: os tipos do JSON (`src/wire.rs`) ficam neste pacote e
espelham os do motor. Pré-requisitos e comandos são os do Seks
(`digital/seks/wasm/README.md`):

- `just conexao-wasm`: gera o pacote em `digital/conexao/wasm/pkg` (fora do
  git).
- `just conexao-wasm-test`: gera o pacote e joga partidas inteiras pelo `Game`
  e pelo `Bot` no Node (`tests/`).
- `just conexao-types`: regenera os tipos TypeScript em `types/`. O `just
  check` falha se eles divergirem de `src/wire.rs`.

## API do `Game`

Tudo o que é estruturado cruza como texto JSON, nos tipos de `types/`. Erros
viram exceção em JavaScript e não mudam a partida. Uma casa é
`fileira * 11 + coluna` em qualquer tamanho de tabuleiro, como no motor: as
fileiras contam do lado das Brancas, e o tabuleiro 9x9 usa o canto de cima e
da esquerda da grade.

| Método | Devolve |
|---|---|
| `new Game()` | partida nova com as regras da proposta (11x11, linha, 16 dados, sem captura) |
| `Game.withRules(rules: string)` | partida nova com `Rules` (tamanho, meta, dados, valor do dado colocado, bloqueio, bloqueio no campo próprio, bloqueante do tabuleiro, captura, limite de turnos) |
| `Game.defaultRules(): string` | as `Rules` da proposta |
| `Game.fromState(json: string)` | partida a partir de um `State`; recusa estados que o motor não alcança (dados fora do tabuleiro, contagem de dados errada) |
| `state(): string` | `State`: salvar a partida, ou mandá-la ao Worker do bot |
| `view(): string` | `View`: casas, reservas, capturados, vez, fileiras do bloqueio de cada lado, lances legais e fim |
| `play(json: string): string` | joga um `Move` e devolve a `Transition` (o lance, os dados capturados e a nova `View`) |
| `canUndo(): boolean`, `undo(): string` | desfaz o último lance e devolve a `View` |

`Bot(name, seed)` (`random`, `greedy`, `noblock`, `lookahead` ou `search`):
`choose(game)` devolve o `Move` JSON que o bot joga na posição do `Game`. O
`search` leva até alguns segundos por lance em WASM; a interface o roda num
Web Worker.
