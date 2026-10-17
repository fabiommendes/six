import { describe, expect, it } from "vitest";
import { SeksGame, type Side } from "../src/engine/game";
import { COUNTER_FROM, drawStatus } from "../src/logic/status";
import { resultText } from "../src/logic/texts";

function diagram(dice: Record<string, string>): string {
  const rows: string[] = [];
  for (let row = 11; row >= 1; row--) {
    rows.push(Array.from({ length: 11 }, (_, col) => dice[`${"abcdefghijk"[col]}${row}`] ?? "..").join(" "));
  }
  return rows.join("\n");
}

/** A game that has gone `plies` plies without a capture (the hashes before are placeholders). */
function withPlies(game: SeksGame, plies: number): SeksGame {
  const state = game.state();
  state.plies_without_capture = plies;
  const fake = Array.from({ length: plies }, (_, i) => (i + 1).toString(16).padStart(16, "0"));
  state.history = [...fake, state.history.at(-1)!];
  return SeksGame.fromState(state);
}

describe("drawStatus: the count of plies without a capture", () => {
  it("shows the count from 80 and not before", () => {
    const start = SeksGame.create();
    expect(COUNTER_FROM).toBe(80);
    expect(drawStatus(start.view()).showCounter).toBe(false);
    expect(drawStatus(withPlies(start, 79).view()).showCounter).toBe(false);
    const at80 = drawStatus(withPlies(start, 80).view());
    expect(at80).toMatchObject({ showCounter: true, plies: 80, max: 100 });
    expect(drawStatus(withPlies(start, 99).view()).plies).toBe(99);
  });

  it("can start the count earlier, for a screenshot of the sketch position", () => {
    expect(drawStatus(withPlies(SeksGame.create(), 23).view(), 0).showCounter).toBe(true);
  });
});

describe("drawStatus: the repetition warning", () => {
  it("warns when a play of the side to move would repeat a position the third time", () => {
    const game = SeksGame.create();
    expect(drawStatus(game.view()).repetitionWarning).toBe(false);
    const cycle = ["b2-b4", "b10-b8", "b4-b2", "b8-b10"];
    for (const command of [...cycle, ...cycle.slice(0, 3)]) game.command(command);
    const status = drawStatus(game.view());
    expect(status.repetitionWarning).toBe(true);
    expect(status.repetitionsForDraw).toBe(3);
  });

  it("does not warn after the game is over", () => {
    const game = SeksGame.create();
    const cycle = ["b2-b4", "b10-b8", "b4-b2", "b8-b10"];
    for (const command of [...cycle, ...cycle.slice(0, 3), "b8-b10"]) game.command(command);
    expect(game.view().outcome).toMatchObject({ kind: "draw", reason: "repetition" });
    expect(drawStatus(game.view()).repetitionWarning).toBe(false);
  });
});

describe("resultText: the winner and the reason, or the draw and the reason", () => {
  it("a win on the back row", () => {
    const game = SeksGame.fromDiagram(diagram({ e5: "w6", a1: "w1", k11: "b1" }), "white");
    const { view } = game.command("e5-e11");
    expect(resultText(view.outcome!, view)).toEqual({
      title: "Vitória das Brancas",
      reason: "Um dado das Brancas terminou o movimento na fileira de fundo das Pretas.",
      winner: "white",
    });
  });

  it("a win by the opponent having no play", () => {
    // The Whites capture the last black die: the Blacks have nothing to play.
    const game = SeksGame.fromDiagram(diagram({ a4: "w1", a5: "b2", a7: "w3" }), "white");
    const { view } = game.command("a7-a6");
    expect(view.outcome).toMatchObject({ kind: "win", winner: "white", reason: "no_play" });
    expect(resultText(view.outcome!, view)).toMatchObject({ title: "Vitória das Brancas", reason: "As Pretas ficaram sem jogada." });
  });

  it("a black win names the Blacks", () => {
    const game = SeksGame.fromDiagram(diagram({ e7: "b6", a11: "b1", k1: "w1" }), "black");
    const { view } = game.command("e7-e1");
    const side: Side = "black";
    expect(resultText(view.outcome!, view)).toMatchObject({ title: "Vitória das Pretas", winner: side });
  });

  it("a draw by repetition", () => {
    const game = SeksGame.create();
    const cycle = ["b2-b4", "b10-b8", "b4-b2", "b8-b10"];
    for (const command of [...cycle, ...cycle.slice(0, 3)]) game.command(command);
    const { view } = game.command("b8-b10");
    expect(resultText(view.outcome!, view)).toEqual({ title: "Empate", reason: "A mesma posição apareceu pela 3ª vez.", winner: null });
  });

  it("a draw by plies without a capture", () => {
    const game = withPlies(SeksGame.fromDiagram(diagram({ a1: "w1", k11: "b1" }), "white"), 99);
    const { view } = game.command("a1+");
    expect(view.outcome).toMatchObject({ kind: "draw", reason: "no_capture" });
    expect(resultText(view.outcome!, view)).toMatchObject({ title: "Empate", reason: "100 jogadas seguidas sem captura, 50 de cada jogador." });
  });
});
