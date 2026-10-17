# Direção D: risografia

## Ideia

Cada peça parece impressa num risógrafo com duas tintas: um campo escuro, um
motivo e o título na tinta clara, com o registro um pouco deslocado. Onde as
duas tintas se cruzam aparece a terceira cor. A textura (grão, borda áspera,
mancha) fica no painel, na moldura e na caixa; o tabuleiro e os dados ficam
limpos. Em preto e branco, o motivo e a face do dado separam os jogos.

## Paleta (Seks)

| Uso | Tinta | Hex |
|---|---|---|
| Campo, texto, linhas do tabuleiro | Riso Federal Blue | `#3d5588` |
| Título, motivo, seleção, destinos | Riso Fluorescent Orange | `#ff7477` |
| Sobreposição das duas | azul sobre laranja | `#3d273f` |
| Papel | natural | `#f1eadb` (casas: `#f8f4ea`) |
| Dados | branco e preto | `#fbf8f0`, `#26262c` |

Manual a uma tinta: `#161616` em papel branco, tons só por retícula.

## Fontes

- Bricolage Grotesque (Ateliertriay), SIL OFL 1.1: títulos e texto.
  `fonts/BricolageGrotesque.ttf`, licença em `fonts/OFL-Bricolage.txt`.
- Space Mono (Colophon), SIL OFL 1.1: coordenadas, rótulos, números.
  `fonts/SpaceMono-*.ttf`, licença em `fonts/OFL-SpaceMono.txt`.

## Os outros cinco

Mesma grade, mesmo tipo, a face do dado como número da coleção. Muda o par de
tintas (cores reais de risografia) e o motivo, tirado da língua do nome:

| Jogo | Campo | Motivo | Motivo desenhado |
|---|---|---|---|
| Seks | Federal Blue `#3d5588` | Fl. Orange `#ff7477` | rosa de Selbu: 8 pétalas, as 8 direções do dado |
| Liu | Teal `#00838a` | Fl. Pink `#ff48b0` | Lo Shu, o quadrado mágico em grupos de pontos |
| Zes | Green `#00a95c` | Sunflower `#ffb511` | relógio do leilão de Aalsmeer |
| Ono | Purple `#765ba7` | Aqua `#5ec8e5` | ondas do Pacífico, como no tapa |
| Suqta | Bright Red `#f15060` | Yellow `#ffe800` | chakana, a cruz andina em degraus |
| Shesh | Burgundy `#914e72` | Mint `#82d8d5` | as pontas do tabuleiro de gamão |

Regra do par: a tinta escura vai no campo; a clara, no motivo e no título.

## Arquivos

`jogo.html`, `capa.html`, `manual.html`; `riso.css` e `riso.js` são
compartilhados (filtros de grão, desenho do dado, posição e movimentos).
