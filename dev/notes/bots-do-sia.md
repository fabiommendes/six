---
type: note
status: active
tags: [sia, bots, calibracao, medicoes]
relatedTo: [dev/rfc/jogo-linha-de-batalha.md, regras/sia/, dev/handoffs/sia-digital.md]
---

# Bots do Sia: calibração e medições

Medições de 2026-10-21 com o motor e os bots de `digital/sia/`. Todos os
lotes são de 2 jogadores, com rotação: cada distribuição (semente) é jogada
nas duas ordens de assento. Elo com o intervalo de 95% da variância
trinomial. Os lotes rodaram com `CPUQuota=600%` e `nice 19`, com load de 12
a 19 na máquina, então os tempos são de máquina carregada.

Arquivos: `digital/sia/bots/tune/runs/fase-1/` (configuração, `log.csv`,
`best.json`, `validacao.txt`). As saídas completas dos lotes ficam em
`runs/medicoes/` (fora do git, como o binário `runs/sia-bots*`).

## Calibração

Fase 1 (`tune/fase1.json`): CMA-ES, 30 gerações de 12 candidatos, 300
partidas por candidato, `greedy` contra `greedy`, mão de 7. Pesos à mão
contra pesos calibrados, em 4000 partidas com sementes que a busca não usou
(500000): os calibrados vencem 63,5% [61,9; 64,9], **+96 Elo [+85, +107]**.
Foram adotados como padrão (`weights/default.json`).

| Peso | À mão | Calibrado |
|---|---|---|
| `adjacent` | 0,30 | 0,21 |
| `prob` | 1,60 | 1,47 |
| `sure` | 0,30 | 0,08 |
| `neighbors` | 1,00 | 0,81 |
| `placed` | 0,05 | -0,30 |
| `lost` | -0,15 | -0,53 |
| `hand` | 0,30 | 0,42 |
| `opp_hand` | -0,20 | -1,43 |

Leitura: o bot passa a cobrar mais cada dado perdido (`lost`) e a valorizar
muito rolar a mão do adversário (`opp_hand`), e deixa de se importar com
dados já colocados. Com os pesos à mão ele rolava de novo 10,4 vezes por
partida; agora rola 8,0.

## Força e tempo

Sementes 600000, pesos calibrados.

| Lote | Partidas | Resultado | Elo | ms por decisão nativo |
|---|---|---|---|---|
| `greedy` x `random` | 600 | 600 a 0 | acima de +880 (limite inferior do intervalo) | 4,3 e 0,01 |
| `pimc` x `greedy` | 300 | 238 a 62 (79,3% [74,4; 83,5]) | +234 [+189, +287] | 200 (máx. 879) e 3,8 |
| `pimc` x `pimc` | 300 | 150 a 150 | 0 | 177 (máx. 694) |
| `greedy:cands=0` x `greedy` | 4000 | 38,1% [36,0; 40,3] | -84 [-100, -68] | 0,2 e 3,9 |

No WASM, pelo Node (`bench.mjs`, 8 posições do começo da partida, load 12 a
19): `pimc` 379 ms (máx. 419), `greedy` 8 ms, `random` 0 ms. O `pimc` fica
abaixo de 0,5 s com folga pequena; se a web pedir mais, baixe `samples` de
`Pimc::new`.

`cands=0` tira do `greedy` as rolagens que ele escolhe, então o valor de
rolar de novo é de uns 84 Elo.

## Como as partidas acabam

Partidas de 7 dados na mão, `greedy` contra `greedy` (4000 partidas):

| Fim | Parte |
|---|---|
| 5 marcos | 30,2% |
| 3 vizinhos | 57,6% |
| sem lugar | 12,2% |

Turnos: média 44,4, mediana 45, p10 38, p90 50, máximo 54 (9 marcos x 3
dados x 2). Cada jogador toma em média 3,2 marcos; 6,3 reivindicações por
partida (53% por prova), e 0,17 marcos decididos no fim por falta de lugar.
Com o `pimc`: 28% / 62% / 10% contra `greedy`, 29% / 53% / 19% contra ele
mesmo, com 44 e 48 turnos.

Empate por falta de lugar é impossível: sem lugar para ninguém, todo marco
que resta tem os dois lados completos, e os 9 marcos se decidem (total
ímpar). Os casos "só um lado completo" e "nenhum" de
`regras/sia/05-fim-do-jogo.md` nunca ocorrem.

## Quem começa

| Lote | Primeiro jogador vence |
|---|---|
| `greedy` x `greedy`, pesos à mão (400 partidas) | 58% [53, 63] |
| `greedy` x `greedy`, pesos calibrados (4000) | 51,5% [49,9; 53,0] |
| `pimc` x `pimc` (300) | 48,0% [42,4; 53,6] |

A vantagem de 58% era do bot fraco: o calibrado a reduz a cerca de 1,5
ponto, e o intervalo inclui 50%.

## Formações

Parte de cada formação nos lados completos ao fim da partida e nos marcos
decididos por reivindicação. `greedy` x `greedy`, 4000 partidas.

| Formação | Lados completos | Reivindicações (por prova) | Marcos decididos no fim |
|---|---|---|---|
| Quadra | 45,3% | 59,4% (76%) | 32,4% |
| Naipe | 29,6% | 18,5% (18%) | 29,2% |
| Sequência | 9,8% | 13,6% (19%) | 14,3% |
| Dois pares | 4,6% | 1,4% (16%) | 4,2% |
| Sequência de naipe | 4,0% | 6,6% (26%) | 11,6% |
| Trinca | 3,4% | 0,4% (6%) | 6,5% |
| Par | 2,4% | 0,1% (9%) | 1,5% |
| Soma | 1,0% | 0% | 0,3% |

