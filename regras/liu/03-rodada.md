---
type: spec
status: draft
tags: [liu, regras, rodada, mercado, turno]
---

# Rodada

O jogo acontece em rodadas. Cada rodada tem duas partes: o mercado e os
turnos.

## Mercado

O anfitrião compra dados: tira um dado do saco, rola e põe no mercado, um de
cada vez, até que valham as duas condições:

- o mercado tem pelo menos **N + 1** dados;
- entre os números de selo, um aparece no mercado **mais vezes que cada um
  dos outros**, sem empate. Os números que não são de nenhum selo não contam.

Se o saco esvazia antes disso, o jogo acaba (ver
[05-fim-do-jogo.md](05-fim-do-jogo.md)).

Os dados que sobram no mercado ao fim da rodada continuam lá para a próxima.

> **Detalhe:** como o mercado continua de uma rodada para a outra, ele pode
> já valer as duas condições no início da rodada. Então ninguém compra.

> **Detalhe:** com 2 jogadores de selos 2 e 5, o mercado `2 2 4 4 4` vale as
> duas condições: o 2 aparece duas vezes e o 5 nenhuma. Os três 4 não contam.

## Ordem

Começa a rodada o jogador cujo número de selo tem a maioria no mercado. Os
outros jogam em seguida, em sentido horário. Cada jogador tem um turno por
rodada.

> **Detalhe:** a condição de compra garante que um único número de selo tem
> a maioria, então nunca há empate para começar.

## Turno

No seu turno, o jogador faz uma destas jogadas:

- **Pôr do mercado:** pega um dado do mercado e o põe na janela.
- **Pôr da mão:** pega um dado do mercado, põe na janela o dado da mão e
  guarda na mão o dado do mercado.
- **Guardar:** com a mão vazia, pega um dado do mercado e o guarda na mão,
  sem pôr dado na janela.
- **Rolar de novo:** com um dado na mão, devolve-o ao mercado e rola de novo
  todos os dados do mercado. Depois pega um deles e o põe na janela ou o
  guarda na mão. Se nenhum couber na janela, ele só pode guardar.
- **Passar:** não faz nada. O jogador pode passar mesmo quando tem jogada.

Pôr um dado na janela segue as regras de
[04-janela.md](04-janela.md). Os dados nunca são girados, a não ser os que o
jogador recebe do saco na preparação e pelo bônus do selo: pega-se o dado
como ele está no mercado.

> **Playtest:** depois de rolar de novo, o jogador escolhe entre pôr o dado
> na janela ou guardá-lo na mão. A outra opção é só pôr na janela, e quem
> rola de novo perde a mão.

### Bônus do selo

Um jogador que termina o turno com a mão vazia, depois de pôr na janela um
dado com o número do seu selo, tira um dado do saco, gira-o até mostrar o
número do seu selo e o guarda na mão. Se o saco está vazio, não há bônus.

> **Detalhe:** o bônus não vale com "Pôr da mão", porque essa jogada sempre
> termina com um dado na mão.

## Mão

A mão guarda no máximo **um** dado. Ela é pública: o dado fica na mesa, ao
lado da moldura, à vista de todos.
