---
type: spec
status: draft
tags: [seks, regras, turno, movimento]
---

# Turno

No seu turno, o jogador faz **exatamente uma** jogada com um dos seus dados:
mover ou incrementar. Passar não é permitido.

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

> **Detalhe:** um 6 cercado nas 8 direções, por dados ou pela borda do
> tabuleiro, não tem jogada. Um dado de valor menor sempre tem, porque pode ser
> incrementado.
