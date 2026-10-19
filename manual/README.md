# manual

Livro de regras da coleção, um só para todos os jogos. Ele reformula as regras
confirmadas de `../regras/` numa forma mais curta e simples. Um único conjunto
de fontes gera um site estático (com a página de entrada da coleção) e um PDF
A4 para impressão.

O build é uma cópia da parte genérica do build do manual do Rio
(`dev/adr/0002-build-do-manual-copiado-do-rio.md`). A estética é provisória e
neutra até a identidade visual ser decidida (`dev/rfc/identidade-visual.md`):
fontes do sistema e a paleta de `rulebook/palette.py`.

## Build

    cd manual
    make            # site + PDF, then lint the output
    make site       # site only (fast)
    make drafts     # also the chapters marked `rascunho: true`
    make check      # manual text whose regras/ sources changed (with diffs)
    make coverage   # regras/ sections no manual text uses yet
    make serve      # http://127.0.0.1:8000/

Ou, da raiz, `just manual`, `just manual-serve`, `just manual-check`.

`make` cria `.venv/` a partir de `requirements.txt` na primeira vez. Requisitos
do sistema: Python 3.11+ e Pango para o WeasyPrint. `pdftotext` (poppler) é
opcional; quando presente, o lint também verifica o texto do PDF.

A saída vai para `build/` (fora do git): `build/site/` (`index.html` é a
entrada da coleção, `manual.html` o início do livro, uma página por capítulo e
o PDF para baixar), `build/manual.pdf` e `build/print/manual.html`, o
documento único de que o PDF é feito.

## Layout

| Caminho | Conteúdo |
|---|---|
| `capitulos/` | `NN-slug.md` para capítulos, `AN-slug.md` para apêndices |
| `simbolos.yaml` | Símbolo interno de `regras/` -> palavra publicada |
| `fontes.lock.yaml` | Estado de revisão gerado para a verificação de sincronia (versionado) |
| `templates/` | Templates Jinja: `site/`, `print/` e `partials/` |
| `styles/` | `common.css` (os dois), `site.css`, `landing.css`, `print.css` |
| `rulebook/` | Código do build |

## Capítulos

Front matter (as chaves estão em português, como o texto):

```yaml
---
titulo: Seks
resumo: Uma linha para o sumário e a página de entrada.
jogo: seks             # o jogo do capítulo: pasta de regras/
jogadores: "2"         # mostrado na página de entrada
digital: seks/          # pasta da versão digital no site publicado (`just site`)
rascunho: true         # fica fora do build publicado
fonte:                 # fontes do capítulo inteiro...
  - regras/seks/00-visao-geral.md
secoes:                # ...e/ou de cada seção ##
  captura:
    fonte:
      - regras/seks/04-captura.md
---
```

- Uma fonte é um arquivo de `regras/`, com `#âncora` opcional: o slug de um
  título. A seção vai até o próximo título de nível igual ou maior.
- Toda seção `##` precisa de fonte, no capítulo ou em `secoes`. `fonte: []`
  quer dizer "sem fonte em regras/".
- `[[Termo]]` e `[[Termo|texto]]` ligam ao glossário do jogo do capítulo;
  `[[seks:Termo]]` escolhe o jogo. `{{ glossario("seks") }}` desenha o
  glossário de um jogo.
- As palavras de `Não usar:` do glossário de um jogo são proibidas no texto
  daquele jogo: o build falha nas fontes, e o lint, na saída. Um jogo pode
  proibir uma palavra que outro usa como termo.

## Diagramas de tabuleiro

Um bloco ` ```tabuleiro ` vira uma figura em SVG, com dados de pontos. O
formato está no topo de `rulebook/diagrams.py`:

    ```tabuleiro
    legenda: O 3 branco sobe duas casas...
    seta: 5,2 -> 3,2
    . . . . .
    . . P2 B3 .
    . B3* . . .
    ```

`.` é uma casa vazia, `o` uma casa marcada, `B1` a `B6` e `P1` a `P6` dados
brancos e pretos; o sufixo `*` destaca o dado, e `x` o mostra capturado. Para
pôr figuras lado a lado, envolva os blocos em `<div class="diagramas"
markdown="1">`; para uma figura grande no PDF, em `<div
class="diagrama--grande" markdown="1">`.

## Sincronia com regras/

Igual ao Rio. `fontes.lock.yaml` guarda, para cada par (trecho do manual,
fonte), a impressão digital do texto da fonte quando uma pessoa revisou o
trecho pela última vez. `make check` lista o que mudou desde então, com o
diff. Depois de revisar, registre com
`.venv/bin/python -m rulebook sync-mark capitulos/03-seks.md#captura` (ou o
capítulo inteiro, ou `--all`) e faça commit do lock junto com o texto.

## Rótulos de status

`regras/README.md#rótulos-de-status` define os rótulos, e
`rulebook/markers.py` guarda a mesma lista. `**(aberto: ...)**` faz o build
falhar se aparecer num capítulo; as notas `> **Rótulo:**` nunca chegam à
saída, e o lint falha se um rótulo aparecer nela.
