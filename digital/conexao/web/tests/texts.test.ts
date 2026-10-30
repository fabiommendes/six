import { describe, expect, it } from "vitest";
import { ConexaoGame, defaultRules, squareOf, type Rules } from "../src/engine/game";
import { NONE } from "../src/logic/selection";
import { capturedText, endText, hint, limitText, moveText, rulesCard, rulesSummary, squareName, winnerText } from "../src/logic/texts";

const names = ["Ana", "Bia"];

describe("texts", () => {
  it("name squares by column letter and row from the White side", () => {
    expect(squareName(squareOf(0, 5))).toBe("f1");
    expect(squareName(squareOf(10, 0))).toBe("a11");
  });

  it("tell how the game ended", () => {
    const rules = defaultRules();
    expect(endText({ kind: "goal", winner: 1 }, names, rules)).toBe("Bia ligou a sua fileira de fundo à do adversário.");
    expect(endText({ kind: "goal", winner: 0 }, names, { ...rules, goal: "reach" })).toMatch(/chegou/);
    expect(endText({ kind: "noMove", winner: 0 }, names, rules)).toBe("Bia ficou sem jogada e perdeu.");
    expect(endText({ kind: "turnLimit" }, names, rules)).toMatch(/300 turnos/);
    expect(winnerText({ kind: "turnLimit" }, names)).toBe("Empate");
    expect(winnerText({ kind: "noMove", winner: 1 }, names)).toBe("Bia venceu!");
  });

  it("describe moves and captures", () => {
    const view = ConexaoGame.create().view();
    expect(moveText({ kind: "increase", at: squareOf(0, 5) }, view, names)).toBe("Ana aumentou o dado de f1 para 2.");
    expect(moveText({ kind: "place", to: squareOf(1, 5), from: { reserve: 2 } }, view, names)).toBe("Ana colocou um dado 2 em f2.");
    expect(moveText({ kind: "place", to: squareOf(1, 5), from: { reserve: 4 } }, view, names)).toBe("Ana colocou um dado 4 em f2.");
    expect(moveText({ kind: "place", to: squareOf(1, 5), from: { board: squareOf(3, 0) } }, view, names)).toBe("Ana colocou um dado em f2, tirando o dado de a4.");
    expect(capturedText([])).toBeNull();
    expect(capturedText([{ at: squareOf(5, 5), die: { owner: 1, value: 4 } }])).toBe("Capturado: o dado preto em f6.");
  });

  it("count the neighbors of a die against its limit", () => {
    const game = ConexaoGame.create();
    game.play({ kind: "place", to: squareOf(1, 5), from: { reserve: 2 } });
    expect(limitText(game.view(), squareOf(0, 5))).toBe("O 1 tem 1 vizinho: está cheio.");
    expect(limitText(game.view(), squareOf(1, 5))).toBe("O 2 tem 1 vizinho: cabe mais 1.");
  });

  it("describe a varied reserve and the loss by captures", () => {
    const rules = { ...defaultRules(), size: 9, dice: 12, capture: true, extra: [0, 0, 0, 1, 1, 1, 1] as Rules["extra"] };
    expect(rulesSummary(rules)).toContain("reserva: um 6, um 5, um 4, um 3 e 7 dados 2");
    expect(rulesCard(rules).find((r) => r.title === "Colocar")!.text).toMatch(/à sua escolha/);
    expect(rulesCard(rules).find((r) => r.title === "Captura")!.text).toMatch(/4 dados capturados perde/);
    expect(rulesCard(defaultRules()).find((r) => r.title === "Colocar")!.text).not.toMatch(/escolha/);
    expect(endText({ kind: "noMove", winner: 1 }, names, rules, [4, 0])).toBe("Ana perdeu dados demais: 4 dados capturados.");
    expect(endText({ kind: "noMove", winner: 1 }, names, rules, [1, 0])).toBe("Ana ficou sem jogada e perdeu.");
  });

  it("show the variants in the rules", () => {
    const rules = { ...defaultRules(), size: 9, capture: true, blockFromBoard: false };
    expect(rulesSummary(rules)).toBe("9x9 · meta: linha · 16 dados · com captura · bloqueante só da reserva");
    const card = rulesCard(rules);
    expect(card.map((r) => r.title)).toContain("Captura");
    expect(card.find((r) => r.title === "Aumentar e bloquear")!.text).toMatch(/fileiras 4, 5 e 6/);
    expect(rulesCard(defaultRules()).find((r) => r.title === "Aumentar e bloquear")!.text).toMatch(/fileiras 5, 6 e 7/);
    expect(hint(ConexaoGame.create().view(), NONE)).toMatch(/anel/);
  });
});
