---
type: rfc
status: draft
tags: [nomes, identidade]
relatedTo: [dev/rfc/estrutura-do-repositorio.md, dev/notes/referencias.md]
created: 2026-10-17
creator: claude
---

# Nomes dos jogos: "seis" em várias línguas

## Problem

Cada jogo da coleção se chama "seis" em alguma língua humana. O Seks já tem
nome (dinamarquês, norueguês e feroês). Os outros cinco precisam de um, e o
nome deve combinar com o jogo, ser fácil de dizer em português e em inglês e
não colidir com um jogo ou uma marca conhecida.

## Proposal

### Critérios

1. **Pronúncia**: um brasileiro e um falante de inglês leem o nome do mesmo
   jeito, ou quase, sem ajuda. Uma ou duas sílabas.
2. **Escrita**: só letras ASCII no logo e no nome do pacote. Diacríticos podem
   ficar no título do manual (*Liù*), mas o slug é ASCII (`liu`).
3. **Ligação com o jogo**: a língua lembra a origem do gênero ou do tema
   (sudoku e o Japão, o leilão holandês e a Holanda).
4. **Sem colisão**: nenhum jogo no BoardGameGeek com o mesmo nome, nenhuma
   marca grande, nenhum sentido ruim em português ou em inglês.
5. **Variedade**: os seis nomes vêm de famílias de línguas e regiões
   diferentes.

### Candidatos por gênero

| Jogo | Candidato | Língua | Por quê |
|---|---|---|---|
| Estilo sudoku | **Liu** (*liù*, 六) | Mandarim | O quadrado mágico mais antigo, o Lo Shu, é chinês. Curto, fácil de dizer |
| Estilo sudoku | Roku (六) | Japonês | O nome "sudoku" é japonês. Colide com a marca Roku (TV) |
| Estilo sudoku | Mu (六つ, *muttsu*) | Japonês, nativo | Também é 無, o "nada" do zen. Curto demais para busca |
| Leilão e sequências | **Zes** | Holandês | O leilão holandês (preço que desce, como no relógio de flores de Aalsmeer) é um tipo clássico de leilão |
| Leilão e sequências | Alti (*altı*) | Turco | O Grande Bazar de Istambul. O "ı" sem ponto se perde no ASCII |
| Leilão e sequências | Shesh | Persa, hebraico | Bazares persas. Mas *shesh besh* é o nome do gamão no Oriente Médio, que serve melhor a outro jogo |
| Construção de saco | Sechs | Alemão | Os jogos de saco mais conhecidos são alemães (*Orléans*, *Quacks*). Difícil de dizer; colide com *6 nimmt!* |
| Construção de saco | Kuusi | Finlandês | Também quer dizer "abeto". Três sílabas, fácil de ler |
| Construção de saco | Enam | Malaio, indonésio | Curto e neutro |
| Cooperativo | **Ono** | Havaiano, maori, taitiano | Os navegadores polinésios cruzavam o Pacífico em grupo, sem instrumentos. Fácil de dizer. Risco de confusão com *UNO* |
| Cooperativo | Sei | Italiano | Em português, "sei" é "eu sei": combina com um jogo de informação escondida, como *Hanabi*. Ambíguo na fala |
| Cooperativo | Anim | Tagalo | Curto. Em inglês lembra *anime* |
| Clássico: dados mentirosos | **Suqta** | Quíchua | O *Perudo* (*Dudo*) vem dos Andes. Fácil de ler |
| Clássico: gamão | **Shesh** | Persa, hebraico | *Shesh besh* (6 e 5) é o gamão no Oriente Médio |
| Clássico: yatzy, generala | Seis | Português, espanhol | A generala é latino-americana. Sem graça como nome |

Os candidatos em negrito são a recomendação de hoje, um por gênero, a
confirmar quando cada jogo tiver as regras desenhadas: o tema do jogo pode
mudar a língua.

### Tabela de referência

A palavra "seis" nas línguas pesquisadas, por família. A pronúncia é uma
aproximação para quem fala português. Itens marcados com (?) precisam de
confirmação com um falante ou um dicionário antes de virar nome de jogo.

**Germânicas**

| Palavra | Língua | Pronúncia | Nota |
|---|---|---|---|
| seks | dinamarquês, norueguês, feroês | "séks" | Nome do primeiro jogo |
| sex | sueco, islandês, nórdico antigo | "séks" | Sentido ruim em inglês e português |
| sechs | alemão, luxemburguês | "zéks" | |
| zes | holandês | "zés" | |
| ses | africâner | "sés" | Também é a palavra do esperanto |
| six | inglês | "síks" | Nome da coleção |
| zeks | iídiche | "zéks" | |
| saihs | gótico | "sérs" | Língua morta |

**Românicas e latim**

| Palavra | Língua | Pronúncia | Nota |
|---|---|---|---|
| seis | português, espanhol, galego | | |
| sei | italiano | "séi" | "Eu sei" em português |
| six | francês | "síss" | Igual ao inglês na escrita |
| sis | catalão, occitano | "sís" | |
| șase | romeno | "cháse" | |
| sex | latim | "séks" | Mesmo problema do sueco |

**Celtas**

| Palavra | Língua | Pronúncia | Nota |
|---|---|---|---|
| sé | irlandês | "chê" | |
| sia | gaélico escocês | "chía" | |
| shey | manês | "chêi" | |
| chwech | galês | "rruérr" | |
| c'hwec'h | bretão | "rruérr" | |
| hwegh | córnico | "huérr" | |

**Eslavas e bálticas**

