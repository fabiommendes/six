# Six

Coleção de seis jogos com dados de seis faces, jogados com o mesmo kit físico.
Cada jogo tem uma versão digital própria, com bots e jogo em rede. Este
monorepo coordena os seis: um livro de regras único, o site, a identidade
visual e uma pasta por implementação digital.

## Idioma

Nível 1 do ADR 0002 do tooling-root:

- A conversa com o humano é sempre em português, inclusive depois de um
  `/compact` ou de uma retomada de sessão.
- Português em todo texto: regras, manual, documentos de `dev/`, mensagens de
  commit.
- Código em inglês: identificadores, comentários e docstrings. Textos
  mostrados ao jogador são conteúdo do jogo e ficam em português.

## Comandos

`just` lista as receitas.

- Checagem: `just check` (build e lint do manual, sincronia com `regras/`,
  lint e testes do protótipo, `cargo fmt --check`, `cargo clippy` e
  `cargo test` do motor e dos bots em Rust, build WASM dos bots, tipos e teste
  em Node do `seks-wasm`, tipos, testes e build da interface web do Seks, e
  o mesmo para o Liu, motor, bots, WASM e interface web do Sia, e o mesmo
  para o Shesh, e o WASM e a interface web do jogo de missões). Define
  "pronto".
- Motor do Seks: `just seks-engine-test`.
- Motor em WebAssembly: `just seks-wasm` (pacote em `digital/seks/wasm/pkg`),
  `just seks-wasm-test` (partidas inteiras no Node), `just seks-types` (tipos
  TypeScript do `wire`). Pré-requisitos em `digital/seks/wasm/README.md`.
- Interface web do Seks: `just seks-web-dev` (servidor de desenvolvimento) e
  `just seks-web-check` (tipos, testes e build); ambos pedem `just seks-wasm`
  antes. Detalhes em `digital/seks/web/README.md`.
- Bots do Seks: `just seks-batch A B` (lote entre dois bots), `just
  seks-train [CONFIG]` (treino, retoma se parou), `just seks-experiments
  GRID` (grade de experimentos com resumo curto), `just seks-bench`
  (velocidade nativa e em WASM). Detalhes em `digital/seks/bots/EVALUATOR.md`
  e `dev/notes/bots-do-seks.md`.
- Liu: `just liu-engine-test` (motor), `just liu-wasm` e `just
  liu-wasm-test` (pacote WASM e partidas no Node, com o bot), `just
  liu-types`, `just liu-web-dev` e `just liu-web-check` (interface web, pede
  `just liu-wasm` antes). Detalhes em `digital/liu/web/README.md`.
- Bots do Liu: `just liu-batch A B` (lote entre dois bots) e `just liu-tune
  CONFIG` (calibração por CMA-ES, retoma se parou). Detalhes em
  `digital/liu/bots/README.md` e `dev/notes/bots-do-liu.md`.
- Sia: `just sia-engine-test` (motor), `just sia-wasm` e `just
  sia-wasm-test` (pacote WASM e partidas no Node, com o bot e o tempo do
  pimc), `just sia-types`, `just sia-web-dev` e `just sia-web-check`
  (interface web, pede `just sia-wasm` antes). Detalhes em
  `digital/sia/wasm/README.md` e `digital/sia/web/README.md`.
- Bots do Sia: `just sia-batch A B` (lote entre dois bots, com resumo de
  fim, duração, formações e rolagens) e `just sia-tune CONFIG` (calibração
  por CMA-ES). Detalhes em `digital/sia/bots/README.md` e
  `dev/notes/bots-do-sia.md`.
- Shesh (protótipo, regras em `dev/rfc/jogo-de-corrida.md`): `just
  shesh-engine-test` (motor), `just shesh-wasm` e `just shesh-wasm-test`
  (pacote WASM e partidas no Node, com o bot), `just shesh-types`, `just
  shesh-web-dev` e `just shesh-web-check` (interface web, pede `just
  shesh-wasm` antes). Detalhes em `digital/shesh/wasm/README.md` e
  `digital/shesh/web/README.md`.
- Bots do Shesh: `just shesh-batch A B` (lote entre dois bots, com variantes
  de regra por flag).
- Jogo de missões (protótipo sem nome, regras em `dev/rfc/jogo-de-missoes.md`):
  `just missoes-engine-test` e `just missoes-batch A,B[,C,D]` (lote entre 2 a
  4 bots, com variantes de regra por flag). `just missoes-wasm` e `just
  missoes-wasm-test` (pacote WASM e partidas no Node, com o bot), `just
  missoes-types`, `just missoes-web-dev` e `just missoes-web-check`
  (interface web, pede `just missoes-wasm` antes). Detalhes em
  `digital/missoes/wasm/README.md` e `digital/missoes/web/README.md`.
- Manual: `just manual` (site e PDF), `just manual-serve`, `just manual-check`
  (trechos do manual cujas fontes em `regras/` mudaram). Detalhes em
  `manual/README.md`.
- Site publicado: `just site` (manual na raiz e as interfaces do Seks em
  `seks/`, do Liu em `liu/`, do Sia em `sia/`, do Shesh em `shesh/` e do
  jogo de missões em `missoes/`, em
  `out/site`) e `just site-serve`. Cada push na `main` publica o site no GitHub Pages (`.github/workflows/pages.yml`).
- Issues, RFCs e ADRs: `r2 issue list`, `r2 rfc list`, `r2 adr list`.

## Mapa

