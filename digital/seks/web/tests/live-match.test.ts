import { describe, expect, it } from "vitest";
import { SeksGame } from "../src/engine/game";
import { endingFixture } from "../src/logic/fixtures";
import type { Mode } from "../src/logic/match";
import { endCard, hint, LIVE, mailGameStatus, modeLine, sideTag, turnSubtitle } from "../src/logic/texts";
import { newLiveGame } from "../src/logic/mail-games";
import { newMatch } from "./fakes";

const as = (human: "white" | "black"): Mode => ({ kind: "live", human, id: "abc" });
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("Match live", () => {
  it("only the side of this browser plays, and there is no undo", async () => {
    const { match } = newMatch(SeksGame.create(), as("black"));
    await match.start();
    expect(match.snapshot().humanToMove).toBe(false);
    await match.click("b2");
    expect(match.snapshot().selection).toBeNull();

    const white = newMatch(SeksGame.create(), as("white"));
    await white.match.start();
    await white.match.click("b2");
    await white.match.click("b4");
    expect(white.match.snapshot().canUndo).toBe(false);
    white.match.undo();
    expect(white.match.record().commands).toEqual(["b2-b4"]);
  });

  it("tells the listeners the human's plays, as soon as the engine takes them, and only those", async () => {
    const { match, game } = newMatch(SeksGame.create(), as("white"));
    const told: { command: string; recorded: string[]; hash: string }[] = [];
    match.onHumanPlay((command) => told.push({ command, recorded: match.record().commands, hash: game.hash() }));
    await match.start();
    await match.click("b2");
    await match.click("b4");
    expect(told).toEqual([{ command: "b2-b4", recorded: ["b2-b4"], hash: game.hash() }]);
    await match.playRemote("b10-b8");
    expect(told).toHaveLength(1);
  });

  it("stops telling a listener that left", async () => {
    const { match } = newMatch(SeksGame.create(), as("white"));
    const told: string[] = [];
    const off = match.onHumanPlay((command) => told.push(command));
    off();
    await match.start();
    await match.click("b2");
    await match.click("b4");
    expect(told).toEqual([]);
  });

  it("plays what the other player played, animated, and the turn is the human's again", async () => {
    const { match, stage } = newMatch(SeksGame.create(), as("black"));
    await match.start();
    await match.playRemote("b2-b4");
    const snapshot = match.snapshot();
    expect(snapshot.view.to_move).toBe("black");
    expect(snapshot.humanToMove).toBe(true);
    expect(snapshot.last).toMatchObject({ side: "white", from: "b2", to: "b4" });
    expect(stage.animations).toHaveLength(1);
    expect(match.record().commands).toEqual(["b2-b4"]);
  });

  it("refuses an illegal play, the human's own turn and a game that is over, leaving the game as it was", async () => {
    const { match } = newMatch(SeksGame.create(), as("white"));
    await match.start();
    expect(() => match.playRemote("b10-b8")).toThrow();
    expect(match.record().commands).toEqual([]);
    await match.click("b2");
    await match.click("b4");
    expect(() => match.playRemote("b4-b5")).toThrow();
    expect(() => match.playRemote("zz")).toThrow();
    expect(match.record().commands).toEqual(["b2-b4"]);

    const ending = endingFixture();
    const over = newMatch(ending.game, as("black"));
    await over.match.start();
    await over.match.playRemote("c8-c11");
    expect(over.match.snapshot().view.outcome).not.toBeNull();
    expect(() => over.match.playRemote("b10-b8")).toThrow();
  });

  it("only a live match takes plays from outside", async () => {
    const { match } = newMatch(SeksGame.create(), { kind: "hotseat" });
    await match.start();
    expect(() => match.playRemote("b2-b4")).toThrow();
  });

  it("a play that comes while the last is still moving waits for it and both end up shown", async () => {
    const { match, stage } = newMatch(SeksGame.create(), as("white"));
    let release!: () => void;
    stage.gate = new Promise<void>((resolve) => (release = resolve));
    await match.start();
    await match.click("b2");
    const first = match.click("b4");
    await tick();
    expect(match.snapshot().busy).toBe(true);
    const second = match.playRemote("b10-b8");
    await tick();
    // The engine has both plays; the stage was asked for the first only.
    expect(match.record().commands).toEqual(["b2-b4", "b10-b8"]);
    expect(stage.animations).toHaveLength(1);
    expect(match.snapshot().busy).toBe(true);
    stage.gate = null;
    release();
    await Promise.all([first, second]);
    expect(stage.animations).toHaveLength(2);
    expect(match.snapshot().busy).toBe(false);
    expect(match.snapshot().humanToMove).toBe(true);
  });

  it("cannot be handed to bots", async () => {
    const { match } = newMatch(SeksGame.create(), as("white"));
    await match.start();
    void match.finishWithBots({ choose: () => new Promise(() => undefined), cancel() {}, dispose() {} }, { id: "x", label: "x" } as never);
    expect(match.mode.kind).toBe("live");
  });
});

describe("texts of live play", () => {
  it("say it is live and which side this browser plays", async () => {
    const { match } = newMatch(SeksGame.create(), as("black"));
    await match.start();
    const snapshot = match.snapshot();
    expect(modeLine(snapshot.mode)).toBe("Ao vivo · você joga com as Pretas");
    expect(sideTag(snapshot.mode, "black")).toBe("você");
    expect(sideTag(snapshot.mode, "white")).toBe("adversário");
    expect(turnSubtitle(snapshot)).toBe("Aguardando as Brancas.");
    expect(hint(snapshot, "clique")).toEqual({ strong: LIVE.waiting("white"), rest: LIVE.waitingRest });
    await match.playRemote("b2-b4");
    expect(turnSubtitle(match.snapshot())).toBe("Sua vez: mova ou incremente um dado.");
    expect(hint(match.snapshot(), "clique").strong).toBe("Escolha um dado.");
  });

  it("the end card is from the point of view of this browser", async () => {
    const win = newMatch(endingFixture().game, as("white"));
    await win.match.start();
    await win.match.click("c8");
    await win.match.click("c11");
    expect(endCard(win.match.snapshot())).toMatchObject({ title: "Você venceu", tone: "win" });

    const loss = newMatch(endingFixture().game, as("black"));
    await loss.match.start();
    await loss.match.playRemote("c8-c11");
    expect(endCard(loss.match.snapshot())).toMatchObject({ title: "Você perdeu", tone: "loss" });
  });

  it("the saved list marks a live game that goes on", () => {
    const game = newLiveGame("white", true, 1, "abc");
    expect(mailGameStatus(game)).toBe("Sua vez · ao vivo");
    expect(mailGameStatus({ ...game, toMove: "black" })).toBe("Aguardando as Pretas · ao vivo");
    expect(mailGameStatus({ ...game, over: true })).toBe("Partida terminada");
    expect(mailGameStatus({ ...game, leftBy: "black" })).toBe("As Pretas saíram da partida.");
  });
});
