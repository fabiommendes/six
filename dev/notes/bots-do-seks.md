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

## Medições até aqui (2026-10-17)

Medidas com a máquina carregada por outras sessões (load entre 12 e 18),
antes dos limites acima, com 10 threads; os tempos por jogada daqui não
valem para o R7, que tem de ser medido numa thread.

- **R6, objetivo do treino, já atingido com os pesos à mão** (`ab` padrão,
  `ab:nodes=20000`, `default.json` igual a `hand.json`): 400 vitórias em 400
  contra `random` (taxa de vitória 100%, [99,0%, 100%]) e 400 em 400 contra
  `greedy`, em `openings/base.txt`. Média de 18 jogadas por partida. Falta
  repetir com os pesos promovidos e o N0 final.
- O `greedy` já vence o `random` em 1000 de 1000 partidas.
- Busca: a poda de jogadas tardias e fúteis valeu +368 Elo [+319, +430] em
  400 partidas com nós iguais; o null move ficou neutro (-17 [-65, +30]);
  dobrar os nós (20 mil para 40 mil) vale +133 Elo [+84, +188].
- Velocidade (`seks-bots bench`, 16 posições, 20 mil nós cada): nativo cerca
  de 640 mil nós/s com a máquina livre e 381 mil carregada; WASM
  (`wasm32-wasip1` no Node 22) 259 mil na mesma carga, 68% do nativo
  (R7 pede 40%). Avaliação: 0,54 µs; gerar as jogadas: 0,75 µs.
- `ab` contra `ab` com ruído na raiz nas 8 a 10 primeiras jogadas (autojogo):
  97% das partidas acabam na fileira de fundo, 3% por repetição e 0,3% por
  100 jogadas sem captura; 55 jogadas por partida. O R8 formal (400 partidas
  no nível padrão, sem ruído) ainda não foi medido.

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

### Segunda execução

Execução `train/base.json` do zero, com contempt 100 e o portão contra
empates.

| Geração | Posições | Perda de validação | Elo contra a anterior | Empates portão / espelho | Promovida |
|---|---|---|---|---|---|
