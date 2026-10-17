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

## Abertura e a estratégia de ficar parado (2026-10-17, parcial)

Pergunta do designer: ficar parado e só incrementar na abertura é uma
estratégia dominante? Como os bots fortes jogam essa fase? Jogadas contadas
a partir da posição inicial; "fora" é um dado fora das duas fileiras
iniciais do seu lado. Valor médio inicial: 26 / 16 = 1,63.

### O `ab` na abertura

| Lote | Resultado | Incrementos por jogada (1-6, 7-10, 11-20, 21-30, 31-40) | Primeira captura | Valor médio / dados fora, jogadas 10, 20, 30 |
|---|---|---|---|---|
| `ab` x `ab`, posição inicial, sem ruído | empate por 100 jogadas sem captura, 0 capturas | 100, 75, 50, 50, 60% | nenhuma | 1,91 / 0,5; 2,06 / 2,0; 2,22 / 3,5 |
| `ab:noise=20` x `ab:noise=20`, posição inicial, 100 partidas | Brancas 50, Pretas 48, empates 2 (2,0% [0,6; 7,0]); 63 jogadas | 72, 67, 63, 51, 41% | 67 de 100; mediana 45 (quartis 33 a 60); 14 até a jogada 30 | 1,82 / 0,8; 1,99 / 1,8; 2,11 / 2,9 |
| `ab` x `ab`, `openings/base.txt`, 400 partidas | +178 =44 -178; Brancas 196, Pretas 160, empates 44 (11,0% [8,3; 14,4]) | 7-10: 90, 77, 63, 59% | 352 de 400; mediana 68 (49 a 86); 12 até a jogada 30 | 1,68 / 1,6; 1,92 / 2,2; 2,11 / 3,2 |
| `ab:noise=20` x pesos à mão com ruído 20, posição inicial, 100 partidas | +80 =1 -19, Elo +246 [+171, +349] | à mão: 14, 12, 13, 12, 15% | 64 de 100; mediana 44 | à mão: 1,56 / 2,2; 1,53 / 3,8; 1,48 / 4,9 |

- O `ab` padrão abre incrementando: 3 de cada 4 jogadas nas 10 primeiras e
  metade entre as jogadas 21 e 30. Tira um dado das fileiras iniciais a cada
  6 a 8 jogadas suas e quase nunca captura antes da jogada 30. Os pesos à
  mão fazem o contrário (12 a 15% de incrementos, dados mais baixos e mais
  avançados) e perdem por +246 Elo.
- Sem ruído, `ab` contra `ab` a partir da posição inicial empata por 100
  jogadas sem captura, sem nenhuma captura. Com ruído 20 (um quinto de
  dado) as partidas viram decisivas (2% de empates): o empate do espelho
  exato é um equilíbrio frágil, não uma propriedade da posição.

### O bot `still` (ficar parado)

`still[:plays=N,ARGS]` (`src/still.rs`, no `by_name`): nas primeiras `N`
jogadas suas (todas, sem `plays`) escolhe o melhor incremento pela busca do
`ab:ARGS` (a raiz só tem incrementos, as respostas não são restritas;
`Searcher::search_among`). Move só para vencer na hora, sem incremento
disponível, ou quando a busca acha que todo incremento perde à força; nesse
caso, e depois das `N` jogadas, joga como `ab:ARGS`. A variante medida
abaixo é `still` sem `plays`: parado a partida inteira, com o `ab` padrão
(60 mil nós) escolhendo o incremento.

Contra `ab`, `openings/base.txt`, 400 partidas: **+24 =283 -93**, Elo
-61 [-79, -43]; empates 70,8% [66,1; 75,0], todos por 100 jogadas sem
captura; 117 vitórias na fileira de fundo (24 do `still`, 93 do `ab`).

| Casas da fileira da frente sem dado próprio depois da abertura | Partidas | `still`: V / E / D |
|---|---|---|
| 0 | 3 | 0 / 3 / 0 |
| 1 (só a coluna 6) | 27 | 0 / 27 / 0 |
| 2 | 106 | 6 / 78 / 22 |
| 3 ou mais | 264 | 18 / 175 / 71 |

- O `ab` não fura a defesa parada: em 283 partidas não consegue uma
  captura em 100 jogadas. As derrotas do `still` são longas (mediana de 180
  jogadas): começam com movimentos forçados para tapar buracos que as seis
  jogadas aleatórias das aberturas abriram (primeiro movimento do `still`
  na jogada 38, mediana), que dão capturas ao `ab` (primeira na jogada 81,
  mediana) e zeram a contagem; em 75 das 93 derrotas o `still` já tinha
  quase todos os dados em 6 e era obrigado a mover. Só 7 derrotas acabam
  antes da jogada 100.
