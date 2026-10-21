---
type: rfc
status: draft
tags: [jogo-novo, design, linha-de-batalha]
relatedTo: [dev/rfc/nomes-dos-jogos.md, dev/notes/referencias.md, regras/kit.md]
created: 2026-10-21
creator: claude
---

# Jogo novo: o *Battle Line* com dados

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

Premissas desta fase: até 5 naipes (cores) de dados, e nenhum limite de
dados por naipe. O kit final sai depois de o jogo ser validado.

### Componentes

- Dados dos 5 naipes num saco.
- 9 marcos numa fileira entre os dois jogadores. O tabuleiro de 11 por 11
  do Seks serve: as 9 casas do meio da fileira central são os marcos, e as
  3 fileiras de cada lado recebem os dados de cada jogador.
- 3 fichas de rolagem por jogador (no físico, qualquer marcador).

### Preparação

Cada jogador tira 6 dados do saco, rola e deixa os dados na sua **reserva**,
à vista dos dois.

### Turno

1. **Reivindicar** (opcional): o jogador toma os marcos que pode provar seus
   (abaixo).
2. **Pôr um dado**: o jogador põe um dado da reserva do seu lado de um marco
   ainda não tomado, com no máximo 3 dados por lado. O dado guarda o número
   que mostra. É obrigatório, se houver lugar.
3. **Repor**: tira um dado do saco, rola e o põe na reserva.

No lugar do passo 2, o jogador pode gastar uma ficha de rolagem e rolar de
novo quantos dados da reserva quiser. Isso ocupa o turno. É o único jeito de
adiar um compromisso, e por isso é limitado.

### Formações

Os 3 dados de um lado formam uma formação. Da mais forte para a mais fraca:

| Formação | O que é | Correspondente no *Battle Line* | Chance com 3 dados ao acaso |
|---|---|---|---|
| Sequência de naipe | 3 números seguidos, do mesmo naipe | *wedge* | 0,4% |
| Trinca | 3 números iguais | *phalanx* | 2,8% |
| Naipe | 3 dados do mesmo naipe | *battalion* | 4% |
| Sequência | 3 números seguidos | *skirmish line* | 11% |
| Soma | qualquer outra | *host* | |

Entre duas formações do mesmo tipo, vence a de maior soma. Se a soma também
empata, vence o lado completado primeiro.

A ordem das cartas continua valendo com dados. Com só 6 números, cada naipe
tem 4 sequências possíveis, contra 8 de um naipe de 10 cartas: as
sequências ficam mais raras, e a trinca mais valiosa.

### Reivindicar

Um marco é do jogador quando os dois lados estão completos e a formação
dele vence. Antes disso, o jogador pode tomar o marco se a sua formação
completa vence qualquer formação que o adversário ainda possa completar
daquele lado, supondo que cada dado que falta pode ter qualquer número e
qualquer naipe. Isso pede o raciocínio de prova do *Battle Line*, mas sem
contar cartas: os números não se esgotam.

### Fim

Vence quem tiver 5 marcos, ou 3 vizinhos, no momento em que os toma.

Se o saco e as reservas acabarem antes, os marcos restantes se resolvem: um
lado completo vence um incompleto, e dois lados incompletos deixam o marco
sem dono. Vence quem tiver mais marcos.

### O que os dados acrescentam

- A reserva é aberta: os dois sabem tudo, menos o que vai sair do saco. No
  *Battle Line*, a mão é escondida.
- A ficha de rolagem é a rolagem extra da generala, posta no lugar das
  cartas de tática.
- Sem limite de dados, nada se esgota, e prever pela contagem deixa de
  funcionar. O que importa é a probabilidade de cada número.

### Versão digital

O estado é pequeno, e a única informação escondida são os dados futuros,
como no Liu. O motor, o PIMC e a calibração do Liu servem de molde. Os bots
precisam da prova de reivindicação, que é uma busca pequena sobre os dados
que faltam.

## Alternatives

- **Mercado comum** (como no Liu), no lugar da reserva de cada um. Aumenta
  o bloqueio (tirar o dado de que o outro precisa), mas aproxima demais o
  jogo do Liu.
- **Reserva escondida**, atrás da mão ou de um copo, como no *Battle Line*.
  Traz o blefe, mas pede um componente novo no kit e deixa os bots mais
  difíceis.
- **Curinga no lugar da ficha de rolagem**: 1 dado por jogador cujo número
  e naipe o dono escolhe ao pôr, como o *leader* do *Battle Line*.
- **Sem a reivindicação antecipada**: todo marco se resolve só com os dois
  lados completos. É mais simples de ensinar, mas tira o ritmo do jogo e o
  peso de completar primeiro.

## Open questions

- Tamanho da reserva: 6 (proposta), 7 como no *Battle Line*, ou 5.
- Quantas fichas de rolagem, e se elas voltam ao jogador de algum modo.
- A ordem entre trinca e naipe se mantém no jogo de verdade? Com seleção, a
  chance de cada formação muda, e só um lote de bots ou partidas na mesa
  dizem.
- 4 ou 5 naipes: com 4, a formação de naipe fica mais fácil e a reserva
  mais coerente.
- O desempate do fim, se os dois tiverem o mesmo número de marcos.
- Nome. Pelos critérios de `dev/rfc/nomes-dos-jogos.md`, o candidato é
  **Sia** (gaélico escocês): o *Schotten Totten* é, pelo nome, um jogo de
  escoceses. O risco é a cantora Sia, e quem fala inglês pode ler "sai-a".

## Outcome
