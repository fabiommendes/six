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

## Regra padrão contra a variante (b), calibrada

Pedido do designer: medir a variante (b) (`--stone-only-sequences`: o marco
só conta para sequência e naipe) a fundo antes de decidir. Medições de
2026-10-21; arquivos em `tune/runs/fase-b/` e saídas em `runs/medicoes/b-*`.

### Calibração para (b)

`tune/fase-b.json`: igual à fase 1 (CMA-ES, 12 candidatos, 300 partidas por
candidato, `greedy` contra `greedy` com os pesos à mão, mão de 7), com a
flag da variante em `flags`, 60 gerações (a fitness parou em torno de 0,78
depois da geração 30; 30 e 60 empatam: +3 Elo [-7, +14]). Sementes que a
busca não usou (500000), 4000 partidas, com a variante:

| Comparação | Elo |
|---|---|
| calibrado (b) contra pesos à mão | +249 [+236, +263] |
| calibrado (b) contra pesos calibrados do padrão | +138 [+126, +149] |

| Peso | Padrão | (b) |
|---|---|---|
| `adjacent` | 0,21 | 0,58 |
| `prob` | 1,47 | 0,22 |
| `sure` | 0,08 | 0,96 |
| `neighbors` | 0,81 | 0,05 |
| `placed` | -0,30 | -0,47 |
| `lost` | -0,53 | -0,59 |
| `hand` | 0,42 | 0,28 |
| `opp_hand` | -1,43 | -1,53 |

Leitura: em (b) os pesos à mão eram ruins (a avaliação deles supunha a
quadra). O bot calibrado passa a valorizar o que já está garantido
(`sure`) e a adjacência dos dados, e quase ignora a probabilidade e os
vizinhos. Cobrar o dado perdido e a mão do adversário não muda.

### Lado a lado

`greedy` x `greedy`, 4000 partidas (sementes 900000), cada regra com os seus
pesos; `pimc` x `pimc`, 300 partidas (sementes 800000, intervalo de 95%).

| | Padrão `greedy` | (b) `greedy` | Padrão `pimc` | (b) `pimc` |
|---|---|---|---|---|
| Formação mais comum nos lados | quadra 45% | sequência 39% | quadra 45% | sequência 34% |
| Segunda e terceira | naipe 30%, seq. 9% | naipe 26%, seq. de naipe 12% | naipe 22%, seq. 10% | naipe 30%, seq. de naipe 13% |
| Formação mais comum nas reivindicações | quadra 59% | sequência 49% | quadra 66% | sequência 46% |
| Reivindicações por prova | 53% | 63% | 44% | 32% |
| Turnos (média) | 44,2 | 46,3 | 47,6 | 49,8 |
| Fim: 5 marcos / 3 vizinhos / sem lugar | 30 / 58 / 12% | 15 / 59 / 26% | 30 / 55 / 15% | 20 / 58 / 22% |
| Marcos decididos no fim por falta de lugar | 0,18 por partida | 1,26 | 0,18 | 0,60 |
| Primeiro vence | 51,1% [49,6; 52,7] | 49,8% [48,3; 51,3] | 53,3% [47,7; 58,9] | 43,3% [37,8; 49,0] |
| Rolagens por partida | 7,9 | 9,9 | 8,2 | 6,8 |
| Sua própria mão / a do adversário | 4,9 / 3,0 | 4,5 / 5,4 | 3,4 / 4,8 | 3,0 / 3,8 |
| Dados perdidos por jogador (média) | 3,9 | 5,0 | 4,1 | 3,4 |
| Jogadores que acabam com 1 dado (6 perdidos) | 30% | 54% | 30% | 13% |
| Tipos de formação por partida, lados / reivindicações | 4,1 / 2,8 | 4,4 / 2,6 | 4,9 / 2,6 | 4,7 / 2,7 |
| Entropia dos lados / das reivindicações (bits, máx. 3) | 2,12 / 1,68 | 2,21 / 1,82 | 2,34 / 1,57 | 2,26 / 1,68 |

Com os pesos calibrados, (b) não tira a formação dominante: a quadra vira
sequência (e a sequência de naipe, que é sequência, acompanha). Com os
pesos do padrão nenhuma formação passava de 35% dos lados; recalibrado, o
bot passa a perseguir a sequência. A fatia da formação mais comum nos lados cai
de 45% para 34% a 39%, e das reivindicações de 59 a 66% para 46 a 49%:
melhora, mas é a mesma situação.

(b) também traz custos. Mais partidas acabam por falta de lugar (22% a 26%
contra 12% a 15%) e 1,26 marco por partida se decide no fim, no caso do
`greedy`: sequência e naipe pedem dados de números certos, então os lados
ficam incompletos com mais frequência. Com o `pimc`, o primeiro jogador
vence 43% das vezes em (b) (intervalo até 49,0%); com 300 partidas é um
indício, não uma medida, e com o `greedy` e 4000 partidas some (49,8%).

### (i) Dependência de rolar de novo

Elo de quem nunca rola de novo (`cands=0`) contra o mesmo bot que rola:

| Bot | Padrão | (b) |
|---|---|---|
| `greedy` (4000 partidas) | -84 [-95, -73] | -30 [-41, -19] |
| `pimc` (300 partidas) | -156 [-202, -114] | -134 [-178, -93] |

Rolar de novo vale menos em (b) para o `greedy` e o mesmo para o `pimc`
(os intervalos se sobrepõem). Em nenhuma regra o jogo depende de rolar:
sem rolar o `greedy` ainda ganha 38% (padrão) e 46% (b) das partidas, e o
`pimc` uns 30%. Em (b) o `greedy` rola mais e
mais na mão do adversário (5,4 contra 3,0 por partida), mas ganha menos com
isso.

### (ii) Variedade da decisão

Duas medidas simples:

- Tipos de formação diferentes por partida (e entropia da distribuição de
  formações, em bits): mede quantas "vias" aparecem. Em ambas as regras
  são 4 a 5 tipos nos lados e 2,6 a 2,8 nas reivindicações; a entropia
  fica entre 2,1 e 2,3 bits nos lados. As regras não se distinguem: a
  variedade dos lados é a mesma, só muda quem domina.
- Quanto a escolha de onde pôr importa: Elo do `greedy` que olha só a
  colocação de maior ganho de chance (`places=1`) contra o que olha as 10
  melhores. No padrão a perda é pequena (-27 Elo [-38, -17]); em (b) é
  grande (-294 [-309, -280]).