- Da posição inicial, `still` contra `ab` (as duas cores) empata as duas
  partidas por 100 jogadas sem captura, sem captura.

### A muralha: um movimento garante o empate

Com a fileira da frente completa (11 dados), nenhum dado adversário chega à
fileira de fundo, porque todo caminho até ela passa por uma casa da fileira
da frente e não se pula dado. Nenhum dado da muralha pode ser capturado: os
vizinhos laterais são dados próprios ou a borda, que não conta, e o vizinho
de trás de um dado da fileira da frente fica na fileira de fundo, aonde o
adversário não chega; os dados da fileira de fundo só têm vizinhos
próprios, a borda ou casas da fileira de fundo. O dono da muralha sempre
tem jogada (incrementos, ou um dado da fileira de fundo andando de lado).
Na posição inicial falta só a coluna 6: **`e1-f2`** (ou `g1-f2`; `e11-f10`
para as Pretas) fecha a muralha, e quem não sai dela não perde. Também não
vence: sem captura, a partida acaba empatada na jogada 100.

Partida de exemplo (abertura `e1-f2`, Brancas `still`, Pretas `ab`; empate
por 100 jogadas sem captura, as Brancas só incrementam):

```text
e1-f2 c10+ i2+ c10+ c2+ i10+ c2+ i10+ i2+ c10-g6 b2+ b10+ b2+ b10+ j2+ a10+
j2+ a10+ k2+ a10-e6 k2+ e11-f10 a2+ b10-f6 a2+ j10+ g1+ j10+ d2+ k10+ d2+
k10+ h2+ a11+ h2+ a11+ g1+ a11+ g1+ d10+ k1+ d10+ k1+ e10+ k1+ e10+ e2+
a11-e7 e2+ e10+ a2+ e10-a6 a2+ d10-h6 b2+ c11-b11 b2+ k11+ g1+ g11+ g1+
i11+ a1+ b11+ c1+ k10-k6 c1+ a6+ c1+ a6+ c1+ b11-b9 c1+ b9-b7 d2+ h6-d10
d2+ d10-d6 i1+ g10-f9 i1+ b7+ c2+ g6-c10 c2+ f10-f11 i2+ g11-e9 f2+ b7+
i1+ k6-g6 i2+ c10-c6 k1+ i11+ k1+ i11+ g2+ f11-f10
```

O teste `still::tests::a_full_front_row_holds_until_the_draw` fixa isso:
depois de `e1-f2`, `still` contra `ab:nodes=2000` empata por 100 jogadas sem
captura com os 16 dados.

### Leitura

- Ficar parado não é dominante para vencer: o `still` perde Elo (-61) e
  quase não vence. É uma defesa de empate: 71% contra o `ab` padrão nas
  aberturas aleatórias, e empate garantido quando a fileira da frente está
  fechada. O `ab` não sabe punir; com a muralha fechada não há o que punir.
- A muralha é uma propriedade das regras (captura por custódia sem a borda,
  movimento sem pular, 100 jogadas sem captura), não um limite da busca.
  Com buracos na fileira da frente, ainda falta medir se mais orçamento do
  `ab` fura a defesa (ver "Pendente").

### Pendente

- `still:plays=N` (N = 10, 20, 40) contra `ab`, 400 partidas cada;
  `ab` contra os pesos à mão em `openings/base.txt`.
- `still` contra `ab` com 240 mil e 1 milhão de nós, para separar o limite
  do bot da propriedade do jogo nas posições com buracos.
- Torneio de bots de anti-jogo pedido pelo designer: handoff em
  `dev/handoffs/abertura-do-seks.md` (fora do git).

### Como reproduzir

Em `digital/seks/bots`, com `S="systemd-run --user --scope -q -p
CPUQuota=600% -p MemoryMax=4G -- nice -n 19 ionice -c3"` e o binário de
`cargo build --release -p seks-bots`:

```sh
$S ../../target/release/seks-bots batch --bots still,ab --openings openings/base.txt --games-out runs/still-ab
$S ../../target/release/seks-bots batch --bots ab,ab --openings openings/base.txt --games-out runs/ab-ab
echo e1-f2 > wall.txt
$S ../../target/release/seks-bots batch --bots still,ab --openings wall.txt --games-out runs/wall
```

As partidas da posição inicial e a análise por jogada (incrementos, valor
médio, dados fora, primeira captura, buracos da fileira da frente) usaram
uma ferramenta descartável, fora do git, guardada em
`dev/handoffs/abertura-do-seks/`.
