import { describe, expect, it } from "vitest";
import type { Die, SideView, View } from "../src/engine/game";
import { SiaGame } from "../src/engine/game";
import { claimable, compareFormations, FORMATION_NAMES, FORMATION_ORDER, formationText, longestRun, ownedStones, sideText, stoneLetter, strength } from "../src/logic/formation";

const die = (value: number): Die => ({ value, suit: 0 });
const side = (dice: Die[], formation: SideView["formation"], potential = { kind: "sum", sum: 0 } as SideView["potential"]): SideView => ({ dice, formation, potential });
const stones = (owners: (number | null)[]) => ({ stones: owners.map((owner) => ({ number: 1, owner, sides: [] })) });

describe("formation names", () => {
  it("are those of the glossary, from the weakest to the strongest", () => {
    expect(FORMATION_ORDER.map((k) => FORMATION_NAMES[k])).toEqual(["Soma", "Par", "Trinca", "Dois pares", "Naipe", "Sequência", "Quadra", "Sequência de naipe"]);
  });

  it("order like the engine does: kind first, then the sum", () => {
    expect(strength("straightFlush")).toBe(7);
    expect(compareFormations({ kind: "pair", sum: 20 }, { kind: "threeOfAKind", sum: 5 })).toBeLessThan(0);
    expect(compareFormations({ kind: "pair", sum: 9 }, { kind: "pair", sum: 7 })).toBeGreaterThan(0);
    expect(compareFormations({ kind: "run", sum: 10 }, { kind: "run", sum: 10 })).toBe(0);
  });
});

describe("formationText", () => {
  it("reads kind and sum", () => {
    expect(formationText({ kind: "threeOfAKind", sum: 14 })).toBe("Trinca, soma 14");
    expect(formationText({ kind: "straightFlush", sum: 18 })).toBe("Sequência de naipe, soma 18");
  });

  it("does not repeat the word for a plain sum", () => {
    expect(formationText({ kind: "sum", sum: 12 })).toBe("Soma 12");
  });
});

describe("sideText", () => {
  it("tells a complete side by its formation", () => {
    expect(sideText(side([die(1), die(1), die(2)], { kind: "pair", sum: 7 }))).toBe("Par, soma 7");
  });

  it("tells an incomplete side by what is missing and what it can still be", () => {
    expect(sideText(side([die(3)], null, { kind: "fourOfAKind", sum: 15 }))).toBe("Faltam 2, pode chegar a quadra");
    expect(sideText(side([], null))).toBe("Vazio");
  });
});

describe("stones taken", () => {
  it("lists the stones of a player and the longest row of neighbors", () => {
    const view = stones([0, 0, null, 0, 1, 0, 0, 0, null]);
    expect(ownedStones(view, 0)).toEqual([0, 1, 3, 5, 6, 7]);
    expect(longestRun(view, 0)).toBe(3);
    expect(longestRun(view, 1)).toBe(1);
    expect(longestRun(stones([null, null]), 0)).toBe(0);
  });

  it("names the stones A to I", () => {
    expect(Array.from({ length: 9 }, (_, i) => stoneLetter(i)).join("")).toBe("ABCDEFGHI");
  });

  it("lists the stones that can be claimed", () => {
    expect(claimable({ claimable: [false, true, false, true] })).toEqual([1, 3]);
  });
});

describe("with the engine", () => {
  it("agrees with the engine on the formation of every complete side", () => {
    const game = SiaGame.create(11n);
    for (let i = 0; i < 80 && game.view().end === null; i++) {
      const commands = game.legalCommands();
      game.command(commands[(i * 7) % commands.length]!);
    }
    const view: View = game.view();
    for (const stone of view.stones) {
      for (const s of stone.sides) {
        if (s.formation) expect(s.dice).toHaveLength(3);
        if (s.formation) expect(compareFormations(s.formation, s.potential)).toBe(0);
      }
    }
  });
});