A segunda medida é a que diferencia: em (b) o marco passa a contar só para
sequência e naipe, então onde pôr cada dado muda muito a chance dos lados, e
a decisão de colocação carrega peso. No padrão a escolha é quase única (a
que sobe mais a chance), porque a quadra com o marco aceita qualquer dado
igual a ele.

### Dados perdidos e o nível fácil

O problema da web: partidas entre bots chegam a mãos de 1 dado. É da regra
mais do que do nível: com o `greedy` calibrado, 30% dos jogadores perdem os
6 dados no padrão e 54% em (b); o `pimc` perde 30% e 13%. A distribuição
completa de dados perdidos por jogador no fim (0 a 6) está nas linhas
`lost per seat` das saídas.

O nível fácil (`greedy:noise=2`) era absurdo: o ruído de 2 pontos ficava
maior do que o custo de rolar de novo, então ele sorteava rolagens como se
fossem jogadas comuns. Resultado: 12 rolagens por partida, e **98% dos
jogadores terminavam com 1 dado** (6 perdidos), nas duas regras.

Ajuste (aplicado em `Greedy::pick`): o ruído não alcança o rolar de novo,
que só entra no sorteio quando é o melhor comando. Com ele, 2,2 rolagens
por partida, média de 1,1 dado perdido por jogador (33% sem perder, 37%
com 1, 20% com 2) e partidas de 50 turnos. Efeito no nível, 4000 partidas:

| | Antes | Depois |
|---|---|---|
| Fácil contra `random` | +404 Elo [+369, +446] | +1079 [+928, +inf] (998 a 2) |
| Fácil contra `greedy` (médio) | -1059 [-1243, -971] (9 a 3991) | -460 [-483, -439] (265 a 3735) |

O fácil melhora, porque deixa de queimar os próprios dados, e ainda perde
91% das partidas contra o médio. A diferença entre os níveis encolhe mas se
mantém clara; se o designer quiser o fácil mais fraco, basta subir o ruído
(`noise=3`). O mesmo vale para (b) (-521 contra o médio).

### Conclusões e recomendação

- A variante (b) não resolve a dominância: a quadra sai e a sequência
  entra no lugar, com 34% a 39% dos lados e 46% a 49% das reivindicações.
  A queda é de uns 10 pontos, não uma mudança de natureza.
- A variedade de formações por partida é igual nas duas regras. O que (b)
  muda de fato é onde pôr o dado, que passa a importar muito, e o custo
  é mais partidas sem lugar e mais marcos decididos no fim.
- O jogo não depende de rolar de novo em nenhuma das duas; em (b) a
  dependência é menor para o `greedy`.
- **Recomendação:** manter a regra padrão. O ganho de (b) é pequeno para o
  custo de reescrever as formações e o glossário, e traz partidas sem
  lugar. Se o designer quiser atacar a dominância, o próximo teste é o
  item 4 abaixo (rolar de novo custar mais), que ataca a causa
  (a rolagem custa pouco e o dado perdido não pesa): o problema dos
  jogadores com 1 dado também é da regra e (b) não o resolve. Se a decisão
  de "onde pôr" for o que interessa ao designer, (b) é a variante a
  considerar.

## Quadra mais baixa, mão de 5, formação de 3 dados, pôr no adversário e naipe coringa

Pedido do designer: testar mudanças mais simples que (b). Medições de
2026-10-22. Cada configuração tem os seus pesos calibrados (CMA-ES, 30
gerações de 12 candidatos, 300 partidas por candidato, `greedy` contra
`greedy` com pesos à mão, pesos iniciais à mão; arquivos em
`tune/runs/fase-<configuração>/`, saídas em `runs/medicoes/<configuração>/`).
Sementes de validação (500000, 4000 partidas, calibrado contra pesos à mão):
padrão/5 +131 Elo, (c)/5 +235, (c)/7 +237, (b)/5 +264, (d)/5 +112, (d)/7
+139, (e)/5 +387, (e)/7 +212, (f)/(d)/7 +170, (f)/(d, naipe abaixo)/7 +116,
(f)/(c)/5 +231. Limite: a calibração parou em 30 gerações como a de (b) em
60; a fitness média ainda subia devagar em algumas (por exemplo padrão/5, de
0,65 na geração 16 para 0,70 na 29), então os pesos podem melhorar um pouco
e os Elos pequenos abaixo (`places=1` perto de zero) não são definitivos.

### Variantes novas (só experimento, flags de `sia-bots batch`)

- (c) `--four-below-run-only`: o marco conta em tudo; ordem: sequência de
  naipe, sequência, quadra, naipe, dois pares, trinca, par, soma.
- (d) `--three-dice`: a formação lê só os 3 dados do jogador: sequência de
  naipe, trinca, naipe, sequência, par, soma. O marco só desempata as
  sequências (com ou sem naipe): a que ele estende para 4 números vence a que
  não estende; depois a soma dos 3 dados; depois quem completou primeiro. Com
  `--flush-below-run` o naipe fica abaixo da sequência.
- (e) `--place-on-opponent`: no lugar do passo 3, põe um dado no lado do
  adversário (marco não tomado, lado dele com menos de 3 dados). O dado sai
  da mão para sempre (conta como dado perdido), precisa de 2 dados e não
  vale no turno em que o jogador rolou de novo. Os bots a consideram
  (`gives=N` limita as colocações no adversário que olham; `gives=0` nunca a
  usa).
- (f) `--wild-suit`: 3 naipes comuns e um coringa, 2:2:2:1 (o coringa é 1 em
  7), com reposição. O coringa vale como qualquer naipe no naipe da
  formação e pode ser posto no lado do adversário sem custo (a mão é reposta
  e pode rolar de novo no turno). Medido sobre (d) nas duas ordens e sobre a
  melhor configuração entre padrão e (c), que foi (c)/5.
- O tamanho da mão já era `--hand-size`; a regra "com 1 dado não pode rolar"
  segue coerente com a mão de 5 (o máximo de dados perdidos é 4) e o lote e a
  calibração aceitam o tamanho.

### Tabela, `greedy` contra `greedy`, 4000 partidas

Sementes 900000 (lote), 920000 (`places=1`) e 910000 (sem rolar); cada bot
com os pesos da sua configuração. "Dados perdidos" é a média por jogador e
inclui, em (e), os dados postos no adversário. "Com 1 dado" é a parte dos
jogadores que acabam com 1 dado na mão. `places=1` mede quanto importa onde
pôr o dado (Elo do bot que olha só a melhor colocação contra o normal; em (e),
só a colocação própria é limitada). "Sem rolar" é o Elo de quem nunca rola
de novo.

