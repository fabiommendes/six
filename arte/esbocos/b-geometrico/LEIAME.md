# b-geometrico: tradição suíça

## Ideia

Grade modular, uma grotesca, cores chapadas e um só motivo: o ponto do dado.
O logo é a face de seis ao lado de "six", com o pingo do i como um ponto. Cada
jogo tem uma cor e um arranjo próprio de seis pontos; o nome fica sempre
embaixo, no mesmo lugar. O tabuleiro é uma grade de 121 módulos cinza com
calha clara, e os dados são os únicos objetos com volume (lateral e sombra
dura, nada difuso). Tudo funciona em preto: cor só reforça forma.

## Paleta

| Uso | Hex |
|---|---|
| Tinta | `#141414` |
| Papel | `#F3F1EC` |
| Casa / fileira de fundo | `#DCD8CF` / `#CBC6BB` |
| Texto secundário | `#6E6A62` |
| Seks, vermelho | `#E2231A` |
| Liu, amarelo | `#F2B200` |
| Zes, laranja | `#F26B00` |
| Ono, verde | `#00905A` |
| Suqta, violeta | `#6A3D9A` |
| Shesh, azul | `#0B5CB5` |

As seis cores dos jogos ficam a 60 graus uma da outra no círculo cromático e
servem também de cores para os dados do kit.

## Fontes

- Archivo (Omnibus-Type), variável em peso e largura, SIL Open Font License
  1.1. Arquivo em `fonts/Archivo.ttf`, licença em `fonts/OFL-Archivo.txt`.

## Os outros cinco jogos

Mesmo esquema da caixa e da tela; muda a cor de acento e o arranjo dos seis
pontos: Seks em duas colunas (a face do dado), Liu em triângulo, Zes em
tijolo, Ono em onda, Suqta em escada, Shesh em anel. O arranjo identifica o
jogo sem cor, então a versão impressa em preto e o manual não perdem nada.

## Arquivos

`jogo.html`, `capa.html`, `manual.html` (A5, preto e branco) e as capturas
`jogo.png`, `jogo-celular.png`, `capa.png`, `manual.png`. `comum.js` desenha
dados, tabuleiro, motivos e logo; os destinos do 6 em f6 são calculados pelas
regras, não digitados.
