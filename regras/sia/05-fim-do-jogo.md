---
type: spec
status: draft
tags: [sia, regras, fim-do-jogo]
---

# Fim do jogo

## Vitória por marcos

Vence na hora quem tomar, ao reivindicar:

- 5 marcos; ou
- 3 marcos vizinhos, isto é, em 3 posições seguidas da fileira.

> **Detalhe:** a posição de um marco na fileira não muda quando ele é
> arrastado para o lado de quem o tomou. Os vizinhos são os da fileira
> inicial.

## Falta de lugar

Depois do passo 4 de cada turno, se nenhum dos dois jogadores pode pôr um
dado, o jogo acaba. Um jogador pode pôr um dado se existe um marco não
tomado em que o seu lado tem menos de 3 dados.

Então os marcos que ainda não foram tomados se resolvem:

- se os dois lados estão completos, o marco é de quem tem a melhor
  formação, com o desempate de [04-formacoes.md](04-formacoes.md#desempate);
- se só um lado está completo, o marco é desse lado;
- se nenhum lado está completo, o marco não tem dono.

Vence quem tem mais marcos, contando os que tomou antes e os que ganhou agora.

> **Proposta:** se os dois têm o mesmo número de marcos, a partida termina
> empatada.

> **Proposta:** se um jogador não pode pôr dado, mas o outro pode, o jogo
> continua. O que não pode pôr dado ainda pode rolar de novo e reivindicar.

> **Detalhe:** o saco nunca acaba no digital, então ele não encerra a
> partida. No físico, o kit decide depois.
