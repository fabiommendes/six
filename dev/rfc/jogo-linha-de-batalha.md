---
type: rfc
status: draft
tags: [jogo-novo, design, sia]
relatedTo: [dev/rfc/nomes-dos-jogos.md, dev/notes/referencias.md, regras/kit.md]
created: 2026-10-21
creator: claude
---

# Sia: o *Battle Line* com dados

## Problem

A coleção tem um jogo abstrato sem sorte (Seks) e um de seleção de dados
para 2 a 4 jogadores (Liu). Falta um duelo curto, de 2 jogadores, em que a
sorte entre na chegada dos dados mas a decisão seja onde lutar e quando
desistir de uma frente.

O *Battle Line* (Reiner Knizia, 2000; o *Schotten Totten* é a versão
original, de 1999) é esse jogo com cartas: 9 marcos entre os jogadores, e
de cada lado de cada marco uma formação de 3 cartas, ao estilo do pôquer.
As formações do pôquer têm um equivalente direto nas combinações da
generala, então o jogo passa para dados sem perder a estrutura.

## Proposal

Premissas desta fase: 5 naipes (cores) de dados, e nenhum limite de dados
por naipe. O kit final sai depois de o jogo ser validado.

### Componentes

- 9 dados de um naipe, que são os **marcos**.
- Um saco com dados dos outros 4 naipes.
- No físico, o tabuleiro de 11 por 11 do Seks: os marcos ficam nas 9 casas
  do meio da fileira central, e as 3 fileiras de cada lado recebem os
  dados de cada jogador.

### Preparação

- Os 9 marcos são rolados e postos na fileira, cada um com o número que
  tirou. O número de um marco não muda mais.
- Cada jogador tira 7 dados do saco, rola e deixa os dados na sua **mão**, à
  vista dos dois.

### Turno

1. **Rolar de novo** (opcional): o jogador escolhe uma mão, a sua ou a do
   adversário, e rola de novo quantos dados dela quiser. O custo é perder um
   dado da própria mão, escolhido por ele antes de rolar e devolvido à
   caixa: daí em diante, a mão dele tem um dado a menos. Quem tem só um
   dado na mão não pode rolar de novo.
2. **Reivindicar** (opcional): o jogador toma os marcos que pode provar seus
   (abaixo).
3. **Pôr um dado**: o jogador põe um dado da mão do seu lado de um marco
   ainda não tomado, com no máximo 3 dados por lado. O dado guarda o número
   que mostra. É obrigatório, se houver lugar.
4. **Repor**: tira um dado do saco, rola e o põe na mão, até ter 7 dados
   menos os que perdeu.

### Formações

A formação de um lado são os 3 dados do jogador e o marco: 4 dados. O
marco entra com o seu número, e o seu naipe vale como qualquer naipe. Por
isso, para fazer a formação de naipe bastam os 3 dados do jogador serem do
mesmo naipe.

Da mais forte para a mais fraca:

| Formação | O que é | Chance com 3 dados ao acaso |
|---|---|---|
| Sequência de naipe | 4 números seguidos, com os 3 dados do mesmo naipe | 0,35% |
| Quadra | 4 números iguais | 0,46% |
| Sequência | 4 números seguidos | 5,6% |
| Naipe | 3 dados do mesmo naipe | 6,3% |
| Dois pares | dois números, dois dados de cada | 6,9% |
| Trinca | 3 números iguais | 9,3% |
| Par | 2 números iguais | 56% |
| Soma | qualquer outra | |

A ordem segue a raridade com dados ao acaso. A sequência de naipe fica
acima da quadra, embora seja um pouco mais comum, como no pôquer. Com 6
números, só há 3 sequências de 4, e o número do marco limita quais delas
cabem.

Entre duas formações do mesmo tipo, vence a de maior soma. Se a soma também
empata, vence o lado completado primeiro.

O marco é dos dois lados. Um marco com 6 favorece as formações altas; um
com 1 ou 6 cabe em uma sequência só, e um com 3 ou 4, em três.

