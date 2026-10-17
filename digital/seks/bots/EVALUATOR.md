# A avaliação do bot `ab`

Fonte: `src/eval/features.rs` (as features) e `src/eval/mod.rs` (a soma
ponderada). Os pesos ficam em `weights/*.json` e entram no binário por
`include_str!`.

## O que ela faz

A busca alfa-beta (`src/search/`) para numa posição quieta, sem captura
disponível e sem ameaça de vitória do adversário, e pede uma nota. A nota é
uma soma linear:

```text
nota(posição) = soma de peso[i] * feature[i]
```

sempre da perspectiva de quem joga ("nós"; o adversário é "eles"). A unidade
é mais ou menos um centésimo de dado: um dado a mais vale perto de 100.
Vitória e derrota não passam pela avaliação: a busca dá `WIN - ply` a uma
vitória (`WIN = 30000`).

A mesma função, `features::extract`, alimenta a avaliação e o treino, então
os dois nunca divergem. Toda feature é igual depois de trocar as cores
(espelhar as fileiras e passar a vez) e de espelhar as colunas: as fileiras
contam a partir da fileira de fundo de cada lado, e as colunas são dobradas
em torno da coluna 6. Os testes de `eval` conferem isso.

## As features

Notação: `fileira` é a fileira relativa ao dono do dado, 1 na própria
fileira de fundo e 11 na fileira de fundo do adversário; `coluna` é a coluna
dobrada, 1 (colunas 1 e 11) a 6 (coluna 6); `valor` é o valor do dado;
`distância` é `11 - fileira`, as fileiras que faltam até a vitória.

| Grupo no JSON | Índices | Feature | Conta |
|---|---|---|---|
| `material` | `[valor - 1]` | dados de cada valor | nossos menos os deles |
| `pst` | `[fileira - 1][coluna - 1][valor - 1]` | tabela por casa e valor | nossos menos os deles |
| `gap_us` | `[max(folga, 0)]`, folga de 0 a 3 | nossos dados com `folga = distância - valor` | nossos |
| `gap_them` | idem | dados deles com essa folga | deles |
| `at_risk_us` | | nossos dados que eles capturam na próxima jogada | nossos |
| `at_risk_them` | | dados deles que capturamos agora | deles |
| `blockers_us` | | linhas de vitória deles cujo primeiro dado no caminho é nosso | nossos |
| `blockers_them` | | linhas de vitória nossas bloqueadas por um dado deles | deles |
| `threats_us` | | nossas linhas de vitória livres | nossas |
| `threats_them` | | linhas de vitória livres deles | deles |
| `tempo` | | 1: o bônus de quem joga | |

Detalhes:

- **Material e tabela.** A tabela (`pst`, 11 x 6 x 6 = 396 pesos) já contém o
  material, mas os dois juntos deixam os pesos à mão simples: o valor de um
  dado em `material`, o ganho por avançar em `pst`.
- **Folga.** `folga <= 0` quer dizer que o valor do dado já alcança a
  fileira de fundo do adversário, se o caminho estiver livre; folga 1 quer
  dizer que falta um incremento. Folgas de 4 ou mais não contam. Ao contrário
  da tabela, esta feature separa os nossos dados dos deles, porque quem joga
  importa: uma folga 1 nossa vira ameaça neste turno.
- **Dados em risco.** Um dado está em risco quando tem uma casa vizinha
  ortogonal vazia que um dado do outro lado alcança em uma jogada, e um dado
  do outro lado na casa vizinha oposta (`regras/seks/04-captura.md`).
- **Linhas de vitória.** Para cada dado cujo valor alcança a fileira de fundo
  do adversário, as três direções para a frente (reta e as duas diagonais)
  até essa fileira. A linha está livre (ameaça), bloqueada pelo outro lado
  (bloqueio) ou bloqueada por um dado do mesmo lado (não conta). Numa posição
  quieta `threats_us` e `threats_them` são 0: com ameaça nossa a busca já
  vence, com ameaça deles a busca não para. Só pesam quando a quiescência
  esgota o limite de respostas a ameaças.

## Pesos

| Arquivo | Conteúdo |
|---|---|
| `weights/hand.json` | pesos à mão, a linha de base do treino |
| `weights/default.json` | os pesos do bot `ab`, a geração promovida pelo treino |

Pesos à mão (`hand.json`):

| Grupo | Valor | Por quê |
|---|---|---|
| `material` | 90, 95, 100, 105, 110, 110 | um dado vale 100; valor alto anda mais |
| `pst` | `4 * (fileira - 1)`, mais 2 nas colunas 4 a 6 | avançar e ocupar o centro |
| `gap_us` | 30, 20, 10, 5 | dados perto de ameaçar vencer |
| `gap_them` | -60, -30, -10, -5 | o mesmo do adversário, que joga depois |
| `at_risk_us` | -40 | jogamos antes e muitas vezes salvamos o dado |
| `at_risk_them` | 60 | uma captura disponível |
| `blockers_us`, `blockers_them` | 10, -10 | |
| `threats_us`, `threats_them` | 500, -300 | |
| `tempo` | 10 | |

## Como ajustar

- À mão: edite um JSON e jogue um lote contra os pesos atuais, com nós
  fixos: `just seks-batch ab:nodes=5000,weights=@novo.json ab:nodes=5000`.
- Pelo treino, `just seks-train [CONFIG]` (`train/base.json` por padrão):
  autojogo, Texel tuning e promoção só se a geração nova vencer a anterior
  (`src/train/`). Grades de experimentos: `just seks-experiments GRID`
  (`train/scripts/experiments.py`). Promover pesos é um commit que troca
  `weights/default.json` e registra a execução na seção abaixo.
- Empates: o `ab` pontua o empate como `-contempt` (100 por padrão, cerca
  de um dado), e o portão do treino recusa uma geração que empate mais de
  10% no lote do portão ou contra si mesma (`gate.max_draw_rate`). Pesos
  ajustados sem esse portão aprenderam a não forçar a vitória.
- Execuções caras rodam com teto de CPU e memória: ver
  `dev/notes/bots-do-seks.md`, que também guarda as medições.

## Gerações promovidas

| Execução | Geração | Posições | Perda de validação | Elo contra `hand.json` | Empates portão / espelho |
|---|---|---|---|---|---|
| `train/base.json` (`l2` = 0,1), 2026-10-17 | 1 | 447 092 | 0,06192 para 0,06048 | +231 [+213, +250] | 8 / 14 |

O Elo vem de 2000 partidas com `ab:nodes=5000` em `openings/gate.txt`.
A geração 2 venceu a 1 por +278 [+260, +297], mas empatou 126 de 400
partidas contra si mesma (31%; no lote do portão, 174 dos 177 empates
foram por 100 jogadas sem captura), e o portão a recusou; o treino parou aí. Mudanças grandes em relação aos
pesos à mão: material de 138 (dado 1) a 276 (dado 6), em vez de 90 a 110;
`gap_them` -51 em vez de -60; `blockers_us` 19 e `blockers_them` -18.
`threats_*` e `at_risk_them` não mudam: o tune só vê posições quietas, em
que essas features são zero. Números por geração em
`dev/notes/bots-do-seks.md`.
