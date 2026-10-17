---
type: issue
status: in_review
tags: [manual, build]
relatedTo: [dev/adr/0002-build-do-manual-copiado-do-rio.md]
kind: task
created: 2026-10-17
creator: claude
---

# Build do manual a partir do build do Rio

## Context

O ADR 0002 decide copiar a parte genérica de `rio/manual/rulebook` para
`manual/`. O livro é único para os seis jogos, então o build lê
`regras/kit.md`, as pastas de jogo em `regras/` e um glossário por jogo.

## Done when

- `just manual` gera `manual/build/manual.pdf` e `manual/build/site/`, com a
  página de entrada da coleção, um capítulo sobre o kit, o capítulo do Seks e
  o glossário do Seks.
- `just manual-check` aponta trechos do manual cujas fontes em `regras/`
  mudaram.
- Nada específico do Rio sobra no código: cartas, facções, mapas, ícones de
  carta, fontes Hearns e Bakso Sapi.

## Plano

- [x] Copiar a parte genérica do `rulebook` do Rio e tirar cartas, facções,
  mapas, ícones e fontes.
- [x] Glossários por jogo (`regras/<jogo>/GLOSSARY.md`), com âncoras
  `jogo-termo` e sinônimos proibidos checados por jogo.
- [x] Diagramas de tabuleiro com dados de pontos (bloco `tabuleiro`).
- [x] Página de entrada da coleção.
- [x] Capítulos: a coleção, o kit (rascunho), o Seks e o glossário.
- [x] `justfile` com `manual`, `manual-serve`, `manual-check` e `check`.
