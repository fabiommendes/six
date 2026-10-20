---
titulo: Liu
resumo: Dados no estilo do sudoku, sem repetir número numa linha nem numa coluna.
jogo: liu
jogadores: "2 a 4"
secoes:
  visao-geral:
    fonte:
      - regras/liu/00-visao-geral.md
  componentes:
    fonte:
      - regras/liu/01-componentes.md
  preparacao:
    fonte:
      - regras/liu/02-preparacao.md
  a-rodada:
    fonte:
      - regras/liu/03-rodada.md#mercado
      - regras/liu/03-rodada.md#ordem
  o-turno:
    fonte:
      - regras/liu/03-rodada.md#turno
      - regras/liu/03-rodada.md#mao
  a-janela:
    fonte:
      - regras/liu/04-janela.md
  fim-do-jogo:
    fonte:
      - regras/liu/05-fim-do-jogo.md
---

*Liu* (六) quer dizer "seis" em mandarim.

O Liu ainda está em teste, e as regras podem mudar.

## Visão geral

De 2 a 4 jogadores. Cada um monta a sua [[Janela]]: uma grade de até 4 por 4
dados em que nenhum número se repete numa linha nem numa coluna, como no
sudoku.

Cada jogador começa com um [[Selo]], um dado da sua cor, e o número dele não
muda na partida. A cada [[Rodada]], dados saem do [[Saco]] e são rolados no
[[Mercado]]. No seu turno, você pega um dado do mercado e o põe na janela, ou
o guarda na [[Mão]] para depois.

O jogo acaba quando alguém completa a janela, quando o saco esvazia ou quando
uma rodada passa sem que ninguém ponha dado. Linhas e colunas completas valem
pontos, e mais ainda se formam uma [[Sequência]] ou o seu [[Código]]. Vence
quem fizer mais pontos.

## Componentes

Com N jogadores:

- N selos, um por jogador, cada um de uma cor que nenhum outro dado tem;
- 15 dados comuns por jogador, no saco: 30 com 2 jogadores, 45 com 3 e 60
  com 4. Brancos e pretos podem se misturar: a cor de um dado comum não conta;
- o saco;
- N [[Moldura|molduras]], grades vazadas de 4 por 4 casas, uma por jogador.

## Preparação

1. Cada jogador escolhe um selo.
2. Um jogador, o anfitrião, rola todos os selos juntos. Enquanto dois selos
   mostram o mesmo número, ele rola de novo todos eles.
3. Cada jogador põe o seu selo na mesa, à sua frente, sem mudar o número, com
   a moldura em volta. Esse é o seu [[Número do selo|número do selo]] até o
   fim da partida. O selo é o primeiro dado da janela.
4. Os dados comuns vão para o saco.
5. Cada jogador tira um dado do saco, gira-o até mostrar o número do seu selo
   e o guarda na mão, ao lado da moldura.

O mercado começa vazio.

## A rodada

Cada rodada tem duas partes: o anfitrião abastece o mercado, e depois cada
jogador faz um turno.

### O mercado

O anfitrião tira um dado do saco, rola e põe no mercado, um de cada vez, até
que valham as duas condições:

- o mercado tem pelo menos **um dado a mais que o número de jogadores**;
- entre os números de selo, um aparece no mercado **mais vezes que cada um
  dos outros**, sem empate. Os números que não são de nenhum selo não contam.

Com selos 2 e 5, o mercado 2 2 4 4 4 já vale as duas condições: o 2 aparece
duas vezes e o 5 nenhuma. Os três 4 não contam.

Os dados que sobram no mercado ficam lá para a próxima rodada. Se o mercado já
vale as duas condições no início da rodada, ninguém tira dado do saco.

### Quem começa

Começa o jogador cujo número de selo aparece mais vezes no mercado. Os outros
jogam em seguida, em sentido horário. Cada jogador tem um turno por rodada.

## O turno

No seu turno, faça **uma** destas jogadas:

- **Pôr do mercado**: pegue um dado do mercado e ponha na sua janela.
- **Pôr da mão**: pegue um dado do mercado, ponha na janela o dado da sua mão
  e guarde na mão o dado do mercado.
- **Guardar**: com a mão vazia, pegue um dado do mercado e guarde na mão.
- **Rolar de novo**: com um dado na mão, devolva-o ao mercado e role de novo
  todos os dados do mercado. Depois pegue um deles e ponha na janela, ou
  guarde na mão.
- **Passar**: não faça nada. Você pode passar mesmo quando tem jogada.

Pegue os dados do mercado como eles estão: não gire nenhum dado. Só os dados
que você recebe do saco, na preparação e pelo bônus do selo, são girados.

### Bônus do selo

Se você puser na janela um dado com o número do seu selo e terminar o turno
com a mão vazia, tire um dado do saco, gire-o até mostrar o número do seu selo
e guarde na mão. Com o saco vazio, não há [[Bônus do selo|bônus]].

"Pôr da mão" nunca dá bônus, porque o turno termina com um dado na mão.

### A mão

A mão guarda no máximo **um** dado. Ele fica na mesa, ao lado da moldura, à
vista de todos.

## A janela

A janela começa só com o selo, que nunca sai dela. Um dado novo precisa:

- **encostar** pelo lado num dado da janela; encostar pela diagonal não
  basta;
- **caber** com todos os outros numa região de 4 por 4 casas;
- **não repetir** o número de nenhum dado da mesma linha ou da mesma coluna.

```diagrama
legenda: Um 3 pode ir nas casas marcadas. A terceira linha e a segunda coluna já têm um 3, e o canto de baixo à direita não encosta em nenhum dado.
moldura: 1,1
o . B5 o
B2 S4 B1 B6
. B3 . .
o B5 o .
```

A região não é fixa. A moldura marca a região na mesa, e você pode
arrastá-la enquanto todos os dados da janela continuam dentro dela.

```diagrama
legenda: A linha já tem 4 dados. Um 3 pode ir acima ou abaixo deles, mas não nas pontas, onde a janela passaria de 4 casas de largura. A moldura ainda pode subir uma casa.
moldura: 2,2
. . . . . .
. o o o o .
. B1 S4 B2 B6 .
. o o o o .
. . . . . .
```

Um dado posto não se move nem muda de número. A janela está **completa** com
16 dados.

## Fim do jogo

O jogo acaba na hora, sem terminar a rodada, quando:

- um jogador completa a janela;
- o saco esvazia enquanto o anfitrião abastece o mercado;
- uma rodada inteira passa sem que ninguém ponha dado na janela.

### Pontuação

Cada jogador escolhe o seu código: quatro números diferentes, de 1 a 6,
escolhidos olhando a janela para fazer o máximo de pontos.

Cada linha completa e cada coluna completa, com 4 dados, vale:

- **1 ponto** por estar completa;
- **1 ponto** a mais se os seus números formam uma sequência: quatro números
  seguidos, em qualquer ordem (1 2 3 4, 2 3 4 5 ou 3 4 5 6);
- **1 ponto** a mais se os seus números são os do código, em qualquer ordem.

Com o código 1 2 5 6, a linha 6 1 5 2 vale 2 pontos, a linha 4 2 3 5 vale 2,
e a linha 4 1 6 3 vale 1. O código também pode ser uma sequência: com o
código 2 3 4 5, a linha 4 2 3 5 vale 3.

Uma janela completa tem 4 linhas e 4 colunas, então vale até 24 pontos.

Vence quem fizer mais pontos. No empate, vence quem tem mais dados na janela.
Se ainda empatar, os empatados dividem a vitória.
