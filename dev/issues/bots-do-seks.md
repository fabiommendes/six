---
type: issue
status: in_progress
tags: [seks, digital, rust, bots]
relatedTo: [dev/issues/motor-do-seks-em-rust.md, dev/adr/0004-bots-do-seks-alfa-beta-com-avaliacao-ajustada.md, regras/seks]
kind: enhancement
created: 2026-10-17
creator: claude
---

# Bots do Seks

## Context

A issue do motor (`motor-do-seks-em-rust.md`, R5) cria o crate `seks-bots`
com um bot aleatório e um guloso de um nível. O designer quer bots fortes e
uma fase de treinamento. O Seks tem informação completa e não tem sorte, então
cabe busca em árvore clássica, sem a amostragem que o Rio precisa.

Números medidos com uma simulação rápida das regras (partidas aleatórias e
gulosas, 2026-10-17):

- Fator de ramificação: 98 na posição inicial, média de 100 e máximo de 150
  nas partidas. O teto teórico passa de 700 (16 dados de valor 6), mas não
  aparece na prática. O xadrez tem cerca de 35.
- 298 de 300 partidas aleatórias empataram por 100 jogadas sem captura. O
  guloso de um nível (ganha se puder, captura se puder, evita perder na
  jogada seguinte) empatou 16 de 20 do mesmo jeito. Rollouts aleatórios quase
  só produzem empates e dizem pouco sobre a posição.
- A vitória pela fileira de fundo é uma ameaça de uma jogada, como um xeque:
  o jogo é tático e tem armadilhas rasas.

A abordagem escolhida está no ADR 0004: alfa-beta escrito à mão, com uma
avaliação linear sobre features feitas à mão e pesos ajustados por Texel
tuning em partidas de autojogo. Sem crate de busca nem de rede neural. Uma
rede pequena (NNUE) fica para outra issue, se a avaliação linear não bastar.

Os bots rodam no servidor de rede e em WASM no navegador (issues futuras): o
bot de jogo tem de ser leve; o treinamento roda offline, só em CPU (Ryzen 5
3600, 12 threads). A GPU da máquina (RX 6600, 8 GB, dividida com o desktop)
está fora da lista oficial do ROCm, mas funciona com override, segundo o
designer. Ela fica como recurso de reserva: só entra se o treino na CPU
travar com os bots já jogando normalmente. Um modelo linear treina em minutos
na CPU.

O crate segue a estrutura do `rio-bots`: trait `Bot`, `by_name(spec)`,
executor em lote com threads, linha de comando com argumentos lidos à mão,
arquivos de partida, `EVALUATOR.md` com as features e os pesos.

## Requirements

- R1. O crate `seks-bots` (`digital/seks/bots/`) expõe a trait `Bot` e
  `by_name(spec)`, com os bots `random`, `greedy` e `ab` (alfa-beta).
  - Aceito quando toda spec documentada no `//!` de `lib.rs` é aceita por
    `by_name` e uma spec inválida devolve erro, coberto por testes.
- R2. `seks-bots batch` joga partidas em lote entre dois bots, cada abertura
  uma vez com cada cor, em várias threads, e resume o resultado: pontos
  (vitória 1, empate 1/2), Elo com intervalo de confiança de 95%, empates por
  causa, número médio de jogadas, tempo e nós por jogada.
  - Aceito quando a mesma semente com bots limitados por nós dá a mesma saída
    (fora os campos de tempo) com 1 e com 12 threads, e 1000 partidas
    `random` contra `greedy` terminam sem erro.
  - Aceito quando `seks-bots replay` repete cada arquivo de partida pelo
    `Engine::command` e chega ao mesmo resultado.
- R3. O bot `ab` busca com alfa-beta e aprofundamento iterativo, tabela de
  transposição pelo `GameState::position_hash` e busca de quiescência; para
  por profundidade, por nós ou por um callback de parada. O núcleo da busca
  não lê relógio nem cria threads, para rodar em `wasm32-unknown-unknown`.
  - Aceito quando, em posições pequenas, a nota do alfa-beta é igual à de um
    minimax sem poda até a profundidade 3, num teste.
  - Aceito quando o `ab` no nível padrão resolve 100% de uma suíte de pelo
    menos 30 posições táticas: vencer em 1, impedir a vitória do adversário
    na jogada seguinte, vencer em 2 forçado, e capturar para desfazer uma
    ameaça.
