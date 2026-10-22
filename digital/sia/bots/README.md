# sia-bots

Bots do Sia em Rust, lotes entre bots e a calibração dos pesos. As medições
estão em `dev/notes/bots-do-sia.md`.

## Bots

A especificação é `NOME[:chave=valor,...]`, lida por `sia_bots::by_name`.

| Bot | O que faz |
|---|---|
| `random` | um comando legal ao acaso (rolar de novo uma vez em dez) |
| `greedy` | olha um comando à frente e joga o de melhor avaliação. `noise=E` sorteia entre os comandos até `E` pontos abaixo do melhor (rolar de novo só entra se for o melhor, porque custa um dado); `rerolls=R` avalia "rolar de novo" pela média de `R` resultados sorteados (3); `cands=C` olha no máximo `C` rolagens (8; 0 nunca rola); `places=P` olha as `P` colocações que mais sobem a chance (10) |
| `pimc` | Monte Carlo com informação perfeita (abaixo). `samples=S` (16), `top=K` (6), `turns=T` (8 comandos; 0 joga até o fim), `temp=X` (2), `rerolls=R` (1), `cands=C` (2), `places=P` (5) |
| `@arquivo.json` | `{"bot": ESPEC, "weights": {...}}`: os pesos listados trocam os de `weights/default.json` |

Nenhum bot lê o gerador de dados do estado: todos jogam sobre cópias com
outra semente (`GameState::reseeded`). Os dados que vão sair do saco e das
rolagens ficam tão desconhecidos para o bot quanto para uma pessoa.

### Rolar de novo

Rolar de novo tem centenas de variantes (dado perdido, mão, dados rolados). O
motor lista todas em `legal_commands`; os bots olham poucas
(`reroll_candidates`): perdem um dos dois dados que menos servem na própria
mão e rolam os 1 a 3 dados que menos servem ao dono da mão (na mão do
adversário, os que mais servem a ele). "Serve" é o ganho de chance de tomar
um marco ao pôr o dado no melhor lugar.

### PIMC

A única informação escondida do Sia são os dados que vão sair. Uma amostra é
a posição com o gerador trocado. O bot ordena os comandos pela avaliação do
`greedy`, guarda os `top`, joga cada um em `samples` amostras e segue com o
`greedy` dos dois lados por `turns` comandos. Partida terminada vale a parte
da vitória; cortada, `1 / (1 + e^(-v / temp))`. Joga o de maior média.

## Avaliador

A base é a chance de um lado vencer o outro num marco. O lado com menos de 3
dados vira uma formação ao acaso (os dados que faltam têm número e naipe
uniformes); `eval::dist_of` dá a distribuição da formação final de cada lado,
pré-calculada, e `beat_chance` compara duas. Os features somam essas chances
sobre os marcos, vistos de um assento; a unidade dos pesos é o marco.

| Nome | Mede |
|---|---|
| `owned` | marcos tomados (diferença); fixo em 1 |
| `adjacent` | pares de marcos vizinhos tomados |
| `prob` | soma de (chance - 1/2) nos marcos não tomados |
| `sure` | marcos com chance de 95% ou mais, menos os de 5% ou menos |
| `neighbors` | chance de fechar 3 vizinhos, menos a do adversário |
| `placed` | dados postos nos marcos não tomados |
| `lost` | dados perdidos |
| `hand` | quanto os dados da própria mão sobem a chance se postos |
| `opp_hand` | o mesmo para a mão do adversário |

## Comandos

- `just sia-batch A B [--games N --seed S --hand-size H --out F.jsonl]`: lote
  com rotação de assentos; escreve o resumo (fim, duração, quem começa,
  formações, rolagens) e o Elo.
- `just sia-tune CONFIG`: calibração por CMA-ES, como a do Liu
  (`tune/tune.py`, formato em `tune/example.json`; `flags` repassa ao lote as variantes de regra).
