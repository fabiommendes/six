import type { Answer, Die, Kind, Mission, Spot, Step, View } from "../engine/game";

/** Every text shown to the player, with the terms of `dev/rfc/jogo-de-missoes.md`. */

export const TITLE = "Missões";

export const KIND_NAMES: Record<Kind, string> = {
  common: "Comum",
  gold: "Ouro",
  highGold: "Ouro alto",
  one: "Um",
  low: "Baixo",
  high: "Alto",
  even: "Par",
  odd: "Ímpar",
  binary: "Binário",
  modifier: "Modificador",
};

/** The printed faces of each kind (the modifier moves by ±1 or ±2; 0 rerolls). */
export const KIND_FACES: Record<Kind, readonly number[]> = {
  common: [1, 2, 3, 4, 5, 6],
  gold: [1, 2, 3, 4, 5, 6],
  highGold: [3, 4, 4, 5, 5, 6],
  one: [1, 1, 1, 1, 1, 1],
  low: [1, 1, 2, 2, 3, 3],
  high: [4, 4, 5, 5, 6, 6],
  even: [2, 2, 4, 4, 6, 6],
  odd: [1, 1, 3, 3, 5, 5],
  binary: [0, 0, 0, 1, 1, 1],
  modifier: [1, 1, 2, 2, 0, 0],
};

export const isGold = (kind: Kind) => kind === "gold" || kind === "highGold";

/** How a face reads: the modifier shows ±1 and ±2. */
export function faceText(kind: Kind, face: number): string {
  if (kind === "modifier") return face === 0 ? "0" : `±${face}`;
  return String(face);
}

export const MISSION_NAMES: Record<Mission, string> = {
  standard: "Padrão",
  bonus: "Bônus",
  distinct: "Diferentes",
  even: "Pares",
  odd: "Ímpares",
  high: "Alta",
  low: "Baixa",
  twoGroups: "Dois grupos",
  ones: "Número 1",
  twos: "Número 2",
  threes: "Número 3",
  fours: "Número 4",
  fives: "Número 5",
  sixes: "Número 6",
};

/** The value of a number mission (1 to 6), or `null` for the others. */
export function missionNumber(mission: Mission): number | null {
  const n = ["ones", "twos", "threes", "fours", "fives", "sixes"].indexOf(mission);
  return n < 0 ? null : n + 1;
}

/** What a mission asks and what its winners score, as the table of the RFC (a no-break space keeps "mais 1" on one line). */
export interface MissionRule {
  readonly goal: string;
  readonly score: string;
}

const numberRule = (n: number): MissionRule => ({ goal: `Obter mais dados com o valor ${n}`, score: `Dobro do número de dados com ${n}` });

export const MISSION_RULES: Record<Mission, MissionRule> = {
  standard: { goal: "Obter o maior grupo de dados iguais", score: "Tamanho do grupo vencedor" },
  bonus: { goal: "Obter o maior grupo de dados iguais", score: "Tamanho do grupo vencedor, mais\u00a01" },
  distinct: { goal: "Obter mais valores diferentes", score: "Número de valores diferentes" },
  even: { goal: "Obter mais dados com valor par", score: "Número de dados pares" },
  odd: { goal: "Obter mais dados com valor ímpar", score: "Número de dados ímpares" },
  high: { goal: "Obter mais dados com 5 ou 6", score: "Dados com 5 ou 6" },
  low: { goal: "Obter mais dados com 1 ou 2", score: "Dados com 1 ou 2" },
  twoGroups: { goal: "Obter os dois maiores grupos de dados iguais", score: "Soma dos dois; o segundo conta com 2 dados ou mais" },
  ones: numberRule(1),
  twos: numberRule(2),
  threes: numberRule(3),
  fours: numberRule(4),
  fives: numberRule(5),
  sixes: numberRule(6),
};

/** The mission at `spot` in the round of `view`; `null` once sabotaged. */
export function spotMission(view: View, spot: Spot): Mission | null {
  if (spot.kind === "standard") return view.current?.standard === false ? null : "standard";
  return view.current?.table[spot.card] ?? null;
}

/** The column of `spot` in `RoundView.results`. */
export const spotColumn = (spot: Spot) => (spot.kind === "standard" ? 0 : spot.card + 1);

export const sameSpot = (a: Spot | null | undefined, b: Spot) => !!a && a.kind === b.kind && (a.kind === "standard" || (b.kind === "card" && a.card === b.card));

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const points = (n: number) => plural(n, "ponto", "pontos");

