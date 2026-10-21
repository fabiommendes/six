---
type: note
status: active
tags: [liu, bots, calibracao, medicoes]
relatedTo: [dev/issues/bots-do-liu.md, dev/adr/0006-bots-do-liu-pimc.md, digital/liu/bots/README.md]
---

# Bots do Liu: calibração e medições

Resultados da issue `dev/issues/bots-do-liu.md`, de 2026-10-20. Todos os
lotes são de 2 jogadores, com rotação: cada distribuição (semente) é jogada
nas duas ordens de assento. Elo com o intervalo de 95% da variância
trinomial; um empate é uma vitória dividida (mesmos pontos e mesmos
dados). Os lotes rodaram com no máximo 6 threads, `CPUQuota=600%` e
`nice 19`, com load de 6 a 10 na máquina, então os tempos são de máquina
carregada.

Arquivos: `digital/liu/bots/tune/runs/` (configurações, `log.csv`,
`best.json`, saídas das grades). O binário de cada medição é a cópia
`runs/liu-bots`, fora do git.

## Linha de base

| Lote | Partidas | Resultado | Elo | ms por decisão |
|---|---|---|---|---|
| `greedy` x `random` (pesos à mão) | 400 | +334 =64 -2 | +413 [+374, +460] | 0,15 |
| `pimc` (16 amostras, até o fim) x `greedy` | 400 | +127 =37 -36 | +171 [+126, +221] | 109 |

Partidas de `greedy` contra ele mesmo: 12,6 rodadas e 29 comandos; 90%
acabam com o saco vazio, 6,5% com uma janela completa e 3,5% numa rodada
sem dado posto.

A linha de base, as fases 1 e 2 da calibração e os parâmetros do PIMC são da
regra anterior a 2026-10-21, em que o saco vazio acabava o jogo e o saco tinha 15
dados por jogador. Com a regra nova (16 por jogador; sem saco, o mercado é
rolado de novo até haver maioria), 200 sementes de `greedy` contra ele mesmo
dão, com 2 jogadores, 14,9 rodadas e 34 comandos, 80% das partidas acabando
com uma janela completa e 20% numa rodada sem dado posto; com 4 jogadores,
15 rodadas e 99% com janela completa. A fase 3 da calibração e os níveis da
web são da regra nova.

## Calibração dos pesos (CMA-ES sobre o guloso)

`tune/tune.py`, 12 candidatos por geração, 40 gerações, 500 distribuições
(1000 partidas) por candidato, `points` fixo em 1. A validação é em
sementes que a busca não usou (900000).

| Fase | Oponente | Features | Contra o oponente | Contra os pesos à mão |
|---|---|---|---|---|
| 1 | `greedy` com os pesos à mão | 11 | +12 [+2, +21] | o mesmo |
| 2 | `best.json` da fase 1 | 13 (com `line3_late` e `line2_late`) | +30 [+21, +40] | +40 [+30, +49] |
| 3 (regra nova) | `greedy` com os pesos da fase 2 | 13 | +29 [+18, +40] | |
| 4 (regra nova) | `best.json` da fase 3 | 13, faixas mais largas | -4 [-14, +7] | |

- A fase 1 mostrou que os pesos à mão já estavam perto do melhor que esses
  11 features dão ao guloso: a média de cada geração ficou abaixo de 50%
  até a geração 25.
- A fase 2 acrescenta `line3` e `line2` multiplicados pela parte do saco já
  tirada. Os dois saem negativos (-1,22 e -0,52): perto do fim, uma linha
  incompleta vale menos, porque faltam turnos para completá-la. `dice`
  sobe de 0,15 para 1,25, `dead` de -0,6 para -1,28 e `run3` de 0,3 para
  0,97. Nenhum peso encostou no limite da faixa.
- No PIMC, os pesos da fase 2 não mudam a força: +5 [-21, +31] em 600
  partidas contra o PIMC com os pesos à mão. Os rollouts dominam.
- A fase 3 recalibra para a regra nova, partindo dos pesos da fase 2.
  Sem o fim pelo saco vazio, a partida dura mais e guardar compensa:
  `hand` sobe de 0,23 para 1,48, `dice` de 1,25 para 2,36, `line3` de
  0,84 para 1,64 e `line3_late` de -1,22 para -1,72. A validação é em
  4000 partidas.
- `dice` e `hand` pararam perto do limite da faixa (2,5 e 1,5), e a fase 4
  abriu as faixas. A média de cada geração ficou abaixo de 50% e o
  resultado empata com a fase 3: o máximo é plano nessa direção.
- Os pesos da fase 3 são o padrão (`weights/default.json`). No PIMC, eles
  ganham do PIMC com os pesos da fase 2 por +33 [+5, +61] em 600 partidas.

## Parâmetros do PIMC

