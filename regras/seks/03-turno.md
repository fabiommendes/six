---
type: spec
status: draft
tags: [seks, regras, turno, movimento]
---

# Turno

No seu turno, o jogador faz **exatamente uma** jogada com um dos seus dados:
mover, incrementar ou atirar. Passar não é permitido.

## Mover

O dado anda em linha reta numa das 8 direções: as 4 ortogonais e as 4
diagonais.

- Ele anda **pelo menos 1 e no máximo tantas casas quanto o seu valor**.
- Ele não pula outros dados, nem os seus nem os do adversário, e não termina
  numa casa ocupada.
- Ele não sai do tabuleiro.

Depois de andar, o dado é girado para mostrar **o número de casas que andou**.
Um 4 que anda 2 casas vira um 2; um 4 que anda 4 casas continua 4. Mover
nunca deixa um dado com valor maior que o de antes.

Depois do movimento, o jogador confere as capturas (ver
[04-captura.md](04-captura.md)) e se venceu (ver
[05-fim-do-jogo.md](05-fim-do-jogo.md)).

## Incrementar

O jogador soma 1 ao valor de um dado seu, que fica na mesma casa. O valor
máximo é **6**: um 6 não pode ser incrementado.

Incrementar nunca captura.

## Atirar

Um dado com valor **6** na **casa central**, a casa da coluna 6 na fileira 6,
pode atirar. O jogador escolhe uma das 8 direções. O primeiro dado nessa
direção, a qualquer distância, precisa ser do adversário: ele é capturado e
sai do tabuleiro, e o atirador vai para a casa dele. O atirador continua
com valor 6, e a casa central fica vazia.

- O tiro não passa por cima de dados: um dado próprio no caminho bloqueia a
  direção.
- Só um dado é capturado por tiro.
- Um dado com valor menor que 6 na casa central não atira; ele pode ser
  incrementado até 6 e atirar num turno seguinte.

Na casa do alvo, o atirador conta como um dado que terminou um movimento: o
jogador confere as capturas por custódia em volta dele (ver
[04-captura.md](04-captura.md)) e se venceu, por exemplo se a casa do alvo
fica na fileira de fundo do adversário (ver
[05-fim-do-jogo.md](05-fim-do-jogo.md)).

> **Proposta:** o tiro foi aprovado para teste e ainda não foi jogado.

> **Detalhe:** nenhum dado chega à casa central com valor 6: a casa mais
> longe dela, na mesma linha, fica a 5 casas. Quem quer atirar move um dado
> até lá, incrementa pelo menos uma vez e só então atira, e o adversário joga
> pelo menos duas vezes nesse meio tempo.

> **Design:** o tiro é forte de propósito, para que a casa central seja um
> ponto disputado da partida. Ele também fura a defesa parada: uma fileira da
> frente completa não deixa nenhum dado adversário passar nem ser capturado
> por custódia (ver `dev/notes/bots-do-seks.md`, "A muralha"), mas não protege
> contra o tiro.

> **Detalhe:** um 6 cercado nas 8 direções, por dados ou pela borda do
> tabuleiro, não tem jogada, a não ser que esteja na casa central e tenha um
> dado adversário vizinho para atirar. Um dado de valor menor sempre tem
> jogada, porque pode ser incrementado.
