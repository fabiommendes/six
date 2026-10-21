# liu-bots

Bots do Liu em Rust, lotes entre bots e a calibração dos pesos. A decisão
está em `dev/adr/0006-bots-do-liu-pimc.md`; as medições, em
`dev/notes/bots-do-liu.md`.

## Bots

A especificação é `NOME[:chave=valor,...]`, lida por `liu_bots::by_name`.

| Bot | O que faz |
|---|---|
| `random` | um comando legal ao acaso |
| `greedy` | olha um comando à frente e joga o de melhor avaliação. `noise=E` sorteia entre os comandos até `E` pontos abaixo do melhor; `rerolls=R` avalia "Rolar de novo" pela média de `R` mercados sorteados (4) |
| `pimc` | Monte Carlo com informação perfeita (abaixo). `samples=S` (32), `top=K` (6), `turns=T` (8; 0 joga até o fim), `temp=X` (2), `rerolls=R` (2) |
| `@arquivo.json` | `{"bot": ESPEC, "weights": {...}}`: os pesos listados trocam os de `weights/default.json` |

Nenhum bot lê o gerador de dados do estado: todos jogam sobre cópias com
outra semente (`GameState::reseeded`). O saco e as rolagens ficam tão
desconhecidos para o bot quanto para uma pessoa.

### PIMC

A única informação escondida do Liu são os números que os dados vão
mostrar. Uma amostra é a posição com o gerador trocado: um futuro possível
do saco e das rolagens. O bot:

1. ordena os comandos legais pela avaliação do `greedy` e guarda os `top`;
2. em cada uma das `samples` amostras, joga cada comando guardado e segue
   com o `greedy` para todos os jogadores por `turns` comandos, ou até o
   fim da partida se ela acabar antes;
3. uma partida terminada vale a parte da vitória (1, 1/2 num empate, 0);
   uma cortada vale `1 / (1 + e^(-v / temp))`, com `v` a avaliação;
4. joga o comando de maior média. Todos os comandos de uma amostra veem o
   mesmo gerador, então a comparação é entre comandos, não entre sortes.

## Avaliador

O valor de um jogador é a soma ponderada dos features da sua janela e da
sua mão. A avaliação de uma posição para um jogador é o seu valor menos o
maior valor entre os outros; no fim do jogo, 100 por parte da vitória (-100
na derrota) mais a diferença de pontos. A unidade dos pesos é o ponto da
pontuação final, e `points` fica fixo em 1.

| Nome | Mede |
|---|---|
| `points` | pontos da janela agora, com o melhor código |
| `dice` | dados na janela |
| `line3`, `line2` | linhas e colunas com 3 ou 2 dados que ainda podem ser completadas |
| `dead` | linhas e colunas com dados que não podem mais ser completadas |
| `run3`, `run2` | das completáveis, as que ainda podem virar sequência |
| `code3` | linhas de 3 dados a um número do conjunto do melhor código das linhas completas |
| `hand` | um dado na mão que cabe na janela |
| `fit_values` | quantos números cabem em algum lugar da janela agora |
| `seal_cells` | casas vazias da região que ainda aceitam o número do selo |

Uma linha é completável quando cada casa vazia de que ela precisa aceita
algum número (sem repetir na linha e na coluna). Enquanto a região não está
fixa naquela direção, basta haver casas vivas suficientes.

## Comandos

Em `digital/`, com o binário de `cargo build --release -p liu-bots`:

```sh
liu-bots batch --bots pimc,greedy --games 200 --seed 900000
liu-bots batch --bots @tune/runs/fase-1/best.json,greedy --players 3 --games 500
```

`--games` conta distribuições (a semente das cartas, aqui dos dados); com
rotação, o padrão, cada uma é jogada uma vez por ordem dos assentos. Com
menos bots que `--players`, o último ocupa os outros assentos. `--out`
grava uma linha JSON por partida. `just liu-batch A B` faz o mesmo com os
limites de CPU e memória.

### Calibração

`tune/tune.py` ajusta os pesos com CMA-ES, como o do Rio
(`~/git/games/rio/digital/tools/tune.py`): cada candidato joga um lote
contra o oponente e a aptidão é a sua parte média da vitória. Todos os
candidatos de uma geração jogam as mesmas distribuições, e cada geração
joga outras. O formato da configuração está em `tune/example.json`.

```sh
just liu-tune digital/liu/bots/tune/runs/fase-1/config.json
```

Cada execução fica em `tune/runs/<nome>/`: `config.json`, `log.csv`,
`best.json` (a média da distribuição, menos ruidosa que o melhor
candidato) e `tune.log`. Rodar de novo retoma da última geração terminada.
Use uma cópia do binário em `tune/runs/liu-bots` (fora do git), para que um
build no meio não troque o bot.