| Configuração | Lados: 1ª e 2ª formação | Reivindicações: 1ª | `places=1` (Elo) | Sem rolar (Elo) | Turnos | Fim: 5 marcos / 3 vizinhos / sem lugar (%) | 1º vence | Rolagens (própria/adversário) | Dados perdidos | Com 1 dado |
|---|---|---|---|---|---|---|---|---|---|---|
| padrão/7 (medido antes) | quadra 45%, naipe 30% | quadra 59% | -27 [-38, -17] | -84 [-95, -73] | 44,2 | 30/58/12 | 51,1% | 7,9 (4,9/3,0) | 3,9 | 30% |
| padrão/5 | quadra 44%, naipe 28% | quadra 63% | -6 [-17, +5] | -66 [-77, -55] | 44,5 | 30/58/12 | 52,5% | 5,50 (3,38/2,11) | 2,75 | 40% |
| (c)/5 | naipe 32%, sequência 22% | sequência 38% | -135 [-147, -124] | -21 [-32, -10] | 47,0 | 29/55/16 | 45,5% | 5,66 (1,25/4,42) | 2,83 | 38% |
| (c)/7 | naipe 29%, quadra 25% | sequência 45% | -182 [-195, -170] | -28 [-38, -17] | 47,7 | 32/51/17 | 47,6% | 9,90 (3,72/6,18) | 4,95 | 52% |
| (b)/5 | sequência 35%, naipe 28% | sequência 46% | -231 [-245, -218] | -17 [-28, -6] | 46,5 | 30/54/16 | 48,8% | 4,94 (0,95/3,99) | 2,47 | 29% |
| (b)/7 (medido antes) | sequência 39%, naipe 26% | sequência 49% | -294 [-309, -280] | -30 [-41, -19] | 46,3 | 15/59/26 | 49,8% | 9,9 (4,5/5,4) | 5,0 | 54% |
| (d)/5 | naipe 30%, trinca 19% | naipe 34% | +23 [+12, +33] | +21 [+10, +32] | 48,7 | 25/52/24 | 45,9% | 5,06 (0,57/4,49) | 2,53 | 40% |
| (d)/7 | naipe 33%, trinca 30% | trinca 39% | -84 [-96, -73] | -67 [-78, -56] | 47,2 | 26/57/17 | 48,9% | 5,56 (1,94/3,62) | 2,78 | 7% |
| (e)/5 | par 36%, quadra 24% | quadra 34% | -58 [-69, -48] | -4 [-14, +7] | 48,2 | 26/53/21 | 52,0% | 0,29 (0,15/0,14) | 3,46 | 68% |
| (e)/7 | par 32%, quadra 27% | quadra 37% | -35 [-46, -24] | -8 [-19, +3] | 46,6 | 28/53/20 | 52,9% | 1,80 (1,41/0,39) | 5,01 | 52% |
| (f) sobre (d)/7 | naipe 48%, seq. de naipe 24% | seq. de naipe 52% | -112 [-123, -101] | -84 [-95, -73] | 48,4 | 10/49/41 | 50,0% | 5,25 (3,06/2,18) | 2,62 | 8% |
| (f) sobre (d), naipe abaixo da sequência/7 | naipe 30%, sequência 21% | seq. de naipe 45% | -83 [-94, -72] | -71 [-82, -60] | 50,7 | 6/36/58 | 48,6% | 8,27 (4,85/3,42) | 4,13 | 35% |
| (f) sobre (c)/5 | naipe 56%, sequência 16% | naipe 45% | -118 [-129, -106] | -24 [-34, -13] | 47,3 | 28/56/16 | 46,5% | 3,27 (0,87/2,40) | 1,63 | 7% |

### Tabela, `pimc` contra `pimc`, 300 partidas

Sementes 800000 e 810000 (sem rolar). Intervalo do "1º vence" de uns 5,6
pontos.

| Configuração | Lados: 1ª e 2ª formação | Reivindicações: 1ª | `places=1` (Elo) | Sem rolar (Elo) | Turnos | Fim: 5 marcos / 3 vizinhos / sem lugar (%) | 1º vence | Rolagens (própria/adversário) | Dados perdidos | Com 1 dado |
|---|---|---|---|---|---|---|---|---|---|---|
| padrão/7 (medido antes) | quadra 45%, naipe 22% | quadra 66% | - | -156 [-202, -114] | 47,6 | 30/55/15 | 53,3% | 8,2 (3,4/4,8) | 4,1 | 30% |
| padrão/5 | quadra 36%, naipe 25% | quadra 58% | - | -78 [-119, -38] | 49,0 | 29/52/19 | 44,7% | 5,13 (1,82/3,31) | 2,57 | 36% |
| (c)/5 | quadra 29%, sequência 23% | sequência 39% | - | -66 [-107, -26] | 47,6 | 24/59/17 | 56,7% | 3,47 (1,30/2,17) | 1,74 | 14% |
| (c)/7 | quadra 36%, sequência 21% | quadra 41% | - | -144 [-190, -103] | 47,7 | 32/50/18 | 46,7% | 6,77 (2,95/3,83) | 3,39 | 16% |
| (b)/5 | sequência 33%, naipe 29% | sequência 46% | - | -108 [-150, -68] | 49,6 | 31/49/20 | 44,0% | 4,41 (1,89/2,51) | 2,20 | 18% |
| (b)/7 (medido antes) | sequência 34%, naipe 30% | sequência 46% | - | -134 [-178, -93] | 49,8 | 20/58/22 | 43,3% | 6,8 (3,0/3,8) | 3,4 | 13% |
| (d)/5 | trinca 26%, naipe 25% | trinca 37% | - | -51 [-92, -12] | 49,2 | 26/53/21 | 50,0% | 2,47 (0,88/1,59) | 1,23 | 6% |
| (d)/7 | trinca 31%, naipe 27% | trinca 40% | - | -108 [-150, -68] | 48,8 | 38/42/20 | 42,0% | 4,25 (1,56/2,69) | 2,13 | 3% |
| (e)/5 | par 30%, trinca 26% | trinca 30% | - | -9 [-49, +30] | 49,3 | 25/61/15 | 54,0% | 0,25 (0,07/0,18) | 3,69 | 78% |
| (e)/7 | par 33%, trinca 25% | trinca 30% | - | +14 [-25, +54] | 48,5 | 26/56/18 | 49,3% | 1,55 (0,55/1,00) | 5,27 | 57% |
| (f) sobre (d)/7 | naipe 40%, seq. de naipe 26% | seq. de naipe 48% | - | -105 [-148, -65] | 47,0 | 19/62/19 | 46,0% | 4,77 (1,64/3,13) | 2,39 | 5% |
| (f) sobre (d), naipe abaixo da sequência/7 | naipe 28%, seq. de naipe 25% | seq. de naipe 44% | - | -110 [-153, -70] | 45,3 | 20/68/12 | 48,7% | 5,58 (2,03/3,55) | 2,79 | 11% |
| (f) sobre (c)/5 | naipe 51%, sequência 14% | naipe 42% | - | -70 [-112, -31] | 47,7 | 28/55/17 | 54,0% | 2,20 (0,75/1,45) | 1,10 | 4% |

