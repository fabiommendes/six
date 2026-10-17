---
type: rfc
status: accepted
tags: [layout, monorepo, rust, manual, site]
relatedTo: [dev/rfc/nomes-dos-jogos.md, dev/rfc/identidade-visual.md]
created: 2026-10-17
decided: 2026-10-17
creator: claude
---

# Estrutura do repositório da coleção Six

## Problem

Seis jogos com dados de seis faces, cada um com versão física e versão
digital com bots e rede. Hoje só existe o Seks, como um rascunho em Python
(repositório próprio, publicado no GitHub e no PyPI). Os outros cinco ainda
não têm regras nem nome.

O que precisa de um lugar:

- regras de cada jogo como fonte única da verdade, como no Rio;
- o manual e o site;
- código compartilhado entre as versões digitais: dados com semente, lugares,
  servidor de rede, bots, cliente WASM;
- identidade visual e componentes físicos;
- RFCs, ADRs e issues que cruzam os jogos.

## Proposal

Desenho aceito, depois das decisões do designer na discussão abaixo.

### Um monorepo de coordenação

```
six/
├── AGENTS.md, CLAUDE.md -> AGENTS.md, README.md, justfile
├── regras/                 # fonte da verdade de todos os jogos
│   ├── kit.md              # o kit físico comum
│   └── seks/               # NN-tema.md e GLOSSARY.md do jogo
├── manual/                 # livro de regras único (PDF e site) e o seu build
├── digital/
│   ├── seks/               # implementação digital do Seks
│   │   └── prototipo/      # protótipo em Python, com o histórico do repositório original
│   └── kit/                # código comum das versões digitais, quando o segundo jogo chegar
├── arte/                   # identidade visual comum, quando for definida
└── dev/                    # rfc/, adr/, issues/, notes/; handoffs/ fora do git
```

- **Livro de regras único**: um manual para os seis jogos, como os livros de
  jogos com baralho comum. Um capítulo comum sobre o kit e um capítulo (ou
  mais) por jogo.
- **Kit físico comum**: todos os jogos se jogam com os mesmos componentes
  (`regras/kit.md`).
- **Uma pasta por implementação digital** em `digital/`. Cada jogo tem o seu
  motor e a sua interface, sem depender dos outros jogos; todos podem depender
  de `digital/kit/`.

### Versões digitais

- Motor em Rust para todos os jogos. A interface é decidida jogo a jogo; o
  padrão sugerido é o do Rio (TypeScript, Vite e o motor em WASM).
- Os motores seguem as decisões dos ADRs 0001, 0004, 0005 e 0010 do Rio:
  estado como valor, comandos legais listados pelo motor, visão por lugar,
  servidor autoritativo.
- O kit nasce do segundo jogo, não do primeiro: o motor do Seks é escrito
  sozinho, e o código que o segundo jogo repetir sai para `digital/kit/`.

### Manual e site

- `manual/` tem o build, uma cópia da parte genérica de `rio/manual/rulebook`:
  capítulos, fontes e `sync-check`, rótulos de status, glossários, lint, PDF
  com WeasyPrint. O que é do Rio (cartas, facções, mapas, ícones) fica de fora.
- O site do manual inclui a página de entrada da coleção, como no Rio.

### Fonte única da verdade

- `regras/` e os glossários dos jogos são as regras.
- Dados estruturados que o manual e o motor precisam iguais (posição inicial,
  tamanho do tabuleiro) ficam em arquivos de dados que os dois leem, quando o
  primeiro motor em Rust existir.

### Idioma

Nível 1 do ADR 0002 do tooling-root, como o Rio: português em tudo, menos no
código.

## Alternatives

- **Um repositório por jogo, coordenados de um repositório só de
  documentação**, como o `tooling-root`. O kit Rust precisaria de versões e
  dependências por git, e as regras ficariam longe dos motores. Descartado.
- **Uma pasta por jogo com regras, manual e motor juntos** (`jogos/seks/`).
  Descartado: o livro de regras é único, e o kit físico é comum.
- **Pacote de build do manual compartilhado com o Rio.** Quase metade do
  código do Rio é específica dele. Descartado por agora: copiar a parte
  genérica e extrair um pacote comum depois, se valer a pena.
- **Extrair o kit digital desde o primeiro jogo.** Com um jogo só, a trait
  sairia com o formato do Seks e erraria no segundo jogo.

## Open questions

- O repositório `fabiommendes/seks` no GitHub e o pacote no PyPI: arquivar,
  ou publicar a versão em Rust com o mesmo nome?
- Algum jogo será público? Isso muda o nível de idioma daquele jogo.

## Outcome

- dev/adr/0001-monorepo-de-coordenacao.md
- dev/adr/0002-build-do-manual-copiado-do-rio.md
- regras/kit.md
- dev/issues/build-do-manual.md
- dev/issues/motor-do-seks-em-rust.md
- dev/issues/composicao-do-kit-fisico.md

---
by: fabio

D1. Vamos deixar esse repositório como coordenação. Uma pasta de regras comum
a todo mundo (o livro de regras é único para todos os jogos) e uma pasta por
implementação digital. Esse vai ser um monorepo. D2: copiar a parte genérica
do build do manual do Rio. D3: trazer o histórico do protótipo com
`git filter-repo`. D4: nível 1 de idioma. D5: todos os jogos usam o mesmo kit
físico.
