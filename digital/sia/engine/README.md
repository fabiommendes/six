# sia-engine

Motor do Sia em Rust. As regras estão em `regras/sia/` e os termos em
`regras/sia/GLOSSARY.md` (o código usa os termos `en:`: `stone` é o marco,
`side` o lado, `claim` reivindicar). O motor é puro: os dados vêm de um
gerador com semente guardado no estado, então uma partida se repete igual.

## Um turno

Uma sequência de comandos do mesmo jogador (`Command`):

| Comando | Passo | Efeito |
|---|---|---|
| `Reroll { target, lost, dice }` | 1 | perde o dado `lost` da própria mão e rola de novo os dados da mão `target` marcados em `dice` (máscara de bits); só no começo do turno |
| `Claim { stone }` | 2 | toma um marco provado (dois lados completos, ou a prova contra o lado incompleto); quantos quiser |
| `Place { die, stone }` | 3 | põe um dado da mão do seu lado do marco; o motor repõe a mão e passa o turno |
| `Pass` | 3 | só sem lugar para pôr; passa o turno |

Os índices de dados são posições na mão antes do comando. `Event` conta o
que aconteceu, em ordem (`Rerolled`, `Claimed`, `Placed`, `Drawn`,
`TurnStarted`, `Awarded`, `GameEnded`). `GameState::legal_commands` lista
tudo o que vale, sem repetir dados iguais.

## Pontos

- `formation` e `best_completion`: a ordem das formações e a melhor formação
  que um lado ainda pode virar (base da prova de reivindicação). O marco conta
  só para a sequência e para a soma; trinca e par olham os 3 dados do
  jogador, e não há quadra nem dois pares. Como o naipe
  só importa na formação de naipe, basta enumerar os números dos dados que
  faltam (no máximo 216 casos); os testes conferem contra a enumeração
  completa de números e naipes.
- `GameState::with_hand_size(n, seed)`: mão de 2 a 10 dados, só para
  experimento. A regra é 5 (`GameState::new`).
- Coringa: cada jogador começa com um dado de naipe `JOKER_SUIT` na mão, com
  número rolado na preparação. Vale como qualquer naipe, o dono pode rolá-lo
  ou perdê-lo ao rolar de novo, e o adversário não pode rolá-lo. Posto ou
  perdido, não volta: a reposição tira só dados dos 4 naipes da bolsa.
- `GameState::reseeded`: o mesmo jogo com outro gerador, para os bots.
- Feature `wire`: serde, `wire::View` e os tipos TypeScript (`just
  sia-types`).

## Testes

`just sia-engine-test`.