### Medidas extras

- (e): o bot passa a quase não rolar de novo (0,29 rolagens por partida em
  /5, 1,8 em /7, contra 5,5 e 7,9) e põe no adversário 6,6 dados por partida
  em /5 e 8,2 em /7 (`greedy`), 7,1 e 9,0 (`pimc`). Quem nunca usa a jogada
  nova perde feio: -524 Elo em /5 e -560 em /7 (`greedy`), -388 e -489
  (`pimc`). A jogada substitui a rolagem e vira a decisão central, mas com 68%
  (/5) e 52% (/7) dos jogadores acabando com 1 dado.
- (f), coringas por partida (`greedy`): 8,5 sorteados nas duas mãos e
  reposições; postos no próprio lado e no do adversário: 2,9 e 5,3 sobre
  (d)/7, 4,5 e 4,1 com o naipe abaixo da sequência, 0,5 e 7,0 sobre (c)/5. O
  assento que sorteou mais coringas vence 68% (sobre (d)/7), 67% (naipe
  abaixo) e 71% (sobre (c)/5) das partidas em que os dois sortearam
  quantidades diferentes; com `pimc`, 73%, 75% e 70% (268 partidas). Não separei o
  efeito do coringa do de repor mais dados, mas a diferença é grande.
- (f) sobre (d)/7: o naipe sobe para 48% dos lados (40% com `pimc`), e
  41% das partidas acabam sem lugar (58% com o naipe abaixo da sequência,
  contra 17% a 24% em (d) sem coringa).

### Leitura

- **Formação dominante.** No padrão a quadra tem 44% a 45% dos lados e 59% a
  63% das reivindicações (`greedy`). (c)/5 tira a quadra do topo para 32% (o
  naipe) nos lados, e a primeira formação das reivindicações é a sequência,
  38%; (c)/7 fica em 29% e 45%. (b)/5: sequência em 35% dos lados e 46% das
  reivindicações. Com o `pimc` a quadra ainda é a primeira em (c) (29% a 36%
  dos lados, contra 36% a 45% no padrão), e a sequência em (b) (33% a 34%). Em
  dominância (c) é equivalente a (b) ou um pouco melhor nos lados; nas
  reivindicações as duas ficam em 38% a 46%. Mão de 5 sozinha não muda nada:
  quadra em 44% dos lados.
- **Quanto importa onde pôr o dado.** Elo de `places=1`: padrão -6 (/5) e -27
  (/7); (c) -135 (/5) e -182 (/7); (b) -231 (/5) e -294 (/7). Aqui (c) **não**
  é equivalente a (b): recupera uns 60% do efeito de (b), e é bem
  melhor que o padrão. (d)/5 não precisa decidir onde pôr (+23), (d)/7 sim
  (-84); (e) e (f) ficam entre -35 e -118.
- **Dados que sobram e rolar de novo.** A mão de 5 corta as rolagens (5,5 no
  padrão contra 7,9), mas sem rolar o Elo continua só -66 e 40% dos
  jogadores terminam com 1 dado. Em (c) a mão de 5 também reduz o rolar (5,7
  contra 9,9 em /7) e os jogadores com 1 dado caem de 52% para 38% (`greedy`)
  e ficam em 14% a 16% com o `pimc`. A mão de 7 em (d) é a que menos deixa
  jogador com 1 dado (7% `greedy`, 3% `pimc`).
- **Duração e fim.** Turnos ficam entre 44 e 51. Sem lugar sobe de 12% (padrão)
  para 16% em (c)/5, 24% em (d)/5 e 41% a 58% com coringa sobre (d).
- **Primeiro jogador.** (c)/5 e (d)/5 dão 45,5% e 45,9% ao primeiro com o
  `greedy` (4000 partidas, intervalo de ±1,5); com o `pimc` os valores
  oscilam de 42% a 57% sem padrão. Vale ficar de olho, é pequeno.
- **(e)** vira um jogo de jogar dados fora: a rolagem some, os jogadores
  acabam com 1 dado em 52% a 78% das partidas e o par vira a formação mais
  comum nos lados (30% a 36%).
- **(f)** piora o que se queria consertar: o naipe domina (48% a 56% dos
  lados) ou, com o naipe abaixo da sequência, metade das partidas acaba sem
  lugar, e quem sorteia mais coringas ganha cerca de 70% das vezes, que é
  sorte demais.

### Recomendação

- **Testar (c) com mão de 5** em playtest. É a mudança mais barata (troca de
  posição de uma linha da tabela e a mão de 7 para 5) e quebra a dominância
  da quadra tanto quanto (b). Não faz onde pôr o dado pesar como em (b), mas
  vai de -6 para -135 Elo.
- Se a ideia for uma mudança estrutural, (d) com mão de 7 é a mais equilibrada
  das novas (naipe 33%, trinca 30%, 7% com 1 dado), mas reescreve todas as
  formações e o glossário, e a decisão de onde pôr pesa só -84.
- Descartar (e) e (f): (e) acaba com a rolagem e deixa a maioria dos
  jogadores com 1 dado; (f) concentra o jogo no naipe ou nas partidas sem
  lugar e dá peso demais à sorte dos coringas.
- Nada disto foi aplicado em `regras/`.

## Um coringa por jogador (g)

Pedido do designer. Medições de 2026-10-26, com o mesmo método da seção
anterior (mão de 5, pesos calibrados por CMA-ES em 30 gerações de 12
candidatos e 150 sementes, `greedy` contra `greedy` com 4000 partidas, `pimc`
contra `pimc` com 300; sementes de lote 900000, 910000, 920000, 800000 e
810000). A calibração do (g) usou sementes novas (700000) e a validação,
também novas (600000, 4000 partidas, contra os pesos à mão): (g) sobre (c)/5
+242 Elo (o (c)/5 sem coringa dá +233 nas mesmas sementes) e (g) sobre (b)/5
+305 (o (b)/5 dá +272). Arquivos em `tune/fase-gc5.json`, `tune/fase-gb5.json`,
`tune/runs/fase-g{c,b}5/` e `tune/runs/medicoes-g/`.

