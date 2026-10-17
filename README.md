# Six

Seis jogos com dados de seis faces, jogados com o mesmo kit físico. Cada jogo
tem uma versão digital, com bots e jogo em rede. O nome de cada jogo é a
palavra "seis" em alguma língua (veja `dev/rfc/nomes-dos-jogos.md`).

| Jogo | Gênero | Estado |
|---|---|---|
| Seks | Estratégia abstrata no estilo de xadrez, damas e hnefatafl | Regras fechadas; protótipo em Python |
| (sem nome) | Competitivo no estilo de sudoku | Ideia |
| (sem nome) | Leilões e formação de sequências | Ideia |
| (sem nome) | Construção de saco com dados especiais | Ideia |
| (sem nome) | Cooperativo | Sem ideia ainda |
| (sem nome) | Releitura de um clássico (duvido, yatzy...) | Ideia |

| Pasta | Conteúdo |
|---|---|
| `regras/` | Regras completas de todos os jogos e do kit físico; a fonte da verdade |
| `manual/` | Livro de regras único, gerado como PDF e site |
| `digital/` | Uma pasta por implementação digital |
| `dev/` | RFCs, ADRs, issues e notas |

As ações comuns estão no `justfile`: rode `just` para listá-las.
