---
type: spec
status: draft
tags: [sia, regras, formacoes, reivindicacao]
---

# Formações

A **formação** de um lado são os 3 dados do jogador e o marco: 4 dados. O
marco entra com o seu número, e o seu naipe vale como qualquer naipe. Por
isso, para fazer a formação de naipe bastam os 3 dados do jogador serem do
mesmo naipe.

## Ordem das formações

Da mais forte para a mais fraca:

| Formação | O que é |
|---|---|
| Sequência de naipe | 4 números seguidos, com os 3 dados do jogador do mesmo naipe |
| Quadra | 4 números iguais |
| Sequência | 4 números seguidos: 1 2 3 4, 2 3 4 5 ou 3 4 5 6 |
| Naipe | os 3 dados do jogador do mesmo naipe |
| Dois pares | dois números, dois dados de cada |
| Trinca | 3 números iguais |
| Par | 2 números iguais |
| Soma | qualquer outra |

Cada formação conta só pela mais forte que os 4 dados fazem. Uma quadra não
é também uma trinca, e uma sequência de naipe não é também um naipe.

> **Detalhe:** com 4 números iguais, a formação é a quadra, e não dois pares.
> A trinca é 3 números iguais com o quarto diferente. O par é 2 números
> iguais com os outros dois diferentes entre si e do par.

> **Playtest:** a ordem segue a raridade com dados ao acaso, com a sequência
> de naipe acima da quadra, como no pôquer. Só playtests e lotes de bots
> dizem se ela se mantém.

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

> **Detalhe:** a prova não olha a mão do adversário nem a bolsa. Um dado que
> o adversário tem na mão não limita o que ele pode pôr.

> **Design:** os números não se esgotam, então a prova não conta dados, como
> o *Battle Line* conta cartas. Ela só olha o que cada lado pode virar.
