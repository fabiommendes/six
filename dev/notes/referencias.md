---
type: note
status: active
tags: [referencias, design]
relatedTo: [dev/rfc/nomes-dos-jogos.md, dev/rfc/estrutura-do-repositorio.md]
---

# Referências de design

Jogos que vale estudar para cada um dos seis. Itens com (*) foram conferidos
numa busca em 2026-10-17; os outros são conhecidos e não precisam de busca.

## Coleções com dados

- **SIX D SIX** (*), Martin Grider, 2011, publicado na web. Seis jogos de
  estratégia com o mesmo material: 36 dados em seis cores, 36 dados pretos e,
  em alguns jogos, um tabuleiro de xadrez. A sorte quase só aparece na
  preparação. É o precedente mais próximo da coleção e do kit físico comum.
- **Piecepack** e **Looney Pyramids**: um conjunto de componentes genéricos e
  dezenas de jogos de autores diferentes. Mostram como manter um kit comum
  sem prender o design.

## Seks: estratégia abstrata com dados como peças

- **Custodian Dice** (*), na Board Game Arena. Tabuleiro 5×5, cinco dados por
  jogador, movimento ortogonal pelo valor exato da face, captura por custódia.
  Depois de mover, o dado gira para uma face vizinha; depois de pular, vira
  para a face oposta. Perde quem fica com menos de dois dados. É o jogo mais
  parecido com o Seks: vale comparar a regra "o dado vira a distância andada"
  com a rotação física.
- **Sinoda** (*): o valor é a distância, mas a captura é por substituição, e
  o valor do dado capturado vira ponto.
- **Cubulous** (*): dados que andam pelo valor, com escudos e um mestre a
  capturar.
- **Hnefatafl** e **Tablut**: captura por custódia e assimetria entre os lados.
- **Hasami shogi** e **ludus latrunculorum**: captura por custódia em
  tabuleiro simétrico, sem rei. As regras de empate e repetição desses jogos
  servem para a questão em aberto de `jogos/seks/regras/05-fim-do-jogo.md`.
- **Kamisado**: movimento em linha reta sem pular, fim ao chegar na fileira de
  fundo adversária.

## Competitivo no estilo de sudoku

- **Sagrada**: escolha de dados e colocação numa grade com restrições de cor
  e valor.
- **Ganz schön clever** e **Qwixx**: rolar e escrever; os dados de um
  jogador servem aos outros.
- **Railroad Ink**: todos usam a mesma rolagem, cada um no seu tabuleiro.
- **Kakuro** e **KenKen**: quebra-cabeças de grade com somas, mais próximos
  da aritmética dos dados que o sudoku.

## Leilões e sequências

- **Ra** e **Medici**: leilões com lotes que crescem até alguém comprar.
- **Modern Art**: cinco tipos de leilão no mesmo jogo, incluindo o holandês.
- **High Society** e **For Sale**: leilões com recursos que acabam.
- **Can't Stop**: formar somas com dados e arriscar avançar.
- **Lost Cities** e **Coloretto**: sequências e coleções em ordem crescente.

## Construção de saco com dados especiais

- **Quarriors** e **Dice Masters**: dados customizados comprados e sacados de
  um saco.
- **Dice Forge**: trocar as faces dos dados durante o jogo.
- **Roll for the Galaxy**: construção de dados com faces diferentes por cor.
- **Orléans** e **The Quacks of Quedlinburg**: construção de saco com fichas;
  o risco de estourar em *Quacks*.

## Cooperativo

- **Hanabi**: informação escondida e sequências, sem dados.
- **The Mind**: sincronizar sem falar.
- **Escape: The Curse of the Temple**: dados em tempo real, cooperativo.
- **Pandemic: The Cure**: o Pandemic com dados.
- **The Crew**: vazas cooperativas com missões.

## Releitura de um clássico

- **Perudo / Dudo / Liar's Dice**: blefe com dados escondidos. "Duvido" no
  Brasil é o jogo de cartas de blefe, com a mesma ideia.
- **Yacht, Yatzy, Generala, Kniffel**: combinações em até três rolagens.
- **Gamão** (*shesh besh*): corrida com dados, captura e bloqueio.
- **Farkle**, **Pig**, **Can't Stop**: forçar a sorte.
- **Jogo Real de Ur** e **Senet**: os mais antigos jogos de corrida com
  dados.
- **Sixis** (*), Asmadi Games: um jogo de dados com o nome do 6.

## Componentes físicos

- Dado padrão de 16 mm (o mais comum) ou de 12 mm (o dos jogos de rolar e
  escrever). O tamanho da casa e do tabuleiro sai dele.
- Dados com cantos arredondados rolam melhor; dados de cantos vivos ficam
  melhor no tabuleiro e empilham.
- Cores de dado vendidas em grande quantidade por fornecedores como Chessex e
  Koplow: branco, preto, vermelho, azul, verde, amarelo, e as versões
  translúcidas. As cores do kit comum precisam ser distinguíveis por quem não
  enxerga cores (forma ou textura além da cor).
