---
type: spec
status: draft
tags: [sia, regras, formacoes, reivindicacao]
---

# Formações

A **formação** de um lado são os 3 dados do jogador e o marco: 4 dados, mas
o marco só conta para a sequência e para o naipe.

- **Sequência:** o marco entra com o seu número, e os 4 números têm de ser
  seguidos.
- **Naipe:** o naipe do marco vale como qualquer naipe, então bastam os 3
  dados do jogador serem do mesmo naipe. O coringa também vale como qualquer
  naipe.
- **Trinca e par:** contam só os 3 dados do jogador. Um dado igual ao marco
  não faz par nem trinca.

Não existem quadra nem dois pares.

## Ordem das formações

Da mais forte para a mais fraca:

| Formação | O que é | Chance com 3 dados ao acaso |
|---|---|---|
| Sequência de naipe | 4 números seguidos com o marco, e os 3 dados do jogador do mesmo naipe | 0,35% |
| Trinca | os 3 dados do jogador com o mesmo número | 2,8% |
| Sequência | 4 números seguidos com o marco: 1 2 3 4, 2 3 4 5 ou 3 4 5 6 | 5,2% |
| Naipe | os 3 dados do jogador do mesmo naipe | 5,7% |
| Par | 2 dos 3 dados do jogador com o mesmo número | 39% |
| Soma | qualquer outra | 47% |

Cada formação conta só pela mais forte que o lado faz. Uma sequência de
naipe não é também uma sequência nem um naipe, e três dados do mesmo número
e do mesmo naipe são uma trinca, e não um naipe.

> **Detalhe:** as chances valem para um marco de número qualquer, 3 dados de
> número ao acaso e 3 dados de naipes ao acaso entre os 4 da bolsa, sem o
> coringa. A ordem segue a chance: quanto mais rara, mais forte. Como a
> trinca vale mais que o naipe, três dados iguais do mesmo naipe contam como
> trinca, e por isso o naipe sozinho tem 5,7%, e não 5,9%.

> **Playtest:** a ordem foi decidida em 2026-10-27 (a trinca subiu para
> acima da sequência e do naipe). Só playtests e lotes de bots dizem se ela
> se mantém.

## Desempate

Entre duas formações do mesmo tipo, vence a de maior **soma**: a soma dos 4
números, o marco incluído. Como o marco é o mesmo dos dois lados, é o mesmo
que comparar a soma dos 3 dados dos jogadores.

Se a soma também empata, vence o lado completado primeiro, isto é, o lado
cujo terceiro dado foi posto antes.

## Reivindicar

Só se reivindica no passo 2 do próprio turno, e só um marco que ainda não foi
tomado e cujo lado do jogador tem 3 dados. Um marco tomado fica com o jogador
até o fim do jogo.

Há dois casos.

- **Os dois lados estão completos.** O jogador toma o marco se a sua
  formação vence a do adversário.
- **O lado do adversário está incompleto.** O jogador toma o marco se a sua
  formação vence **toda** formação que o adversário ainda pode completar
  naquele lado. Para isso, cada dado que falta pode ter qualquer número de 1
  a 6 e qualquer dos 4 naipes da bolsa.

> **Detalhe:** na prova, se uma formação possível do adversário empata com a
> do jogador em tipo e soma, o jogador vence, porque o seu lado foi
> completado antes.

> **Detalhe:** quem perde um marco com os dois lados completos não pode
> tomá-lo. O vencedor pode esperar para reivindicar quando quiser, enquanto o
> marco não for tomado. Até lá, o marco ainda aceita dados de um lado
> incompleto, mas não de um lado completo.

> **Detalhe:** o coringa que o adversário ainda pode pôr não muda a prova:
> ele vale como o naipe de que o lado precisa, e a prova já supõe esse naipe
> quando os dados do lado são do mesmo.

> **Detalhe:** a prova não olha a mão do adversário nem a bolsa. Um dado que
> o adversário tem na mão não limita o que ele pode pôr.

> **Design:** os números não se esgotam, então a prova não conta dados, como
> o *Battle Line* conta cartas. Ela só olha o que cada lado pode virar.