### Variante (g), `--joker`

- Cada jogador começa com 1 dado coringa (cor dos marcos) na mão, com o
  número rolado na preparação, e 4 dados da bolsa. Ele vale como qualquer
  naipe na formação; o número vale normalmente. Uma vez posto, a mão é
  reposta só com dados da bolsa, que continua com os 4 naipes comuns.
- O adversário não pode rolar o coringa ao rolar a mão do dono (o comando é
  recusado e as jogadas legais e os bots o excluem). O dono pode rolá-lo e
  pode escolhê-lo como o dado perdido.
- A prova de reivindicação não muda: ela já supõe que os dados que faltam ao
  adversário têm qualquer número e qualquer naipe, o que cobre o coringa dele.
  Um teste confere que a melhor formação possível com um coringa no lado é a
  mesma de um dado do naipe certo.
- Os bots tratam o coringa como um dado de naipe que serve a qualquer
  formação; o resto da avaliação é o mesmo.

### Tabela, `greedy` contra `greedy`, 4000 partidas

As linhas sem coringa são as da seção anterior. "Sorte" é a medida abaixo
(partilha das aberturas em que o assento decide, calibrado contra pesos à mão).

| Configuração | Lados: 1ª e 2ª formação | Reivindicações: 1ª | `places=1` (Elo) | Sem rolar (Elo) | Turnos | Fim: 5 marcos / 3 vizinhos / sem lugar (%) | 1º vence | Rolagens (própria/adversário) | Dados perdidos | Com 1 dado | Sorte |
|---|---|---|---|---|---|---|---|---|---|---|---|
| (c)/5 | naipe 32%, sequência 22% | sequência 38% | -135 [-147, -124] | -21 [-32, -10] | 47,0 | 29/55/16 | 45,5% | 5,66 (1,25/4,42) | 2,83 | 38% | 32,6% |
| (c)/5 + (g) | naipe 30%, sequência 22% | sequência 37% | -126 [-138, -115] | -12 [-22, -1] | 47,2 | 30/54/15 | 48,6% | 5,65 (0,58/5,08) | 2,83 | 39% | 32,1% |
| (b)/5 | sequência 35%, naipe 28% | sequência 46% | -231 [-245, -218] | -17 [-28, -6] | 46,5 | 30/54/16 | 48,8% | 4,94 (0,95/3,99) | 2,47 | 29% | 28,9% |
| (b)/5 + (g) | sequência 33%, naipe 32% | sequência 42% | -256 [-270, -242] | -25 [-36, -15] | 46,1 | 32/53/15 | 49,2% | 5,73 (1,36/4,37) | 2,87 | 40% | 25,8% |

### Tabela, `pimc` contra `pimc`, 300 partidas

Intervalo do "1º vence" de uns 5,6 pontos.

| Configuração | Lados: 1ª e 2ª formação | Reivindicações: 1ª | Sem rolar (Elo) | Turnos | Fim: 5 marcos / 3 vizinhos / sem lugar (%) | 1º vence | Rolagens (própria/adversário) | Dados perdidos | Com 1 dado |
|---|---|---|---|---|---|---|---|---|---|
| (c)/5 | quadra 29%, sequência 23% | sequência 39% | -66 [-107, -26] | 47,6 | 24/59/17 | 56,7% | 3,47 (1,30/2,17) | 1,74 | 14% |
| (c)/5 + (g) | quadra 27%, naipe 22% | sequência 34% | -120 [-164, -80] | 47,8 | 29/51/20 | 47,3% | 4,42 (1,74/2,68) | 2,21 | 25% |
| (b)/5 | sequência 33%, naipe 29% | sequência 46% | -108 [-150, -68] | 49,6 | 31/49/20 | 44,0% | 4,41 (1,89/2,51) | 2,20 | 18% |
| (b)/5 + (g) | sequência 34%, naipe 30% | sequência 44% | -37 [-77, +2] | 48,6 | 28/58/14 | 46,7% | 3,09 (1,36/1,73) | 1,54 | 7% |

### Medidas extras do coringa

Por jogador, em cada partida:

| Configuração | Coringa posto | Turno médio em que é posto | Rolado pelo dono (por coringa) | Perdido pelo dono | Formação do lado onde fica, no fim |
|---|---|---|---|---|---|
| (c)/5 + (g), `greedy` | 99,2% | 3,0 | 0,00 | 0,8% | naipe 46%, quadra 19%, sequência 17%, seq. de naipe 10% |
| (c)/5 + (g), `pimc` | 98,0% | 4,6 | 0,00 | 2,0% | naipe 35%, quadra 26%, sequência 19%, seq. de naipe 9% |
| (b)/5 + (g), `greedy` | 98,3% | 4,8 | 0,00 | 1,6% | naipe 47%, sequência 24%, seq. de naipe 23% |
| (b)/5 + (g), `pimc` | 99,3% | 5,2 | 0,00 | 0,7% | naipe 36%, seq. de naipe 35%, sequência 22% |

- Os bots põem o coringa nos primeiros turnos e nunca o rolam. Ele funciona
  como um dado bom do início, não como uma decisão. A regra de o dono poder
  rolá-lo ficou sem uso nos bots. Só 1% a 2% são perdidos.
- O lado do coringa termina em naipe ou sequência de naipe em 44% (`pimc`,
  (c)) a 71% (`pimc`, (b)) dos casos (em (c)/5 sem coringa, 36% de todos os
  lados): é o dado que ajuda o naipe.

### Medida de sorte

O quanto o resultado depende dos dados tirados: tomo as 2000 aberturas da
validação (sementes 600000), cada uma jogada nos dois assentos pelo bot
calibrado contra o bot de pesos à mão. Se o mesmo bot vence as duas partidas,
quem decidiu foi a habilidade; se cada bot vence a partida em que está no
mesmo assento, quem decidiu foi a abertura (os dados). A coluna "Sorte" é a
fração das aberturas do segundo tipo: 0% se só a habilidade decidisse, 50% se
só os dados decidissem. É uma medida grosseira: a habilidade
relativa dos bots também entra e muda um pouco entre as configurações (de
+233 a +305 Elo), e o intervalo é de uns ±2 pontos.

- (c)/5: 32,6%, com coringa 32,1%. Sem diferença.
- (b)/5: 28,9%, com coringa 25,8%. O coringa não aumenta a sorte; a diferença
  é do tamanho do intervalo, e o (g) sobre (b) tem Elo maior (+305 contra
  +272), o que explica boa parte dela.
