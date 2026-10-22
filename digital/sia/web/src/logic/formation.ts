import type { Formation, FormationKind, SideView, View } from "../engine/game";

/** The kinds of formation from the weakest to the strongest, as the engine orders them. */
export const FORMATION_ORDER: readonly FormationKind[] = ["sum", "pair", "threeOfAKind", "twoPairs", "flush", "run", "fourOfAKind", "straightFlush"];

/** The names of the formations, as `regras/sia/GLOSSARY.md` writes them. */
export const FORMATION_NAMES: Readonly<Record<FormationKind, string>> = {
  sum: "Soma",
  pair: "Par",
  threeOfAKind: "Trinca",
  twoPairs: "Dois pares",
  flush: "Naipe",
  run: "Sequência",
  fourOfAKind: "Quadra",
  straightFlush: "Sequência de naipe",
};

/** What each formation is, as `regras/sia/04-formacoes.md` says it. */
export const FORMATION_RULES: Readonly<Record<FormationKind, string>> = {
  sum: "qualquer outra",
  pair: "2 números iguais",
  threeOfAKind: "3 números iguais",
  twoPairs: "2 números, 2 dados de cada",
  flush: "os 3 dados do jogador do mesmo naipe",
  run: "4 números seguidos",
  fourOfAKind: "4 números iguais",
  straightFlush: "4 números seguidos, com os 3 dados do jogador do mesmo naipe",
};

/** Dice on a side of a stone, when it is complete. */
export const SIDE_SIZE = 3;

/** Stones in the row. */
export const STONES = 9;

/** The label of a stone in texts and on the board: A to I, from the left of the first player. */
export const stoneLetter = (stone: number) => "ABCDEFGHI".charAt(stone);

/** 0 for the weakest kind to 7 for the strongest. */
export function strength(kind: FormationKind): number {
  return FORMATION_ORDER.indexOf(kind);
}

/** The kinds from the strongest to the weakest, as the table of the formations lists them. */
export const FORMATIONS_BY_STRENGTH: readonly FormationKind[] = [...FORMATION_ORDER].reverse();

/** The place of a kind in the order, counting from the strongest: "6ª de 8" for a three of a kind. */
export function rankText(kind: FormationKind): string {
  return `${FORMATION_ORDER.length - strength(kind)}ª de ${FORMATION_ORDER.length}`;
}

/** "Trinca, soma 14"; a plain sum reads "Soma 14". */
export function formationText(formation: Formation): string {
  return formation.kind === "sum" ? `Soma ${formation.sum}` : `${FORMATION_NAMES[formation.kind]}, soma ${formation.sum}`;
}

/** Orders two formations by the engine's rule: kind, then sum. Negative when `a` is weaker. */
export function compareFormations(a: Formation, b: Formation): number {
  return strength(a.kind) - strength(b.kind) || a.sum - b.sum;
}

/** What a side is, in words: its formation once complete, else how far it is and what it can still become. */
export function sideText(side: SideView): string {
  if (side.formation) return formationText(side.formation);
  const missing = SIDE_SIZE - side.dice.length;
  if (side.dice.length === 0) return "Vazio";
  return `Faltam ${missing}, pode chegar a ${FORMATION_NAMES[side.potential.kind].toLowerCase()}`;
}

/** The stones a player has taken, by position. */
export function ownedStones(view: Pick<View, "stones">, player: number): number[] {
  return view.stones.flatMap((stone, i) => (stone.owner === player ? [i] : []));
}

/** The most stones in a row (neighbors) a player has taken. */
export function longestRun(view: Pick<View, "stones">, player: number): number {
  let best = 0;
  let run = 0;
  for (const stone of view.stones) {
    run = stone.owner === player ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** The positions of the stones the player to move may claim now. */
export function claimable(view: Pick<View, "claimable">): number[] {
  return view.claimable.flatMap((can, i) => (can ? [i] : []));
}
