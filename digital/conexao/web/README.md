# Interface web do jogo de conexão

Partidas de dois jogadores no mesmo aparelho, contra um bot ou bot contra
bot, em Vite e TypeScript, com o motor e os bots do jogo de conexão em
WebAssembly (`digital/conexao/wasm`). A mesa é desenhada em 3D com Three.js
sobre o tabuleiro de 11 por 11 casas do Seks, com os dados brancos e pretos do
Seks. Os painéis (jogadores, regras, vez e ações, histórico e fim do jogo)
ficam por cima, em HTML.

As regras são as de `dev/rfc/jogo-de-conexao.md` (seções Proposal e
Decisions). O jogo é um protótipo sem nome: as regras não estão em `regras/`,
e a interface ainda não tem motivo nem cor própria (ver Notas).

## Comandos

- `just conexao-wasm` antes de tudo: o pacote WASM não vai para o git.
- `just conexao-web-dev`: servidor de desenvolvimento.
- `just conexao-web-check`: tipos, testes (Vitest, com o motor real) e build
  em `dist/`. Faz parte do `just check`.
- `just site` publica o build em `out/site/conexao/`.

## Organização

| Caminho | Conteúdo |
|---|---|
| `src/engine/` | `ConexaoGame` e `ConexaoBot`, o `Game` e o `Bot` do WASM com JSON tipado, as casas (`fileira * 11 + coluna`) e os vizinhos, e o carregamento do módulo |
| `src/bot/` | Os bots oferecidos (`greedy`, `lookahead` e `search` de `conexao-bots`), o Web Worker do bot e o cliente que fala com ele |
| `src/table/` | A mesa em 3D (`Table3D`): disposição (`layout.ts`), texturas desenhadas em canvas (tabuleiro, dados, bandejas, marcas), o motivo da moldura (`motif.ts`, o mesmo do Sia), a animação de cada lance e os sons |
| `src/logic/selection.ts` | Toques no tabuleiro: dado a aumentar, casa de colocar, casa do bloqueante e dado tirado do tabuleiro |
| `src/logic/texts.ts` | Todo texto mostrado ao jogador, com os termos da RFC |
| `src/logic/save.ts` | A partida salva no `localStorage` (nomes, quem é bot e o estado, com as regras), para continuar depois |
| `src/ui/` | Tela inicial (modo, jogadores e regras), tela do jogo (painéis sobre a mesa) e os ícones SVG dos dados |

## Antes da partida

A tela inicial escolhe o modo (dois jogadores, contra o bot, bot contra bot),
o nome e o bot de cada lado e as variantes de regra: tabuleiro 11x11 ou 9x9,
meta (linha ou chegar), captura, bloqueante da reserva ou do tabuleiro (ou só
da reserva) e de 10 a 20 dados de cada cor. As outras regras ficam nas da
proposta: dado colocado com 2, bloqueio só nas três fileiras centrais, empate
com 300 turnos. As escolhas ficam guardadas para a próxima partida.

## O tabuleiro

- As fileiras contam do lado das Brancas (embaixo, para quem joga com elas),
  de 1 a 11, e as colunas da esquerda, de `a` a `k`; o histórico usa esses
  nomes ("f1"). A câmera gira para o lado de quem joga.
- O 9x9 fica no centro do tabuleiro do Seks; as casas em volta ficam
  acinzentadas e fora do jogo. (O motor usa o canto da grade; a interface só
  desloca o desenho.)
- A fileira de fundo de cada lado tem um tom, e o nome dela fica na borda
  ("fundo das Brancas", "fundo das Pretas"). As fileiras do bloqueio têm um
  tom na cor do jogo e uma barra nas duas bordas laterais.
- Ao lado do tabuleiro, cada jogador tem duas bandejas: a reserva e os dados
  da sua cor capturados. O rótulo da reserva leva o nome do jogador e acende
  na vez dele.

## Como se joga

As marcas saem dos lances legais do motor, e cada uma tem forma própria:
anel para colocar, losango para bloquear, colchetes nos dados a escolher,
quadrado grosso no que já foi escolhido e cantos no último lance (com um
quadrado tracejado no dado que saiu do tabuleiro).

- **Colocar:** toque numa casa com anel. O dado entra na hora.
- **Aumentar:** toque num dado (de qualquer cor) e toque nele de novo, ou em
  Aumentar. O texto da vez mostra os vizinhos dele contra o limite ("O 2 tem
  1 vizinho: cabe mais 1").
- **Aumentar e bloquear:** toque no dado que vai aumentar; os losangos
  mostram onde o bloqueante cabe depois do aumento; toque num deles. Também
  vale ao contrário: toque primeiro numa casa com losango e depois num dado
  com colchetes. Uma casa que tem anel e losango ao mesmo tempo coloca no
  primeiro toque; para bloquear nela, escolha antes o dado.
- **Reserva vazia:** depois da casa (e do dado a aumentar), os colchetes
  marcam os dados seus que podem sair do tabuleiro; toque num deles.
- Escape ou Cancelar desfazem a escolha; Desfazer (Ctrl+Z) volta até a
  última vez de uma pessoa, passando pelos lances do bot.
- Na vez de um bot, o lance sai de um Web Worker, depois de pelo menos 0,6 s,
  e as casas dele ficam marcadas um instante antes de ele jogar. O `search`
  pode levar alguns segundos por lance.
- Um dado capturado sobe com o rótulo "Capturado" e vai para a bandeja dos
  capturados da cor dele.

## Notas

- O jogo não tem nome, então não tem motivo nem ponto na face de seis
  (ADR 0005). A moldura usa a malha nórdica do Seks, porque o jogo usa o
  tabuleiro do Seks, num roxo provisório (`#7A3E6B`) que não é de nenhum dos
  seis jogos; os seis pontos da face ficam vazados.
- Os bots não foram calibrados contra pessoas.
- Em desenvolvimento, `window.conexaoTable` e `window.conexaoScreen` expõem a
  mesa e a tela para testes no navegador (`conexaoTable.screenOf(casa)` dá a
  posição de uma casa na página, `conexaoScreen.current` a `View`).
