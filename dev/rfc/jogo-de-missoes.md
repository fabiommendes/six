---
type: rfc
status: draft
tags: [jogo-novo, design, construcao-de-reserva, mercado]
relatedTo: [dev/rfc/nomes-dos-jogos.md, dev/rfc/jogo-de-leilao-ra.md, dev/rfc/jogo-de-corrida.md, regras/kit.md]
created: 2026-10-29
creator: claude
---

# Jogo novo: missões e construção de reserva com dados

## Problem

A coleção prevê um jogo de construção de saco (`dev/rfc/nomes-dos-jogos.md`),
e a RFC do Shesh já conta com um deck builder que pede dados de faces
especiais.

A ideia do designer junta duas partes:

- **missões**: a cada rodada, uma carta decide quem pontua com os dados
  rolados. A missão padrão é fazer o maior número de repetições de um valor;
  quem vence pontua esse valor;
- **construção de reserva**: cada jogador compra dados de tipos diferentes,
  que mudam as chances de cumprir as missões.

Não há saco: cada jogador escolhe à vista os dados que vai rolar. Os dados de
ouro decidem quem escolhe a missão e quem compra primeiro.

## Proposal

### Componentes

- Os **dados**, comuns e especiais, de faces impressas (ver
  [Tipos de dado](#tipos-de-dado)).
- O **mercado**: os dados que podem ser comprados.
- As **missões**: cartas impressas, cada uma com a regra de pontuação de uma
  rodada.
- Uma trilha de pontos.

Os dados ficam sempre à vista: cada jogador tem uma **reserva** aberta, e
nenhuma escolha é feita em segredo.

### Tipos de dado

Os dados se distinguem em dois eixos:

- **constância**: quantos valores distintos o dado tem. Menos valores, mais
  repetições;
- **valor**: quanto ele pontua na missão padrão.

| Dado | Faces | Valores distintos |
|---|---|---|
| Comum | 1 2 3 4 5 6 | 6 |
| Ouro | 1 2 3 4 5 6, numa cor só dele | 6 |
| Ouro alto | 3 4 4 5 5 6, na cor do ouro | 4 |
| Um | 1 1 1 1 1 1 | 1 |
| Baixo | 1 1 2 2 3 3 | 3 |
| Alto | 4 4 5 5 6 6 | 3 |
| Par | 2 2 4 4 6 6 | 3 |
| Ímpar | 1 1 3 3 5 5 | 3 |
| Binário | 0 0 0 1 1 1 | 2 |
| Modificador | ±1 ±1 ±2 ±2 0 0 | (não tem valor) |

O ouro alto é um ouro em tudo: soma na ordem de compra e sai da missão de
quem compra.

Um **0**, no binário ou no modificador, sempre permite rolar de novo um outro
dado da mão.

> **Design:** par, ímpar, alto e baixo têm a mesma chance de repetir. Eles
> só mudam quais valores saem, e par fica perto de alto, ímpar perto de
> baixo. Medir se os quatro se justificam ou se dois bastam.

> **Proposta:** o binário é o dado do Shesh. O 1 conta como um 1.

> **Proposta:** o modificador não conta na missão. O ±1 e o ±2 movem o
> valor de um outro dado seu, para cima ou para baixo, à escolha do
> jogador, sem passar de 6 nem baixar de 1.

### Preparação

1. Cada jogador começa com uma reserva de 5 dados comuns e 1 de ouro, e com
   0 pontos.
2. Embaralhe as cartas de missão e revele uma por jogador: é a **mesa de
   missões**. A missão padrão está sempre na mesa, fora do baralho.

O **mercado** tem 6 dados um, 4 de cada outro tipo especial (baixo, alto,
par, ímpar, binário e modificador), 8 ouros e 4 ouros altos. A **vitrine** são os
dados do mercado à venda: no início de cada rodada, ela é completada até ter
2 dados por jogador.

> **Proposta:** a vitrine guarda os dados que ninguém comprou e só é
> completada. A outra leitura é trocá-la inteira a cada rodada.

### Rodada

1. **Escolher os dados**: cada jogador separa 6 dados da sua reserva, todos
   ao mesmo tempo. Os outros ficam de fora nesta rodada.
2. **Rolar**: todos rolam os seus 6 dados.
3. **Dinheiro**: o dinheiro de cada jogador é a soma dos seus ouros
   rolados, mais 1 por dado da reserva fora da mão que ele tira do jogo
   agora. Todos decidem quais dados tirar antes de qualquer um tirar.
4. **Ordem**: a ordem da rodada vai do maior dinheiro ao menor. No empate,
   os empatados rolam um dado comum, e o maior vai na frente.
5. **Comprar**: na ordem, cada jogador com dinheiro maior que 0 pode
   comprar um dado da vitrine. Ele rola o dado comprado, que entra na mão
   desta rodada e depois fica na sua reserva. Quem compra tira da missão
   todos os seus ouros; quem não compra usa os seus ouros como dados comuns.
6. **Marcar**: na ordem, cada jogador põe o seu marcador numa missão da
   mesa, a padrão ou uma carta. Mais de um jogador pode ficar na mesma.
7. **Jogar**: na ordem, em voltas, cada jogador faz uma ação por vez:
   - **sacrificar**: tira um dado da mão e rola de novo, de uma vez, quantos
     quiser dos outros;
   - **usar um 0** ou **um modificador** (ver abaixo);
   - **sabotar**: paga 2 pontos com 2 jogadores, ou 1 com 3 ou 4, e remove
     uma carta da mesa. Quem tinha marcador nela o põe em outra missão da
     mesa. A padrão nunca é sabotada;
   - **passar**: sai da fase até o fim da rodada.

   A fase acaba quando todos passaram.
8. **Pontuar**: cada missão é disputada só entre os jogadores que têm
   marcador nela. Vencem todos os que têm o melhor resultado ali, e cada um
   ganha pontos iguais ao seu resultado. Quem fica sozinho numa missão vence
   nela com qualquer resultado maior que 0.
9. **Limpar**: todos os dados voltam à reserva do dono. As cartas
   sabotadas vão para o descarte, e a mesa é reposta com cartas do baralho;
   quando o baralho acaba, o descarte é embaralhado.

> **Design:** os ouros dão a ordem: quem vai na frente compra primeiro e
> marca primeiro, mas também age primeiro e mostra o jogo a quem vem
> depois. Comprar custa os ouros da rodada; o dado comprado, que entra na
> mão, repõe em parte o que eles deixam de dar.

> **Proposta:** as cartas que não foram sabotadas ficam na mesa para a
> rodada seguinte.

> **Detalhe:** um ouro comprado entra na mão, mas também não conta: é um
> ouro de quem comprou.

> **Detalhe:** o ouro não é gasto. Depois da compra, ele volta à reserva
> como os outros dados.

### Zeros e modificadores

- Cada 0, de um binário ou de um modificador, rola de novo um outro dado seu
  que conta na missão. O dado rolado de novo não dá outra ação, mesmo que
  caia em 0.
- Cada modificador em ±1 ou ±2 move o valor de um outro dado seu que conta
  na missão, para cima ou para baixo, à escolha do jogador, sem passar de 6
  nem baixar de 1.
- Um 0, um modificador, um dado sacrificado e um ouro tirado pela compra
  não contam na missão.

### Missões

Toda missão pontua por número de dados, não pelo valor deles. A **padrão**
conta quantas vezes se repete o valor que mais se repete na mão.

As cartas pontuam melhor que a padrão em certas mãos:

| Missão | Resultado |
|---|---|
| Presente | O da padrão mais 1: um dado a mais com o valor que o jogador quiser |
| Sequência | O tamanho da maior sequência de valores seguidos |
| Pares | O da padrão, contando só os valores pares, mais o bônus |
| Ímpares | O da padrão, contando só os valores ímpares, mais o bônus |
| Alta | O da padrão, contando só 4, 5 e 6, mais o bônus |
| Baixa | O da padrão, contando só 1, 2 e 3, mais o bônus |
| Dois grupos | Os dois maiores grupos de valores iguais somados; o segundo conta a partir de 2 dados |

> **Proposta:** bônus de 1. Alta, Baixa e Dois grupos foram propostas no
> protótipo, sem pedido do designer, para o baralho ter cartas bastantes
> para 4 jogadores.

> **Proposta:** a Exclusão sai do baralho: ela mexia nos dados da mesa toda
> e não cabe na disputa por carta.

### Fim do jogo

Ao fim de uma rodada em que alguém chegou à meta de pontos, vence quem tem
mais pontos. No empate, vence quem tem mais dados na reserva; se ainda
empatar, a vitória é dividida.

> **Playtest:** meta de 30 pontos, umas 10 rodadas, para uma partida de uns
> 40 minutos.

## Alternatives

- **Saco por jogador**, tirando N dados por rodada: descartado. Cada jogador
  escolhe os 6 dados que rola, e o jogo dispensa os sacos.
- **Prioridade da compra decide a missão**: o primeiro da ordem dos ouros
  escolhe a missão. Substituído por um leilão separado, em pontos.
- **Lance da missão com dados da rolagem**: o lance seria o número de dados
  tirados da missão. Substituído por pontos.
- **Leilão em pontos pela missão** (versões de 2026-10-29): uma volta de
  lances em pontos, e quem vence escolhe a missão de todos. Substituído pela
  fase das missões com marcadores. As medições dele estão abaixo.
- **Lance em segredo**, com o jogador escolhendo quais ouros entram:
  descartado, porque os dados devem estar sempre à vista para evitar
  manipulação.
- **Dinheiro gasto**: a soma dos dados de ouro paga o preço de cada dado.
  Substituído pelo ouro que só define a ordem.
- **Missão escolhida antes de rolar**: o lance seria uma aposta. Substituído
  pela escolha depois de rolar, que é mais tática.
- **Cada jogador com a sua missão**: descartado, porque a missão comum põe
  todos na mesma disputa.
- **Dados especiais como dados comuns de uma cor, com uma tabela de
  leitura**: cabem no kit atual, mas são ruins de ler na mesa.
- **Missões numa tabela do manual, sorteadas com dados**: descartado; as
  missões são cartas impressas.

## Decisions

- 2026-10-29, designer: 2 a 4 jogadores; uma missão por rodada, a mesma para
  todos, escolhida depois da rolagem entre algumas reveladas; uma cor de
  dado é o dinheiro, e o valor dele não é gasto, só define a ordem de
  prioridade, com sorteio no empate; os dados especiais têm faces impressas.
- 2026-10-29, designer: os dados ficam sempre à vista. A maior soma dos
  ouros dá a prioridade, e quem tem prioridade pode trocar um ouro por um
  dado do mercado; se comprar, os seus ouros saem da missão, e se não
  comprar, eles valem como dados normais. As missões são cartas impressas;
  não há sacos. A partida vai até uma meta de pontos. Na missão padrão,
  todos os empatados no maior número de repetições vencem, cada um com o seu
  valor. Cada jogador escolhe 6 dados da sua reserva e rola só esses.
- 2026-10-29, designer: o ouro não é gasto na compra; volta à reserva, mas
  não conta na missão da rodada. Todos podem comprar, na ordem, um dado cada.
  A missão tem um leilão separado, com lances em pontos. O ouro tem faces
  comuns. O protótipo se chama `missoes` até o jogo ter nome.
- 2026-10-29, designer: o modificador tem as faces +1 +1 −1 −1 0 0, e o 0
  de qualquer dado rola de novo outro dado da mão. Sacrifício: a qualquer
  hora, um dado sai da mão desta rodada, e o jogador rola de novo, de uma
  vez, quantos quiser dos outros. Reserva inicial de 5 comuns e 1 ouro.
- 2026-10-29, designer: o dado comprado é rolado e entra na missão da
  rodada. Ouro alto (3 4 4 5 5 6). Mercado de 4 dados de cada tipo, 8 ouros
  e 4 ouros altos; a vitrine tem 2 dados por jogador e é reposta no início
  de cada rodada.
- 2026-10-29, designer: a Negativa sai, porque não funciona com as
  rolagens de novo. Entram Pares e Ímpares. Testar a pontuação pelo número
  de repetições, sem o valor. (A Contagem saiu do baralho do protótipo por
  ser quase nunca escolhida, e porque é a padrão pontuada pelo número.)
- 2026-10-29, designer: a Exclusão não vale para quem a escolheu. Testar a
  meta de 15 pontos; a partida deve durar uns 40 minutos.
- 2026-10-29, designer: sai o leilão em pontos pela missão. Depois da
  compra vem a fase das missões: há uma carta por jogador, mais a padrão,
  que nunca sai. Cada jogador põe um marcador numa missão e, na ordem, pode
  sacrificar um dado para rolar de novo, sabotar uma missão ou passar, e
  quem passa sai da fase. Sabotar custa 1 ponto ou um dado da reserva, tirado
  do jogo; remove a carta, e quem estava nela escolhe outra missão da mesa.
  A missão é disputada só entre os jogadores que estão nela. As cartas
  sabotadas são repostas no fim da rodada. As missões devem pontuar melhor
  que a padrão.
- 2026-10-29, designer: meta de 30. Sabotar com dado tira do jogo um dado
  da mão. Na fase de mercado, cada dado da reserva fora da mão tirado do
  jogo soma 1 ao dinheiro, e qualquer dinheiro dá direito a comprar.
- 2026-10-29, designer: testar a sabotagem paga só com 1 ponto.
- 2026-10-30, designer: no empate em pontos no fim, vence quem tem mais
  dados na reserva. Testar o modificador com ±1 ±1 ±2 ±2 0 0, com o sentido
  à escolha do jogador, e medir se juntar dados um compensa. O mercado
  passa a ter 6 dados um: o um combina com o baixo, o ímpar e o 1 do
  binário, e o combo pode ser montado aos poucos. Sabotar custa 2 pontos
  com 2 jogadores e 1 com 3 ou 4.

## Open questions

- **Kit**: entram cartas de missão, dados de faces impressas e uma trilha de
  pontos. As cartas e os dados especiais mudam o kit e afetam os outros
  jogos. A trilha de pontos pode ser a borda do tabuleiro do Seks.
- **A reserva só cresce**: sem saco, um dado novo nunca piora a reserva, só
  dá mais opções. Medir se a reserva inicial e o limite de 6 dados bastam
  para a compra pesar.
- **O ouro domina o comum**: as faces são as mesmas, e quem não compra usa o
  ouro como dado comum. Levar todos os ouros para a rolagem nunca é pior,
  e o comum só serve até o jogador ter ouros e especiais suficientes.
- **O líder controla as missões**: só quem tem pontos dá lance. Medir se o
  leilão aumenta a vantagem de quem está na frente.
- **Nome**: *Sechs* era o candidato do jogo de saco em
  `dev/rfc/nomes-dos-jogos.md`, e o jogo não tem mais saco.

## Medições

Protótipo em `digital/missoes/` (`missoes-engine` e `missoes-bots`), com as
regras desta RFC. Bots:

- **aleatório**;
- **guloso**: escolhe os 6 dados por uma estimativa de Monte Carlo da missão
  padrão contra 6 dados comuns, e todo o resto pela margem na rodada (os
  seus pontos menos os do melhor adversário). Dá lance até metade do que a
  melhor missão vale a mais que a padrão; compra quando o ganho estimado do
  dado, vezes as rodadas que faltam, passa o que perde na rodada;
- **sem compra** e **sem lance**: o guloso que nunca compra ou nunca dá
  lance.

Lotes de 2.000 sementes, cada uma em todos os assentos
(`just missoes-batch greedy,greedy --games 2000`), em 2026-10-29.

| Partida | Meta | Negativa | Vitória do 1º bot | Rodadas (média, p90) | Líder na metade vence |
|---|---|---|---|---|---|
| guloso × guloso | 30 | sim | 50% | 29,9, 52 | 86% |
| guloso × guloso | 30 | não | 50% | 16,4, 22 | 79% |
| guloso × guloso | 20 | sim | 50% | 15,5, 28 | 87% |
| guloso × guloso | 20 | não | 50% | 10,0, 14 | 82% |
| guloso × sem compra | 30 | sim | 77% | 26,8, 47 | 89% |
| guloso × sem compra | 20 | não | 64% | 10,0, 14 | 83% |
| guloso × sem lance | 30 | sim | 89% | 14,5, 21 | 86% |
| guloso × sem lance | 20 | não | 87% | 7,5, 10 | 84% |
| guloso × aleatório | 20 | não | 98,5% | 7,2, 9 | 90% |
| 4 gulosos | 30 | sim | 25% | 39,4, 63 | 63% |
| 4 gulosos | 20 | não | 25% | 12,7, 18 | 59% |

- **A Negativa dobra a partida**: o vencedor do leilão a escolhe para tirar
  pontos de quem está na frente (17% das rodadas, −5,6 pontos por rodada).
  Com ela, a partida de 2 jogadores e meta 30 tem 30 rodadas em média, e 1
  em 10 passa de 52.
- **O leilão pesa mais que os dados**: o guloso vence o sem lance em 87% a
  89%. Há lance em 80% das rodadas, a 2,5 a 2,9 pontos. Só 15% a 20% das
  rodadas ficam com a missão padrão.
- **A compra pesa, mas é rara**: o guloso vence o sem compra em 64% a 77%,
  com só 2 a 3 compras por partida. Comprar tira os ouros da missão, e o
  guloso quase só compra quando os ouros não mudam o resultado da rodada.
- **Os dados baixos não saem do mercado**: o guloso compra ouro, alto, par e
  modificador; quase nunca ímpar e binário, e nunca um nem baixo. Parte disso
  é o bot, que avalia os dados pela missão padrão; mas nas missões o valor
  conta quase sempre a favor do dado alto.
- **Contagem quase nunca é escolhida** (1% das rodadas): ela pontua 2 ou 3,
  menos que qualquer outra missão.
- **O primeiro abridor não tem vantagem**: vence 49% a 50% com 2 jogadores e
  24% a 25% com 4. Empates em 1% a 2% das partidas.

### Sacrifício, compra que joga e mercado novo

Regras de 2026-10-29: sacrifício, modificador com 0, reserva de 5 comuns e
1 ouro, dado comprado na mão, ouro alto, vitrine de 2 dados por jogador.
Meta de 30. O guloso só sacrifica depois das compras, quando conhece a
missão. Lotes de 1.000 sementes com 2 jogadores, 300 com 3 e 200 com 4.

| Partida | Negativa | Vitória do 1º bot | Rodadas (média, p90) | Compras por bot | Sacrifícios por bot |
|---|---|---|---|---|---|
| guloso × guloso | sim | 50% | 24,4, 39 | 9,8 | 56 |
| guloso × guloso | não | 50% | 15,7, 23 | 5,9 | 34 |
| guloso × guloso, comprado espera | não | 50% | 15,8, 22 | 3,1 | 32 |
| guloso × sem compra | não | 70% | 15,4, 21 | 6,1 | 32 |
| guloso × sem lance | não | 48% | 11,5, 15 | 3,5 | 22 |
| guloso × sem sacrifício | não | 99,9% | 10,4, 14 | 3,9 | 13 |
| 3 gulosos | não | 33% | 17,9, 24 | 6,2 | 39 |
| 4 gulosos | não | 25% | 19,3, 27 | 6,2 | 41 |

- **O sacrifício domina**: sem ele, o guloso perde 99,9% das partidas. Ele
  é quase de graça: um dado fora do grupo que vence não vale nada na
  missão padrão. Cada jogador sacrifica uns 2 dados por rodada, e o grupo
  vencedor da missão padrão passa de 3 para 4 repetições (com 4 jogadores,
  4 ou 5).
- **A compra que entra na mão dobra as compras** (5,9 contra 3,1 por
  partida) e espalha os tipos: um, baixo, ímpar e binário passam a sair.
  Comprar vale 70% contra o bot que nunca compra.
- **O leilão quase não vale**: o bot que nunca dá lance vence 52%. O
  sacrifício depois da escolha corrige quase qualquer missão, e o lance de
  2,7 pontos não se paga. Parte disso é o bot, que dá lance sem prever os
  sacrifícios.
- **A Negativa vira anti-jogo**: os jogadores sacrificam dados para não
  vencê-la (−0,6 ponto por rodada), e a partida alonga de 16 para 24
  rodadas.
- **Quem abre o primeiro leilão perde um pouco com 3 e 4 jogadores** (28% e
  18,5%, contra 33% e 25%). O erro padrão é de 1,5 ponto: a diferença
  parece real, mas pede lotes maiores.

### Pares, Ímpares e pontuação pelo número de repetições

Baralho sem Negativa e sem Contagem, com Pares e Ímpares. Pelo número de
repetições (`--by-count`), a Menor sai do baralho. Lotes de 1.000 sementes
com 2 jogadores e 200 com 4.

| Pontuação | Meta | Partida | Vitória do 1º bot | Rodadas (média, p90) | Compras por bot |
|---|---|---|---|---|---|
| valor | 30 | guloso × guloso | 50% | 15,4, 21 | 5,9 |
| valor | 30 | guloso × sem compra | 73% | 14,8, 21 | 5,9 |
| valor | 30 | guloso × sem lance | 46% | 11,3, 15 | 3,4 |
| valor | 30 | 4 gulosos | 25% | 19,4, 27 | 6,4 |
| repetições | 30 | guloso × guloso | 50% | 19,6, 26 | 7,5 |
| repetições | 30 | guloso × sem compra | 67% | 19,3, 25 | 7,3 |
| repetições | 30 | guloso × sem lance | 69% | 13,9, 17 | 4,5 |
| repetições | 30 | 4 gulosos | 25% | 21,3, 28 | 7,9 |
| repetições | 20 | guloso × guloso | 50% | 11,6, 16 | 5,4 |
| repetições | 20 | guloso × sem compra | 67,5% | 11,7, 16 | 5,5 |
| repetições | 20 | guloso × sem lance | 64% | 8,8, 12 | 3,3 |
| repetições | 20 | 4 gulosos | 25% | 12,1, 17 | 6,2 |

- **Pelo número de repetições, o leilão volta a valer**: o guloso vence o
  sem lance em 64% a 69%, contra 46% pela pontuação por valor. O preço cai
  de 2,8 para 2,0 pontos, num jogo em que a rodada rende menos.
- **Pelo número, todo tipo de dado sai do mercado**: um, baixo, ímpar e
  alto são comprados quase na mesma quantidade (0,7 a 0,9 por partida com
  2 jogadores). Pelo valor, o guloso ainda prefere alto e par.
- **A Exclusão rende pouco**: 1,7 ponto por rodada pelo número, contra 4 a 5
  das outras. Ela tira o valor mais repetido da mesa, que quase sempre é o
  do vencedor.
- **Pares e Ímpares** são escolhidas em 9% a 14% das rodadas, como as
  outras cartas.
- **Meta 20 pelo número de repetições**: 11,6 rodadas com 2 jogadores e 12,1
  com 4, com p90 de 16 e 17.
- **Quem abre o primeiro leilão** vence 23,8% e 25,5% com 4 jogadores: a
  desvantagem medida antes (18,5%) era ruído.

### Meta de 15 e a Exclusão que poupa quem a escolhe

Pontuação pelo número de repetições, baralho com Presente, Exclusão,
Sequência, Pares e Ímpares. "Vantagem de quem escolhe": os pontos de quem
venceu o leilão menos os do melhor adversário, na média das rodadas em que
a missão foi escolhida (sem descontar o lance).

| Meta | Partida | Vitória do 1º bot | Rodadas (média, p90) | Abridor vence |
|---|---|---|---|---|
| 15 | guloso × guloso | 50% | 7,4, 10 | 50,2% |
| 15 | guloso × sem compra | 69% | 7,6, 11 | |
| 15 | guloso × sem lance | 68% | 6,1, 8 | |
| 15 | 3 gulosos | 33% | 7,7, 11 | 36,8% |
| 15 | 4 gulosos | 25% | 7,8, 11 | 30,4% |
| 20 | 4 gulosos | 25% | 11,4, 16 | 25,7% |

| Missão | Vantagem, 2 jogadores | Vantagem, 4 jogadores |
|---|---|---|
| Exclusão, poupando quem escolhe | +2,8 | +1,9 |
| Exclusão para todos | +0,0 | |
| Sequência | +2,2 | +1,0 |
| Presente | +1,9 | +0,6 |
| Pares | +1,1 | −0,4 |
| Ímpares | +0,9 | +0,0 |

- **Meta 15 dá umas 7,5 rodadas** com 2, 3 ou 4 jogadores; meta 20, umas
  11,5. O número de rodadas quase não muda com o número de jogadores, mas
  a rodada com 4 jogadores leva mais tempo na mesa.
- **A Exclusão que poupa quem a escolhe virou a carta mais forte**: +2,8
  pontos de vantagem, contra nada na versão para todos.
- **Pares e Ímpares quase não ajudam quem escolhe**, e com 4 jogadores nada.
  Os bots as escolhem para negar uma missão melhor a outro, ou por falta de
  opção.
- **Com meta 15, quem abre o primeiro leilão pode ter vantagem com 3 e 4
  jogadores** (36,8% e 30,4%, contra 33% e 25%; erro padrão de 1,6 ponto).
  Com meta 20 não aparece. Pede lotes maiores.
- Com meta 15, quem lidera na metade da partida vence 81% com 2 jogadores e
  65% com 4.

### Fase das missões com marcadores

Regras de 2026-10-29, com a fase das missões no lugar do leilão em pontos.
O guloso marca a missão de maior margem na hora, sabota quando a margem
ganha passa o custo (1 ponto, ou a perda estimada da reserva sem o dado) e
passa quando nenhuma ação melhora a margem. Bots novos: **sem sabotagem** e
**sem sacrifício**. Lotes de 1.000 sementes com 2 jogadores e 200 com 4.

| Meta | Partida | Vitória do 1º bot | Rodadas (média, p90) | Sabotagens por bot (ponto + dado) |
|---|---|---|---|---|
| 15 | guloso × guloso | 50% | 4,7, 6 | 0,6 + 1,7 |
| 15 | guloso × sem compra | 71% | 4,8, 6 | |
| 15 | guloso × sem sabotagem | 68% | 4,2, 5 | |
| 15 | guloso × sem sacrifício | 94% | 4,6, 6 | |
| 15 | 4 gulosos | 25% | 4,2, 5 | 0,3 + 1,5 |
| 30 | guloso × guloso | 50% | 9,8, 12 | 1,4 + 3,5 |
| 30 | guloso × sem compra | 61% | 10,1, 12 | |
| 30 | guloso × sem sabotagem | 74% | 8,4, 10 | |
| 30 | 4 gulosos | 25% | 8,6, 10 | 0,7 + 3,3 |

Pontos por marcador, meta 30:

| Missão | 2 jogadores | 4 jogadores |
|---|---|---|
| Padrão | 2,5 (66% dos marcadores) | 2,1 (43%) |
| Presente | 3,5 | 3,4 |
| Sequência | 3,4 | 3,3 |
| Pares, Ímpares, Alta, Baixa | 3,5 a 3,7 | 3,4 a 3,6 |
| Dois grupos | 4,0 | 4,0 |

- **A partida encurtou pela metade**: cada jogador pontua quase toda rodada,
  na sua missão, e não só o vencedor da padrão. Com meta 15 são 4 a 5
  rodadas; com meta 30, umas 9 a 10, com 2 ou 4 jogadores.
- **As cartas pontuam mais que a padrão**, como o designer quer: 3,4 a 4,0
  por marcador, contra 2,1 a 2,5. Dois grupos é a mais forte.
- **A padrão fica cheia**: com 2 jogadores, 66% dos marcadores terminam
  nela, porque cada um sabota a carta do outro, que volta para a padrão e
  divide a disputa.
- **Sabotar quase sempre se paga com um dado**: um dado da reserva fora da
  mão é, por definição, um dos piores, e tirá-lo quase não enfraquece a
  reserva. A sabotagem sai quase de graça depois que a reserva passa de 6
  dados.
- **Sabotar vale** 68% a 74% contra quem nunca sabota, **comprar** 61% a 71%,
  e **sacrificar** 94%.
- Empates sobem para 2% a 9% das partidas, mais com 4 jogadores.

### Dinheiro da reserva e sabotagem com dado da mão

Meta 30. Sabotar com dado tira um dado da mão; cada dado da reserva fora da
mão tirado do jogo soma 1 ao dinheiro. O guloso só troca por dinheiro dados
que quase não fazem falta, quantos bastem para comprar ou passar o ouro dos
outros.

| Partida | Vitória do 1º bot | Rodadas (média, p90) | Sabotagens por bot (ponto + dado) | Dados trocados por dinheiro |
|---|---|---|---|---|
| guloso × guloso | 50% | 10,1, 12 | 1,8 + 3,2 | 1,3 |
| guloso × guloso, sem dinheiro da reserva | 50% | 10,2, 12 | 1,5 + 4,0 | |
| guloso × sem compra | 48% | 10,3, 12 | | |
| guloso × sem sabotagem | 69% | 8,4, 10 | | |
| guloso × sem sacrifício | 93,5% | 9,5, 11 | | |
| 3 gulosos | 33% | 9,2, 11 | 1,2 + 3,0 | 1,6 |
| 4 gulosos | 25% | 8,4, 10 | 0,8 + 2,8 | 1,7 |

- **A sabotagem continua forte**: 5 por jogador numa partida de 2, e 69%
  contra quem nunca sabota. O dado da mão que paga é quase sempre um que
  está fora do grupo que pontua, e esse dado não vale nada na rodada; a
  perda para as rodadas seguintes é pequena enquanto a reserva tem dados
  comuns.
- **O dinheiro da reserva quase não é usado**: 1,3 a 1,7 dado por partida,
  sem efeito medível (os lotes com e sem ele quase não mudam).
- **A compra deixou de valer para o guloso**: 48% contra quem nunca compra,
  contra 61% antes desta mudança. O guloso paga sabotagens com os dados que
  comprou. Pode ser um defeito do bot, não da regra.
- **O modificador quase nunca é comprado** (0,01 por partida): com a
  pontuação por repetições e o sacrifício, mover um dado em 1 vale menos que
  rolar de novo.
- **A padrão continua cheia** com 2 jogadores (67% dos marcadores), e a
  Sequência é a carta menos escolhida (2% dos marcadores).

### Sabotagem só com ponto e o defeito do ouro no bot

Meta 30, sabotagem paga só com 1 ponto.

**Defeito do bot**: o guloso dava ao ouro um bônus de 0,2 ao escolher os
dados e ao avaliar as compras. Com ele, o bot levava ouros para a mão no
lugar de dados especiais e comprava ouros (1,3 a 1,5 por partida), que têm
as faces do comum e saem da missão de quem compra. Com sabotagem só por
ponto, o guloso perdia para o bot sem compra (40%); sem o bônus, vence 81%.
Todas as medições anteriores usavam o bônus: a falta de valor da compra que
elas mostram em alguns lotes vem em parte desse defeito. O bônus agora é 0.

| Partida | Vitória do 1º bot | Rodadas (média, p90) | Compras por bot | Sabotagens por bot | Dados trocados por dinheiro |
|---|---|---|---|---|---|
| guloso × guloso | 50% | 9,3, 11 | 3,0 | 2,6 | 2,2 |
| guloso × guloso, sem dinheiro da reserva | 50% | 9,5, 11 | 1,9 | 2,6 | |
| guloso × sem compra | 81% | 9,1, 11 | 3,5 | | |
| guloso × sem sabotagem | 66% | 8,2, 9 | | 1,9 | |
| guloso × sem sacrifício | 97% | 8,5, 10 | | | |
| 3 gulosos | 33% | 8,0, 9 | 3,1 | 1,6 | 2,4 |
| 4 gulosos | 25% | 7,6, 9 | 3,1 | 1,5 | 2,5 |

- **Comprar volta a valer muito** (81% contra quem nunca compra), e os
  dados comprados se espalham por todos os tipos especiais, menos o
  modificador, que nunca é comprado, e o ouro comum (0,1 por partida).
- **O dinheiro da reserva aumenta as compras** de 1,9 para 3,0 por partida.
- **Sabotar ainda vale** (66% contra quem nunca sabota), com 1,5 a 2,6
  sabotagens por jogador numa partida.
- **A padrão esvazia**: 45% dos marcadores com 2 jogadores, 16% com 4.
  Dois grupos continua a carta mais forte (4,1 por marcador).
- **Empates crescem com o número de jogadores**: 4% com 2, 9% com 3 e 12,5%
  com 4. Com o desempate pela reserva maior, sobram 5,2% com 4 (1600
  partidas entre gulosos).

### Modificador com ±2 e o acúmulo de dados um

Regras de 2026-10-30: modificador ±1 ±1 ±2 ±2 0 0 com sentido à escolha,
desempate pela reserva maior. Antes do lote, três defeitos do guloso foram
corrigidos na jogada rápida que avalia uma mão:

- Ela sacrificava o primeiro dado fora do grupo e rolava de novo dados que
  não podiam cair no valor buscado (um um, buscando 5). A força da mesma mão
  mudava com a ordem dos dados: 5 comuns e um um valiam 1,86 ou 2,45. Agora
  sacrifica o dado com menos chance de cair no valor e só rola de novo os
  que podem.
- Ela tirava da mão os dados que não contam (o modificador e o 0) antes dos
  sacrifícios. Mas qualquer dado da mão pode ser sacrificado, e esses são o
  sacrifício mais barato. Isso derrubava o modificador e o binário.
- Com 128 amostras, o erro da força é de uns ±0,08, do tamanho das
  diferenças entre os dados. As compras ainda usam 128 amostras; a tabela
  abaixo usa 20 mil.

Força na padrão, por simulação: pontos esperados contra 6 comuns, com zeros,
modificadores e sacrifícios, trocando comuns pelo dado (entre parênteses, o
tamanho médio do grupo):

| Dado | 1 trocado | 2 trocados |
|---|---|---|
| Comum, ouro (6 comuns) | 2,32 (3,10) | 2,32 (3,10) |
| Ouro alto | 2,45 (3,17) | 2,61 (3,27) |
| Um | 2,32 (3,10) | 2,65 (3,30) |
| Baixo, alto, par, ímpar | 2,48 a 2,50 (3,20) | 2,68 a 2,70 (3,31) |
| Binário | 2,39 (3,14) | 2,56 (3,24) |
| Modificador | 2,59 (3,26) | 2,28 (3,07) |

Com mais dados um: 3,50 com 3, 4,40 com 4, 5,17 com 5 e 6 com 6.

- **Um modificador é o melhor dado da mão; dois pioram.** Ele move um dado
  para o grupo e depois serve de sacrifício.
- **Todos os especiais são comprados**, de 0,4 a 0,6 por partida cada; só o
  ouro comum fica de fora (0,06).
- **O um cresce como o designer esperava**: igual ao comum sozinho, entre os
  melhores com 2 e muito forte a partir de 3. Mas o mercado limita: um
  guloso com bônus na compra do um (`greedy-u20`) junta só 0,9 por partida
  com 2 jogadores e 1,6 com 4, e vence 52,9% contra o guloso com 2
  jogadores e 28,9% com 4 (25% seria o empate).
- **Comprar vale mais com a avaliação corrigida**: o guloso vence 90%
  contra quem nunca compra (era 81%), com 4,5 compras por partida.
- Duração: 8,7 a 9,0 rodadas com 2 jogadores, 7,3 com 4. Empates: 0,9% a
  2,3% com 2 jogadores, 3,8% com 4.

Com 6 dados um no mercado:

- **Juntar uns passa a compensar com 4 jogadores**: o guloso com bônus na
  compra do um junta 2,2 por partida, e mais binários (0,9), e vence 34,2%
  (25% seria o empate). Com 2 jogadores, junta 1,4 e vence 54,9%.
- O guloso comum compra 0,8 um por partida (era 0,5); o resto pouco muda.
  Comprar ainda vale 88,7% contra quem nunca compra.

Com 512 amostras na força das mãos (`-s512`), no lugar de 128: o guloso de
512 vence 52,3% contra o de 128, e as compras por tipo mudam menos de 0,05
por partida. O lote fica 2 a 4 vezes mais lento; 128 continua o padrão.

Com a sabotagem a 2 pontos com 2 jogadores:

- **Sabota-se menos da metade**: 1,15 sabotagem por jogador numa partida
  (eram 2,5). A partida encurta de 8,9 para 8,3 rodadas, porque se perdem
  menos pontos.
- **Sabotar ainda vale, mas pouco**: 56,3% contra quem nunca sabota (era
  66% com 1 ponto).
- Comprar vale 87,8% contra quem nunca compra; empates em 1,8%.

## Outcome

(aberto)
