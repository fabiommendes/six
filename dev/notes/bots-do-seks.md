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
- Execução `train/base.json` (8000 partidas por geração, janela de 2
  gerações, portão de 2000 partidas em `openings/gate.txt` com 5000 nós):

| Geração | Posições | Perda de validação | Elo contra a anterior | Promovida |
|---|---|---|---|---|
| 1 | 448 720 | 0,06025 para 0,05800 | +190 [+174, +208] | sim |

- K da sigmoide: 0,0014 a 0,0019 por unidade de avaliação. Um dado a mais
  (100) só move a previsão de 50% para cerca de 54%: no Seks o resultado
  depende mais de abrir caminho até a fileira de fundo que de material.
- Com Adam, uma penalidade L2 comum encolhia na velocidade máxima os pesos
  que os dados nunca tocam (Adam normaliza o gradiente). O tune usa
  decaimento desacoplado em direção aos pesos iniciais.
- As features já são simétricas por cor e por colunas, então aumentar os
  dados por simetria só repetiria posições: não é feito.
