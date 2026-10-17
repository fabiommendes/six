---
type: note
status: active
tags: [seks, bots, treinamento, medicoes]
relatedTo: [dev/issues/bots-do-seks.md, dev/adr/0004-bots-do-seks-alfa-beta-com-avaliacao-ajustada.md, digital/seks/bots/EVALUATOR.md]
---

# Bots do Seks: treino e medições

Resultados da issue `dev/issues/bots-do-seks.md`. Os números de Elo e de
taxa de vitória vêm com o intervalo de 95% (Elo pela variância trinomial,
taxa de vitória pelo intervalo de Wilson).

## Como rodar sem travar a máquina

A máquina de treino (Ryzen 5 3600, 12 threads, 32 GB) é dividida com outras
sessões. Toda execução cara (lote, autojogo, tune, treino, experimentos,
bench) segue estes limites:

- no máximo 6 threads de trabalho: é o padrão de `seks-bots`
  (`DEFAULT_THREADS`) e de `train/base.json`; `--threads N` ou `"threads"`
  na configuração mudam;
- teto rígido e prioridade mínima, que as receitas `just seks-batch`,
  `seks-train`, `seks-experiments`, `seks-bench` e `seks-bots-slow-test` já
  aplicam:
  `systemd-run --user --scope -q -p CPUQuota=600% -p MemoryMax=4G -- nice -n 19 ionice -c3 <comando>`;
- memória abaixo de 4 GB: o autojogo grava cada partida em disco ao
  terminar, e o tune lê os arquivos em blocos de 65 536 posições e só guarda
  as features das posições quietas (cerca de 200 bytes cada);
- builds com `CARGO_BUILD_JOBS=4` enquanto um treino roda; os testes de
  centenas de partidas ficam atrás de `#[ignore]`, fora do `just check`, e
  rodam com `just seks-bots-slow-test`.

## Nível padrão: N0, R6, R7 e R8 (2026-10-17)

Medidas com os pesos promovidos (geração 1 da segunda execução, abaixo) e o
treino parado. `ab` padrão é `ab:nodes=60000`, contempt 100, TT de 16 MiB.

- **N0 = 60 000 nós.** Numa thread, contra `random` (`openings/base.txt`,
  400 partidas, load 1,4 a 3,4): 20 mil nós dão 31,5 ms por jogada (máximo
  63), 40 mil 65,7 ms (127) e 60 mil 99,5 ms (194). O custo cresce linear,
  cerca de 1,65 ms por mil nós. 60 mil deixa folga de 2x na média e de 2,5x
  no máximo do R7 para máquinas carregadas e para o WASM; dobrar os nós
  valia +133 Elo (medição antiga, 20 para 40 mil).
- **R6, passa.** 400 vitórias em 400 contra `random` (100%, [99,0%, 100%];
  21 jogadas por partida) e 400 em 400 contra `greedy` (100%, [99,0%,
  100%]; 18 jogadas).
- **R7, passa.** Nas partidas do R6, numa thread, load 1 a 1,5: média de
  99,9 ms (máximo 193) contra `random` e 91,3 ms (máximo 161) contra
  `greedy`, cerca de 540 mil nós/s. `just seks-bench` (load 5,9): nativo 562
  mil nós/s, WASM (`wasm32-wasip1` no Node) 376 mil, 67% do nativo (pede
  40%). No navegador, a interface mediu 58 ms por jogada com 20 mil nós
  (load ~7), o que dá cerca de 175 ms com 60 mil.
- **R8.** 400 partidas `ab` contra `ab` no nível padrão, sem ruído,
  `openings/base.txt`, 6 threads: +178 =44 -178. Empates: 44 (11%), todos
  por 100 jogadas sem captura; nenhum por repetição nem por falta de
  jogada. 356 partidas acabam na fileira de fundo. Média de 104 jogadas e
  3,7 capturas por partida. Com 6 threads em paralelo, 176 ms por jogada
  (máximo 513), não comparável ao R7.
