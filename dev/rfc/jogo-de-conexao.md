---
type: rfc
status: draft
tags: [jogo-novo, design, conexao, seks]
relatedTo: [dev/rfc/nomes-dos-jogos.md, regras/kit.md, regras/seks/01-componentes.md]
created: 2026-10-29
creator: claude
---

# Jogo novo: conexão com dados no tabuleiro do Seks

## Problem

O designer propôs um jogo de conexão para dois jogadores, com os mesmos
componentes do Seks: o tabuleiro de 11 por 11 e 16 dados de cada cor. Cada
jogador constrói uma linha de dados de um lado ao outro do tabuleiro. O valor
de cada dado limita quantos vizinhos ele aceita, e isso é ao mesmo tempo o
freio da própria linha e a ferramenta de bloqueio.

## Proposal

### Componentes

Os do Seks: o tabuleiro de 11 por 11 e 32 dados, 16 de cada cor. Cabe no kit
sem mudança.

### Preparação

- Cada jogador tem 16 dados da sua cor: 15 na reserva, com valor 2, e 1 no
  tabuleiro, com valor 1.
- O dado inicial das Brancas fica na coluna 6 da fileira 1; o das Pretas, na
  coluna 6 da fileira 11.

> **Proposta:** para acelerar a partida, parte da reserva começa com outros
> valores: um 6, um 5, um 4 e um 3, e o resto com valor 2. Ao colocar, o
> jogador escolhe qual dado da reserva usa; o bloqueante entra com valor 1
> seja qual for o dado. A medir nos bots (`--extra 6,5,4,3`), com outras
> distribuições se o resultado mudar muito.

### Vizinhos e limite

Dois dados são **vizinhos** quando ocupam casas que se tocam pelo lado ou
pela quina (até 8 vizinhos), qualquer que seja a cor.

**Limite:** o valor de um dado é o número máximo de vizinhos que ele pode
ter. Uma colocação só é válida se, depois dela, nenhum dado envolvido passa
do limite: nem o dado colocado, nem os vizinhos dele, de qualquer cor.

> **Design:** um dado 2 com dois vizinhos está cheio. Para receber um
> terceiro, alguém precisa aumentar o valor dele antes.

### Turno

Na sua vez, o jogador faz uma de três ações:

1. **Aumentar:** soma 1 ao valor de um dado qualquer, próprio ou adversário,
   até 6.
2. **Colocar:** põe um dado 2 numa casa vazia vizinha a um dado próprio.
3. **Aumentar e bloquear:** soma 1 ao valor de um dado qualquer e põe um
   **dado bloqueante**, com valor 1, numa casa vazia vizinha a um dado
   adversário. O bloqueante só pode ir para as três fileiras centrais (5, 6
   e 7).

> **Proposta:** o bloqueante também pode ir para o campo próprio, as
> fileiras entre a de fundo e as centrais. A medir nos bots
> (`--block-home`).

O bloqueante é um dado comum da reserva de quem bloqueia. Depois de
colocado, não se distingue dos outros: pode ser aumentado e conta na linha
do dono.

> **Design:** aumentar um dado adversário serve para abrir espaço ao lado
> dele para um bloqueante.

### Reserva vazia

Quando a reserva acaba, o jogador pode colocar um dado próprio que tira do
tabuleiro, qualquer um, inclusive o inicial. Ele mantém o valor que tinha,
salvo se for colocado como bloqueante: nesse caso vira 1. Tirar do tabuleiro
é opcional: o jogador ainda pode só aumentar.

> **Proposta:** o bloqueante só sai da reserva. Com a reserva vazia, a
> ação 3 deixa de existir, e o bloqueio tem fim. A medir nos bots
> (`--block-reserve`).

### Captura

