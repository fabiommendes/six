# Interface web do Shesh

Partidas de dois jogadores no mesmo aparelho, contra um bot ou bot contra
bot, em Vite e TypeScript, com o motor e os bots do Shesh em WebAssembly
(`digital/shesh/wasm`). A mesa é desenhada em 3D com Three.js e usa o
tabuleiro de 11 por 11 casas do Seks como base, com a trilha destacada e a
casa central vermelha. Os painéis (jogadores, regras, vez, jogadas e ações,
histórico e fim do jogo) ficam por cima, em HTML.

As regras são as de `dev/rfc/jogo-de-corrida.md` (a seção Decisions vale sobre
o texto original): sem lance extra, só a casa vermelha do centro é roseta,
entrada em ordem do menor dado, e levar todos os dados encerra a partida e dá
a vitória a quem tem mais pontos. O jogo ainda é um protótipo: as regras
não estão em `regras/` e o nome pode mudar.

## Comandos

- `just shesh-wasm` antes de tudo: o pacote WASM não vai para o git.
- `just shesh-web-dev`: servidor de desenvolvimento.
- `just shesh-web-check`: tipos, testes (Vitest, com o motor real) e build em
  `dist/`. Faz parte do `just check`.
- `just site` publica o build em `out/site/shesh/`.

## Organização

| Caminho | Conteúdo |
|---|---|
| `src/engine/` | `SheshGame` e `SheshBot`, o `Game` e o `Bot` do WASM com JSON tipado (e os dados que saíram da trilha), e o carregamento do módulo |
| `src/bot/` | Os níveis (bots de `shesh-bots`), o Web Worker do bot e o cliente que fala com ele |
| `src/table/` | A mesa em 3D (`Table3D`): disposição e geometria da trilha (`layout.ts`), texturas desenhadas em canvas (tabuleiro, dados, bandejas, marcas), dados, animação de cada evento e sons feitos com Web Audio |
| `src/logic/selection.ts` | Cliques em jogadas: dado da reserva ou casa da trilha, destino e lista de jogadas |
| `src/logic/texts.ts` | Todo texto mostrado ao jogador, com os termos da RFC |
| `src/logic/save.ts` | A partida salva no `localStorage` (nomes, quem é bot, o estado e os dados que saíram), para continuar depois |
| `src/ui/` | Tela inicial, tela do jogo (painéis sobre a mesa) e os ícones SVG dos dados |

As fontes vêm de `digital/seks/web/public/fonts` (com as licenças), pelo CSS
em `src/styles/fonts.css`. A moldura usa o azulejo de estrela e cruz do Shesh
(ADR 0005), em turquesa `#167F88`, desenhado em `src/table/drawing.ts`
(`drawBand`); o ponto do jogo na face de seis é o sexto.

## A trilha na mesa

- Colunas contam da esquerda (1 a 11) e fileiras da borda do primeiro jogador
  (1 a 11). A trilha é a do tabuleiro de Ur. A pista de entrada de cada
  jogador fica na fileira 5 (primeiro jogador, a mais perto dele) ou 7
  (segundo), da coluna 6 à 3 (casas 1 a 4). A pista do meio é a fileira 6, da
  coluna 3 à 10 (casas 5 a 12), e a pista de saída volta à fileira de cada
  um, nas colunas 10 e 9 (casas 13 e 14). As colunas 7 e 8 das pistas
  próprias são o vão do tabuleiro de Ur: a seta "entra" fica na coluna 7, ao
  lado da casa 1, e a seta "sai" (a saída, casa 15) na coluna 8.
- As casas da trilha têm contorno e cor: as pistas próprias na cor do
  jogador (terracota e azul), a pista do meio em turquesa, a roseta do
  centro em vermelho com uma estrela branca e as rosetas das pistas próprias
  (casas 4 e 14) com uma estrela vermelha. Cada casa leva o número dela, de cabeça para o
  lado de quem a usa. Os dois jogadores andam no mesmo sentido da mesa; a
  câmera gira para o assento de quem joga.
- Os dados de cada jogador mostram o valor na face de cima, na cor do assento
  e com uma marca no canto (círculo para o primeiro, quadrado para o
  segundo), para a cor não ser a única pista.
- Ao lado do tabuleiro, cada jogador tem duas bandejas: a **reserva**, com os
  dados que esperam para entrar (do menor para o maior), e os **pontos**, com
  os dados que saíram da trilha. O motor guarda só a soma dos pontos; a
  interface guarda os dados que saíram, pelos eventos (e os salva junto com a
  partida). Numa partida salva sem essa lista, ela é refeita com a soma, em
  dados de 6.
- Os 4 dados binários (faces lisas para 0 e com 1 ponto para 1) são rolados a cada turno nas fileiras
  livres do tabuleiro, do lado de quem joga. O motor só dá a soma; quais dos
  4 mostram 1 é sorteado de forma fixa pelo turno, só para a apresentação. A
  barra de baixo repete a rolagem em ícones.

## Como se joga

- Toque (ou clique) num dado marcado com cantos (os que podem andar a
  rolagem), ou numa jogada da lista de baixo: o dado sobe, um anel mostra
  onde ele para e a lista diz o que acontece ("come o 2", "desgasta",
  "encosta", "funde", "sai e vale 4 pontos"). Toque no anel, no dado de novo
  ou em Jogar para confirmar. Da reserva, só o menor dado entra.
- Sem jogada possível, o botão Passar fica ativo.
- Cada evento do motor vira uma animação e uma linha do histórico: o dado
  voa até a casa, e espera sobre o dado que encontrou até o motor dizer o que
  houve. Comer manda o dado do adversário de volta para a reserva dele e põe
  um dado novo na sua; desgastar manda o seu dado de volta e mostra o do
  adversário com o valor menor (ou o tira do jogo); fundir junta os dois
  dados; encostar mostra o dado com 1 a menos; sair leva o dado para
  os pontos. Uma etiqueta sobe da casa com o nome do evento.
- Escape cancela a escolha em curso e Ctrl+Z desfaz até a última vez de uma
  pessoa, passando pelas jogadas dos bots.
- Na vez de um bot, a jogada sai de um Web Worker e aparece depois de pelo
  menos 0,6 s; antes dela, o dado do bot sobe e um anel mostra o destino.
- Dois jogadores no mesmo aparelho: a câmera gira para o assento de quem
  joga. Em tela estreita as bandejas ficam acima e abaixo do tabuleiro.
- A câmera não gira com o mouse nem com o toque: a inclinação é fixa e só o
  zoom é seu (roda do mouse, gesto de pinça ou os botões; o duplo clique ou o
  botão de centralizar voltam à vista inicial). Com "reduzir movimento" no
  sistema, as animações são puladas.

## Notas

- Os níveis dos bots são `random` (fácil), `greedy` (médio) e `expecti`
  (difícil); não foram calibrados contra pessoas.
- O manual ainda não tem capítulo do Shesh, então a interface não tem link de
  regras.
- Em desenvolvimento, `window.sheshTable` e `window.sheshScreen` expõem a
  mesa e a tela para testes no navegador (`sheshTable.screenOf(pick, seat)`
  dá a posição de um dado ou de uma casa na página).
