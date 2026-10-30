# missoes-wasm

O jogo de missões (protótipo sem nome, regras em `dev/rfc/jogo-de-missoes.md`)
em WebAssembly para a interface web: o motor uma decisão por vez
(`missoes_engine::Steps`) e os bots de `missoes-bots` nos lugares de bot. As
regras ficam no motor; a interface só monta respostas com as opções que a
`View` lista.

Pré-requisitos e comandos são os do Seks (`digital/seks/wasm/README.md`):

- `just missoes-wasm`: gera o pacote em `digital/missoes/wasm/pkg` (fora do git).
- `just missoes-wasm-test`: gera o pacote e joga partidas inteiras no Node
  (`tests/`), com pessoas que respondem ao acaso e bots.
- `just missoes-types`: regenera os tipos TypeScript em `types/`. O `just
  check` falha se eles divergirem do `src/wire.rs`.

## API do `Game`

Tudo o que é estruturado cruza como texto JSON, nos tipos de `types/`. Erros
viram exceção em JavaScript e não mudam a partida.

| Método | Devolve |
|---|---|
| `new Game(setup: string, seed: bigint)` | partida nova de um `Setup`: o bot de cada lugar (`"random"`, `"greedy"` ou outro nome de `missoes_bots::by_name`; `null` para pessoa), de 2 a 4 lugares, e a meta (30 por padrão) |
| `view(): string` | `View`: pontos, reservas, mesa de missões, vitrine, a rodada em curso (mãos, dinheiro, ordem, marcadores, o resultado de cada um em cada missão), a decisão pendente com as opções legais, a última rodada pontuada e os vencedores |
| `botToMove(): boolean` | se a decisão pendente é de um bot |
| `check(answer: string): string \| undefined` | confere a `Answer` da pessoa que decide agora sem jogá-la: `undefined` se `apply` a aceitaria, senão o motivo |
| `apply(answer: string): string` | joga a `Answer` da pessoa que decide agora e devolve o `Step` (quem, a resposta e a nova `View`) |
| `playBot(): string` | o bot que decide agora responde; devolve o `Step` |

As decisões são as do trait `Player` do motor, na mesma ordem: escolher os
dados (`select`), tirar dados da reserva por dinheiro (`cash`), comprar
(`buy`), pôr o marcador (`place`, também depois de uma sabotagem) e agir
(`act`: sacrificar, usar 0, modificar, sabotar ou passar). Quem não tem o
que decidir é pulado, como no motor. A sabotagem custa `View.sabotageCost`
pontos.

- A sabotagem (`{ kind: "sabotage", spot }`) aponta uma `Spot`, a padrão
  (`{ kind: "standard" }`) ou uma carta (`{ kind: "card", card }`). As
  opções legais vêm em `Decision.act.sabotage`, também como `Spot`: a
  última missão da mesa não aparece. Com a padrão sabotada,
  `RoundView.standard` é `false` e o resultado de todos nela fica 0.
- `RoundView.table` dá `null` para uma carta sabotada nesta rodada;
  `View.table` guarda as cartas do começo da rodada. Uma carta sabotada ou
  em que ninguém pontuou continua em `View.table` na rodada seguinte.
- `Mission` é uma string. As missões 1 a 6 (`Mission::Number(n)` no motor)
  cruzam como variantes planas, `ones`, `twos`, `threes`, `fours`, `fives`
  e `sixes`, para o TypeScript ter uma união de strings só.

O bot guloso pode levar um segundo ou mais numa decisão; a interface roda o
`Game` num Web Worker.
