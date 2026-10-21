import { describe, expect, it } from "vitest";
import { LiuGame } from "../src/engine/game";
import { eventText, hint, scoreText, winnersText } from "../src/logic/texts";

const names = ["Ana", "Bia", "Caio"];

/** Words that the glossary of the Liu forbids (regras/liu/GLOSSARY.md, "Não usar"). */
const FORBIDDEN = /\b(puzzle|quebra-cabeça|quadro|tabuleiro|reserva|feira|quadra|senha|rima|dado pessoal)s?\b/i;

describe("texts", () => {
  it("describe every event of a whole game without forbidden words", () => {
    const game = LiuGame.create(3, 21n);
    const lines = game.openingEvents().map((e) => eventText(e, names));
    for (let i = 0; i < 400 && game.view().end === null; i++) {
      const commands = game.legalCommands();
      const command = commands.find((c) => c.kind === "placeFromMarket") ?? commands[0]!;
      for (const event of game.command(command).events) lines.push(eventText(event, names));
      lines.push(hint(game.view(), { kind: "none" }, names));
    }
    expect(game.view().end).not.toBeNull();
    for (const line of lines) {
      expect(line).toBeTruthy();
      expect(line).not.toMatch(FORBIDDEN);
      expect(line).not.toMatch(/undefined|null|NaN/);
    }
  });

  it("say what a score is made of", () => {
    expect(scoreText({ code: null, lines: [], points: 0, dice: 3 })).toBe("Nenhuma linha ou coluna completa.");
    const line = (run: boolean, code: boolean) => ({ line: { kind: "row" as const, index: 0, values: [1, 2, 3, 4] }, run, code, points: 1 + Number(run) + Number(code) });
    expect(scoreText({ code: [1, 2, 3, 4], lines: [line(true, true), line(false, false)], points: 4, dice: 16 })).toBe(
      "2 linhas e colunas completas, 1 sequência, 1 com o código 1 2 3 4.",
    );
  });

  it("tell the market rolled with the bag empty, and a round with nothing in the market", () => {
    expect(eventText({ kind: "marketRerolled", market: [2, 2, 5], rolls: 3 }, names)).toBe(
      "O saco acabou. O mercado foi rolado de novo 3 vezes até um número de selo ter a maioria: 2 2 5.",
    );
    expect(eventText({ kind: "roundStarted", round: 9, first: 1 }, names, [])).toBe("Rodada 9. O saco e o mercado estão vazios: começa de novo Bia.");
    expect(eventText({ kind: "roundStarted", round: 9, first: 1 }, names, [3])).toBe("Rodada 9. Começa Bia, que tem a maioria no mercado.");
  });

  it("name the winners", () => {
    expect(winnersText([1], names)).toBe("Bia venceu!");
    expect(winnersText([0, 2], names)).toBe("Ana e Caio dividem a vitória.");
  });
});
