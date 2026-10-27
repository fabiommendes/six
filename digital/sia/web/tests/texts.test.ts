import { describe, expect, it } from "vitest";
import { SiaGame, type Event, type View } from "../src/engine/game";
import { NONE, REROLL_START } from "../src/logic/selection";
import { ACTIONS, claimTag, dieText, endText, eventText, handText, happeningText, hint, sideLines, stonesCount, TOOLS, turnTitle, winnersText } from "../src/logic/texts";

const names = ["Ana", "Beto"];

/** Words `regras/sia/GLOSSARY.md` says never to use. */
const FORBIDDEN = /\b(combina[cç][aã]o|jogada|coluna|pilha|bandeira|fronteira|territ[oó]rio|reserva|capturar|conquistar|capturou|conquistou|saco|caixa)\b/i;

/** Plays a whole game with the last legal command and returns all the events and the views. */
function playedGame(seed: bigint): { events: Event[]; views: View[]; game: SiaGame } {
  const game = SiaGame.create(seed);
  const events: Event[] = [...game.openingEvents()];
  const views: View[] = [game.view()];
  for (let i = 0; i < 400 && game.view().end === null; i++) {
    const commands = game.legalCommands();
    // Mix the plays, so claims, rerolls and passes all show up.
    const command = commands[(i * 13) % commands.length]!;
    const t = game.command(command);
    events.push(...t.events);
    views.push(t.view);
  }
  return { events, views, game };
}

describe("dieText", () => {
  it("says the number and the suit", () => {
    expect(dieText({ value: 5, suit: 0 })).toBe("5 vermelho");
    expect(dieText({ value: 2, suit: 1 })).toBe("2 azul");
  });
});

describe("eventText", () => {
  it("writes a line for every kind of event the engine plays, without a word of the glossary's lists", () => {
    const kinds = new Set<string>();
    for (const seed of [1n, 2n, 3n, 4n]) {
      const { events, views } = playedGame(seed);
      const last = views[views.length - 1]!;
      for (const event of events) {
        kinds.add(event.kind);
        const text = eventText(event, names, last);
        const happening = happeningText(event, names, last);
        for (const t of [text, happening]) if (t !== null) expect(t).not.toMatch(FORBIDDEN);
        if (event.kind !== "turnStarted" && event.kind !== "drawn") expect(text).not.toBeNull();
      }
    }
    for (const kind of ["stonesRolled", "drawn", "rerolled", "placed", "claimed"]) expect(kinds.has(kind)).toBe(true);
  });

  it("tells a placement and a completed side", () => {
    const text = eventText({ kind: "placed", player: 0, die: { value: 4, suit: 2 }, handIndex: 0, stone: 3, completes: true }, names);
    expect(text).toBe("Ana pôs o 4 no marco D, completando o lado.");
  });

  it("tells a reroll with its cost and what changed", () => {
    const own = eventText({ kind: "rerolled", player: 0, target: 0, lost: { value: 6, suit: 3 }, lostIndex: 0, rolled: [{ index: 1, from: { value: 2, suit: 0 }, to: { value: 5, suit: 0 } }] }, names)!;
    expect(own).toContain("perdeu para sempre o 6 verde");
    expect(own).toContain("da própria mão");
    expect(own).toContain("2 virou 5");
    const other = eventText({ kind: "rerolled", player: 0, target: 1, lost: { value: 6, suit: 3 }, lostIndex: 0, rolled: [] }, names)!;
    expect(other).toContain("da mão de Beto");
  });

  it("tells a claim with the formation and the stone", () => {
    const text = eventText({ kind: "claimed", player: 1, stone: 0, formation: { kind: "threeOfAKind", sum: 14 }, proven: false }, names, { stones: [{ number: 3, owner: 1, sides: [] }] })!;
    expect(text).toBe("Beto reivindicou o marco A (3) com trinca, soma 14.");
  });

  it("tells who the stones left at the end went to", () => {
    expect(eventText({ kind: "awarded", stone: 2, player: 0 }, names)).toBe("O marco C ficou com Ana.");
    expect(eventText({ kind: "awarded", stone: 2, player: null }, names)).toBe("O marco C ficou sem dono.");
  });
});