- Não medi o efeito do número que sai no coringa.

### Leitura

- **Formação dominante.** Não muda: (c)/5 continua com o naipe e a sequência
  na frente (30% e 22% dos lados) e (b)/5 com a sequência e o naipe (33% e
  32%). A diferença de (b) para (c) das seções anteriores continua.
- **Onde pôr o dado.** (c) -126 contra -135; (b) -256 contra -231. Dentro do
  erro de medida (uns ±12).
- **Turnos, fim, dados perdidos, rolagens.** Iguais, dentro do intervalo. A
  proporção de rolagens no adversário sobe em (c) (5,08 contra 4,42), e as
  rolagens da própria mão caem de 1,25 para 0,58.
- **Vantagem do primeiro.** (c)/5 sobe de 45,5% para 48,6% com o coringa
  (intervalo ±1,5), e fica mais perto de 50%; em (b)/5 não muda (48,8% e
  49,2%). Com o `pimc`, 47,3% e 46,7% (±5,6).
- **Sorte.** Sem diferença que a medida separe do ruído.
- Limite: 30 gerações de calibração, como as anteriores; os bots nunca rolam o
  coringa, então a regra de rolagem do dono não foi posta à prova por eles.

### Recomendação

- O coringa não resolve nem estraga nada do que medimos: formação, onde pôr
  o dado, duração, fim e sorte ficam onde estavam. O único ganho é no (c)/5, em
  que o primeiro jogador deixa de ter 45,5% e vai a 48,6% com o `greedy`
  (sem confirmação no `pimc`). Custo: um dado diferente, com regra própria de
  rolagem, que os bots nunca rolam.
- Se o designer quiser o coringa por motivo de sensação (sempre ter um dado
  flexível no início), a combinação é **(c)/5 + (g)**: mantém as propriedades
  de (c)/5 e aproxima o primeiro dos 50%. (b)/5 + (g) não ganha nada sobre
  (b)/5, e (b) já tem o custo de reescrever a quadra e os dois pares.
- Sem esse motivo, o resultado é: não adotar (g), e a escolha continua entre
  (c)/5 e (b)/5 da seção anterior.
- Nada disto foi aplicado em `regras/`.

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

1. A variante (b), em que o marco só entra na sequência e no naipe, foi
   recalibrada e medida com o `pimc` (seção acima): não resolve a
   dominância, a sequência assume o lugar da quadra. Não recomendada.
2. Reescrever `regras/sia/05-fim-do-jogo.md` sem os casos de empate por
   falta de lugar, que não ocorrem.
3. Manter 7 dados, sem compensação para o segundo jogador.
4. Alternativa não testada para a quadra: rolar de novo custar mais (por
   exemplo, perder um dado e não poder rolar a própria mão duas vezes
   seguidas). É o próximo teste, agora que (b) foi medida.

## Regra adotada (2026-10-26)

O designer decidiu a variante (b) com mão de 5 e o coringa (g), a
configuração medida como "(b)/5 + (g)". Ela é a regra de `regras/sia/` e o
padrão do motor, sem flags. As seções acima são o histórico das variantes e
citam flags (`--stone-only-sequences`, `--joker`, `--hand-size` com 7 e
outras) que o motor não tem mais; as seções "Regra padrão" e "Propostas de
regra" falam de uma regra que deixou de existir.

- Formação: 3 dados do jogador e o marco; o marco conta só para a sequência
  e o naipe (o naipe dele vale como qualquer naipe). Trinca e par olham só os
  3 dados. Sem quadra nem dois pares. Ordem: sequência de naipe, sequência,
  naipe, trinca, par, soma.
- Desempate: maior soma dos 4 números (o marco entra na soma, como o código
  faz: `stone + 3 dados`), depois o lado completado primeiro.
- Mão de 5: o coringa e 4 dados da bolsa. Repor completa até 5 menos os
  perdidos, só com dados dos 4 naipes da bolsa.
- Coringa: dado do naipe dos marcos (`JOKER_SUIT`), número rolado na
  preparação. O dono pode rolá-lo e perdê-lo; o adversário não pode rolá-lo.
  O que o código faz com o coringa perdido: ele só sai da mão (a mão perde um
  dado, `lost` sobe) e não volta como coringa, porque a bolsa só sorteia os 4
  naipes. Foi mantido e registrado em `regras/sia/01-componentes.md` como
  Proposta; o designer precisa confirmar.
- Chances de cada formação com 3 dados ao acaso, recalculadas por
  enumeração (marco de 1 a 6, números de 1 a 6, 4 naipes, sem coringa):
  sequência de naipe 0,35%, sequência 5,2%, naipe 5,9%, trinca 2,6%, par 39%,
  soma 47%. A trinca, mais rara que o naipe, fica abaixo dele, pela ordem
  decidida.

### O que saiu do motor

`experiment` (os átomos globais e a struct `Variant`), as variantes (a) a
(f) e `second_bonus`/`first_turn_without_reroll`, o comando
`PlaceOnOpponent` e o erro `PlaceOnOpponentClosed`, `WILD_SUIT` e
`suit_with_wild`, e os parâmetros `gives` dos bots. O tamanho da mão
(`GameState::with_hand_size`, `--hand-size`) ficou como parâmetro de
experimento, dentro do estado; o padrão é 5. `FormationKind` tem 6 valores
(`FourOfAKind` e `TwoPairs` saíram dos tipos TypeScript). O jogo salvo da web
passou para a chave `sia.partida.v2`.

### Pesos padrão

`weights/default.json` agora é o `best.json` da fase `gb5`
(`tune/fase-gb5.json`: CMA-ES de 30 gerações, 12 candidatos, 150 sementes,
mão de 5, regra decidida), validado em 4000 partidas (sementes 600000)
contra os pesos à mão: **+305 Elo [+290, +321]**.

| Peso | Antes (fase 1, mão de 7) | Agora (gb5) |
|---|---|---|
| `adjacent` | 0,21 | 0,00 |
| `prob` | 1,47 | 0,28 |
| `sure` | 0,08 | 0,67 |
| `neighbors` | 0,81 | 0,00 |
| `placed` | -0,30 | -0,11 |
| `lost` | -0,53 | -0,85 |
| `hand` | 0,42 | 0,48 |
| `opp_hand` | -1,43 | -1,98 |

### Níveis da web, medidos de novo

Pesos novos, sementes 600000, rotação de assentos, nativo.

