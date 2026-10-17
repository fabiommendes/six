import { describe, expect, it } from "vitest";
import { SeksGame } from "../src/engine/game";
import type { Mode } from "../src/logic/match";
import { hint, MAIL, mailGameStatus, modeLine, sideTag, turnSubtitle } from "../src/logic/texts";
import { markResigned, newMailGame } from "../src/logic/mail-games";
import { newMatch } from "./fakes";

const as = (human: "white" | "black"): Mode => ({ kind: "correspondence", human, id: "abc" });

describe("Match by correspondence (R2, R6)", () => {
  it("only the side of this browser plays: the other side's dice take no click", async () => {
    const { match } = newMatch(SeksGame.create(), as("black"));
    await match.start();
    expect(match.snapshot().humanToMove).toBe(false);
    await match.click("b2");
    expect(match.snapshot().selection).toBeNull();
  });

  it("plays its own turn, then waits for the other side and can undo until the link is sent", async () => {
    const { match } = newMatch(SeksGame.create(), as("white"));
    await match.start();
    await match.click("b2");
    await match.click("b4");
    const after = match.snapshot();
    expect(after.view.to_move).toBe("black");
    expect(after.humanToMove).toBe(false);
    expect(after.canUndo).toBe(true);
    match.undo();
    expect(match.snapshot().view.to_move).toBe("white");
    expect(match.snapshot().canUndo).toBe(false);
  });

  it("after the link is sent (lock) the play cannot be undone", async () => {
    const { match } = newMatch(SeksGame.create(), as("white"));
    await match.start();
    await match.click("b2");
    await match.click("b4");
    match.lock();
    expect(match.snapshot().canUndo).toBe(false);
    match.undo();
    expect(match.snapshot().view.to_move).toBe("black");
  });

  it("the plies that came in a link are locked, the answer is not", async () => {
    const { match } = newMatch(SeksGame.create(), as("black"));
    match.resume(["c1-d1"], 1);
    await match.start();
    const received = match.snapshot();
    expect(received.humanToMove).toBe(true);
    expect(received.canUndo).toBe(false);
    expect(received.last).toMatchObject({ side: "white", from: "c1", to: "d1" });
    await match.click("b10");
    await match.click("b8");
    expect(match.snapshot().canUndo).toBe(true);
    match.undo();
    expect(match.snapshot().view.to_move).toBe("black");
    expect(match.snapshot().last).toMatchObject({ side: "white" });
    expect(match.snapshot().canUndo).toBe(false);
  });

  it("asks no bot", async () => {
    const { match } = newMatch(SeksGame.create(), as("white"));
    await match.start();
    await match.click("b2");
    await match.click("b4");
    expect(match.snapshot().thinking).toBe(false);
  });
});

describe("texts of play by correspondence", () => {
  it("says whose side this is and who waits", async () => {
    const { match } = newMatch(SeksGame.create(), as("black"));
    await match.start();
    const snapshot = match.snapshot();
    expect(modeLine(snapshot.mode)).toBe("Por correspondência · você joga com as Pretas");
    expect(sideTag(snapshot.mode, "black")).toBe("você");
    expect(sideTag(snapshot.mode, "white")).toBe("adversário");
    expect(turnSubtitle(snapshot)).toBe("Aguardando as Brancas.");
    expect(hint(snapshot, "clique").strong).toBe("Convide as Brancas.");
  });

  it("asks the link of a play not yet sent and then waits", async () => {
    const { match } = newMatch(SeksGame.create(), as("white"));
    await match.start();
    await match.click("b2");
    await match.click("b4");
    expect(hint(match.snapshot(), "clique").strong).toBe("Mande o link.");
    match.lock();
    expect(hint(match.snapshot(), "clique").strong).toBe("Aguardando as Pretas.");
  });

  it("lists a saved game by whose turn it is, or who left", () => {
    const game = newMailGame("white");
    expect(mailGameStatus(game)).toBe(MAIL.yours);
    expect(mailGameStatus({ ...game, toMove: "black" })).toBe("Aguardando as Pretas");
    expect(mailGameStatus({ ...game, over: true })).toBe(MAIL.over);
    expect(mailGameStatus({ ...game, leftBy: "black" })).toBe("As Pretas saíram da partida.");
    expect(mailGameStatus(markResigned(game))).toBe(MAIL.resignedTitle);
  });
});