- R4. A avaliação é linear sobre features listadas no `EVALUATOR.md`, da
  perspectiva do jogador da vez. Os pesos ficam num JSON no git e entram no
  binário por `include_str!`; o `ab` também aceita pesos de um arquivo.
  - Aceito quando testes mostram que trocar as cores (espelhar as fileiras e
    passar a vez) e espelhar as colunas não mudam a nota.
- R5. O treinamento gera partidas de autojogo, ajusta os pesos por Texel
  tuning e só promove uma geração que vence a anterior numa partida em lote.
  - Aceito quando os pesos promovidos vencem os pesos à mão
    (`weights/hand.json`) com Elo de pelo menos +50 e limite inferior do
    intervalo de 95% acima de 0, em pelo menos 2000 partidas com nós fixos.
  - Aceito quando o mesmo arquivo de configuração e a mesma semente geram o
    mesmo conjunto de dados.
- R6. Objetivo do treino, definido pelo designer: no nível padrão, o `ab`
  **vence** o `random` (que escolhe ao acaso entre as jogadas legais) em mais
  de 90% das partidas. Empate não conta como vitória.
  - Aceito quando o `ab` vence mais de 90% de 400 partidas contra o `random`
    (200 aberturas, cada uma com as duas cores), com o limite inferior do
    intervalo de 95% da taxa de vitória acima de 85%.
  - O resultado contra o `greedy` (pontos e taxa de vitória, nas mesmas 400
    partidas) é medido e registrado em `dev/notes/bots-do-seks.md`, mas não
    decide o aceite.
- R7. Custo do nível padrão, numa thread, com tabela de transposição de no
  máximo 16 MiB:
  - nativo (Ryzen 5 3600): média de até 200 ms e máximo de 500 ms por
    jogada, nas partidas de R6;
  - `cargo build -p seks-bots --lib --target wasm32-unknown-unknown` passa,
    e um benchmark compilado para `wasm32-wasip1` e rodado no Node faz pelo
    menos 40% dos nós por segundo do nativo, o que põe o nível padrão abaixo
    de 1 s por jogada no navegador.
- R8. Os empates entre bots fortes viram dado para o designer: 400 partidas
  `ab` contra `ab` no nível padrão, com a taxa de empate por causa
  (repetição, 100 jogadas sem captura), ficam registradas em
  `dev/notes/bots-do-seks.md`. A regra de empate é **Playtest** em
  `regras/seks/05-fim-do-jogo.md`.

## Out of scope

- Rede neural (NNUE ou estilo AlphaZero): issue própria, se R6 não for
  atingido com a avaliação linear ou se o designer pedir um nível acima.
- MCTS: descartado no ADR 0004.
- Busca em várias threads (Lazy SMP), livro de aberturas e tabelas de final.
- Níveis de dificuldade na interface: esta issue só oferece os parâmetros
  (nós, profundidade, ruído na raiz); os níveis com nome saem da issue da
  interface.
- Bindings WASM e integração com o servidor: issues futuras. Aqui só se
  garante que o crate compila para WASM e quanto custa lá.

## Plano

Propostas que o designer revisa antes da implementação estão marcadas com
**(revisar)**. Itens marcados com **(paralelo)** podem rodar ao mesmo tempo
que os outros da mesma fase.

### Fase 0: o bot simples (issue do motor, R5)

- [x] Depende do item `seks-bots` da issue do motor: crate, bots `random` e
  `greedy`, RNG splitmix64 próprio, teste de autojogo. Esta issue começa
  depois dele e não o refaz.

### Fase 1: lote, partidas e estatística

- [x] Pedidos ao motor (lista abaixo), combinados com quem cuida da issue do
  motor. Os itens 1 e 3 bloqueiam a fase 2; os outros podem chegar depois.
- [x] **(paralelo)** `stats.rs`: pontos, Elo e intervalo de 95% pela
  variância trinomial (vitória, empate, derrota). Testes com valores
  calculados à mão.