Cada linha joga 300 distribuições (600 partidas) contra `greedy` com os
pesos à mão, sempre as mesmas (sementes 700000), com os pesos à mão no
PIMC também.

| Espec. | Elo contra `greedy` | ms por decisão (máx.) |
|---|---|---|
| `pimc` (samples=16, top=6, turns=0) | +171 [+145, +200] | 115 (481) |
| `samples=8` | +112 [+87, +138] | 56 (210) |
| `samples=32` | +203 [+175, +232] | 251 (1027) |
| `top=3` | +124 [+97, +151] | 65 (241) |
| `top=10` | +151 [+126, +178] | 226 (747) |
| `turns=4` | +156 [+129, +184] | 42 (173) |
| `turns=8` | +171 [+145, +200] | 75 (271) |
| `turns=8,temp=1` | +172 [+146, +201] | 61 (226) |
| `turns=8,temp=4` | +146 [+120, +174] | 60 (242) |
| `rerolls=1` | +151 [+124, +179] | 106 (385) |
| `rerolls=4` | +160 [+134, +189] | 197 (753) |
| `samples=24,turns=8` | +211 [+183, +241] | 90 (374) |
| `samples=32,turns=8` | +217 [+189, +246] | 112 (532) |

Leitura:

- O número de amostras é o que mais pesa: de 8 para 32 vão uns 100 Elo.
  Mais candidatos na raiz (`top=10`) não ajudam e custam o dobro; menos
  (`top=3`) perde 50 Elo.
- Cortar o rollout em 8 comandos (4 turnos de cada jogador) empata com ir
  até o fim e custa 35% menos; com 4 comandos perde pouco. Esse tempo
  economizado paga mais amostras.
- `temp` entre 1 e 2 dá o mesmo; 4 achata a avaliação dos rollouts
  cortados e perde.
- **Padrão novo: `samples=32, turns=8`** (`Pimc::new`). Contra o padrão
  antigo, em confronto direto (300 distribuições, sementes 920000): +294
  =73 -233, **+35 [+9, +62]**, com o mesmo custo.

## Níveis da web

Regra nova e pesos da fase 3, 500 distribuições (1000 partidas) por
linha, o difícil com 300 (600 partidas), sementes 930000. Tempo no WASM
pelo Node (`Bot` do `liu-wasm`, 6 partidas, load 14,6). Saídas em
`tune/runs/niveis-2/`.

| Nível | Espec. | Resultado | Elo | WASM: média (máx.) |
|---|---|---|---|---|
| Fácil | `greedy:noise=1` | contra `random`: +738 =240 -22 | +312 [+291, +336] | |
| Fácil | | contra o médio: +320 =7 -673 | -128 [-152, -106] | |
| Médio | `greedy` | contra os pesos da fase 2: +540 =11 -449 | +32 [+10, +53] | |
| Difícil | `pimc` | contra o médio: +442 =27 -131 | +199 [+169, +233] | 234 ms (480) |

Com a regra anterior e os pesos da fase 2, o fácil ficava a -246 [-273,
-222] do médio, o difícil a +192 [+164, +221], e o difícil levava 127 ms
(máx. 296) no WASM com load 9,6. Na regra nova a partida é mais longa e
o ruído do fácil custa menos: ele fica uns 120 Elo mais perto do médio.
Os empates quase somem (7 em 1000), porque a maioria das partidas acaba
com uma janela completa.

O fácil começou com `noise=1.5` (+265 [+245, +286] contra `random`, -349
[-382, -320] contra o médio); o designer pediu um fácil mais perto do
médio, e `noise=1` fecha uns 100 Elo da distância.

O R7 da issue passa: o difícil vence o médio com o intervalo inteiro acima
de 50% (75,9% [72,4; 79,2]) e fica abaixo de 0,5 s por decisão no WASM,
mas o máximo (480 ms com load 14,6) já chega perto. A web mostra a jogada
do bot depois de pelo menos 0,6 s.

## 3 e 4 jogadores

Regra anterior e pesos da fase 2. Um `pimc` contra `greedy` nos outros
lugares, 100 distribuições em todas as ordens de assento (sementes 940000):

| Jogadores | Vitórias do `pimc` | Parte justa | ms por decisão (máx.) |
|---|---|---|---|
| 3 | 48,3% [42,7; 54,0] | 33,3% | 153 (690) |
| 4 | 33,1% [28,6; 37,8] | 25% | 208 (618) |

Com mais jogadores a partida fica mais longa (48 e 64 comandos) e cada
rollout de 8 comandos cobre menos turnos de cada um. Os pesos e os
parâmetros foram calibrados só em 2 jogadores.

## Pendente

- Calibrar em 3 e 4 jogadores, se o designer jogar muito nesses formatos.
- Features que olhem o mercado e a mão dos outros (negar o dado que o
  adversário precisa): o guloso não vê isso, e o teto do PIMC é o do
  guloso dos rollouts.
