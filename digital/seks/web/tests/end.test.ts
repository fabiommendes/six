import { describe, expect, it } from "vitest";
import { drawFixture, endingFixture, lossFixture, stuckFixture, winFixture, FIXTURES, type Fixture } from "../src/logic/fixtures";
import type { Cell } from "../src/engine/cells";
import { endCard, resultText } from "../src/logic/texts";
import { newMatch, ScriptedBot } from "./fakes";

/** Opens a fixture on a match and plays `from` to `to` by clicks. */
async function played(fixture: Fixture, from: Cell, to: Cell, bot: ScriptedBot | null = null) {
  const { match, stage } = newMatch(fixture.game, fixture.mode, bot);
  await match.start();
  await match.click(from);
  await match.click(to);
  return { match, stage, snapshot: match.snapshot() };
}

describe("the end of the game: the card (feedback of the designer)", () => {
  it("has no card while the game goes on", async () => {
    const { match } = newMatch(winFixture().game, winFixture().mode);
    await match.start();
    expect(endCard(match.snapshot())).toBeNull();
  });

  it("a win against the bot: Você venceu, with the reason in a line", async () => {
    const { snapshot } = await played(winFixture(), "c8", "c11");
    expect(endCard(snapshot)).toEqual({
      title: "Você venceu",
      reason: "Um dado das Brancas terminou o movimento na fileira de fundo das Pretas.",
      tone: "win",
    });
  });

  it("a loss against the bot: Você perdeu", async () => {
    const fixture = lossFixture();
    const bot = new ScriptedBot();
    bot.queue = ["c8-c11"];
    const { match } = newMatch(fixture.game, fixture.mode, bot);
    await match.start();
    // The bot plays the Whites and wins at once.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const card = endCard(match.snapshot());
    expect(card).toMatchObject({ title: "Você perdeu", tone: "loss" });
    expect(card?.reason).toContain("fileira de fundo");
  });

  it("in hotseat the card names the side that won, with no point of view", async () => {
    const { snapshot } = await played(endingFixture(), "c8", "c11");
    expect(endCard(snapshot)).toMatchObject({ title: "Vitória das Brancas", tone: "neutral" });
  });

  it("by correspondence it is the point of view of this browser too", async () => {
    const fixture = endingFixture();
    const { match } = newMatch(fixture.game, { kind: "correspondence", human: "black", id: "abc" });
    await match.start();
    expect(endCard(match.snapshot())).toBeNull();
    const as = newMatch(fixture.game, { kind: "correspondence", human: "white", id: "abc" });
    await as.match.start();
    await as.match.click("c8");
    await as.match.click("c11");
    expect(endCard(as.match.snapshot())).toMatchObject({ title: "Você venceu" });
  });

  it("a draw shows its reason and no side as the winner", async () => {
    const { snapshot } = await played(drawFixture(), "b4", "b5");
    expect(snapshot.view.outcome).toEqual({ kind: "draw", reason: "no_capture" });
    const card = endCard(snapshot);
    expect(card).toMatchObject({ title: "Empate", tone: "neutral" });
    expect(card?.reason).toBe("100 jogadas seguidas sem captura, 50 de cada jogador.");
  });

  it("a win because the other side has no play says so", async () => {
    const { snapshot } = await played(stuckFixture(), "a1", "a2");
    expect(snapshot.view.outcome).toEqual({ kind: "win", winner: "white", reason: "no_play" });
    expect(endCard(snapshot)).toMatchObject({ title: "Vitória das Brancas", reason: "As Pretas ficaram sem jogada." });
  });

  it("repetition says the position came a third time", () => {
    const view = { repetitions_for_draw: 3, max_plies_without_capture: 100 } as never;
    expect(resultText({ kind: "draw", reason: "repetition" }, view).reason).toBe("A mesma posição apareceu pela 3ª vez.");
  });

  it("the fixtures are open by name", () => {
    for (const name of ["vitoria", "derrota", "empate", "sem-jogada"]) expect(FIXTURES[name]).toBeTypeOf("function");
  });
});

describe("what decided the game is marked on the board", () => {
  it("the die that reached the back row", async () => {
    const { stage } = await played(endingFixture(), "c8", "c11");
    const marks = stage.animations.at(-1)!.marks;
    expect(marks.decisive).toEqual(["c11"]);
  });

  it("every die of the side left with no play", async () => {
    const { stage } = await played(stuckFixture(), "a1", "a2");
    expect(stage.animations.at(-1)!.marks.decisive).toEqual(["a11"]);
  });

  it("nothing in a draw or while the game goes on", async () => {
    const draw = await played(drawFixture(), "b4", "b5");
    expect(draw.stage.animations.at(-1)!.marks.decisive).toEqual([]);
    const { match, stage } = newMatch(endingFixture().game, endingFixture().mode);
    await match.start();
    expect(stage.shown.at(-1)!.marks.decisive).toEqual([]);
  });

  it("goes away when the last play is taken back", async () => {
    const { match, stage } = await played(endingFixture(), "c8", "c11");
    match.undo();
    expect(stage.shown.at(-1)!.marks.decisive).toEqual([]);
  });
});