> **Proposta:** um dado com valor 4 ou mais sai do jogo quando uma
> colocação o enche: o 4 com o quarto vizinho, o 5 com o quinto, o 6 com o
> sexto. Aumentar um dado não o protege, só pede mais um vizinho. Como
> qualquer dado pode ser aumentado, o atacante pode levar um dado cheio a
> 4 ou mais e cercá-lo; a ação 3 faz as duas coisas num turno só (aumenta
> o dado cheio e põe o bloqueante como o vizinho que falta). Um dado 3 ou
> menos não é capturado. A medir nos bots (`--capture`).

> **Proposta:** quem tiver dados capturados em número igual a dados por
> jogador menos lado do tabuleiro mais 1 perde na hora: sobram menos dados
> que fileiras, e a linha fica impossível. Com 16 dados, são 8 em 9x9 e 6
> em 11x11. O jogo passa a ter duas metas: a linha ou a captura.

> **Design:** o protótipo captura dados de qualquer cor e só os vizinhos do
> dado colocado; o próprio dado colocado não é capturado, mesmo que chegue
> cheio. Aumentar não captura: só colocar ou bloquear. O lance que forma a linha ou leva o
> adversário ao limite vence, mesmo que leve também quem jogou ao limite.

### Fim do jogo

Vence quem forma uma linha contínua de dados próprios, de vizinho em vizinho
pelo lado ou pela quina, da sua fileira de fundo até a do adversário (da
fileira 1 à 11).

Quem não tem ação válida na sua vez perde.

> **Proposta:** variante a testar: vence quem põe um dado próprio na fileira
> de fundo do adversário, sem precisar da linha. Com a reserva vazia, isso
> deixa a fila de dados andar, tirando os dados de trás e pondo na frente.

> **Playtest:** nos bots, a partida empata num limite de turnos. Na mesa, a
> ideia é empatar quando a mesma posição se repete três vezes.

## Alternatives

- **Meta numa faixa de fileiras** do adversário: descartada; a meta é a
  fileira de fundo.
- **Linha só pelos lados**: descartada; a linha vale pelas diagonais, como o
  limite.
- **Bloqueante neutro**, fora da linha e sem aumento: descartado; o
  bloqueante é um dado comum do dono.
- **Sem ação válida, passa a vez**: descartado; perde.

## Decisions

- 2026-10-29, designer: tabuleiro e dados do Seks; 15 dados 2 na reserva e
  1 dado 1 no tabuleiro, na coluna central da fileira de cada lado; as três
  ações do turno; bloqueante com valor 1 só nas três fileiras centrais;
  limite de vizinhos igual ao valor, contando as diagonais; com a reserva
  vazia, o dado colocado vem do tabuleiro.
- 2026-10-29, designer: a meta é a fileira de fundo do adversário, e a linha
  vale pelas diagonais. O bloqueante sai da reserva de quem bloqueia, é um
  dado comum, entra na linha e pode ser aumentado. Aumentar vale para
  qualquer dado. Tirar dado do tabuleiro é opcional e vale para qualquer
  dado próprio. Sem ação válida, o jogador perde.
- 2026-10-29, designer: o limite vale para dados de qualquer cor. Nos bots,
  a partida empata num limite de turnos; na mesa, a ideia é a repetição de
  posição. Testar a variante em que basta chegar com um dado à fileira de
  fundo do adversário.
- 2026-10-29, designer: as corridas curtas parecem defeito do bot. Testar o
  bloqueio nas três fileiras centrais e também no campo próprio.
- 2026-10-29, designer: o bloqueio fica só nas três fileiras centrais; o
  campo próprio deu defesa demais. Melhorar o bot.
- 2026-10-30, designer: testar o bloqueante só com dado da reserva.
- 2026-10-30, designer: o fim do jogo precisa de uma regra que elimine
  dados. Proposta: o quarto vizinho de um dado 4 o tira do jogo.
- 2026-10-30, designer: 9x9 com a linha, porque termina mais rápido, apesar
  de empatar um pouco mais que 11x11. Quem perde dados demais para formar
  uma linha perde (limite de dados por jogador menos lado mais 1). Testar a
  reserva com um 6, um 5, um 4 e um 3.