- [ ] **(paralelo)** Aberturas: `seks-bots openings` gera N posições depois
  de K jogadas aleatórias, descarta as que uma busca curta já vê decididas
  (nota além de uma margem), e grava uma abertura por linha como a
  sequência de jogadas desde a posição inicial. `openings/base.txt` (200
  aberturas, K = 6) vai para o git. Sem aberturas variadas, dois bots
  determinísticos jogariam sempre a mesma partida.
- [x] `batch.rs` e `main.rs`: `seks-bots batch --bots A,B --openings FILE
  [--games N] [--seed S] [--threads N] [--max-plies N] [--out games.jsonl]
  [--games-out DIR]`, como o `rio-bots batch`. Uma linha JSONL por partida;
  resumo de R2 no stderr. Threads com `std::thread::scope`, sem rayon.
- [x] `game_file.rs` e `seks-bots replay`: arquivo JSON por partida, com
  bots, semente, abertura, jogadas na notação do motor, resultado e, por
  jogada, nós, tempo, profundidade e nota.
- [ ] `seks-bots perft --depth N` e `seks-bots bench`: nós por segundo do
  gerador de jogadas e da busca, num conjunto fixo de posições.

### Fase 2: o bot alfa-beta

- [ ] `eval/features.rs`: as features, numa função usada pela avaliação e
  pelo treino, para os dois nunca divergirem. Conjunto inicial **(revisar)**:
  - material por valor (quantos dados de cada valor, 1 a 6);
  - avanço: tabela por fileira relativa ao lado e por valor, com as colunas
    dobradas pela simetria (11 x 6 x 6 pesos);
  - distância até a fileira de fundo do adversário menos o valor do dado
    (quão perto ele está de ameaçar vencer);
  - dados em risco de captura na jogada seguinte do adversário;
  - dados próprios que bloqueiam as linhas de ataque à própria fileira de
    fundo;
  - bônus de quem joga.
- [ ] `eval/weights.rs`: `Weights` lidos de JSON (`serde_json`), com o padrão
  embutido por `include_str!("../../weights/default.json")`.
  `weights/hand.json`: pesos à mão, a linha de base do treino.
- [ ] `EVALUATOR.md`: cada feature, a fórmula, o peso padrão e como ajustar,
  como o do Rio.
- [ ] `search/`: negamax com PVS e aprofundamento iterativo; tabela de
  transposição de tamanho fixo em potência de 2 (chave, jogada, nota,
  profundidade, tipo de limite); ordenação pela jogada da tabela, vitórias
  imediatas, capturas, killers e histórico; quiescência sobre capturas e
  jogadas que chegam à fileira de fundo; extensão de uma jogada quando o
  adversário ameaça vencer na jogada seguinte; redução de jogadas tardias
  (LMR), que o fator de ramificação de 100 exige. Vitória vale
  `WIN - ply`; repetição de uma posição já no caminho da busca vale empate.
- [ ] `ab.rs`: bot `ab[:depth=D,nodes=N,ms=T,tt=MIB,noise=E,weights=@F]`.
  Nível padrão **(revisar)**: `ab:nodes=N0`, com N0 escolhido na fase 4 para
  caber em R7. `ms=T` usa `std::time::Instant` só no lado nativo; o núcleo
  recebe o callback de parada. `noise=E` escolhe com a semente entre as
  jogadas da raiz a até E da melhor nota (variedade contra humanos; 0 nos
  testes).
- [ ] Testes: minimax sem poda contra alfa-beta (R3), suíte tática em
  `tests/positions/` no formato de diagrama do motor (R3), simetria da
  avaliação (R4), determinismo com limite de nós.

### Fase 3: treinamento

- [ ] `train/dataset.rs`: registros binários de tamanho fixo, little-endian,
  com o tabuleiro em 4 bits por casa, o jogador da vez, a nota da busca e o
  resultado final da partida; cabeçalho com versão. Cerca de 64 bytes por
  posição.
- [ ] `seks-bots selfplay --bot SPEC --openings FILE --games N --threads N
  --out FILE`: autojogo com nós fixos e ruído na raiz nas primeiras jogadas.
  Estimativa: com 5000 nós por jogada, cerca de 50 mil partidas e 7 milhões
  de posições por hora nas 12 threads.