describe("hint", () => {
  it("tells what can be done at the start of a turn", () => {
    const view = SiaGame.create(5n).view();
    const text = hint(view, NONE, names);
    expect(text).toMatch(/dado da sua mão/);
    expect(text).toMatch(/role de novo/);
  });

  it("points at a stone that can be claimed", () => {
    const view = SiaGame.create(5n).view();
    const claim: View = { ...view, claimable: view.claimable.map((_, i) => i === 2) };
    expect(hint(claim, NONE, names)).toContain("reivindicar o marco C");
    expect(claimTag(claim, 2)).toBe("Reivindicar");
  });

  it("tells the cost of a reroll as it is built", () => {
    const view = SiaGame.create(5n).view();
    const me = view.toMove;
    expect(hint(view, REROLL_START, names)).toMatch(/perdido para sempre/);
    const lost = hint(view, { kind: "reroll", target: null, lost: 0, dice: [] }, names);
    expect(lost).toContain("perde o");
    expect(lost).toContain("limitada a 5 dados");
    const rolling = hint(view, { kind: "reroll", target: 1 - me, lost: 0, dice: [0, 1] }, names);
    expect(rolling).toContain(`da mão de ${names[1 - me]}`);
    expect(rolling).toContain("Rola 2 dados");
  });

  it("says a bot is thinking, and why a game ended", () => {
    const view = SiaGame.create(5n).view();
    expect(hint(view, NONE, names, true)).toContain("pensando");
    expect(endText({ kind: "stones", player: 0 }, names)).toBe("Ana tomou o quinto marco.");
    expect(endText({ kind: "neighbors", player: 1 }, names)).toBe("Beto tomou 3 marcos vizinhos.");
    expect(endText({ kind: "noRoom" }, names)).toMatch(/lugar/);
  });
});

describe("small texts", () => {
  it("counts stones and dice in the hand", () => {
    expect(stonesCount(1)).toBe("1 marco");
    expect(stonesCount(3)).toBe("3 marcos");
    expect(handText(5, 5, 0)).toBe("5 dados");
    expect(handText(3, 5, 2)).toBe("3 de 3 dados (2 perdidos)");
  });

  it("announces the winner or the draw", () => {
    expect(winnersText([1], names)).toBe("Beto venceu!");
    expect(winnersText([0, 1], names)).toMatch(/Empate/);
  });

  it("addresses the person to move", () => {
    const view = SiaGame.create(5n).view();
    expect(turnTitle(view, names, false, 1)).toBe("Sua vez");
    expect(turnTitle(view, names, false, 2)).toBe(`Sua vez, ${names[view.toMove]}`);
    expect(turnTitle(view, names, true, 1)).toBe(`Vez de ${names[view.toMove]}`);
  });

  it("keeps the labels of the buttons free of the forbidden words", () => {
    for (const text of [...Object.values(ACTIONS), ...Object.values(TOOLS)]) expect(text).not.toMatch(FORBIDDEN);
  });
});

describe("sideLines", () => {
  const die = (value: number) => ({ value, suit: 0 });
  const potential = { kind: "straightFlush", sum: 15 } as const;

  it("reads a complete side by formation, place in the order and the sum as the tiebreak", () => {
    expect(sideLines({ dice: [die(1), die(1), die(1)], formation: { kind: "threeOfAKind", sum: 14 }, potential })).toEqual({ title: "Trinca", note: "2ª de 6", tiebreak: "desempate: soma 14" });
  });

  it("reads an incomplete side by what is missing and what it can still be", () => {
    expect(sideLines({ dice: [die(3)], formation: null, potential })).toEqual({ title: "Faltam 2 dados", note: "pode chegar a sequência de naipe", tiebreak: "" });
    expect(sideLines({ dice: [die(3), die(3)], formation: null, potential }).title).toBe("Falta 1 dado");
    expect(sideLines({ dice: [], formation: null, potential })).toEqual({ title: "Vazio", note: "faltam 3 dados", tiebreak: "" });
  });
});
