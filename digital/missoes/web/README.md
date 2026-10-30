# Interface web do jogo de missões

Partidas de 2 a 4 jogadores no mesmo aparelho, cada lugar uma pessoa ou um
bot, em Vite e TypeScript, com o motor e os bots em WebAssembly
(`digital/missoes/wasm`). A mesa é desenhada em 3D com Three.js; o painel
da direita (placar, missões, vitrine e histórico) e a barra sob a mesa
(o pedido da vez e os botões) são HTML.

As regras são as da seção Proposal de `dev/rfc/jogo-de-missoes.md`. O jogo
ainda é um protótipo sem nome: "Missões" é título provisório, e a
interface não tem cor nem motivo próprios (usa o dourado dos ouros).

## Comandos

- `just missoes-wasm` antes de tudo: o pacote WASM não vai para o git.
- `just missoes-web-dev`: servidor de desenvolvimento.
- `just missoes-web-check`: tipos, testes (Vitest, com o motor real) e build
  em `dist/`. Faz parte do `just check`.
- `just site` publica o build em `out/site/missoes/`.

## Organização

| Caminho | Conteúdo |
|---|---|
| `src/engine/` | `LocalGame` (o `Game` do WASM com JSON tipado), o Web Worker que roda o jogo e os bots, e `RemoteGame`, que fala com ele |
| `src/logic/act.ts` | A ação de uma pessoa montada por toques na mesa: 0 e alvo, modificador, alvo e sentido, sacrifício e dados que rolam de novo, sabotagem |
| `src/logic/texts.ts` | Todo texto mostrado ao jogador: tipos de dado, missões, pedidos e linhas do histórico |
| `src/logic/seats.ts` | Os bots da tela inicial, os nomes padrão e as metas |
| `src/table/` | A mesa em 3D (`Table3D`): disposição (`layout.ts`), texturas desenhadas em canvas (faces, bandejas, cartas) e a animação de rolar |
| `src/ui/` | Tela inicial, tela do jogo e os ícones SVG dos dados |

## A mesa

- Cada jogador tem uma bandeja com a cor do lugar: o nome e o placar no
  alto, a reserva no meio e a mão na frente, num tapete escuro só dela. O
  primeiro lugar fica embaixo.
- O placar é `X+Y`: X são os pontos, Y o que a rodada daria se terminasse
  agora (`RoundView.score`), na bandeja e no painel, para todos.
- Um 0 ou modificador já usado e um dado sacrificado saem do tapete e
  voltam para a reserva, com a face que mostram. Lá eles não contam; o
  ouro de quem comprou fica na mão, esmaecido.
- No meio ficam a missão padrão e as cartas da mesa, com os marcadores
  dos jogadores, e a vitrine à direita. A carta e o painel dizem o objetivo e a
  pontuação (os textos estão em `src/logic/texts.ts`, `MISSION_RULES`); as
  cartas 1 a 6 mostram o número grande no alto. Na vez de uma pessoa de
  marcar ou de agir, cada carta mostra quanto ela faz ali.
- Uma missão sabotada, a padrão também, fica escura, com "sabotada" e
  "volta na próxima rodada": ela não conta nesta rodada. A carta sabotada
  continua na mesa na rodada seguinte, e a padrão volta.
- Cada tipo de dado tem uma cor e uma marca no canto, para a cor não ser a
  única pista: comum (marfim, sem marca), ouro (dourado, O), ouro alto
  (dourado, O+), um (preto, U), baixo (azul, B), alto (vermelho, A), par
  (verde, P), ímpar (marrom, I), binário (turquesa, 01) e modificador
  (roxo, ±; as faces mostram ±1 e ±2). Os lugares têm cor e forma de
  marcador (círculo, quadrado, triângulo, losango).

## Como se joga

- Toda escolha se faz tocando na mesa. O que pode ser tocado agora tem um
  quadrado tracejado; o escolhido, um quadrado dourado. A barra sob a mesa
  diz o que fazer e tem só os botões sem objeto na mesa: confirmar,
  cancelar, passar e não comprar. O botão de confirmar só se acende depois
  que o motor confere a resposta (`check`).
- Escolher: toque nos dados da reserva para levá-los ao tapete, até 6, e em
  Rolar; um toque no tapete devolve o dado.
- Dinheiro: toque nos dados da reserva que saem do jogo e confirme (ou Não
  trocar). Sem dado de fora, a resposta é automática.
- Comprar: toque num dado da vitrine e em Comprar, ou Não comprar.
- Marcar: toque numa missão.
- Agir: toque num 0 e no dado que ele rola de novo; num modificador, no
  dado que ele move e em +N ou −N, que aparecem sobre o dado; em qualquer
  outro dado da mão (ou num 0 ou modificador já usado, na reserva) para
  sacrificá-lo (ele já aparece na reserva), depois nos dados do tapete que
  rolam de novo e em Sacrificar; numa missão, a padrão ou uma carta, para
  sabotá-la, e confirme; ou em Passar. Um segundo toque no 0 ou no
  modificador escolhido o sacrifica.
- No fim de cada rodada, uma janela mostra a missão, o resultado e os pontos
  de cada um; a mesa fica como a rodada terminou até Próxima rodada. Com só
  bots, a partida segue sozinha.
- Os bots jogam num Web Worker, com pelo menos 0,65 s por decisão.

## Notas

- Os bots são `random` (fácil) e `greedy` (médio), sem calibração contra
  pessoas.
- A partida não é salva: sair ou recarregar a página a perde.
- Em desenvolvimento, `window.missoesScreen` e `window.missoesTable` expõem a
  tela e a mesa para testes no navegador (`missoesTable.screenOf(key)` dá a
  posição de um dado ou de uma carta na página).
