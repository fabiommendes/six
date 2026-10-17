# Briefing dos esboços de identidade visual

Esboços temporários para o designer escolher uma direção visual da coleção
Six. Ficam como referência (ADR 0005). Leia antes `dev/rfc/identidade-visual.md`
(restrições), `dev/rfc/nomes-dos-jogos.md` (os seis nomes vêm de "seis" em
várias línguas), `dev/rfc/interface-do-seks.md` (a interface do jogo) e
`regras/seks/00-visao-geral.md` a `05-fim-do-jogo.md`.

## A coleção

Seis jogos de dados de seis faces, jogados com o mesmo kit físico. O
primeiro é o **Seks** ("seis" em dinamarquês e norueguês): estratégia
abstrata, 2 jogadores, tabuleiro de 11 por 11, 16 dados brancos contra 16
pretos. O valor da face de cima diz até quantas casas o dado anda; mover deixa
o dado com o número de casas andadas; incrementar soma 1. Captura por
custódia ortogonal. Os outros cinco ainda não existem; candidatos a nome:
Liu (mandarim), Zes (holandês), Ono (polinésio), Suqta (quíchua), Shesh
(persa).

## Restrições (do RFC)

- Imprimível em casa e em gráfica: funciona em preto e branco; nenhuma
  informação depende só de cor.
- Os dados reais são o centro: a arte emoldura dados de 16 mm e nunca esconde
  o valor da face. Dados com **pontos**, não algarismos.
- A mesma linguagem no papel e na tela: o jogo digital desenha tabuleiro e
  dados como os físicos.
- Unidade e diferença: os seis se reconhecem como coleção, mas cada um tem
  cor e motivo próprios.
- Fontes com licença livre para uso comercial (SIL OFL ou similar). Cite a
  licença de cada fonte.
- Nada de estética de pixel art (limite técnico do protótipo, não escolha).
- Evite clichês de "app moderno": gradientes roxos, glassmorphism, sombras
  difusas em tudo, cantos arredondados genéricos.

## A partida que todo esboço mostra

Brancas jogam. O 6 branco em f6 está **selecionado**, e as casas aonde ele
pode ir estão destacadas (8 direções, de 1 a 6 casas, sem pular dados nem
sair do tabuleiro; calcule a partir do diagrama). A **última jogada** foi das
Pretas, g8 para g6: marque a origem e o destino. Cada lado já perdeu um dado
(1 branco e 1 preto capturados, mostrados fora do tabuleiro). 23 jogadas sem
captura.

Fileira 11 no topo, colunas `a` a `k` da esquerda para a direita. `w` é
branco, `b` é preto, o número é o valor:

```
11  b1 .. b1 .. .. .. b1 .. b1 .. b1
10  b2 b2 .. b2 b3 .. b2 b2 .. b2 ..
 9  .. .. b4 .. .. .. .. .. .. .. ..
 8  .. .. .. .. .. b5 .. .. .. .. ..
 7  .. .. .. w3 .. .. .. .. .. .. ..
 6  .. .. .. .. .. w6 b2 .. .. .. ..
 5  .. .. .. .. .. .. .. .. w4 .. ..
 4  .. w2 .. .. .. .. .. .. .. .. ..
 3  .. .. .. .. .. .. .. .. .. .. ..
 2  w2 .. w2 w2 .. .. w2 .. .. w2 ..
 1  w1 .. w1 .. w1 .. w1 .. w1 .. w1
     a  b  c  d  e  f  g  h  i  j  k
```

Tabuleiro visto de cima (a interface final usa Three.js com câmera
ortográfica de cima; o esboço pode ser HTML, CSS e SVG, mas os dados devem
parecer objetos, não círculos chapados).

## Entregáveis, em `arte/esbocos/<direção>/`

1. `jogo.html`: a tela do jogo em 1440 por 900, com o tabuleiro, a seleção,
   os destinos, a última jogada, os dados capturados, de quem é a vez, o
   contador de jogadas sem captura e os botões Desfazer e Nova partida. Textos
   em português, com os termos de `regras/seks/GLOSSARY.md` e nunca as
   palavras de `Não usar:` (por exemplo, "peça" e "comer" são proibidas).
   Precisa funcionar também em 390 por 844 (celular em retrato).
2. `capa.html`: o logo da coleção "six" e a capa da caixa do Seks, e uma faixa
   mostrando como os seis jogos se diferenciam (cor e motivo de cada um; os
   cinco ainda sem regras podem ser só nome e motivo).
3. `manual.html`: uma página do livro de regras em A5, com título, um
   parágrafo da seção de captura e um diagrama de tabuleiro, numa versão
   para impressão em preto e branco.
4. `LEIAME.md`: a ideia em até 6 linhas, a paleta (hex), as fontes com
   licença, e como a direção se estende aos outros cinco jogos.
5. Capturas PNG de cada página (`jogo.png`, `jogo-celular.png`, `capa.png`,
   `manual.png`), feitas com Chromium headless pelo `playwright-core`
   instalado numa pasta temporária fora do repositório (há Chromium em
   `/usr/bin/chromium`). Olhe as capturas e corrija o que estiver feio ou
   quebrado antes de entregar.

Tudo autocontido na pasta da direção: fontes baixadas para `fonts/` (do
Google Fonts ou do repositório oficial, só licenças livres), sem CDN em tempo
de execução. Não faça commit e não edite nada fora da sua pasta.
