---
type: rfc
status: accepted
tags: [seks, digital, web, rede]
relatedTo: [dev/rfc/interface-do-seks.md, dev/issues/servidor-do-seks.md]
created: 2026-10-17
decided: 2026-10-17
creator: claude
---

# Rede sem servidor central

## Problem

`dev/rfc/interface-do-seks.md` previa o jogo em rede com um servidor
autoritativo, como no Rio. Um servidor custa dinheiro e manutenção desde o
primeiro dia, e o Seks não precisa dele para dois amigos jogarem: é um jogo
de turnos, de informação completa, e cada lado já roda o motor inteiro em
WASM. Só as jogadas precisam trafegar, e cada lado valida a jogada do outro
com o próprio motor; a única trapaça possível é abandonar a partida.

## Proposal

Dois modos de rede, ambos gratuitos e só com o site estático:

### Partida por correspondência

Cada jogada gera um link com a partida inteira. O jogador manda o link pelo
mensageiro que quiser; quem abre vê a partida na posição atual e, se for a
vez da sua cor, joga e manda o link de volta.

- O link carrega a posição inicial, as jogadas e a versão do formato. As
  jogadas vão em forma compacta (por exemplo, o índice de cada jogada na
  lista de jogadas legais do motor, em base64url), para uma partida longa
  caber numa URL.
- Cada lado refaz a partida com o motor ao abrir o link; um link com jogada
  ilegal é recusado.
- O navegador guarda as partidas em andamento, para o jogador voltar a elas.
- Funciona em qualquer rede e não depende de terceiros.

### Partida ao vivo (P2P)

Conexão direta entre os dois navegadores com WebRTC. Quem cria a partida
manda um link de convite; os dois se conectam e trocam jogadas em tempo real.

- A sinalização (o aperto de mão inicial do WebRTC) usa infraestrutura
  pública, com a biblioteca Trystero (relays Nostr, trackers BitTorrent ou
  MQTT). Depois disso, o tráfego é direto.
- Cada jogada leva o número da jogada e o hash da posição, para detectar
  dessincronia; quem criou a partida é a referência para ressincronizar.
- Cerca de 10% a 20% das conexões falham sem um servidor TURN (NAT simétrico,
  comum em 4G). Quando a conexão não sai, a interface oferece continuar a
  partida por correspondência.
- Desfazer não existe em rede (decisão do RFC da interface).

### Modo pago, no futuro

Servidor autoritativo, busca de adversário, ranking, contas e TURN próprio
ficam para um eventual modo pago, em `dev/issues/servidor-do-seks.md`.

### Código comum

A camada de rede (formato do link, sala P2P, sincronia) não depende das
regras do Seks: recebe comandos em texto e um motor que valida. Fica em
`digital/seks/web/` até o segundo jogo, como manda o RFC de estrutura para
`digital/kit/`.

## Alternatives

- **Servidor autoritativo desde já** (plano original): custo e manutenção
  antes de existir público; vira o modo pago.
- **Troca manual de convite WebRTC** (QR code ou texto colado): sem
  terceiros, mas a experiência é ruim e a falha por NAT continua.
- **js-libp2p no navegador**: pesado e ainda precisa de relays; não compensa
  para dois jogadores.

## Decisions

- Modo gratuito: partida por correspondência e partida ao vivo P2P, só com
  o site estático.
- Servidor, ranking e busca de adversário: eventual modo pago no futuro.
- Ordem: correspondência primeiro (define o formato da partida no link), P2P
  depois, reaproveitando o formato.

## Open questions

- O jogo físico não tem desistência. Em rede, um jogador pode sumir. A
  interface oferece "desistir" (vitória do outro) ou só "sair da partida"
  (sem resultado)? É regra do jogo, decide o designer.
- Partida por correspondência tem prazo por jogada?

## Outcome

Aceito em 2026-10-17. Gerou:

- `dev/issues/partida-por-correspondencia-do-seks.md` (`todo`);
- `dev/issues/partida-ao-vivo-do-seks.md` (`todo`);
- `dev/issues/servidor-do-seks.md` passa a ser o modo pago (`backlog`).