- 2026-10-30, designer: a captura vale para todo dado de 4 ou mais, quando
  recebe tantos vizinhos quanto o seu valor. Antes era só o dado 4, e
  aumentar para 5 o protegia.

## Open questions

- **Repetição:** com a realocação e o aumento de qualquer dado, a partida
  pode não terminar. Medir nos bots quantas partidas chegam ao limite de
  turnos, com a linha e com a variante de chegar.
- **Ordem na ação 3:** a RFC assume que o aumento vem antes do bloqueante,
  e por isso pode abrir espaço para ele.
- **Aumentar o 6:** a RFC assume que um dado 6 não pode ser aumentado.
- **Fim de jogo:** sem eliminar dados, a defesa por muralha empata a
  partida. A captura do dado 4 (ver Captura) reduz os empates nos bots,
  mas em 9x9 com a meta de chegar a muralha continua (ver Medições).
- **Duração:** com captura em 11x11, a mediana é de cerca de 100 turnos por
  jogador. Longo para a mesa.

### Consequências do limite a medir

- O bloqueante com valor 1 aceita um vizinho só: entra encostado em
  exatamente um dado, o adversário, e fica cheio até alguém aumentá-lo.
- O dado inicial, com valor 1, fica cheio na primeira colocação ao lado
  dele.
- Uma linha reta de dados 2 tem os dados do meio cheios. Sem aumento,
  ninguém encosta nela; com o aumento de dado adversário, o oponente abre
  espaço, mas gasta a ação.
- Ir de uma fileira à outra pede 11 dados em linha. Com 16 dados, cada
  bloqueante custa um dado da reserva, mas pode entrar na linha depois.
- A ação 3 faz duas coisas no turno. Medir se ela domina a ação 1.
- Corrida pura favorece quem começa: medir a vantagem das Brancas nos bots.

## Medições

Protótipo em `digital/conexao/` (`just conexao-batch A,B`), 2026-10-29. Cada
lote: 100 sementes, cada uma jogada duas vezes, com as cores trocadas; empate
em 300 turnos. Bots: `greedy` minimiza a diferença entre os caminhos mais
curtos dos dois lados, um lance à frente; `lookahead` olha a melhor resposta
do `greedy` para os seus 8 melhores lances; `noblock` é o `greedy` sem a
ação 3.

| Lote | Meta | Empates | Brancas vencem (decididas) | Turnos (mediana, p90) | Bloqueios por bot | Dados tirados do tabuleiro por bot |
|---|---|---|---|---|---|---|
| greedy x greedy | linha | 16% | 43% | 98, 300 | 19 | 37 |
| greedy x greedy | chegar | 5% | 39% | 28, 92 | 8 | 8 |
| lookahead x greedy | linha | 7,5% | 49% | 115, 263 | 19 | 36 |
| lookahead x greedy | chegar | 5% | 50% | 45, 138 | 10 | 13 |
| greedy x greedy, sem bloqueio | linha | 0% | 86% | 19, 29 | 0 | 0,5 |

- **Bloquear é o jogo.** Sem a ação 3, vira corrida pura, e as Brancas vencem
  86%. O `greedy` vence o `noblock` em 96% das partidas, sem perder nenhuma.
- **Habilidade conta:** o `lookahead` vence o `greedy` em 82% (linha) e 88%
  (chegar).
- **Vantagem de quem começa:** não aparece com bloqueio (39% a 50% para as
  Brancas, dentro do ruído de 200 partidas).
- **A linha arrasta o fim:** a reserva acaba sempre, por volta do turno 41, e
  depois os bots ficam realocando dados (37 por partida); 16% das partidas
  chegam a 300 turnos. A meta de chegar corta a mediana de 98 para 28 turnos
  e os empates para 5%.
- Ruído a conferir: no `greedy x greedy` com a meta de chegar, o bot 0
  venceu 58% e o bot 1 37%, com os mesmos bots. Pede mais sementes.

