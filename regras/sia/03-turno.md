---
type: spec
status: draft
tags: [sia, regras, turno]
---

# Turno

Os jogadores alternam turnos. Cada turno tem quatro passos, sempre nesta
ordem.

## 1. Rolar de novo (opcional)

O jogador escolhe uma **mão**, a sua ou a do adversário, e rola de novo
quantos dados dela quiser, os que escolher, menos o coringa do adversário.

Antes de rolar, o jogador **perde para sempre** um dado da própria mão,
escolhido por ele. O dado volta para a bolsa (o coringa é a exceção, ver
[01-componentes.md](01-componentes.md#o-coringa)), e a mão dele passa a ter
um dado a menos até o fim da partida.

- O jogador que tem só 1 dado na mão não pode rolar de novo, nem a mão do
  adversário.
- O dado perdido sai antes da rolagem. Se o jogador rola a própria mão, o
  dado perdido não está entre os que podem ser rolados.
- A mão do adversário pode ser rolada mesmo que ele tenha só 1 dado, desde
  que esse dado não seja o coringa.
- Quem rola a mão do adversário escolhe quais dados dela rolar, exceto o
  coringa, que ele não pode rolar.
- O dado perdido pode ser o próprio coringa. Rolado de novo, o coringa
  continua coringa e só muda de número.

> **Proposta:** só se pode rolar de novo uma vez por turno.

> **Design:** rolar de novo custa mais a cada vez, porque a mão fica menor
> para sempre. Rolar a mão do adversário desfaz uma formação que ele
> montava, e por isso também é um ataque.

## 2. Reivindicar (opcional)

O jogador toma os marcos que pode provar seus, um a um, como em
[04-formacoes.md](04-formacoes.md#reivindicar). Se tomar o quinto marco, ou
o terceiro vizinho, o jogo acaba na hora.

## 3. Pôr um dado

O jogador põe um dado da sua mão do seu lado de um marco que ainda não foi
tomado e em que o seu lado tenha menos de 3 dados. O dado guarda o número que
mostra e não se move mais.

O passo é obrigatório, se houver lugar.

> **Proposta:** se o jogador não tem lugar para pôr um dado (todos os marcos
> não tomados têm 3 dados do seu lado), ele pula este passo. Os outros passos
> do turno acontecem normalmente.

> **Detalhe:** o terceiro dado de um lado completa o lado. A ordem em que os
> lados se completam desempata formações iguais.

## 4. Repor

O jogador tira dados da bolsa, rola cada um e os põe na mão, até ter 6 dados
menos os que perdeu na partida. Se já tem esse número, não tira nenhum.

> **Detalhe:** com 0 dados perdidos, a mão volta a 6 depois de pôr um dado.
> Com 2 perdidos, a mão volta a 4, e assim por diante.

> **Detalhe:** a bolsa só tem os 4 naipes, então a reposição nunca devolve
> um coringa. Quem pôs ou perdeu o coringa repõe só com dados da bolsa.

Depois do passo 4, confere-se se o jogo acabou por falta de lugar (ver
[05-fim-do-jogo.md](05-fim-do-jogo.md#falta-de-lugar)).