const dieText = (die: Die) => `${KIND_NAMES[die.kind]} ${faceText(die.kind, die.face)}`;

/** What the pending player is asked, as a heading. */
export function prompt(view: View, names: readonly string[]): string {
  const pending = view.pending;
  if (!pending) return "Fim do jogo";
  const who = names[pending.player]!;
  switch (pending.decision.kind) {
    case "select":
      return `${who}: escolha ${pending.decision.count} dados da reserva para rolar`;
    case "cash":
      return `${who}: troque dados da reserva por dinheiro?`;
    case "buy":
      return `${who}: comprar um dado da vitrine?`;
    case "place":
      return pending.decision.moved ? `${who}: a sua missão foi sabotada; escolha outra` : `${who}: escolha uma missão para o marcador`;
    case "act":
      return `${who}: a sua ação`;
  }
}

/** The line of the history for a step, given the view before it. */
export function stepLine(step: Step, before: View, names: readonly string[]): string {
  const who = names[step.player]!;
  const after = step.view;
  const hand = (v: View) => v.current?.hands[step.player] ?? [];
  const answer: Answer = step.answer;
  switch (answer.kind) {
    case "select":
      return `${who} rolou ${hand(after).map((d) => faceText(d.kind, d.face)).join(" ")}.`;
    case "cash":
      return answer.dice.length === 0 ? `${who} não trocou dados.` : `${who} tirou ${plural(answer.dice.length, "dado", "dados")} do jogo por ${answer.dice.length} de dinheiro.`;
    case "buy": {
      if (answer.die === null) return `${who} não comprou.`;
      const kind = before.showcase[answer.die]!;
      const rolled = hand(after).at(-1);
      return `${who} comprou um ${KIND_NAMES[kind]}${rolled ? ` e tirou ${faceText(rolled.kind, rolled.face)}` : ""}. Os ouros saem da missão.`;
    }
    case "place": {
      const mission = spotMission(before, answer.spot);
      const moved = before.pending?.decision.kind === "place" && before.pending.decision.moved;
      return `${who} ${moved ? "mudou o marcador para" : "pôs o marcador em"} ${mission ? MISSION_NAMES[mission] : "?"}.`;
    }
    case "act": {
      const action = answer.action;
      const was = hand(before);
      const now = hand(after);
      switch (action.kind) {
        case "pass":
          return `${who} passou.`;
        case "sacrifice": {
          const rerolled = action.rerolls.map((i) => faceText(now[i]!.kind, now[i]!.face)).join(" ");
          return `${who} sacrificou o ${dieText(was[action.out]!)}${action.rerolls.length ? ` e rolou de novo ${plural(action.rerolls.length, "dado", "dados")}: ${rerolled}` : ""}.`;
        }
        case "zero":
          return `${who} usou o 0 do ${KIND_NAMES[was[action.zero]!.kind]}: o ${KIND_NAMES[was[action.target]!.kind]} foi de ${was[action.target]!.face} para ${now[action.target]!.face}.`;
        case "modify":
          return `${who} usou o modificador ${action.up ? "+" : "−"}${was[action.modifier]!.face}: o ${KIND_NAMES[was[action.target]!.kind]} foi de ${was[action.target]!.face} para ${now[action.target]!.face}.`;
        case "sabotage": {
          const mission = spotMission(before, action.spot);
          return `${who} pagou ${points(before.sabotageCost)} e sabotou ${mission ? MISSION_NAMES[mission] : "uma missão"}.`;
        }
      }
    }
  }
}

/** The line that closes a round. */
export function roundLine(view: View, names: readonly string[]): string {
  const last = view.last!;
  const parts = last.deltas.map((d, p) => `${names[p]} +${d}`);
  return `Rodada ${last.round}: ${parts.join(", ")}.`;
}

/** The line of the order of a round. */
export function orderLine(view: View, names: readonly string[]): string {
  const round = view.current!;
  return `Ordem: ${round.order.map((p) => `${names[p]} (${round.money[p]})`).join(", ")}.`;
}

export function winnersText(view: View, names: readonly string[]): string {
  const winners = view.winners ?? [];
  if (winners.length === 1) return `${names[winners[0]!]} venceu!`;
  return `Vitória dividida: ${winners.map((w) => names[w]).join(" e ")}.`;
}
