import { describe, expect, it } from "vitest";
import {
  findMailGame,
  gameRoute,
  loadMailGames,
  MAIL_KEY,
  mailStatus,
  memoryStore,
  newMailGame,
  openLink,
  parseRoute,
  removeMailGame,
  saveMailGame,
  type LinkOutlook,
  type MailGame,
} from "../src/logic/mail-games";
import { outlook } from "../src/logic/seks-link";

const link = (commands: string[], id = "abc", start = "") => ({ id, start, commands });
const after = (commands: string[]): LinkOutlook => outlook("", commands);

describe("saved games", () => {
  it("a new game is the standard position, nothing played, the Whites to move", () => {
    const game = newMailGame("black", 5, "xyz");
    expect(game).toMatchObject({ id: "xyz", start: "", player: "black", commands: [], shared: 0, toMove: "white", over: false, leftBy: null, updated: 5 });
    expect(mailStatus(game)).toBe("waiting");
    expect(mailStatus({ ...game, player: "white" })).toBe("yours");
    expect(mailStatus({ ...game, over: true })).toBe("over");
  });

  it("saves, finds, replaces and removes entries, latest first", () => {
    const store = memoryStore();
    const a = newMailGame("white", 1, "aaa");
    const b = newMailGame("black", 2, "bbb");
    saveMailGame(store, a);
    saveMailGame(store, b);
    expect(loadMailGames(store).map((game) => game.id)).toEqual(["bbb", "aaa"]);
    saveMailGame(store, { ...a, commands: ["c1-d1"], shared: 1, updated: 9 });
    expect(loadMailGames(store).map((game) => game.id)).toEqual(["aaa", "bbb"]);
    expect(findMailGame(store, "aaa")?.commands).toEqual(["c1-d1"]);
    expect(findMailGame(store, "nope")).toBeNull();
    removeMailGame(store, "aaa");
    expect(loadMailGames(store).map((game) => game.id)).toEqual(["bbb"]);
  });

  it("ignores damaged or other-version saves and entries that do not hold", () => {
    const store = memoryStore();
    expect(loadMailGames(store)).toEqual([]);
    store.setItem(MAIL_KEY, "{not json");
    expect(loadMailGames(store)).toEqual([]);
    store.setItem(MAIL_KEY, JSON.stringify({ version: 99, games: [newMailGame("white")] }));
    expect(loadMailGames(store)).toEqual([]);
    const good = newMailGame("white", 1, "good");
    const bad = { ...newMailGame("white", 2, "bad"), shared: 3 };
    store.setItem(MAIL_KEY, JSON.stringify({ version: 1, games: [good, bad, { id: 1 }, null] }));
    expect(loadMailGames(store).map((game) => game.id)).toEqual(["good"]);
  });

  it("a storage that throws is not an error", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadMailGames(broken)).toEqual([]);
    expect(() => saveMailGame(broken, newMailGame("white"))).not.toThrow();
    expect(() => removeMailGame(broken, "abc")).not.toThrow();
  });
});