### Tabuleiro 9x9, meta da linha

Mesmo protocolo, com `--size 9 --dice D`. No 9x9, a coluna central é a 5 e
as fileiras do bloqueio são 4, 5 e 6, contando de 1.

| Dados | Bots | Empates | Brancas vencem (decididas) | Turnos (mediana) | Fim da reserva (turno) | Dados tirados do tabuleiro por bot |
|---|---|---|---|---|---|---|
| 12 | greedy x greedy | 29,5% | 47% | 110 | 28 | 51 |
| 12 | lookahead x greedy | 14,5% | 50% | 90 | 31 | 37 |
| 14 | greedy x greedy | 25,5% | 40% | 99 | 37 | 41 |
| 14 | lookahead x greedy | 22% | 46% | 102 | 40 | 37 |
| 16 | greedy x greedy | 23,5% | 42,5% | 107 | 50 | 34 |
| 16 | lookahead x greedy | 18% | 53% | 114 | 52 | 31 |
| 18 | greedy x greedy | 23,5% | 37% | 117 | 65 | 26 |
| 18 | lookahead x greedy | 25,5% | 50% | 118 | 69 | 27 |

- O 9x9 empata mais que o 11x11 (23% a 30% contra 16% no greedy x greedy)
  e não encurta a partida: a mediana fica entre 99 e 117 turnos com
  qualquer número de dados.
- Mais dados adiam o fim da reserva, mas as partidas trocam realocações por
  aumentos e terminam no mesmo turno. Os empates param de cair a partir de
  14 dados.
- A vantagem do `lookahead` cai com 18 dados (57% contra 69% a 77%).
- Em todos os lotes `greedy x greedy`, nos dois tamanhos, as Brancas vencem
  menos da metade das partidas decididas (37% a 47%). Responder ao lance do
  outro pode valer mais que começar.

### Tabuleiro 9x9, meta de chegar

Mesmo protocolo, com `--size 9 --goal reach --dice D`.

| Dados | Bots | Empates | Brancas vencem (decididas) | Turnos (p10, mediana, p90) | A reserva acabou |
|---|---|---|---|---|---|
| 12 | greedy x greedy | 6,5% | 40% | 16, 25, 85 | 47% |
| 12 | lookahead x greedy | 7,5% | 44% | 16, 32, 117 | 52% |
| 14 | greedy x greedy | 9,5% | 40% | 16, 25, 125 | 31,5% |
| 14 | lookahead x greedy | 8% | 49,5% | 16, 32, 130 | 42,5% |
| 16 | greedy x greedy | 9,5% | 37,5% | 16, 25, 120 | 24,5% |
| 16 | lookahead x greedy | 9% | 48% | 16, 32, 173 | 39% |
| 18 | greedy x greedy | 7,5% | 37% | 16, 25, 122 | 22,5% |
| 18 | lookahead x greedy | 15% | 47,5% | 16, 32, 300 | 34% |

- A meta de chegar corta os empates do 9x9 de 23% a 30% para 6,5% a 9,5%
  e a mediana de cerca de 100 para 25 turnos, como no 11x11.
- O número de dados pouco muda o resultado: a maioria das partidas termina
  antes de a reserva acabar. Com 18 dados, o `lookahead` empata mais (15%).
- A duração é bimodal: mediana de 25 turnos, mas p90 de 85 a 300.
- O p10 de 16 turnos quer dizer que, em pelo menos 10% das partidas, quem
  venceu atravessou com 8 dados em 8 turnos, o mínimo possível: o bloqueio
  não parou a corrida. Hipótese a conferir: uma fila reta de dados 2 tem os
  dados do meio cheios, e depois que a ponta passa das fileiras centrais não
  há mais onde bloquear.
- As Brancas vencem só de 37% a 40% das partidas decididas no
  `greedy x greedy`.

### Bloqueio também no campo próprio

