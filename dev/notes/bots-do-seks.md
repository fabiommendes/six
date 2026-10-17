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

## Treino

(em andamento)
