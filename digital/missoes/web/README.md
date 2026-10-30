# Interface web do jogo de missões

Partidas de 2 a 4 jogadores no mesmo aparelho, cada lugar uma pessoa ou um
bot, em Vite e TypeScript, com o motor e os bots em WebAssembly
(`digital/missoes/wasm`). A mesa é desenhada em 3D com Three.js; o painel
da direita (jogadores, decisão da vez, missões, vitrine e histórico) é HTML.

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
| `src/logic/act.ts` | A ação de uma pessoa montada dado a dado: 0 e alvo, modificador, alvo e sentido, sacrifício e dados que rolam de novo |
| `src/logic/texts.ts` | Todo texto mostrado ao jogador: tipos de dado, missões, pedidos e linhas do histórico |
| `src/logic/seats.ts` | Os bots da tela inicial, os nomes padrão e as metas |
| `src/table/` | A mesa em 3D (`Table3D`): disposição (`layout.ts`), texturas desenhadas em canvas (faces, bandejas, cartas) e a animação de rolar |
| `src/ui/` | Tela inicial, tela do jogo e os ícones SVG dos dados |

## A mesa

- Cada jogador tem uma bandeja com a cor do lugar: a reserva atrás, a mão
  na frente. O primeiro lugar fica embaixo.
- No meio ficam a missão padrão e as cartas da mesa (riscadas quando
  sabotadas), com os marcadores dos jogadores, e a vitrine à direita.
- Cada tipo de dado tem uma cor e uma marca no canto, para a cor não ser a
  única pista: comum (marfim, sem marca), ouro (dourado, O), ouro alto
  (dourado, O+), um (preto, U), baixo (azul, B), alto (vermelho, A), par
  (verde, P), ímpar (marrom, I), binário (turquesa, 01) e modificador
  (roxo, ±; as faces mostram ±1 e ±2). Os lugares têm cor e forma de
  marcador (círculo, quadrado, triângulo, losango).
- Dados que não contam na missão (0, modificador, usados, ouros de quem
  comprou) ficam esmaecidos; os sacrificados, quase transparentes.

## Como se joga

- Na vez de uma pessoa, o painel mostra o pedido e as opções; dados e
  cartas também se escolhem tocando na mesa. O que pode ser escolhido tem
  um quadrado tracejado; o escolhido, um quadrado grosso.
- Escolher: toque nos dados da reserva até completar 6 e em Rolar.
- Dinheiro: toque nos dados de fora da mão para tirá-los do jogo, ou Não
  trocar. Sem dado de fora, a resposta é automática.
- Comprar: toque num dado da vitrine e em Comprar, ou Não comprar.
- Marcar: toque numa missão (o botão diz quanto você faz em cada uma).
- Agir: toque num 0 e depois no dado que ele rola de novo; ou num
  modificador, no dado que ele move e em +N ou −N; ou em Sacrificar, no
  dado que sai e nos que rolam de novo; ou em Sabotar; ou em Passar.
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