9x9, meta de chegar, mesmo protocolo. "Centro" é a regra atual; "campo
próprio" é `--block-home`. O resumo do lote passou a contar as vitórias com o
mínimo de lances, um dado por fileira.

| Dados | Bots | Bloqueio | Empates | Brancas vencem (decididas) | Vitórias com o mínimo de lances | Turnos (mediana) | Bloqueios por bot |
|---|---|---|---|---|---|---|---|
| 12 | greedy x greedy | centro | 6,5% | 40% | 11,5% | 25 | 10 |
| 12 | greedy x greedy | campo próprio | 43,5% | 49% | 0% | 160 | 51 |
| 12 | lookahead x greedy | campo próprio | 31,5% | 55,5% | 0% | 123 | 45 |
| 14 | greedy x greedy | centro | 9,5% | 40% | 11,5% | 25 | 12 |
| 14 | greedy x greedy | campo próprio | 56,5% | 48% | 0% | 300 | 60 |
| 14 | lookahead x greedy | campo próprio | 42,5% | 49% | 0% | 141 | 50 |
| 16 | greedy x greedy | centro | 9,5% | 37,5% | 11,5% | 25 | 11 |
| 16 | greedy x greedy | campo próprio | 67,5% | 46% | 0% | 300 | 62 |
| 16 | lookahead x greedy | campo próprio | 54% | 49% | 0% | 300 | 48 |

- Com o bloqueio só no centro, 10,5% a 11,5% das partidas terminam com o
  mínimo de lances: a corrida passa pelo bloqueio.
- No campo próprio, isso some, mas a defesa passa a dominar: os empates sobem
  para 31% a 68%, e os bloqueios vão de cerca de 10 para 45 a 62 por bot.
- A vantagem do `lookahead` cai: com 16 dados, vence 44% e o `greedy` 13%,
  com o resto empatado.
- As Brancas passam a vencer cerca de metade das partidas decididas.

### Bot com busca

O `search` é uma busca alfa-beta de 3 lances sobre os 8 melhores lances do
`greedy` em cada posição, e prefere a vitória mais rápida. 9x9, meta de
chegar, 16 dados, bloqueio só no centro, 25 sementes por lote (50 partidas).

| Bots | Vitórias | Empates | Vitórias com o mínimo de lances | Turnos (mediana) | Bloqueios por bot | Dados tirados do tabuleiro por bot |
|---|---|---|---|---|---|---|
| search x greedy | 88% x 4% | 8% | 18% | 17 | 9 | 9 |
| search x lookahead | 16% x 6% | 78% | 0% | 300 | 55 | 76 |
| search x search | 18% x 20% | 62% | 0% | 300 | 46 | 61 |

- As corridas curtas eram defeito do `greedy`: o `search` as encontra contra
  ele (18% das partidas), e nenhuma passa contra o `lookahead` ou o
  `search`.
- Com dois bots que defendem, a partida trava: 62% a 78% de empates. A
  reserva acaba por volta do turno 70, e daí em diante os bots tiram dados do
  tabuleiro para bloquear de novo (46 a 55 bloqueios por bot). Com a reserva
  vazia, o bloqueio não tem custo e não acaba.
- Falta separar empate real de bot que não sabe converter a vantagem.

### Bloqueante só da reserva, e muralhas

9x9, meta de chegar, 16 dados, `--block-reserve`. O resumo passou a contar,
nos empates, quantos lados terminam sem caminho até a meta (cercados por
dados adversários).

| Bots | Bloqueio | Vitórias | Empates | Empates com 0, 1 ou 2 lados cercados | Bloqueios por bot |
|---|---|---|---|---|---|
| greedy x greedy | só reserva | 50% x 40,5% | 9,5% | | 4 |
| lookahead x greedy | só reserva | 78% x 8% | 14% | | 4 |
| lookahead x lookahead | só reserva | 7% x 14% | 79% | 1%, 53%, 25% | 4 |
| search x lookahead | só reserva | 20% x 6% | 74% | | 4 |
| search x search | só reserva | 18% x 22% | 60% | | 4 |
| search x search (12 sementes) | só reserva | 12,5% x 25% | 62,5% | 0%, 42%, 21% | 5 |
| search x search (12 sementes) | atual | 12,5% x 25% | 62,5% | 0%, 29%, 33% | 46 |