describe("opening a link", () => {
  const first = ["c1-d1"];
  const second = ["c1-d1", "b10-c9"];

  it("a game this browser does not have: it plays the side to move", () => {
    const opening = openLink(link(first), null, after(first), 7);
    expect(opening).toMatchObject({ kind: "open", stale: false, game: { id: "abc", player: "black", toMove: "black", shared: 1, commands: first, updated: 7 } });
  });

  it("an invitation with no plays: the first player is the Whites", () => {
    const opening = openLink(link([]), null, after([]));
    expect(opening).toMatchObject({ kind: "open", game: { player: "white", toMove: "white", shared: 0 } });
  });

  it("a finished game that is new here: the side that did not play last", () => {
    const ending: LinkOutlook = { toMove: "white", over: true, lastMover: "black" };
    const opening = openLink(link(["x"]), null, ending);
    expect(opening).toMatchObject({ kind: "open", game: { player: "white", over: true } });
  });

  it("the answer to a game this browser has: the entry takes the new plays and keeps its side", () => {
    const mine: MailGame = { ...newMailGame("white", 1, "abc"), commands: first, shared: 1, toMove: "black" };
    const opening = openLink(link(second), mine, after(second), 8);
    expect(opening).toMatchObject({
      kind: "open",
      stale: false,
      game: { player: "white", commands: second, shared: 2, toMove: "white", updated: 8 },
    });
  });

  it("an older link keeps the entry, which is further along, with its unsent play", () => {
    const mine: MailGame = { ...newMailGame("white", 1, "abc"), commands: second, shared: 1, toMove: "white" };
    const opening = openLink(link(first), mine, after(first));
    expect(opening).toEqual({ kind: "open", stale: true, game: mine });
  });

  it("the same link again keeps the entry as it is", () => {
    const mine: MailGame = { ...newMailGame("black", 1, "abc"), commands: first, shared: 1, toMove: "black" };
    expect(openLink(link(first), mine, after(first))).toEqual({ kind: "open", stale: false, game: mine });
  });

  it("a link in which the other side left: a new game here plays the other side", () => {
    const opening = openLink({ ...link(first), left: "w" }, null, after(first));
    expect(opening).toMatchObject({ kind: "open", game: { player: "black", leftBy: "white" } });
  });

  it("a link in which the other side left marks the entry, even with no new plays", () => {
    const mine: MailGame = { ...newMailGame("black", 1, "abc"), commands: first, shared: 1, toMove: "black" };
    expect(openLink({ ...link(first), left: "w" }, mine, after(first))).toMatchObject({ kind: "open", game: { leftBy: "white", commands: first } });
    const longer = openLink({ ...link(second), left: "w" }, { ...mine, player: "black", commands: first }, after(second));
    expect(longer).toMatchObject({ kind: "open", game: { leftBy: "white", commands: second, player: "black" } });
  });

  it("a link that says the player of this browser left, or a side that does not exist, is refused", () => {
    const mine: MailGame = { ...newMailGame("black", 1, "abc"), commands: first, shared: 1, toMove: "black" };
    expect(openLink({ ...link(first), left: "b" }, mine, after(first))).toEqual({ kind: "refused", reason: "other-game" });
    expect(openLink({ ...link(first), left: "z" }, null, after(first))).toEqual({ kind: "refused", reason: "format" });
  });

  it("another game with the same id or a game that went another way is refused", () => {
    const mine: MailGame = { ...newMailGame("white", 1, "abc"), commands: first, shared: 1, toMove: "black" };
    expect(openLink(link(first, "abc", "pw" + "0".repeat(121)), mine, after(first))).toEqual({ kind: "refused", reason: "other-game" });
    expect(openLink(link(["c1-b1", "b10-c9"]), mine, after(["c1-b1", "b10-c9"]))).toEqual({ kind: "refused", reason: "diverged" });
  });
});

describe("the fragment of the page", () => {
  it("is empty, the own game, or a link", () => {
    expect(parseRoute("")).toEqual({ kind: "none" });
    expect(parseRoute("#")).toEqual({ kind: "none" });
    expect(parseRoute("#g.abc_-1")).toEqual({ kind: "game", id: "abc_-1" });
    expect(parseRoute("#v1.abc..AAEJ")).toEqual({ kind: "link", fragment: "v1.abc..AAEJ" });
    expect(parseRoute("#lixo")).toEqual({ kind: "link", fragment: "lixo" });
    expect(parseRoute("#g.a b")).toEqual({ kind: "link", fragment: "g.a b" });
  });

  it("writes the route of a game", () => {
    expect(gameRoute("abc")).toBe("#g.abc");
    expect(parseRoute(gameRoute("abc"))).toEqual({ kind: "game", id: "abc" });
  });
});
