# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Jogadores em geral: quem chega pelo site, não conhece o projeto e quer
aprender e jogar um dos jogos. Não se presume que tenham o kit físico nem que
conheçam jogos abstratos.

Situações de uso confirmadas:

- navegador no computador, com mouse, em partidas longas;
- celular e tablet, por toque, inclusive em hotseat passando o aparelho;
- partida remota com amigos, por link (correspondência) ou ao vivo (P2P), sem
  servidor;
- consulta ao manual e ao site durante uma partida na mesa, com o kit real.

## Product Purpose

Six é uma coleção de seis jogos com dados de seis faces, jogados com o mesmo
kit físico. Cada jogo tem uma versão digital no navegador, com bots e jogo em
rede, e todos compartilham um livro de regras único (site e PDF). O produto
deu certo quando alguém aprende um jogo pelo manual ou pela interface e joga
uma partida inteira, sozinho contra o bot, no mesmo aparelho ou a distância.

## Positioning

Um único kit (dados, tabuleiro de 11 por 11, saco, molduras) serve aos seis
jogos, e cada versão digital desenha esse kit como ele é na mesa: o dado é
peça e contador ao mesmo tempo, e girar o dado é o gesto central. O manual e
as interfaces usam as mesmas figuras. O nome de cada jogo é a palavra "seis"
numa língua.

## Operating Context

- Jogos com versão digital: Seks (estratégia abstrata, regras fechadas), Liu,
  Sia, Shesh (protótipo de corrida) e dois protótipos sem nome (conexão e
  missões). Os demais estão em ideia.
- Modos de jogo: hotseat, contra bot (no navegador, em Web Worker), bot contra
  bot, partida por link e partida ao vivo P2P (no Seks).
- `regras/` é a fonte da verdade; manual e interfaces derivam dela.
- Site publicado no GitHub Pages: manual na raiz e uma interface por jogo em
  subpasta (`seks/`, `liu/`, `sia/`, `shesh/`, `conexao/`, `missoes/`).

## Capabilities and Constraints

- Site estático; nenhum servidor. Motor e bots em Rust compilados para WASM;
  interfaces em Vite, TypeScript e Three.js.
- A interface não reimplementa regra: o motor decide o que é legal.
- Textos mostrados ao jogador são em português; código em inglês. Termos
  seguem o glossário de cada jogo, e palavras de `Não usar:` nunca aparecem
  na tela.
- Interação por clique e toque nos próprios dados e casas, sem lista de
  jogadas.
- Em aberto: objetivo de longo prazo da coleção (produto comercial ou
  projeto aberto), composição do kit físico (`regras/kit.md`), nomes dos
  jogos sem nome.

## Brand Commitments

- Identidade visual decidida no ADR 0005 (`dev/adr/0005-identidade-visual-um-motivo-por-lingua.md`);
  o registro visual fica no DESIGN.md, não aqui.
- O logo é a face de seis ao lado de "six"; cada ponto é um jogo.
- Nenhuma informação depende só de cor; tudo funciona em preto e branco.
- Fontes com licença comercial desde o começo.
- Motivos culturais passam pela revisão de alguém da cultura antes de
  publicar; ficam de fora símbolos religiosos ou de clã.

## Evidence on Hand

- Regras: `regras/`, manual em `manual/`.
- Esboços das quatro direções visuais: `arte/esbocos/`.
- Medições de bots: `dev/notes/bots-do-*.md`.
- Não há depoimentos, números de jogadores, preço ou distribuição. Não
  inventar.

## Product Principles

1. Os dados ficam no centro: nada esconde o valor de uma face nem briga com
   ela.
2. Mesa e tela falam a mesma língua: o digital desenha o kit físico, e o
   manual usa as mesmas figuras.
3. Coleção com unidade e diferença: os seis jogos se reconhecem como família,
   e cada um tem cor e motivo próprios.
4. Quem chega sem contexto aprende jogando; regras vêm do motor, não da
   interface.

## Accessibility & Inclusion

- Informação nunca só por cor: seleção, destino, origem e destino da última
  jogada têm formas distintas.
- Toque e mouse como entradas de primeira classe.
