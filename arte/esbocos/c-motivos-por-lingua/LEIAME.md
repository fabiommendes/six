# Direção C: um motivo por língua

Cada jogo veste um padrão da língua do seu nome: malha nórdica (Seks), treliça
chinesa (Liu), azulejo de Delft (Zes), tapa polinésio (Ono), tecido andino
(Suqta), azulejo persa (Shesh). Todos são desenhados na mesma grade de pontos,
com três marcas: o ponto do tamanho de um ponto de dado, o traço e a área. A
unidade vem da moldura (faixa do motivo, face de seis nos cantos), da Alegreya
Sans e da grade. O padrão fica nas bordas e na caixa, nunca atrás dos dados.

## Paleta

| Uso | Hex |
|---|---|
| Tinta (texto, linhas, dados pretos) | `#1E1B18` |
| Papel (fundo da tela) | `#F4EEE2` |
| Lã crua (tabuleiro, cartões) | `#FBF8F1` |
| Linha da grade | `#CDC3B0` |
| Texto secundário | `#6B6257` |
| Seks, vermelho de lã | `#A3302A` |
| Liu, verde jade | `#4C7A34` |
| Zes, azul de Delft | `#1F4E9B` |
| Ono, marrom de casca | `#6B3F22` |
| Suqta, ocre | `#A8740C` |
| Shesh, turquesa | `#167F88` |

A cor nunca carrega informação sozinha: seleção é um quadrado grosso, destino é
um anel, origem é um quadrado tracejado, destino da última jogada são cantos.

## Fontes

- Alegreya Sans (interface, títulos, logo) e Alegreya Sans SC (rótulos):
  Huerta Tipográfica, SIL Open Font License 1.1 (`fonts/OFL-AlegreyaSans.txt`,
  `fonts/OFL-AlegreyaSansSC.txt`).
- Alegreya (texto corrido do manual): Huerta Tipográfica, SIL Open Font License
  1.1 (`fonts/OFL-Alegreya.txt`).

Baixadas do repositório `google/fonts`.

## Os outros cinco

- Cada jogo recebe uma cor e três versões do motivo: `band` (moldura do
  tabuleiro e da caixa), `thin` (faixas finas, celular, manual) e `tile`
  (área cheia, só na caixa). Estão em `six.js`, todas na mesma grade.
- A face de seis é o logo da coleção; cada ponto é um jogo, na ordem
  Seks, Liu, Zes (coluna da esquerda), Ono, Suqta, Shesh (coluna da direita).
  Nos cantos da moldura, o ponto do jogo vem cheio e os outros vazados.
- Tabuleiro, dados, marcas de jogada e tipografia não mudam de um jogo para
  outro; só a cor das marcas e o motivo da moldura.
- Cuidados: nada de símbolos religiosos ou de clã. Ficaram de fora a suástica
  das treliças chinesas, a chakana andina, motivos de tatuagem polinésia e a
  caligrafia persa. A estrela de oito pontas do Shesh é a do azulejo de estrela
  e cruz, sem o círculo e os quadrados sobrepostos do *rub el hizb*. Antes de
  publicar, vale a revisão de alguém de cada cultura.
