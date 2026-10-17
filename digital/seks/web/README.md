# Interface web do Seks

Vite, TypeScript e Three.js. O motor roda no navegador em WebAssembly
(`digital/seks/wasm`). Contexto: `dev/issues/interface-web-do-seks.md`.
Hotseat ou jogo contra o bot, com toque ou mouse, em retrato e paisagem.

## Comandos

- `just seks-wasm`: gera o pacote WASM em `digital/seks/wasm/pkg` (a interface
  importa dele; não vai para o git).
- `just seks-web-install`: instala as dependências (pnpm).
- `just seks-web-dev`: servidor de desenvolvimento.
- `just seks-web-check`: tipos, testes e build (`dist/`).

## Estrutura

- `src/engine`: carregador do WASM e invólucro tipado do `Game`.
- `src/logic`: seleção, partida (`Match`, desfazer, capturados), contador,
  textos ao jogador e posições de teste. Não depende de DOM nem de WebGL.
  Partida por correspondência: `link.ts` (formato do link, genérico),
  `seks-link.ts` (o Seks no formato) e `mail-games.ts` (partidas guardadas).
- `src/bot`: Web Worker do bot, protocolo e níveis; `chooser.ts` roda o bot do `seks-bots` (WASM).
- `src/board`: tabuleiro e dados em Three.js, motivo da moldura.
- `src/ui`: telas (inicial e de jogo) e o painel, em DOM.
- `tests/`: vitest com o WASM real no Node, sem mock do motor.

## Vistas

Vista de cima: câmera ortográfica. Vista inclinada: câmera em perspectiva
(campo de visão de 35 graus, 38 graus da vertical) e o tabuleiro como um bloco
de meio dado de espessura (`BOARD_THICKNESS`). Nas duas, `src/board/view.ts`
ajusta a câmera para o tabuleiro inteiro, com coordenadas, caber no canvas em
qualquer proporção.

No desktop o canvas ocupa o retângulo à esquerda do painel (não um quadrado), e
a câmera enquadra pela largura e pela altura reais. A vista inclinada é mais larga
que alta, então ela usa a largura toda e sobra espaço acima e abaixo; só em
retrato (celular) o canvas é quadrado.

O tabuleiro é visto do lado do jogador: contra o bot, o humano fica embaixo (com
as Pretas, a fileira 11 fica embaixo e a coluna k à esquerda); em hotseat, o
tabuleiro gira meia volta para o lado da vez depois que a animação da jogada
termina, e também ao desfazer. Em desenvolvimento (`vite`), a partida, a vista e
a orientação sobrevivem a reload e HMR (`sessionStorage`; `logic/session.ts`).

A vista escolhida (de cima ou inclinada) fica no `localStorage` (`logic/view-preference.ts`),
em qualquer build, e vale para as próximas partidas e visitas, inclusive depois de
"Nova partida". Uma partida restaurada pela sessão do desenvolvimento mantém a sua
vista enquanto dura; um valor inválido no storage é ignorado.

## Posições de teste

`?fixture=NOME` abre uma posição pronta, para olhar a tela sem jogar até lá:

- `esboco`: a partida do esboço de arte (`arte/esbocos/c-motivos-por-lingua/jogo.png`),
  com o contador visível.
- `contador`: a mesma posição com 85 jogadas sem captura.
- `fim`: as Brancas ganham jogando c8 para c11 (hotseat).
- `vitoria` e `derrota`: a mesma posição contra o bot, com o jogador nas
  Brancas (joga c8 para c11) ou nas Pretas (o bot joga c8 para c11).
- `empate`: 99 jogadas sem captura; b4 para b5 empata.
- `sem-jogada`: a1 para a2 deixa as Pretas sem jogada.

## Bot

O bot é o alfa-beta de `seks-bots`, no WASM (`Bot` de `digital/seks/wasm`).
Roda num Web Worker, um por partida, que guarda a tabela de transposição entre
as jogadas. Os níveis da tela inicial (`src/bot/levels.ts`) são orçamentos de
busca, não de tempo, então valem em qualquer máquina:

| Nível | Nós por jogada | Ruído |
|---|---|---|
| Fácil | 200 | 100 (um dado) |
| Médio | 2000 | 30 |
| Difícil | o padrão do `seks-bots` (`Bot.defaultNodes()`) | 0 |

O Difícil acompanha o padrão dos bots quando ele muda. O ruído sorteia entre as
jogadas até essa distância da melhor.

## Fim da partida

Quando a partida acaba (e a última jogada pousou), um cartão sobe sobre o
tabuleiro, no lado oposto ao da última jogada: "Você venceu" ou "Você perdeu"
(contra o bot e por correspondência), "Vitória das Brancas/Pretas" (hotseat e
bots), ou "Empate", com o motivo numa linha. No tabuleiro, uma moldura dupla
vermelha marca o que decidiu: o dado que chegou à fileira de fundo, ou os dados
do lado que ficou sem jogada. "Ver tabuleiro" fecha o cartão; o painel continua
com o resultado, e "Desfazer" vale onde já valia. A animação de subida só
roda sem `prefers-reduced-motion`.

## Sair da partida local

Em hotseat e contra o bot, "Sair da partida" oferece "Voltar para o início" ou
"Terminar com bots": os bots (nível padrão, `Match.finishWithBots`) jogam os dois
lados, com no mínimo 0,3 s entre o início de uma jogada e o da seguinte (um bot que demora mais joga assim que responde, sem espera extra), e o jogador assiste até o fim.
"Interromper" para os bots na posição de agora. Não há desfazer nem clique no
tabuleiro enquanto os bots jogam, e o fim mostra o resultado neutro.

## Partida por correspondência

A partida viaja num link, sem servidor (`dev/rfc/rede-sem-servidor.md`). Quem
cria escolhe a cor, joga e manda o link; quem abre vê a posição, joga se for a
vez da sua cor e manda outro link de volta. Não há identidade: quem abre joga a
cor da vez.

O link é um fragmento (`#`, que não vai ao servidor): `v1.<id>.<posição>.<jogadas>`
com uma quinta parte opcional que diz quem desistiu.

- `id`: 8 caracteres aleatórios; identifica a partida, para o link que volta
  atualizar a entrada certa da lista;
- `posição`: vazia para a inicial padrão; senão `p`, a cor da vez (`w` ou `b`)
  e 121 dígitos (uma posição de `Game.fromDiagram`, sem histórico);
- `jogadas`: o índice de cada jogada na lista de `legalCommands()` do motor, em
  varint de 7 bits e base64url. Uma partida de 300 jogadas tem 413 caracteres.

O formato só funciona porque o motor lista as jogadas legais sempre na mesma ordem
(`legal_commands` em `digital/seks/engine/src/command.rs`). `tests/seks-link.test.ts`
trava essa ordem com um vetor fixo: mudar a ordem sem mudar a versão do formato
quebra os links já enviados, e o teste falha antes.

Na interface:

- tela inicial: "Por correspondência" cria a partida; a lista abaixo guarda as
  partidas em andamento (`localStorage`, `seks-web:mail`), com a cor e de quem é a
  vez; as terminadas têm "Remover";
- depois de jogar, o painel mostra o link, com "Copiar link" e "Compartilhar"
  (onde há `navigator.share`). Até copiar ou compartilhar a jogada pode ser
  desfeita; depois, não (as jogadas que vieram em links nunca podem);
- link inválido (texto corrompido, versão desconhecida, jogada ilegal) mostra um
  aviso na tela inicial; um link mais velho que a partida guardada abre a guardada;
- "Desistir" (com confirmação) tira a partida da lista e mostra o link que avisa o
  outro jogador. Quem o abre escolhe "Continuar contra o bot" (da posição atual, com
  a mesma cor e o nível escolhido) ou "Encerrar". Não há regra de resultado.

O fragmento da página é `#g.<id>` enquanto uma partida guardada está aberta, e a
página reage a `hashchange` (um link colado numa aba já aberta).