### Reivindicar

Um marco é do jogador quando os dois lados estão completos e a formação
dele vence. Antes disso, o jogador pode tomar o marco se a sua formação
completa vence qualquer formação que o adversário ainda possa completar
daquele lado, supondo que cada dado que falta pode ter qualquer número e
qualquer um dos 4 naipes do saco. Isso pede o raciocínio de prova do
*Battle Line*, mas sem contar cartas, porque os números não se esgotam.

### Fim

Vence quem tiver 5 marcos, ou 3 vizinhos, no momento em que os toma.

Se nenhum dos dois puder mais pôr dado, os marcos restantes se resolvem: um
lado completo vence um incompleto, e dois lados incompletos deixam o marco
sem dono. Vence quem tiver mais marcos.

### O que os dados acrescentam

- Os marcos são dados: cada frente tem um número que serve aos dois lados,
  e a disputa começa diferente a cada partida.
- Rolar de novo custa um dado da mão para sempre. Cada rolagem deixa o
  jogador com menos opções, até o fim da partida. Rolar a mão do adversário
  desfaz uma formação que ele estava montando, e por isso também é ataque.
- A mão é aberta: os dois sabem tudo, menos o que vai sair do saco. No
  *Battle Line*, a mão é escondida.
- Sem limite de dados, nada se esgota, e prever pela contagem deixa de
  funcionar. O que importa é a probabilidade de cada número.

### Versão digital

O estado é pequeno, e a única informação escondida são os dados futuros,
como no Liu. O motor, o PIMC e a calibração do Liu servem de molde. Os bots
precisam da prova de reivindicação, que é uma busca pequena sobre os dados
que faltam.

## Alternatives

- **Formação de 3 dados, com o marco e 2 do jogador.** A partida fica mais
  curta, mas a formação de naipe passa a sair com 2 dados (25% ao acaso) e
  fica fácil demais.
- **Marco sem naipe coringa**: o marco conta com o seu naipe, e o jogo
  precisa de 5 naipes no saco. A formação de naipe fica quase impossível.
- **Fichas de rolagem** (a primeira versão deste RFC): 3 por jogador, e
  rolar de novo ocupa o turno. Pede um componente a mais, e o custo não
  cresce ao longo da partida.
- **Mercado comum** (como no Liu), no lugar da mão de cada um. Aumenta o
  bloqueio, mas aproxima demais o jogo do Liu.
- **Mão escondida**, atrás da mão ou de um copo, como no *Battle Line*.
  Traz o blefe, mas pede um componente novo no kit e deixa os bots mais
  difíceis.
- **Sem a reivindicação antecipada**: todo marco se resolve só com os dois
  lados completos. É mais simples de ensinar, mas tira o ritmo do jogo e o
  peso de completar primeiro.

## Decisions

Do designer, em 2026-10-21:

- Um naipe vira os marcos; o saco tem os outros 4. O marco entra na
  formação, e o seu naipe vale como qualquer naipe.
- Rolar de novo custa um dado da mão para sempre, e a mão começa com 7.
  Pode-se rolar a própria mão ou a do adversário; com um dado só na mão,
  não.
- Rolar de novo vem antes de pôr o dado, no mesmo turno, e não o
  substitui.
- Quem rola escolhe quais dados da mão rolar, inclusive na do adversário.
- O nome é *Sia*.

## Open questions

- A ordem das formações se mantém no jogo de verdade? Com seleção, a chance
  de cada formação muda, e só um lote de bots ou partidas na mesa dizem.
  Sequência e naipe estão perto, e dois pares e trinca também.
- O desempate do fim, se os dois tiverem o mesmo número de marcos.
- O nome *Sia* (gaélico escocês; o *Schotten Totten* é, pelo nome, um jogo
  de clãs escoceses) ainda precisa ser conferido no BoardGameGeek. O risco
  é a cantora Sia, e quem fala inglês pode ler "sai-a".

## Outcome
