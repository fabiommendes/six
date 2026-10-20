---
type: spec
status: draft
tags: [liu, regras, visao-geral]
---

# Visão geral

Jogo de dados para 2 a 4 jogadores, no estilo do sudoku. Cada jogador monta a
sua **janela**, uma grade de até 4 por 4 dados, sem repetir número numa linha
nem numa coluna.

Cada jogador tem um **selo**, um dado da sua cor com um número que não muda
na partida. A cada rodada, dados saem do **saco** para o **mercado** até que
um dos números de selo apareça mais vezes que os outros. Cada jogador pega
um dado do mercado e o põe na janela, ou guarda um dado na **mão** para
depois.

O jogo acaba quando alguém completa a janela, quando o saco esvazia ou
quando uma rodada passa sem que ninguém ponha dado. Linhas e colunas
completas valem pontos, e mais ainda se formam uma sequência ou o código do
jogador.

> **Proposta:** o jogo inteiro foi aprovado para teste e ainda não foi
> jogado.

## Nome

*Liu* (*liù*, 六) é "seis" em mandarim. O quadrado mágico mais antigo, o Lo
Shu, é chinês, e as janelas de treliça chinesas são o motivo da arte do jogo
(ver `dev/adr/0005-identidade-visual-um-motivo-por-lingua.md`).
