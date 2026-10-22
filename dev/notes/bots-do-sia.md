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
