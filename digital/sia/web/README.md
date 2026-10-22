# Interface web do Sia

Partidas de dois jogadores no mesmo aparelho, contra um bot ou bot contra
bot, em Vite e TypeScript, com o motor e os bots do Sia em WebAssembly
(`digital/sia/wasm`). A mesa é desenhada em 3D com Three.js e usa o
tabuleiro de 11 por 11 casas do Seks como base, com a casa central marcada.
Os painéis (jogadores, formações, cartas dos marcos, vez e ações, histórico e
fim do jogo) ficam por cima, em HTML.

## Comandos

- `just sia-wasm` antes de tudo: o pacote WASM não vai para o git.
- `just sia-web-dev`: servidor de desenvolvimento.
- `just sia-web-check`: tipos, testes (Vitest, com o motor real) e build em
  `dist/`. Faz parte do `just check`.
- `just site` publica o build em `out/site/sia/`.

## Organização

| Caminho | Conteúdo |
|---|---|
| `src/engine/` | `SiaGame` e `SiaBot`, o `Game` e o `Bot` do WASM com JSON tipado, e o carregamento do módulo |
| `src/bot/` | Os níveis (especificações de `sia-bots`), o Web Worker do bot e o cliente que fala com ele |
| `src/table/` | A mesa em 3D (`Table3D`): disposição (`layout.ts`), texturas desenhadas em canvas (tabuleiro, dados com a marca do naipe, bandejas, marcas), dados, animação de cada evento e sons feitos com Web Audio |
| `src/logic/formation.ts` | Nomes, ordem e descrição das formações, "Trinca, soma 14", "6ª de 8", marcos de cada jogador e vizinhos |
| `src/logic/selection.ts` | Cliques em comandos: dado da mão e marco, reivindicação e a montagem de "rolar de novo" com a prévia do custo |
| `src/logic/texts.ts` | Todo texto mostrado ao jogador, com os termos de `regras/sia/GLOSSARY.md` |
| `src/logic/feedback.ts` | Em que lugar fica cada formação tomada |
| `src/logic/save.ts` | A partida salva no `localStorage` (nomes, quem é bot e o estado), para continuar depois |
| `src/ui/` | Tela inicial, tela do jogo (painéis sobre a mesa) e os ícones SVG dos dados |

As fontes vêm de `digital/seks/web/public/fonts` (com as licenças), pelo CSS
em `src/styles/fonts.css`. O motivo da moldura é o do Seks (`src/table/motif.ts`
é cópia do dele); o Sia ainda não tem identidade própria no ADR 0005, então
o azul-ardósia `#46607A` da moldura e das marcas é provisório.

## O que a mesa mostra

- Os 9 marcos ficam nas 9 casas do meio da fileira central, com as letras A
  a I nas bordas do tabuleiro (a letra é a posição, da esquerda do primeiro
  jogador; o texto do histórico fala "marco C"). Os dados de cada jogador
  ficam nas 3 fileiras do seu lado, na coluna do marco.
- Reivindicar: a coluna de quem tomou o marco (o marco e os dados dele, na
  mesma ordem) sobe e desliza em linha reta, na própria coluna, até o fundo
  do tabuleiro do lado desse jogador: o último dado fica na última fileira
  (com 3 dados, 2 casas de deslocamento). Uma borda fina da cor do jogador
  corre dos dois lados da coluna. Os dados do perdedor ficam onde estavam e
  desbotam para cinza, sem a cor do naipe e com os pontos legíveis, junto com
  o deslize; os marcos resolvidos no fim do jogo seguem a mesma regra (sem
  dono, os dados dos dois lados desbotam).
- As duas mãos ficam abertas em bandejas ao lado do tabuleiro, cada uma
  perto do seu jogador (ao lado em tela larga, abaixo e acima em tela
  estreita). A bolsa fica na mesa: uma bolsa de tecido, grande, com cordão e
  a boca franzida e aberta; os dados saem por ela e o dado perdido volta
  para ela. Quantos dados cada jogador perdeu
  aparece no cartão dele ("mão: 5 de 5 dados (2 perdidos)").