| Lote | Partidas | Resultado | Elo | ms por decisão |
|---|---|---|---|---|
| fácil (`greedy:noise=2`) x médio (`greedy`) | 2000 | 69 a 1931 (3,5% [2,7; 4,3]) | -579 [-626, -541] | 3,0 e 2,5 |
| fácil x `random` | 600 | 575 a 25 (95,8% [93,9; 97,2]) | +545 [+485, +632] | 3,8 e 0,00 |
| difícil (`pimc`) x médio | 200 | 158 a 42 (79,0% [72,8; 84,1]) | +230 [+176, +297] | 114 (máx. 486) e 2,1 |

- O fácil ainda perde 96,5% das partidas para o médio: o degrau fácil-médio
  (579 Elo) é o maior dos três. Antes (sem coringa, mão de 7) eram -460 Elo.
  Se o designer quiser o fácil mais perto do médio, é subir o `noise` da
  especificação em `digital/sia/web/src/bot/levels.ts`; não mudei.
- O difícil contra o médio é +230, como o `pimc` x `greedy` anterior (+234).
- Tempo do `pimc` no WASM (`just sia-wasm-test`, 3 decisões do começo da
  partida): 163 ms por decisão (pior 176), com a máquina menos carregada que
  nas medidas de 2026-10-21 (379 ms). Folga grande para o teto de 0,5 s.

## Ordem pela chance e mão de 6 (2026-10-27)

O designer decidiu duas mudanças sobre a regra adotada: (1) ordem das
formações pela chance com 3 dados ao acaso, com a trinca acima da sequência
e do naipe (sequência de naipe, trinca, sequência, naipe, par, soma); (2)
mão de 6 (o coringa e 5 dados da bolsa). Pediu para ver se a ordem nova "não
distorce muito as estratégias". Medido antes de mudar o padrão.

### Chances recalculadas

Por enumeração (marco de 1 a 6, 3 dados de 1 a 6, 4 naipes, sem coringa).
A ordem pela chance é a que o designer decidiu. Com a trinca acima do naipe,
três dados iguais do mesmo naipe contam como trinca, e as chances mudam um
pouco:

| Formação | Ordem antiga | Ordem nova |
|---|---|---|
| Sequência de naipe | 0,35% | 0,35% |
| Trinca | 2,60% | 2,78% |
| Sequência | 5,21% | 5,21% |
| Naipe | 5,90% | 5,73% |
| Par | 39,06% | 39,06% |
| Soma | 46,88% | 46,88% |

Na ordem nova a trinca (2,8%) continua mais rara que a sequência (5,2%) e que
o naipe (5,7%), então a ordem pela chance é a decidida.

### Método

Quatro configurações, cada uma com pesos calibrados por CMA-ES (30 gerações,
12 candidatos, 150 sementes 700000, partindo dos pesos padrão anteriores,
`greedy:cands=4,rerolls=2` contra os pesos à mão) e validada em 4000 partidas
nas sementes 600000, que a busca não usou:

| | Ordem | Mão | Fase | Validação contra os pesos à mão |
|---|---|---|---|---|
| A | antiga | 5 | `gb5` (regra adotada) | +305 [+290, +321] |
| B | nova | 5 | `hb5` | +235 [+222, +248] |
| C | antiga | 6 | `hc6` | +265 [+251, +280] |
| D | nova | 6 | `hd6` | +222 [+209, +235] |

As quatro foram calibradas, e cada medida usa os pesos da própria
configuração. A (`gb5`) é a medição da seção anterior, com as mesmas
sementes (900000, 910000, 920000, 800000, 810000, 600000); B, C e D usam os
mesmos lotes e o binário do motor com a ordem e a mão certas (a ordem antiga
só existe no binário anterior ao commit `c76ca0a`; não houve flag no motor).
Arquivos: `tune/fase-h{b5,c6,d6}.json`, `tune/runs/fase-h*/`,
`tune/runs/medicoes-h/`.

Os pesos achados são bem diferentes entre as quatro (por exemplo `prob` vai
de 0,02 em C a 1,34 em D), sinal de que a superfície é plana e a busca de 30
gerações não separa pesos parecidos. Os Elo de validação não são comparáveis
entre linhas (o bot à mão é o mesmo, mas o jogo muda).

### Tabela, `greedy` contra `greedy`, 4000 partidas

"Sorte" como na seção do coringa; o valor de A é o de (b)/5 + (g) daquela
seção, medido com os mesmos lotes.

| | Lados: 1ª e 2ª formação | Reivindicações: 1ª | `places=1` (Elo) | Sem rolar (Elo) | Turnos | Fim: 5 marcos / 3 vizinhos / sem lugar (%) | 1º vence | Rolagens (própria/adversário) | Dados perdidos | Com 1 dado | Sorte |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A (antiga, 5) | sequência 33%, naipe 32% | sequência 42% | -256 [-270, -242] | -25 [-36, -15] | 46,1 | 32/53/15 | 49,2% | 5,73 (1,36/4,37) | 2,87 | 40% | 25,8% |
| B (nova, 5) | trinca 38%, sequência 23% | trinca 54% | -109 [-121, -98] | -21 [-32, -11] | 46,2 | 30/55/15 | 47,0% | 5,83 (1,54/4,29) | 2,92 | 42% | 34,2% |
| C (antiga, 6) | sequência 34%, naipe 30% | sequência 43% | -257 [-272, -244] | -25 [-36, -14] | 46,4 | 30/54/16 | 48,4% | 7,48 (2,15/5,33) | 3,74 | 40% | 31,6% |
| D (nova, 6) | trinca 42%, sequência 22% | trinca 57% | -111 [-122, -99] | -60 [-71, -49] | 46,6 | 32/56/12 | 48,0% | 8,11 (3,55/4,56) | 4,06 | 51% | 34,8% |

Intervalo do "1º vence": uns 1,5 ponto. "Dados perdidos" é por jogador (a
coluna de rolagens é por partida, com um dado perdido por rolagem). "Com 1
dado" é a fração de jogadores que termina com 1 dado na mão.

### Tabela, `pimc` contra `pimc`, 300 partidas

Intervalo do "1º vence": uns 5,6 pontos.