- [ ] `seks-bots tune --data FILE... --init PESOS --out PESOS`: Texel tuning.
  Ajusta K da sigmoide nos pesos iniciais, depois minimiza o erro quadrático
  entre `sigmoid(K * nota)` e o alvo `lambda * sigmoid(K * nota_da_busca) +
  (1 - lambda) * resultado`, com Adam escrito à mão (o gradiente de um
  modelo linear é direto), regularização L2 e 10% das partidas separadas
  para validação. Só entram posições quietas: sem captura nem vitória
  disponível para quem joga, e sem ameaça de vitória do adversário.
  Aumenta os dados pela simetria das colunas.
- [ ] `seks-bots train CONFIG.json`: repete gerações (autojogo com os pesos
  atuais, tune, partida em lote contra a geração anterior) e só promove a
  geração que melhora o Elo com o limite inferior do intervalo acima de 0.
  Retoma do ponto onde parou. Saída em `digital/seks/bots/train/runs/<nome>/`
  (`log.csv` com perda de treino e validação e Elo por geração, pesos de
  cada geração, dados e partidas).
- [ ] O que vai para o git: código, `weights/hand.json`,
  `weights/default.json` (a geração promovida, com metadados: execução,
  geração, número de posições, perda, Elo medido), configurações em
  `train/*.json`, `openings/`, `tests/positions/`. Fica fora
  (`.gitignore`): `train/runs/`. Promover pesos é um commit com o resumo da
  execução no `EVALUATOR.md`.
- [ ] Scripts Python de automação do treino em
  `digital/seks/bots/train/scripts/` (pedido do designer): rodar uma grade de
  experimentos ou calibrações a partir de uma configuração, chamar o
  `seks-bots` (`selfplay`, `tune`, `batch`, `train`), juntar os `log.csv` e os
  JSONL e imprimir um resumo curto por experimento (Elo com intervalo, taxa
  de vitória contra `random`, empates por causa). O objetivo é desenhar
  experimentos sem escrever código novo e manter fora do contexto dos agentes
  a saída longa dos lotes: o agente lê só o resumo. Projeto `uv`, só com a
  biblioteca padrão se der.
- [ ] Medir R5 e registrar a curva por geração em
  `dev/notes/bots-do-seks.md`.

### Fase 4: custo e WASM

- [ ] `cargo build -p seks-bots --lib --target wasm32-unknown-unknown` entra
  no `just check`. Lote, autojogo, treino e linha de comando ficam sob
  `#[cfg(not(target_arch = "wasm32"))]`, como o `run_parallel` do Rio.
- [ ] Benchmark em `wasm32-wasip1` rodado com `node:wasi` (R7). Precisa de
  `rustup target add wasm32-wasip1`.
- [ ] Escolher N0 do nível padrão, medir R6, R7 e R8 e registrar em
  `dev/notes/bots-do-seks.md`.
- [ ] `just`: receitas `seks-batch`, `seks-train` e `seks-bench`;
  `digital/Cargo.toml` ganha `seks/bots` nos membros; `AGENTS.md` cita as
  receitas.

### Pedidos ao motor

O motor já tem `legal_commands_into`, `Engine::step` sem eventos, estado
`Copy`, `position_hash` incremental e diagramas. Faltam:

1. Notação de texto estável para `Cell` e `Command` (`Display` e `FromStr`),
   para arquivos de partida, aberturas, linha de comando e, depois, o
   protocolo do servidor.
2. `GameState::repetitions()`: quantas vezes a posição atual já apareceu
   (hoje `PositionHistory::current_occurrences` é `pub(crate)`). A busca
   trata a segunda aparição no caminho como empate.
3. Capturas de uma jogada sem aplicá-la, por exemplo
   `captures(state, command) -> u8`, com o mesmo código da regra. A
   ordenação e a quiescência perguntam isso para cerca de 100 jogadas por
   nó; aplicar cada uma para ver custa uma cópia de 1,1 KB por jogada.
4. `GameState::from_board(board, to_move)` e `Board::set` públicos (ou
   `Board::from_dice`): o treino monta milhões de posições a partir dos
   registros, e as transformações de simetria precisam montar tabuleiros
   sem passar por texto.
5. A checagem de "adversário sem jogada" dentro do `step` sem montar a lista
   de jogadas: basta achar um dado abaixo de 6 ou um 6 com casa vizinha
   livre.
6. `DIRECTIONS` público, para as features de ameaça.