- O `greedy` vence o `random` em 1000 de 1000 partidas.
- Busca (medido com os pesos à mão e 20 mil nós): a poda de jogadas tardias
  e fúteis valeu +368 Elo [+319, +430] em 400 partidas com nós iguais; o
  null move ficou neutro (-17 [-65, +30]); dobrar os nós (20 mil para 40
  mil) vale +133 Elo [+84, +188]. Avaliação: 0,54 µs; gerar as jogadas:
  0,75 µs.

## Treino

- Um tune sobre 4000 partidas de autojogo (`ab:nodes=5000`, pesos à mão)
  vence `hand.json` por +182 Elo [+158, +208] em 1000 partidas com 5000 nós.
- K da sigmoide: 0,0014 a 0,0019 por unidade de avaliação. Um dado a mais
  (100) só move a previsão de 50% para cerca de 54%: no Seks o resultado
  depende mais de abrir caminho até a fileira de fundo que de material.
- Com Adam, uma penalidade L2 comum encolhia na velocidade máxima os pesos
  que os dados nunca tocam (Adam normaliza o gradiente). O tune usa
  decaimento desacoplado em direção aos pesos iniciais.
- As features já são simétricas por cor e por colunas, então aumentar os
  dados por simetria só repetiria posições: não é feito.

### Primeira execução, descartada: pesos que param de jogar

Execução `train/base.json` sem contempt e com o portão só por Elo (8000
partidas por geração, janela de 2 gerações, portão de 2000 partidas em
`openings/gate.txt` com 5000 nós). Registro em `train/runs/base-passive/`
(fora do git).

- Geração 1: 448 720 posições, perda de validação de 0,06025 para 0,05800,
  +190 Elo [+174, +208] contra os pesos à mão, promovida.
- O autojogo da geração 2, com os pesos da geração 1, empatou 52,6% das 8000
  partidas: 49,3% por 100 jogadas sem captura e 3,3% por repetição (na
  geração 1, com os pesos à mão: 0,35% e 2,9%).
- Sem ruído, 400 partidas `ab:nodes=5000` contra ele mesmo em
  `openings/base.txt`: pesos à mão, 3,5% de empates (todos por repetição),
  53 jogadas por partida; geração 1, 46% (42,5% sem captura), 123 jogadas
  por partida.
- Causa nos pesos: o material subiu de cerca de 100 para cerca de 180 por
  dado, e a tabela de avanço perdeu o gradiente (a fileira 2 valia mais que
  as fileiras 3 a 9). Os pesos venciam os à mão jogando fechado, mas contra
  si mesmos não forçavam a vitória. O portão só por Elo não via isso.

### Contempt e o portão contra empates

- `ab:contempt=C`: um empate vale `-C` para o bot em vez de 0. Calibração em
  `train/grids/contempt.json`, 400 partidas por linha, `ab:nodes=5000`,
  `openings/base.txt`:

| C | Espelho, pesos da geração 1: empates (sem captura, repetição) | C contra C=0, pesos da geração 1 | C contra C=0, pesos à mão: Elo (empates) |
|---|---|---|---|
| 0 | 184 (170, 14) | | |
| 25 | 174 (172, 2) | +3 [-23, +28] | +6 [-28, +40] (11) |
| 50 | 166 (164, 2) | +3 [-23, +28] | +10 [-24, +44] (5) |
| 100 | 158 (156, 2) | +3 [-23, +29] | +13 [-21, +47] (1) |
| 200 | 146 (146, 0) | +12 [-14, +39] | +11 [-23, +46] (1) |

- O contempt acaba com os empates por repetição e não custa Elo, mas quase
  não mexe nos empates por 100 jogadas sem captura: o limite fica além do
  horizonte da busca. **C = 100** (cerca de um dado) é o padrão do `ab`
  (`AlphaBeta::DEFAULT_CONTEMPT`), no autojogo, no portão e no nível do
  jogador; `contempt=0` desliga.