- Tirar o bloqueio do tabuleiro não muda os empates: os bloqueios caem de 46
  para 4 por bot, e os empates ficam iguais.
- Quase todo empate termina com pelo menos um lado cercado. A defesa é uma
  muralha de dados próprios: uma fileira de dados 2 lado a lado tem dois
  vizinhos por dado, é legal, e ninguém atravessa.
- Daí a proposta de eliminar dados (ver Open questions).

### Captura

Medido com a captura só do dado 4 (antes da decisão de capturar todo dado
de 4 ou mais). 16 dados, bloqueio atual (reserva e tabuleiro, só nas 3 fileiras centrais),
lookahead x lookahead, 100 partidas por linha, com e sem `--capture`. O bot
conta na avaliação o material capturado e os dados expostos (valor 4 com 3
vizinhos); `-blind` desliga esses termos.

| Tabuleiro | Meta | Captura | Vitórias | Empates | Empates com 0, 1 ou 2 lados cercados | Brancas | Mediana de turnos | Perdidos por bot |
|---|---|---|---|---|---|---|---|---|
| 9x9 | chegar | não | 10% x 9% | 81% | 1%, 55%, 25% | 36,8% | 300 | 0 |
| 9x9 | chegar | sim | 11% x 12% | 77% | 2%, 44%, 31% | 52,2% | 300 | 0,2 |
| 9x9 | linha | não | 22% x 28% | 50% | 7%, 31%, 12% | 48% | 284 | 0 |
| 9x9 | linha | sim | 40% x 41% | 19% | 0%, 14%, 5% | 43,2% | 132 | 0,4 |
| 11x11 | chegar | não | 26% x 30% | 44% | 17%, 24%, 3% | 53,6% | 255 | 0 |
| 11x11 | chegar | sim | 34% x 42% | 24% | 5%, 18%, 1% | 47,4% | 149 | 0,2 |
| 11x11 | linha | não | 37% x 37% | 26% | 22%, 4%, 0% | 55,4% | 216 | 0 |
| 11x11 | linha | sim | 42% x 43% | 15% | 14%, 1%, 0% | 48,2% | 195 | 0,4 |

Bot que vê a captura contra bot cego a ela, com captura:

| Tabuleiro | Meta | Vitórias (vê x cego) | Empates | Perdidos pelo cego |
|---|---|---|---|---|
| 11x11 | chegar | 60% x 29% | 11% | 3,7 |
| 9x9 | chegar | 33% x 22% | 45% | 3,1 |

- A captura reduz os empates em todas as combinações, mais na linha em 9x9
  (50% para 19%) e na chegada em 11x11 (44% para 24%). Em 9x9 com a meta de
  chegar quase não muda (81% para 77%): a muralha continua.
- Entre bots que veem a captura, ela quase não acontece (0,2 a 0,5 dado por
  bot por partida). O efeito vem da ameaça: o dado 4 com 3 vizinhos não
  pode ficar parado, e a muralha de dados 2 pode ser aumentada até virar
  alvo. Contra um bot cego, a captura acontece (3 a 4 dados por partida) e
  decide a partida.
- Melhor resultado: 11x11 com a linha e captura, 15% de empates, Brancas com
  48,2% das vitórias. Mas os empates restantes quase nunca têm lado cercado:
  são bots que não convertem, não muralha. A partida é longa (mediana de 195
  turnos, cerca de 100 por jogador).
- 11x11 sofre menos com a muralha que 9x9: fechar 11 casas pede 11 dos 16
  dados, e fechar 9 pede 9.