| Pasta | Conteúdo |
|---|---|
| `regras/` | Fonte da verdade: `kit.md` e uma pasta por jogo, com o glossário do jogo |
| `manual/` | Livro de regras único (PDF e site) e o código que o gera |
| `digital/<jogo>/` | Uma pasta por implementação digital |
| `digital/seks/engine/` | Motor do Seks em Rust (`seks-engine`), no workspace Cargo de `digital/` |
| `digital/seks/wasm/` | `seks-wasm`: o motor (`Game`) e o bot (`Bot`) em WebAssembly e os tipos TypeScript do `wire` |
| `digital/seks/web/` | Interface web do Seks (Vite, TypeScript e Three.js): hotseat, jogo contra bot, partida por correspondência (link) e partida ao vivo (P2P), com o motor em WASM |
| `digital/seks/bots/` | Bots do Seks (`seks-bots`): aleatório, guloso e alfa-beta, lotes e treino |
| `digital/seks/prototipo/` | Protótipo do Seks em Python e Pyxel, referência de comportamento |
| `digital/liu/engine/` | Motor do Liu em Rust (`liu-engine`), com o sorteio dos dados no estado |
| `digital/liu/bots/` | Bots do Liu (`liu-bots`): aleatório, guloso e PIMC, lotes e calibração |
| `digital/liu/wasm/` | `liu-wasm`: o motor (`Game`) e o bot (`Bot`) do Liu em WebAssembly e os tipos TypeScript |
| `digital/liu/web/` | Interface web do Liu (Vite, TypeScript e Three.js): mesa em 3D, 2 a 4 jogadores no mesmo aparelho, pessoas ou bots |
| `digital/sia/engine/` | Motor do Sia em Rust (`sia-engine`), com os dados no estado e a prova de reivindicação |
| `digital/sia/bots/` | Bots do Sia (`sia-bots`): aleatório, guloso e PIMC, lotes e calibração |
| `digital/sia/wasm/` | `sia-wasm`: o motor (`Game`) e o bot (`Bot`) do Sia em WebAssembly e os tipos TypeScript |
| `digital/sia/web/` | Interface web do Sia (Vite, TypeScript e Three.js): mesa em 3D sobre o tabuleiro do Seks, dois jogadores no mesmo aparelho, contra bot ou bot contra bot |
| `digital/shesh/engine/` | Motor do Shesh, o jogo de corrida (protótipo), em Rust (`shesh-engine`), com os dados binários no estado |
| `digital/shesh/bots/` | Bots do Shesh (`shesh-bots`): aleatório, guloso e expectimax, lotes |
| `digital/shesh/wasm/` | `shesh-wasm`: o motor (`Game`) e o bot (`Bot`) do Shesh em WebAssembly e os tipos TypeScript |
| `digital/shesh/web/` | Interface web do Shesh (Vite, TypeScript e Three.js): mesa em 3D sobre o tabuleiro do Seks com a trilha destacada, dois jogadores no mesmo aparelho, contra bot ou bot contra bot |
| `digital/missoes/engine/` | Motor do jogo de missões (protótipo), em Rust (`missoes-engine`), que chama os jogadores a cada decisão (`Game`) ou espera cada resposta (`Steps`) |
| `digital/missoes/bots/` | Bots do jogo de missões (`missoes-bots`): aleatório e guloso, com variantes sem compra e sem lance, lotes |
| `digital/missoes/wasm/` | `missoes-wasm`: o jogo de missões em WebAssembly, uma decisão por vez, com os bots dos lugares de bot e os tipos TypeScript |
| `digital/missoes/web/` | Interface web do jogo de missões (Vite, TypeScript e Three.js): mesa em 3D com 2 a 4 jogadores no mesmo aparelho, pessoas ou bots |
| `arte/` | Identidade visual (ADR 0005); `esbocos/` guarda as quatro direções esboçadas, como referência |
| `dev/` | `rfc/`, `adr/`, `issues/`, `notes/`; `handoffs/` e `esbocos/` (temporários) ficam fora do git |

## Regras

- O fluxo de documentos segue o ADR 0003 do tooling-root
  (`~/git/tools/tooling-root/dev/adr/0003-modelo-de-repositorio.md`): RFC,
  depois ADR, issues e stories. Issues e RFCs se chamam `<slug>.md`; ADRs,
  `NNNN-<slug>.md`.
- Mantenha o histórico linear: rebase e `git merge --ff-only`, nunca commits
  de merge.
- Outras sessões também fazem commit aqui: releia cada arquivo logo antes de
  editá-lo e adicione ao stage só as suas mudanças.

### Regras dos jogos

- `regras/` é a fonte da verdade. O manual e as versões digitais derivam
  dela; quando divergem, `regras/` vence.
- Escreva em `regras/` só o que o designer confirmou. Marque o resto com os
  rótulos de `regras/README.md#rótulos-de-status`.
- Sempre que o designer mudar ou refinar uma regra, em qualquer sessão,
  atualize os arquivos de `regras/` afetados e o glossário do jogo no mesmo
  trabalho. Uma decisão registrada só num ADR, numa nota, no código ou no
  manual não é regra.
- Cada termo de um glossário tem uma linha `en:`. Código usa o termo em
  inglês; texto em português usa o termo em português. Palavras de `Não usar:`
  nunca aparecem no manual, no site ou no jogo.
- Todos os jogos usam o kit físico de `regras/kit.md`. Um jogo que pede um
  componente fora do kit muda o kit, e isso afeta os outros jogos: confirme com
  o designer.
- Renomear um título de `regras/` ou um termo de glossário quebra as âncoras
  do manual: rode `just manual-check` e corrija o que quebrar.
- Mudou uma regra: atualize o trecho do manual que a reformula, rode
  `sync-mark` nele (ver `manual/README.md`) e faça commit do lock junto.
