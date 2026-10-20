import { describe, expect, it } from "vitest";
import {
  findMailGame,
  gameRoute,
  isLive,
  isResigned,
  markResigned,
  loadMailGames,
  MAIL_KEY,
  mailStatus,
  memoryStore,
  newLiveGame,
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

describe("resigning keeps the game until the link is sent", () => {
  it("marks the entry with the side that left, so a reload still finds it", () => {
    const store = memoryStore();
    const game = { ...newMailGame("white", 1, "abc"), commands: ["b2-b4"], toMove: "black" as const };
    saveMailGame(store, markResigned(game, 9));
    const saved = findMailGame(store, "abc");
    expect(saved).toMatchObject({ leftBy: "white", updated: 9, commands: ["b2-b4"] });
    expect(isResigned(saved!)).toBe(true);
    expect(isResigned(game)).toBe(false);
    // The opponent's departure is not the player's.
    expect(isResigned({ ...game, leftBy: "black" })).toBe(false);
  });
});

describe("saved games", () => {
  it("a new game is the standard position, nothing played, the Whites to move", () => {
    const game = newMailGame("black", 5, "xyz");
    expect(game).toMatchObject({ id: "xyz", start: "", player: "black", commands: [], shared: 0, toMove: "white", over: false, leftBy: null, live: null, updated: 5 });
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

describe("live games", () => {
  it("a new live game is a new game that knows whether this browser invited", () => {
    expect(newLiveGame("black", true, 3, "xyz")).toEqual({ ...newMailGame("black", 3, "xyz"), live: { host: true } });
    expect(newLiveGame("white", false, 3, "xyz").live).toEqual({ host: false });
  });

  it("is live while it goes on: not over and nobody left", () => {
    const game = newLiveGame("white", true, 1, "abc");
    expect(isLive(game)).toBe(true);
    expect(isLive({ ...game, over: true })).toBe(false);
    expect(isLive({ ...game, leftBy: "black" })).toBe(false);
    expect(isLive(newMailGame("white", 1, "abc"))).toBe(false);
  });

  it("is kept with its live data, and a save from before the live mode loads as by correspondence", () => {
    const store = memoryStore();
    saveMailGame(store, newLiveGame("white", true, 2, "live"));
    const { live: _live, ...old } = newMailGame("black", 1, "old");
    store.setItem(MAIL_KEY, JSON.stringify({ version: 1, games: [newLiveGame("white", true, 2, "live"), old] }));
    expect(findMailGame(store, "live")?.live).toEqual({ host: true });
    expect(findMailGame(store, "old")?.live).toBeNull();
  });

  it("drops an entry whose live data is not valid", () => {
    const store = memoryStore();
    const broken = { ...newMailGame("white", 1, "bad"), live: { host: "yes" } };
    store.setItem(MAIL_KEY, JSON.stringify({ version: 1, games: [broken, newMailGame("white", 2, "good")] }));
    expect(loadMailGames(store).map((game) => game.id)).toEqual(["good"]);
  });

  it("a link of correspondence ends the live mode of the entry, whether it brings plays or not", () => {
    const live = { ...newLiveGame("white", true, 1, "abc"), commands: ["c1-b1"], shared: 1, toMove: "black" as const };
    const same = openLink(link(["c1-b1"]), live, after(["c1-b1"]), 7);
    expect(same).toMatchObject({ kind: "open", game: { live: null, commands: ["c1-b1"] } });
    const further = openLink(link(["c1-b1", "b10-c9"]), live, after(["c1-b1", "b10-c9"]), 7);
    expect(further).toMatchObject({ kind: "open", game: { live: null, commands: ["c1-b1", "b10-c9"] } });
    const fresh = openLink(link(["c1-b1"]), null, after(["c1-b1"]), 7);
    expect(fresh).toMatchObject({ kind: "open", game: { live: null } });
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
    expect(parseRoute("#v2.abc..AAEJ")).toEqual({ kind: "link", fragment: "v2.abc..AAEJ" });
    expect(parseRoute("#lixo")).toEqual({ kind: "link", fragment: "lixo" });
    expect(parseRoute("#g.a b")).toEqual({ kind: "link", fragment: "g.a b" });
  });

  it("is an invite when it reads as one, with the side of whoever invites", () => {
    expect(parseRoute("#i1.abc_-1.w")).toEqual({ kind: "invite", id: "abc_-1", host: "white" });
    expect(parseRoute("#i1.abc.b")).toEqual({ kind: "invite", id: "abc", host: "black" });
    // Anything that is not a valid invite is taken for a link, which says why it does not open.
    expect(parseRoute("#i1.abc.x")).toEqual({ kind: "link", fragment: "i1.abc.x" });
    expect(parseRoute("#i2.abc.w")).toEqual({ kind: "link", fragment: "i2.abc.w" });
  });

  it("writes the route of a game", () => {
    expect(gameRoute("abc")).toBe("#g.abc");
    expect(parseRoute(gameRoute("abc"))).toEqual({ kind: "game", id: "abc" });
  });
});
