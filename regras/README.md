# regras

Regras internas e completas dos jogos da coleção, em português. Esta pasta é a
fonte da verdade: o manual (um livro só para os seis jogos) simplifica para o
jogador, e cada versão digital implementa o jogo físico o mais fielmente
possível. As regras aqui entram em quantos detalhes forem necessários para
eliminar ambiguidade, incluindo casos de borda que o manual não vai mencionar.

## Arquivos

- `kit.md`: o kit físico comum, com que se jogam todos os jogos.
- `seks/`: o Seks. A primeira versão saiu do README e do código do protótipo
  em Python (`digital/seks/prototipo/`, tag `seks-py-v0.1.0`); onde o README
  não dizia nada, a regra segue o protótipo.
  - `00-visao-geral.md`: o jogo em poucas linhas e o nome.
  - `01-componentes.md`: o que o Seks usa do kit.
  - `02-preparacao.md`: posição inicial e jogador inicial.
  - `03-turno.md`: as duas jogadas, mover e incrementar.
  - `04-captura.md`: captura por custódia.
  - `05-fim-do-jogo.md`: vitória e empate.
  - `GLOSSARY.md`: os termos do Seks e os termos em inglês. Faz parte das
    regras.
- `liu/`: o Liu, jogo de dados no estilo do sudoku, para 2 a 4 jogadores.
  - `00-visao-geral.md`: o jogo em poucas linhas e o nome.
  - `01-componentes.md`: o que o Liu usa do kit.
  - `02-preparacao.md`: os selos, o saco e a mão.
  - `03-rodada.md`: o mercado, a ordem e o turno.
  - `04-janela.md`: onde um dado pode ser posto.
  - `05-fim-do-jogo.md`: fim e pontuação.
  - `GLOSSARY.md`: os termos do Liu e os termos em inglês.

Cada jogo novo ganha uma pasta com o mesmo esquema: arquivos `NN-tema.md` e um
`GLOSSARY.md`.

## Rótulos de status

Toda regra escrita aqui foi confirmada pelo designer. As notas sobre o status
usam só estes rótulos, os mesmos em todos os jogos, para que possam ser
achadas com grep e lidas pelo build do manual:

| Rótulo | Significado | No manual |
|---|---|---|
| `**(aberto: pergunta)**` | Ainda não decidido; enuncia a pergunta exata | Bloqueia a publicação |
| `> **Playtest:** ...` | Decidido, mas um valor ou a própria regra será ajustado em playtests | Publica a regra, retira a nota |
| `> **Proposta:** ...` | Aprovado só para teste, ainda não jogado | Publica a regra, a checagem avisa |
| `> **Ideia futura:** ...` | Não faz parte do jogo atual | Nunca publicado |
| `> **Detalhe:** ...` | Caso de borda ou decisão fina que o manual pode omitir | Opcional, material para as perguntas frequentes |
| `> **Design:** ...` | Intenção de design por trás de uma regra | Nunca publicado |

Não use outros rótulos.
