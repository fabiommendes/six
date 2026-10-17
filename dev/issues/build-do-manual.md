---
type: issue
status: in_progress
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
