# Interface web do Seks

Vite, TypeScript e Three.js. O motor roda no navegador em WebAssembly
(`digital/seks/wasm`). Contexto: `dev/issues/interface-web-do-seks.md`.
Hotseat, jogo contra o bot, partida por correspondência (link) e partida ao vivo
(P2P), com toque ou mouse, em retrato e paisagem.

## Comandos

- `just seks-wasm`: gera o pacote WASM em `digital/seks/wasm/pkg` (a interface
  importa dele; não vai para o git).
- `just seks-web-install`: instala as dependências (pnpm).
- `just seks-web-dev`: servidor de desenvolvimento.
- `just seks-web-check`: tipos, testes e build (`dist/`).
- `just site`: o site publicado em `out/site`, com o manual na raiz e esta
  interface em `seks/`. A tela inicial liga para as regras (`../seks.html`) e
  para a entrada da coleção (`../`), que só existem nesse build.

## Estrutura

- `src/engine`: carregador do WASM e invólucro tipado do `Game`.
- `src/logic`: seleção, partida (`Match`, desfazer, capturados), contador,
  textos ao jogador e posições de teste. Não depende de DOM nem de WebGL.
  Partida por correspondência: `link.ts` (formato do link, genérico),
  `seks-link.ts` (o Seks no formato) e `mail-games.ts` (partidas guardadas, de
  correspondência e ao vivo). Partida ao vivo: `invite.ts` (o link de convite).
- `src/net`: a rede da partida ao vivo, sem DOM e sem regras do Seks: `transport.ts`
  (a interface), `trystero-transport.ts` (a implementação com Trystero),
  `live-protocol.ts` (as mensagens), `live-session.ts` (a sessão) e
  `fallback-timer.ts` (quando oferecer a correspondência).
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
- "Desistir" (com confirmação) mostra o link que avisa o outro jogador. A partida
  fica na lista, marcada como desistida, até o link ser copiado ou compartilhado
  (um reload antes disso não a perde); só então sai da lista. Quem abre o link
  escolhe "Continuar contra o bot" (da posição atual, com a mesma cor e o nível
  escolhido) ou "Encerrar". Não há regra de resultado.

O fragmento da página é `#g.<id>` enquanto uma partida guardada está aberta, e a
página reage a `hashchange` (um link colado numa aba já aberta).

## Partida ao vivo

Os dois navegadores se ligam por WebRTC e trocam as jogadas na hora, sem servidor
do jogo (`dev/rfc/rede-sem-servidor.md`). Só a sinalização (o aperto de mão
inicial) passa por infraestrutura pública; depois o tráfego é direto.

**Biblioteca e estratégia.** `@trystero-p2p/nostr` 0.26.0, fixada no
`package.json` (o pacote `trystero` só a reexporta; a API mudou entre versões, por
isso a versão exata). A sinalização usa relays Nostr, a lista padrão da
biblioteca (dezenas de relays públicos; a lista é dela e muda entre versões, e
alguns relays falham ou limitam o uso, o que ela tolera). O `appId` é `six-seks`
e a sala de cada partida é `seks.<id>`. Se a biblioteca ou a estratégia mudar,
só `src/net/trystero-transport.ts` muda: o resto fala com a interface `Transport`
(`join(sala)` devolve uma `Room` com `send`, `peers` e `leave`), e os testes usam um
transporte em memória (`tests/live-fakes.ts`). Sem servidor TURN, 10% a 20% dos
pares de redes não conectam (NAT simétrico, comum em 4G): daí o fallback.

**Convite.** "Ao vivo" na tela inicial cria a partida (cor escolhida) e mostra o
link `#i1.<id>.<w|b>`: o `id` é o da partida (e da sala) e a letra é a cor de
quem convida. Quem abre joga a outra cor. A partida é uma entrada da lista
guardada (`MailGame` com `live: { host }`), com o mesmo `id` da correspondência. Abrir
o convite de novo, ou a partida pela lista, volta à mesma sala.

**Mensagens** (`live-protocol.ts`, JSON num canal de texto, todas com `v: 1`):

- `state`: a partida inteira no formato do link (`g`). Vai quando o outro entra,
  na reconexão, como resposta a qualquer problema e de 10 em 10 segundos
  enquanto conectado (cobre uma mensagem perdida com a conexão de pé, que
  travaria a vez dos dois);
- `move`: `n` (índice da jogada), `c` (a jogada) e `h` (o hash da posição depois
  dela);
- `resign`: quem manda saiu da partida.

Cada lado confere o que chega com o próprio motor. Jogada ilegal, número fora de
ordem ou hash diferente: o lado manda o seu `state`. Um `state` que é prefixo do
meu é respondido com o meu; se o meu é prefixo do dele, adoto; se divergem, vale o
do anfitrião (quem convidou), e a tela é refeita a partir dele.

**Interface.** O painel mostra a conexão (conectando, conectado, o outro jogador
saiu), o link do convite enquanto ninguém entrou e a vez, como nas outras partidas.
Não há "Desfazer". Se ninguém conecta, ou a conexão cai e não volta, em 20 s
aparece "Continuar por correspondência": a entrada perde o `live` (o `id` é o mesmo)
e a partida segue pelo link, da posição de agora. Abrir um link de correspondência
de uma partida ao vivo também a tira do modo ao vivo.

"Desistir" com o outro conectado manda `resign` e volta ao início (a partida sai
da lista); o outro vê "saíram da partida" e escolhe "Continuar contra o bot" ou
"Encerrar", como na correspondência. Sem conexão, vira a desistência da
correspondência (link, partida marcada até enviar).

**Verificação no navegador.** O `just check` não usa a rede real. Para ver com
duas abas ligadas pela sinalização pública, rode `just seks-web-dev` (ou o
`vite preview` do `dist/`), abra a partida ao vivo numa aba e o convite noutro
contexto do navegador (outro perfil, ou janela anônima, porque o `localStorage` é
por perfil e a partida de cada lado fica nele). A conexão leva de 1 a 10 s.