Com o `pimc` contra ele mesmo a quadra é 43,8% dos lados e 66,8% das
reivindicações. Com os pesos à mão eram 50%: o bot calibrado diversifica um
pouco, mas a quadra continua dominante.

Por que: o marco tem número conhecido, três dados iguais a ele fazem
quadra, e rolar de novo (um dado perdido) fecha a distância. É a formação
que um jogador bom persegue, e é só a quarta mais forte.

## Rolar de novo

`greedy` x `greedy`: 8,0 vezes por partida, 5,0 na própria mão e 3,0 na do
adversário, 1,7 dado rolado por vez. Cada rolagem custa um dado para
sempre, então cada jogador perde uns 4 dados por partida. O `pimc` rola 7,4
a 8,4 vezes, quase sempre um dado só, e rola a mão do adversário mais
(4,2 a 4,8 por partida) que o `greedy`.

## Mão de 6, 7 e 8 dados

`greedy` x `greedy`, 2000 partidas por linha (`GameState::with_hand_size`).

| Mão | Turnos | 5 marcos / 3 vizinhos / sem lugar | Primeiro vence | Quadra nos lados | Rolagens |
|---|---|---|---|---|---|
| 6 | 44,7 | 29% / 60% / 11% | 51,3% [49,1; 53,5] | 43,6% | 7,4 |
| 7 | 44,4 | 30% / 58% / 12% | 51,5% [49,9; 53,0] | 45,3% | 8,0 |
| 8 | 43,9 | 32% / 57% / 11% | 48,1% [45,9; 50,3] | 46,2% | 8,2 |

O tamanho da mão quase não muda a partida: o que limita é o número de
marcos e de dados nos lados.

## Variantes de regra (só experimento)

Flags de `sia-bots batch` (`sia_engine::experiment`); o padrão e `regras/`
não mudam. `greedy` x `greedy`, 3000 partidas por linha, sementes 700000.
Os bots usam os pesos calibrados no padrão, sem recalibrar para a
variante, e a avaliação deles lê a ordem e a leitura da variante.

| Variante | Quadra | Naipe | Sequência | Seq. de naipe | Trinca | Par | Primeiro vence | Turnos |
|---|---|---|---|---|---|---|---|---|
| Padrão | 45% | 30% | 10% | 4% | 3% | 2% | 51,4% [49,6; 53,2] | 44,2 |
| (a) `--four-below-run`: quadra abaixo de naipe e sequência | 13% | 56% | 17% | 3% | 4% | 3% | 48,0% [46,2; 49,8] | 47,0 |
| (b) `--stone-only-sequences`: marco só conta para sequência e naipe | 0% | 33% | 35% | 12% | 9% | 9% | 48,7% [46,9; 50,5] | 44,7 |
| `--second-bonus 1`: 8 dados para quem não começa | 47% | 30% | 10% | 4% | 3% | 3% | 42,4% [40,6; 44,2] | 44,2 |
| `--first-no-reroll`: primeiro turno sem rolar de novo | 45% | 30% | 10% | 4% | 3% | 2% | 50,5% [48,7; 52,3] | 44,2 |

Colunas são a parte dos lados completos. Em (b) não há quadra nem dois
pares, porque a trinca e o par leem só os 3 dados do lado. Combinar (a) e
(b) dá o mesmo que (b).

- (a) só muda quem domina: o naipe passa de 30% para 56%. Também cai a
  parte das provas bem-sucedidas (de 54% para 35% das reivindicações) e
  sobem as partidas sem lugar (de 10% para 22%).
- (b) é a única variante em que nenhuma formação passa de 35%. A sequência
  e o naipe dividem a mesa, e a sequência de naipe sobe para 12%.
- Dar um dado a quem não começa passa de 51,4% para 42,4%: compensa demais.
  Não há compensação intermediária com dados inteiros.
- Tirar a rolagem do primeiro turno desloca 1 ponto, dentro do ruído.

## Conclusões de design

- O motor funciona: sem empates, partidas de 44 turnos com final variado, e
  o `pimc` ganha do `greedy` por +234 Elo, então há habilidade a ganhar.
- A vantagem de quem começa não é problema com bots calibrados (cerca de
  1,5 ponto, intervalo inclui 50%). O número de 58% vinha dos pesos fracos.
  Nenhuma compensação é necessária.
- A quadra é a formação que um jogador bom busca (45% dos lados, 60% das
  reivindicações). Mudar a ordem (a) só passa o problema para o naipe. A
  causa é o marco ter número conhecido e a rolagem custar pouco.
- O tamanho da mão (6 a 8) não mexe na partida; fica em 7.

## Propostas de regra

Nada disto foi aplicado em `regras/`; é para o designer decidir.

1. Se a quadra dominante incomodar, testar a variante (b), em que o marco
   só entra na sequência e no naipe. Ela remove quadra e dois pares, então
   a ordem das formações e o glossário mudam. Antes de adotar: recalibrar
   os pesos para ela, medir com o `pimc` e olhar se o jogo continua com
   decisões (a avaliação do bot já lê a variante).
2. Reescrever `regras/sia/05-fim-do-jogo.md` sem os casos de empate por
   falta de lugar, que não ocorrem.
3. Manter 7 dados, sem compensação para o segundo jogador.
4. Alternativa não testada para a quadra: rolar de novo custar mais (por
   exemplo, perder um dado e não poder rolar a própria mão duas vezes
   seguidas). Só vale medir se (b) não agradar.