| Palavra | Língua | Pronúncia | Nota |
|---|---|---|---|
| šest | tcheco, croata, sérvio, esloveno | "chést" | |
| šesť | eslovaco | "chést" | |
| sześć | polonês | "chéchtch" | Difícil para quem não fala polonês |
| шесть (shest') | russo | "chést" | |
| шест (shest) | búlgaro, macedônio | "chést" | |
| шість (shist') | ucraniano | "chísst" | |
| šeši | lituano | "chéchi" | |
| seši | letão | "séchi" | |

**Outras indo-europeias**

| Palavra | Língua | Pronúncia | Nota |
|---|---|---|---|
| έξι (éxi) | grego | "ékssi" | O grego antigo *hex* é o prefixo de "hexágono"; *Hex* já é um jogo clássico |
| gjashtë | albanês | "djáchtê" | |
| վեց (vets') | armênio | "vets" | |
| شش (shesh) | persa | "chêch" | |
| şeş | curdo | "chéch" | |
| شپږ (shpag) | pachto | "chpag" (?) | |
| छह (chhah) | hindi | "tcha" | |
| ছয় (chhoy) | bengali | "tchói" | |
| षट् (ṣaṭ) | sânscrito | "chat" | Em inglês, *chat* |
| šov | romani | "chôv" | |

**Fino-úgricas e túrquicas**

| Palavra | Língua | Pronúncia | Nota |
|---|---|---|---|
| kuusi | finlandês | "kússi" | Também é "abeto" |
| kuus | estoniano | "kúss" | |
| hat | húngaro | "rót" | Em inglês, "chapéu" |
| guhtta | sami do norte | "gúhta" | |
| altı | turco, azeri | "altã" | |
| алты (alty) | cazaque | "altã" | |

**Afro-asiáticas**

| Palavra | Língua | Pronúncia | Nota |
|---|---|---|---|
| ستة (sitta) | árabe | "síta" | |
| sitta | maltês | "síta" | |
| שש (shesh) | hebraico | "chêch" | |
| ስድስት (sidist) | amárico | "sidíst" | |
| shida | hauçá | "chída" | |
| lix | somali | "lih" | |

**Leste e sudeste da Ásia**

| Palavra | Língua | Pronúncia | Nota |
|---|---|---|---|
| 六 (liù) | mandarim | "liôu" | |
| 六 (luk) | cantonês | "luk" | |
| 六 (roku), 六つ (muttsu) | japonês | "rôku", "mútsu" | *Roku* é marca de TV |
| 육 (yuk), 여섯 (yeoseot) | coreano | "iúk", "iôssót" | |
| sáu | vietnamita | "sáu" | |
| หก (hok) | tailandês, laosiano | "rók" | |
| ခြောက် (chauk) | birmanês | "tcháuk" | |
| prammuoy | khmer | "pram-muôi" | Quer dizer "cinco e um" |
| rau | hmong | "rau" | |
| ninggun | manchu | "ningun" | |
| zurgaa | mongol | "zurgá" | |
| drug (དྲུག) | tibetano | "trúk" | Em inglês, *drug* |

**Austronésias**

| Palavra | Língua | Pronúncia | Nota |
|---|---|---|---|
| enam | malaio, indonésio | "ênam" | |
| enem | javanês | "ênem" | Sigla do vestibular brasileiro |
| anim | tagalo | "ânim" | |
| unom | cebuano | "únom" | |
| enina | malgaxe | "enína" | |
| ono | havaiano, maori, taitiano, samoano, fijiano | "ôno" | Em havaiano, *ono* também é "gostoso" |

**Africanas (nígero-congolesas)**

| Palavra | Língua | Pronúncia | Nota |
|---|---|---|---|
| sita | suaíli | "síta" | |
| ẹ̀fà | iorubá | "éfa" | Ligação com o Brasil pela cultura iorubá |
| isii | igbo | "issíi" | |
| isithupha | zulu | "issitúpa" | Quer dizer "polegar": conta-se 6 no polegar |
| isithandathu | xhosa | "issitandátu" | |

**Américas**

| Palavra | Língua | Pronúncia | Nota |
|---|---|---|---|
| suqta | quíchua | "súkta" | |
| suxta | aimará | "súhta" | |
| poteĩ | guarani | "potêin" | "Po" é mão: 5 mais 1 |
| chicuace | náuatle | "tchikuáse" | |

**Isoladas, mortas e construídas**

| Palavra | Língua | Pronúncia | Nota |
|---|---|---|---|
| sei | basco | "séi" | Igual ao italiano |
| huθ ou śa | etrusco | | Qual das duas é o 6 ainda é debatido |
| aš | sumério | "ach" (?) | Escrito como 5 mais 1 |
| *swéḱs | protoindo-europeu | | A raiz de "seis", *six*, *sechs*, *hex* |
| ses | esperanto | "sés" | |
| jav | klingon | "djáv" | Língua de *Star Trek*; marca registrada |

## Alternatives

- **Nomes descritivos** (como *Dice Chess*). Perdem o tema da coleção.
- **Todos os nomes de uma família de línguas** (seis línguas germânicas, por
  exemplo). Os nomes ficam parecidos demais entre si: *seks*, *sechs*, *zes*,
  *ses*.
- **O numeral escrito como algarismo em várias escritas** (六, ٦, ६). Bonito
  no logo, mas não se lê em voz alta.

## Open questions

- Falta conferir cada candidato final no BoardGameGeek e numa busca de marcas
  (INPI e USPTO). As buscas de hoje não acharam jogos chamados *Zes*, *Liu*,
  *Shesh* ou *Kuusi*.
- O nome escolhe a língua pelo tema do jogo, ou o tema do jogo nasce do nome?
  Para o cooperativo, que ainda não tem ideia, o nome pode vir primeiro (*Ono*
  sugere navegação polinésia).
- A coleção se chama *Six* em todas as línguas, ou *Seis* no Brasil?

## Outcome