| | Lados: 1ª e 2ª formação | Reivindicações: 1ª | Sem rolar (Elo) | Turnos | Fim: 5 marcos / 3 vizinhos / sem lugar (%) | 1º vence | Rolagens (própria/adversário) | Com 1 dado |
|---|---|---|---|---|---|---|---|---|
| A | sequência 34%, naipe 30% | sequência 44% | -37 [-77, +2] | 48,6 | 28/58/14 | 46,7% | 3,09 (1,36/1,73) | 7% |
| B | trinca 35%, sequência 19% | trinca 54% | -113 [-156, -73] | 49,4 | 33/50/17 | 46,7% | 3,23 (1,12/2,11) | 10% |
| C | sequência 35%, naipe 27% | sequência 49% | -83 [-124, -43] | 48,9 | 31/54/15 | 48,7% | 3,58 (1,55/2,03) | 4% |
| D | trinca 36%, sequência 19% | trinca 53% | -90 [-132, -50] | 49,8 | 31/50/19 | 43,3% | 5,42 (2,00/3,42) | 18% |

### Leitura

- **A ordem nova distorce, e muito, a formação buscada.** Com a trinca no
  topo, ela passa a ser a formação mais comum: 38% a 42% dos lados e 54% a
  57% das reivindicações (`greedy`), contra 33% da sequência e 42% a 43% das
  reivindicações na ordem antiga. É o mesmo problema da quadra do padrão
  antigo (ver "Conclusões de design"): uma formação que não depende do marco
  e que se monta rolando de novo vira a que um jogador bom busca. A
  sequência cai para 22% a 23% e o naipe para 14% a 15% dos lados. O `pimc`
  confirma: trinca em 35% a 36% dos lados e 53% a 54% das reivindicações.
- **O que a ordem nova melhora.** Onde pôr o dado deixa de pesar tanto:
  `places=1` vai de -256 para -109 (B) e -111 (D): a trinca não depende do
  marco, então escolher o marco onde pôr o dado vale a metade. Em A e C essa
  escolha vale uns 250 Elo, que era o ponto que as variantes anteriores
  tentavam aumentar.
- **Sem distorção:** turnos (46 a 47), fim da partida, vitória do primeiro
  (47% a 49%, ±1,5) e o
  número de rolagens em B (5,8 contra 5,7).
- **Sorte.** B e D ficam em 34% a 35% contra 26% a 32% das outras. A
  diferença vem em parte de os pesos de A, B, C e D terem forças diferentes
  contra o bot à mão (+222 a +305 Elo), então é sinal fraco, mas vai no
  sentido de mais sorte: a trinca depende do número dos dados que saem.
- **A mão de 6 em relação à de 5.** As rolagens sobem de 5,7 para 7,5 (ordem
  antiga) e de 5,8 para 8,1 (ordem nova); as rolagens na própria mão sobem
  de 1,4 para 2,2 e de 1,5 para 3,6. Os dados perdidos sobem na mesma
  proporção. A fração de jogadores que termina com 1 dado **não cai**: 40%
  em A e C, 42% em B e **51% em D**; com o `pimc`, 7% a 10% com mão de 5 e
  4% (C) a 18% (D) com mão de 6. Sem rolar o Elo é -25 em A, B e C e -60
  em D. A mão de 6 não resolve a limitação de partidas que acabam com 1
  dado: com a ordem antiga ela é neutra, com a nova piora. O jogo apenas
  rola mais e perde mais dados (4,1 contra 2,9 por jogador, em D contra A).

### Níveis da web, pesos `hd6`, mão de 6 e ordem nova

Binário nativo, sementes 600000, rotação de assentos.

| Lote | Partidas | Resultado | Elo | ms por decisão |
|---|---|---|---|---|
| fácil (`greedy:noise=1`) x médio (`greedy`) | 2000 | 428 a 3572 de 4000 lugares (10,7% [9,8; 11,7]) | -369 [-387, -352] | 2,7 e 2,2 |
| fácil `noise=1` x `random` | 600 | 1197 a 3 de 1200 lugares (99,8%) | +1040 [+909, +inf] | 3,3 |
| fácil `noise=2` (o nível antigo) x médio | 2000 | 80 a 3920 (2,0%) | -676 [-719, -641] | 2,1 |
| difícil (`pimc`) x médio | 200 | 319 a 81 de 400 lugares (79,8% [75,5; 83,4]) | +238 [+198, +284] | 105 (máx. 522) e 1,8 |

- O fácil com `noise=1` perde 89% dos lugares para o médio (-369 Elo; era
  -579 com `noise=2` e mão de 5). Com `noise=2` a mudança de regra levaria o
  degrau a -676, por isso o `noise=1`. O degrau fácil-médio ainda é o maior
  do conjunto, mas ganha 99,8% do `random`.
- O difícil contra o médio é +238, igual a antes (+230).
- Tempo do `pimc` no WASM (`just sia-wasm-test`, 3 decisões do começo da
  partida): 192 ms por decisão (pior 196). Mais jogadas com mão de 6 e ainda
  abaixo de 400 ms.

### Recomendação

- Aplicada em `regras/sia/` e no motor a regra decidida (D). Pelas medidas,
  a ordem nova troca o problema de lugar: a trinca vira a formação
  dominante (42% dos lados, 57% das reivindicações), como a quadra era. Em
  troca, a escolha do marco onde pôr o dado pesa menos (-111 contra -256).
- A mão de 6 não faz o jogo acabar menos com 1 dado (51% em D). Se esse for
  o problema, o tamanho da mão não o resolve: com mão de 5 eram 40% a 42%, e
  com mão de 6 ficam em 40% (ordem antiga) e 51% (nova).
- Para o designer decidir: manter a trinca no topo (a ordem pela chance),
  ou voltar a pô-la abaixo da sequência, que na medição A e C dá a mesma
  duração e menos dominância (sequência 33% a 34%) a custo de a escolha do
  marco pesar 250 Elo.

## Decisão do designer: ordem antiga com mão de 6 (C)

Em 2026-10-27 o designer escolheu a configuração C: a ordem antiga
(sequência de naipe, sequência, naipe, trinca, par, soma) com a mão de 6. A
ordem pela chance foi descartada porque a trinca dominava e a escolha do
marco perdia peso (`places=1` de -256 para -111). Motor, regras e web voltam
à ordem antiga e os pesos padrão passam a ser os da fase `hc6` (+265 Elo
sobre os pesos à mão). Níveis medidos de novo com esses pesos (binário
nativo, sementes 600000, rotação de assentos, arquivos em
`tune/runs/medicoes-i/niveis/`): fácil (`greedy:noise=1`) x médio, 2000
aberturas, 13,7% dos lugares, -320 Elo [-337, -305]; fácil x `random`, 600
aberturas, 99,8%, +1111 Elo; difícil (`pimc`) x médio, 200 aberturas, 74,2%
dos lugares, +184 Elo [+147, +225]. O fácil fica dentro do limite de -450
Elo contra o médio. O `pimc` no WASM leva 166 ms por decisão (pior 190).
