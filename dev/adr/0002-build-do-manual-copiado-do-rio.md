---
type: adr
status: accepted
tags: [manual, build]
relatedTo: [dev/rfc/estrutura-do-repositorio.md, dev/issues/build-do-manual.md]
created: 2026-10-17
decided: 2026-10-17
deciders: [fabio, claude]
---

# O build do manual é uma cópia da parte genérica do build do Rio

## Context

O Rio tem um build de manual (`rio/manual/rulebook`, Python, Jinja,
Python-Markdown e WeasyPrint) que gera o PDF e o site das mesmas fontes, e
verifica que cada trecho do manual acompanha a seção de `regras/` que ele
reformula. Quase metade do código trata de coisas do Rio: cartas, facções,
mapas, ícones.

## Options

- Um pacote compartilhado entre o Rio e o Six desde já.
- Copiar para `six/manual/` só a parte genérica.

## Decision

Copiar a parte genérica: capítulos e o front matter `fonte:`, `sync-check` e
`sync-mark`, rótulos de status, glossário, símbolos, lint, PDF e site. O Six
tem vários glossários (um por jogo), e o build passou a ler todos.

## Consequences

- Correções feitas num dos builds precisam ser copiadas à mão para o outro.
- Se os dois builds continuarem parecidos, vale extrair um pacote comum.