### Reserva variada e limite de captura

Também com a captura só do dado 4. 9x9, linha, captura com o limite de 8 dados, lookahead x lookahead, 100
partidas por linha. `--extra` lista os dados da reserva que não são 2.

| Reserva | Vitórias | Empates | Empates com 0, 1 ou 2 lados cercados | Brancas | Mediana de turnos | p10 | Perdidos por bot |
|---|---|---|---|---|---|---|---|
| só 2 | 40% x 41% | 19% | 0%, 14%, 5% | 43,2% | 132 | 75 | 0,4 |
| 6, 5, 4, 3 | 35% x 36% | 29% | 5%, 19%, 5% | 49,3% | 132 | 69 | 0,5 |
| 3, 3, 3, 3 | 43% x 33% | 24% | 5%, 12%, 7% | 55,3% | 142 | 67 | 0,4 |
| 6, 6 | 40% x 40% | 20% | 3%, 9%, 8% | 45% | 120 | 68 | 0,3 |
| 4, 4, 4, 4 | 46% x 39% | 15% | 4%, 9%, 2% | 48,2% | 118 | 64 | 0,5 |

- Nenhuma partida terminou pelo limite de captura: os bots perdem menos de
  um dado por partida, longe dos 8.
- A reserva variada não encurta a partida de forma clara: a mediana fica
  entre 118 e 142 turnos, e com 100 partidas a margem dos empates é de uns
  4 pontos para cada lado. 6, 5, 4, 3 empatou mais (29%); 4, 4, 4, 4, menos
  (15%), mas dentro do ruído.
- O bot mede a distância como se toda casa recebesse um dado 2: ele não
  planeja onde gastar os dados altos. Parte do efeito da reserva variada
  pode estar escondida por isso.

### Captura de todo dado de 4 ou mais

9x9, linha, limite de 8 dados, 100 partidas por linha. Captura quando uma
colocação enche um dado de valor 4 ou mais.

| Bots | Reserva | Vitórias | Empates | Empates com 0, 1 ou 2 lados cercados | Brancas | Mediana de turnos | Perdidos por bot | Fim pelo limite |
|---|---|---|---|---|---|---|---|---|
| lookahead x lookahead | só 2 | 39% x 39% | 22% | 15%, 5%, 2% | 44,9% | 158 | 1,8 | 1% |
| lookahead x lookahead | 6, 5, 4, 3 | 42% x 34% | 24% | 11%, 10%, 3% | 46,1% | 124 | 1,5 | 0% |
| lookahead x lookahead-blind | só 2 | 83% x 11% | 6% | | 51,1% | 128 | 0,2 x 5,5 | 35% |

- As capturas entre bots iguais sobem de 0,4 para 1,8 dado por bot, e os
  empates ficam onde estavam (19% a 29%, dentro do ruído). Os empates agora
  quase nunca têm lado cercado: a muralha deixou de ser o problema.
- Ver a captura decide a partida: o bot cego perde 5,5 dados e 35% das
  partidas terminam pelo limite de 8.
- Entre bots que se defendem, o limite quase não chega (1%).

### Menos dados

9x9, linha, captura de todo dado de 4 ou mais, reserva só de 2,
lookahead x lookahead, 100 partidas por linha. O limite de captura é o
número de dados menos 8.

| Dados | Limite | Vitórias | Empates | Empates com 0, 1 ou 2 lados cercados | Brancas | Mediana de turnos | p90 | Perdidos por bot | Fim pelo limite | Reserva acaba no turno |
|---|---|---|---|---|---|---|---|---|---|---|
| 12 | 4 | 56% x 36% | 8% | 6%, 2%, 0% | 54,3% | 141 | 290 | 0,9 | 5% | 41 |
| 13 | 5 | 47% x 35% | 18% | 13%, 3%, 2% | 57,3% | 168 | 300 | 1,2 | 3% | 46 |
| 14 | 6 | 41% x 42% | 17% | 8%, 8%, 1% | 48,2% | 137 | 300 | 1,3 | 0% | 52 |
| 15 | 7 | 44% x 35% | 21% | 14%, 5%, 2% | 55,7% | 150 | 300 | 1,5 | 0% | 59 |
| 16 | 8 | 39% x 39% | 22% | 15%, 5%, 2% | 44,9% | 158 | 300 | 1,8 | 1% | |