- Urgência (testada e descartada): somar à folha `C * jogadas_sem_captura /
  100`, com o sinal do contempt. Com os pesos da geração 1 e C=100, os
  empates do espelho caem de 158 para 56 (U=100); com os pesos à mão, que
  não têm empate sem captura a evitar, custa Elo: -42 [-77, -8] com U=300 e
  -166 [-206, -130] com U=1000. Não entrou: mascara pesos passivos em vez
  de recusá-los.
- **Portão do treino:** promove só se o limite inferior do Elo contra os
  pesos atuais passa de 0 **e** nem o lote do portão nem um lote espelhado
  (os pesos novos contra eles mesmos, `gate.mirror_games` = 400 partidas em
  `openings/gate.txt`) empatam mais que `gate.max_draw_rate` = 10% das
  partidas. O `log.csv` ganha a coluna `mirror_draws`.
- O autojogo usa um bot por lado: com contempt, as notas guardadas na
  tabela de transposição dependem de quem está na raiz.

### Regularização do tune

Com contempt e o portão novo, a geração 1 (`l2` = 0,0001) venceu os pesos à
mão por +170 Elo [+153, +187], mas o espelho empatou 254 de 400 partidas
(63%), e o portão a recusou. Nos mesmos dados (447 092 posições de autojogo
com os pesos à mão), `train/grids/regularization.json`, portão de 400
partidas contra os pesos à mão e espelho de 400, `ab:nodes=5000`,
`openings/gate.txt`:

| Tune | Perda de validação | Elo contra os pesos à mão | Empates no espelho |
|---|---|---|---|
| `l2` = 0,001 | 0,06192 para 0,05945 | +159 [+124, +197] | 254 (240 sem captura) |
| `l2` = 0,01 | 0,06192 para 0,05937 | +212 [+175, +254] | 154 (148 sem captura) |
| **`l2` = 0,1** | 0,06192 para 0,06048 | **+215 [+177, +258]** | **14** (12 sem captura) |
| `lambda` = 1, `l2` = 0,0001 | | +117 [+82, +154] | 2 |

O decaimento em direção aos pesos iniciais segura a tabela de avanço, e os
pesos mais fortes são também os que menos empatam: os empates da primeira
execução vinham do tune, não do jogo. `train/base.json` passa a usar
`l2` = 0,1.

### Segunda execução

Execução `train/base.json` com contempt 100, o portão contra empates e
`l2` = 0,1 (o autojogo da geração 1 é o mesmo da tentativa recusada).

| Geração | Posições | Perda de validação | Elo contra a anterior | Empates portão / espelho | Promovida |
|---|---|---|---|---|---|
| 1 | 447 092 | 0,06192 para 0,06048 | +231 [+213, +250] | 8 / 14 | sim |
| 2 | 1 075 571 | 0,05813 para 0,05770 | +278 [+260, +297] | 177 / 126 | não |

A geração 2 (autojogo com os pesos da 1, janela de duas gerações de dados)
ficou mais forte que a 1, mas voltou a empatar: 31% contra si mesma, e no
lote do portão 174 dos 177 empates foram por 100 jogadas sem captura. O
portão a recusou e o treino parou aí; a geração 1 foi promovida para
`weights/default.json`. O tune ainda empurra os pesos para um jogo que não
força a vitória quando os dados vêm de um bot forte; uma terceira execução
precisaria atacar isso (por exemplo, `l2` maior ou o alvo do tune mais
perto do resultado), e fica para depois.

**R5** (2000 partidas, `ab:nodes=5000`, `openings/gate.txt`, geração 1
contra `hand.json`): +1577 =8 -415, Elo +231 [+213, +250]. Passa (pede
+50 com o limite inferior acima de 0). É o mesmo lote do portão: mesma
semente e bots determinísticos.
