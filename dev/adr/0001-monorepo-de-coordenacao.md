---
type: adr
status: accepted
tags: [layout, monorepo]
relatedTo: [dev/rfc/estrutura-do-repositorio.md]
created: 2026-10-17
decided: 2026-10-17
deciders: [fabio, claude]
---

# Monorepo de coordenação com regras únicas e uma pasta por versão digital

## Context

A coleção tem seis jogos com o mesmo kit físico e um livro de regras único.
Cada jogo tem uma versão digital própria, e as versões digitais devem
reaproveitar código (rede, bots, dados com semente). O protótipo do Seks era
um repositório separado.

## Options

- Um repositório de coordenação só de documentação e um repositório por jogo.
- Um monorepo com uma pasta por jogo contendo regras, manual e motor.
- Um monorepo com regras e manual comuns e uma pasta por versão digital.

## Decision

A terceira. `regras/` guarda as regras de todos os jogos e do kit físico,
`manual/` gera um livro único, e `digital/<jogo>/` guarda cada versão digital.
O código comum das versões digitais vai para `digital/kit/` quando o segundo
jogo precisar dele. O protótipo em Python entrou com o histórico em
`digital/seks/prototipo/` (`git filter-repo`, tag `seks-py-v0.1.0`).

## Consequences

- Uma mudança de regra, a do manual e a do motor cabem num commit só.
- Um jogo não sai do repositório com um `git mv`: as regras e a versão digital
  ficam em pastas diferentes.
- O repositório `fabiommendes/seks` no GitHub fica parado; o que fazer com ele
  e com o pacote no PyPI ainda não foi decidido.