- Os empates caem com menos dados: 22% com 16, 8% com 12. Com 12, só 2%
  dos empates têm lado cercado.
- A duração quase não muda: a mediana fica entre 137 e 168 turnos. Com
  menos dados a reserva acaba antes (turno 41 com 12), e a partida segue
  tirando dados do tabuleiro.
- O limite de captura decide pouco mesmo com 12 dados (5%).
- As Brancas ficam entre 45% e 57%, sem tendência clara; com 100 partidas,
  a margem é de uns 10 pontos.

### Bot que conta os dados altos

O lookahead passou a medir a distância com o maior dado que cada lado pode
colocar (da reserva, ou do tabuleiro com ela vazia), em vez de um 2 em toda
casa; `-flat` volta ao antigo. 9x9, linha, captura de todo dado de 4 ou
mais.

| Bots | Dados | Reserva | Partidas | Vitórias | Empates | Brancas | Mediana de turnos | Fim pelo limite |
|---|---|---|---|---|---|---|---|---|
| novo x antigo | 12 | só 2 | 100 | 55% x 30% | 15% | 47,1% | 167 | 4% |
| novo x novo | 12 | só 2 | 100 | 47% x 41% | 12% | 42% | 169 | 8% |
| novo x novo | 12 | só 2 | 200 | 41% x 45,5% | 13,5% | 51,4% | 151 | 6,5% |
| novo x novo | 14 | só 2 | 200 | 42% x 40% | 18% | 48,2% | 142 | 1,5% |
| novo x novo | 12 | 6, 5, 4, 3 | 200 | 44,5% x 43,5% | 12% | 50,6% | 137 | 8% |

- O bot novo vence o antigo por 55% a 30%.
- Entre bots novos, 12 dados empatam menos que 14 (13,5% contra 18%), e a
  duração é a mesma. As Brancas ficam perto de 50%.
- A reserva 6, 5, 4, 3 com 12 dados fica igual à reserva só de 2 dentro do
  ruído (12% de empates, mediana 137).
- Um bot que lembrava as posições vistas e evitava repeti-las não mudou nada:
  aumentos e capturas não voltam atrás, e a posição quase não se repete. Os
  empates vêm de partidas lentas, não de repetição. O código foi removido.
- Bot melhor não encurta a partida: a duração tem de vir das regras.

### 11x11 com as regras atuais

Linha, captura de todo dado de 4 ou mais, limite de dados menos 10, reserva
só de 2, lookahead x lookahead (o que conta os dados altos), 100 partidas
por linha.

| Dados | Limite | Vitórias | Empates | Brancas | Mediana de turnos | p90 | Fim pelo limite | Reserva acaba no turno |
|---|---|---|---|---|---|---|---|---|
| 13 | 3 | 51% x 40% | 9% | 58,2% | 165 | 291 | 20% | 41 |
| 14 | 4 | 42% x 44% | 14% | 59,3% | 173 | 300 | 14% | 45 |
| 16 | 6 | 40% x 39% | 21% | 39,2% | 196 | 300 | 4% | 56 |

- Como em 9x9, menos dados empatam menos: 21% com 16, 9% com 13.
- Em 11x11 o limite de captura pesa: com 13 dados, 20% das partidas acabam
  nele. As duas metas, linha e captura, decidem partidas.
- A partida é um pouco mais longa que em 9x9 com 12 dados (mediana 165
  contra 151).
- As Brancas oscilam de 39% a 59%; com 100 partidas, a margem é de uns 10
  pontos.

## Outcome

Pendente.