- Naipes: vermelho, azul, amarelo e verde nos dados da bolsa, grafite nos
  marcos. Cada face tem também uma marca no canto (círculo, quadrado,
  triângulo, losango), para o naipe não depender só da cor.
- Cartão das formações (HTML, à esquerda, sob os cartões dos jogadores): as 8
  formações da mais forte para a mais fraca, o que cada uma é e o
  desempate (maior soma; se empata, quem completou o lado primeiro). Em tela
  estreita fica escondido atrás do botão "Formações" da barra de cima.
- Cartas dos marcos (HTML, acima da mesa): para cada lado, o nome da formação
  e o lugar dela na ordem ("Trinca", "6ª de 8"), com a soma dita como
  desempate ("desempate: soma 14"). Um lado incompleto diz o que falta
  ("Faltam 2 dados") e até onde pode chegar ("pode chegar a quadra"). Um
  marco que pode ser reivindicado ganha a borda pulsante, o rótulo
  "Reivindicar" e, na mesa, os cantos e uma etiqueta ("Reivindicar · Par,
  soma 17"). Passar o mouse numa carta acende a coluna na mesa, e o
  contrário.
- Cada evento do motor vira uma animação: os marcos são rolados na
  preparação, os dados saem da boca da bolsa e rolam para a mão, o dado perdido sai
  da mão e volta para dentro da bolsa, os dados rolados saltam e mostram o número novo, o
  dado posto voa até o lado do marco, a reivindicação faz uma onda nos dados
  e desliza a coluna, e os marcos que sobram no fim do jogo vão para quem
  ganhou cada um. Na vez de um bot, a jogada é antecipada por marcas (dado
  levantado, anel no destino, cantos no marco, cruz e círculos tracejados
  no "rolar de novo"). Com "reduzir movimento" no sistema, as animações são
  puladas.

## Como se joga

- Toque (ou clique) num dado da sua mão e depois no marco onde ele vai, ou
  no próprio lado. Com um dado escolhido, passar o mouse num marco com lugar
  mostra o dado ali.
- Reivindicar: toque no marco marcado, ou na carta dele.
- Rolar de novo: o botão abre o painel (se um dado da sua mão já estava
  escolhido, o painel abre com a sua mão e esse dado marcado para rolar).
  Toque no dado da sua mão que você
  perde para sempre (cruz vermelha), escolha a mão (a sua ou a do adversário)
  e toque nos dados que serão rolados (círculos tracejados). O painel mostra
  o custo ("perde 2 amarelo", "rola 2 dados") e a mão fica limitada a um
  dado a menos até o fim. Ao rolar a própria mão, o dado perdido não pode ser
  rolado.
- Escape cancela a escolha em curso e Ctrl+Z desfaz até a última vez de uma
  pessoa, passando pelas jogadas dos bots.
- Na vez de um bot, a jogada sai de um Web Worker e aparece depois de pelo
  menos 0,6 s; os cliques ficam parados até lá. O bot joga sobre cópias do
  estado com outra semente: não sabe o que a bolsa e as rolagens vão dar.
- Dois jogadores no mesmo aparelho: a câmera gira para o assento de quem
  joga e a ordem das cartas dos marcos acompanha.
- A câmera não gira com o mouse nem com o toque: a inclinação é fixa e só o
  zoom é seu (roda do mouse, gesto de pinça ou os botões; o duplo clique ou o
  botão de centralizar voltam à vista inicial). Ela gira sozinha só para o
  assento de quem joga, o que só acontece com duas pessoas. Em tela estreita as bandejas ficam acima e abaixo do tabuleiro e
  as cartas dos marcos rolam na horizontal.

## Notas

- Os níveis dos bots (fácil, médio, difícil) são `greedy:noise=2`, `greedy` e
  `pimc`; não foram calibrados contra pessoas.
- O manual ainda não tem capítulo do Sia, então a interface não tem link de
  regras.
- Em desenvolvimento, `window.siaTable` e `window.siaScreen` expõem a mesa e
  a tela para testes no navegador (`siaTable.screenOf(pick)` dá a posição de
  um dado, de um marco ou de um lado na página).
