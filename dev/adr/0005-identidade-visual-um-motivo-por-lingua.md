---
type: adr
status: accepted
tags: [identidade-visual, arte, digital, manual]
relatedTo: [dev/rfc/identidade-visual.md, dev/rfc/interface-do-seks.md, dev/rfc/nomes-dos-jogos.md]
created: 2026-10-17
decided: 2026-10-17
deciders: [fabio, claude]
---

# Identidade visual: um motivo por língua

## Context

A coleção precisava de uma estética comum para as caixas, os tabuleiros, o
manual e as seis versões digitais, com as restrições de
`dev/rfc/identidade-visual.md`: funcionar em preto e branco, deixar os dados
no centro, usar a mesma linguagem no papel e na tela, distinguir os seis jogos
dentro de uma coleção e usar fontes com licença livre. A interface do Seks
(`dev/rfc/interface-do-seks.md`) dependia dessa escolha.

Quatro direções foram esboçadas a partir de um mesmo briefing
(`arte/esbocos/BRIEF.md`), cada uma com a tela do jogo, a capa, uma página do
manual e um `LEIAME.md` com paleta e fontes. `arte/esbocos/index.html` mostra
as quatro lado a lado.

## Options

- (a) Madeira e tinta (`arte/esbocos/a-madeira-e-tinta/`): objeto de
  marcenaria, tabuleiro de madeira clara, dados de marfim e ébano, Alegreya;
  cada jogo com uma tinta e um ornamento de régua e compasso.
- (b) Geométrico (`arte/esbocos/b-geometrico/`): grade suíça, Archivo, cores
  chapadas; cada jogo com uma cor e um arranjo de seis pontos.
- (c) Motivo por língua (`arte/esbocos/c-motivos-por-lingua/`): cada jogo veste
  um padrão da cultura da língua do seu nome, numa moldura comum.
- (d) Risografia (`arte/esbocos/d-risografia/`): duas tintas por jogo,
  sobreposição e granulação, com cara de impressão independente.

## Decision

Opção (c). Cada jogo veste um padrão da cultura da língua do nome: malha
nórdica (Seks), treliça chinesa (Liu), azulejo de Delft (Zes), tapa
polinésio (Ono), tecido andino (Suqta) e azulejo persa (Shesh). Todos são
desenhados na mesma grade de pontos, com três marcas: o ponto do tamanho de
um ponto de dado, o traço e a área. A unidade da coleção vem da moldura (a
faixa do motivo, com a face de seis nos cantos), da Alegreya Sans e da grade.

- O logo é a face de seis ao lado de "six"; cada ponto da face é um jogo.
- O padrão fica nas bordas e na caixa, nunca atrás dos dados.
- O tabuleiro, os dados, as marcas de jogada e a tipografia são iguais nos
  seis jogos; mudam só a cor das marcas e o motivo da moldura.
- A cor nunca carrega informação sozinha: a seleção é um quadrado grosso, o
  destino é um anel, a origem da última jogada é um quadrado tracejado e o
  destino dela são cantos.
- Paleta, fontes e licenças estão em `arte/esbocos/c-motivos-por-lingua/LEIAME.md`;
  os motivos, em `six.js` na mesma pasta.

As quatro direções ficam no repositório como referência: todas têm méritos
próprios, e a versão digital pode oferecer temas no futuro.

## Consequences

- A interface web do Seks parte de `arte/esbocos/c-motivos-por-lingua/jogo.html`.
- Antes de publicar um jogo, o motivo dele passa pela revisão de alguém da
  cultura correspondente. Ficaram de fora de propósito símbolos religiosos ou
  de clã: a suástica das treliças chinesas, a chakana andina, motivos de
  tatuagem polinésia e a caligrafia persa.
- Os motivos ainda não pesam igual (o do Ono é o mais pesado, o do Suqta e o
  do Shesh precisaram ser vazados) e a malha só de pontos fica fraca em tamanho
  pequeno. Isso é ajuste de desenho, não muda a decisão.
- Se um nome de jogo mudar (`dev/rfc/nomes-dos-jogos.md`), o motivo dele muda
  junto.
- Um tema alternativo na versão digital pode partir das direções (a), (b) e
  (d), mas precisa respeitar as mesmas marcas de jogada por forma.
