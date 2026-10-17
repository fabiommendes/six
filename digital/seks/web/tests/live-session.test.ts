import { describe, expect, it } from "vitest";
import { decodeMessage, encodeMessage } from "../src/net/live-protocol";
import { FakeNetwork, peer, settle, type Peer } from "./live-fakes";

/** The host (Whites) and the guest (Blacks), both joined and connected. */
async function connected(network = new FakeNetwork()): Promise<{ network: FakeNetwork; host: Peer; guest: Peer }> {
  const host = peer(network, "white", true);
  const guest = peer(network, "black", false);
  host.session.start();
  await settle();
  guest.session.start();
  await settle();
  return { network, host, guest };
}

/** A play of the player of `from`, sent to the other side. */
function play(from: Peer, command: string): void {
  from.game.play(command);
  from.session.sendMove();
}

describe("the messages", () => {
  it("round-trip, and anything else is ignored", () => {
    for (const message of [
      { t: "state", g: "v1.abc..GQ" },
      { t: "move", n: 3, c: "b2-b4", h: "00ff00ff00ff00ff" },
      { t: "resign" },
    ] as const) {
      expect(decodeMessage(encodeMessage(message))).toEqual(message);
    }
    expect(decodeMessage("not json")).toBeNull();
    expect(decodeMessage("[]")).toBeNull();
    expect(decodeMessage('{"t":"move","v":2,"n":0,"c":"a","h":"b"}')).toBeNull();
    expect(decodeMessage('{"t":"move","v":1,"n":-1,"c":"a","h":"b"}')).toBeNull();
    expect(decodeMessage('{"t":"move","v":1,"n":0,"c":1,"h":"b"}')).toBeNull();
    expect(decodeMessage('{"t":"jump","v":1}')).toBeNull();
  });
});

describe("connection", () => {
  it("goes from connecting to connected on both sides, with no one adopting anything", async () => {
    const { host, guest } = await connected();
    expect(host.session.status).toBe("connected");
    expect(guest.session.status).toBe("connected");
    expect(host.statuses).toEqual(["connected"]);
    expect(guest.statuses).toEqual(["connected"]);
    expect(host.adopted + guest.adopted).toBe(0);
  });

  it("stays connecting while nobody comes", async () => {
    const host = peer(new FakeNetwork(), "white", true);
    host.session.start();
    await settle();
    expect(host.session.status).toBe("connecting");
  });
});

describe("plays", () => {
  it("each play goes to the other side with its number and the hash of the position", async () => {
    const { network, host, guest } = await connected();
    network.log.length = 0;
    play(host, "b2-b4");
    expect(guest.game.commands()).toEqual(["b2-b4"]);
    const sent = decodeMessage(network.log[0]!.text);
    expect(sent).toEqual({ t: "move", n: 0, c: "b2-b4", h: host.game.hash() });
    play(guest, "b10-b8");
    play(host, "b4-b5");
    expect(host.game.commands()).toEqual(["b2-b4", "b10-b8", "b4-b5"]);
    expect(guest.game.commands()).toEqual(host.game.commands());
    expect(guest.game.hash()).toBe(host.game.hash());
    expect(host.adopted + guest.adopted).toBe(0);
  });

  it("an illegal play is not applied, and the sender gets the whole match", async () => {
    const { network, host, guest } = await connected();
    play(host, "b2-b4");
    network.log.length = 0;
    // The guest's side sends a play that is not legal (the engine refuses it).
    guest.room().send(JSON.stringify({ t: "move", v: 1, n: 1, c: "b10-b1", h: "0000000000000000" }));
    expect(host.game.commands()).toEqual(["b2-b4"]);
    const answers = network.log.filter((entry) => entry.from === host.room()).map((entry) => decodeMessage(entry.text));
    expect(answers).toHaveLength(1);
    expect(answers[0]?.t).toBe("state");
  });

  it("a play for the other player's turn is refused", async () => {
    const { host, guest } = await connected();
    // The guest plays the Whites' turn: the host refuses to apply it to the Whites.
    guest.room().send(JSON.stringify({ t: "move", v: 1, n: 0, c: "b2-b4", h: "0000000000000000" }));
    expect(host.game.commands()).toEqual([]);
  });

  it("a play with the wrong hash is taken back and the sides resynchronize", async () => {
    const { host, guest } = await connected();
    play(host, "b2-b4");
    const own = guest.game.commands().length;
    guest.room().send(JSON.stringify({ t: "move", v: 1, n: 1, c: "b10-b8", h: "0000000000000000" }));
    // The host applied nothing it could not check: its match is as before.
    expect(host.game.commands()).toEqual(["b2-b4"]);
    expect(guest.game.commands()).toHaveLength(own);
  });

  it("a repeated play is no problem", async () => {
    const { network, host, guest } = await connected();
    play(host, "b2-b4");
    network.log.length = 0;
    host.session.sendMove();
    expect(guest.game.commands()).toEqual(["b2-b4"]);
    expect(network.log.map((entry) => decodeMessage(entry.text)?.t)).toEqual(["move"]);
  });
});

describe("desynchronization", () => {
  it("a play after a gap: the guest says what it has and takes the host's match", async () => {
    const { host, guest } = await connected();
    // The host's first play never arrived; the next one shows the gap.
    host.game.play("b2-b4");
    host.room().send(JSON.stringify({ t: "move", v: 1, n: 2, c: "b4-b5", h: host.game.hash() }));
    expect(guest.game.commands()).toEqual(["b2-b4"]);
    expect(guest.game.hash()).toBe(host.game.hash());
    expect(guest.adopted).toBe(1);
    expect(host.adopted).toBe(0);
  });

  it("the guest and the host diverged: the host is the reference and the guest takes its match", async () => {
    const { host, guest } = await connected();
    host.game.play("b2-b4");
    guest.game.replace(["c2-c4"]);
    // The host's play meets a guest whose match took another path at the same point.
    host.session.sendMove();
    expect(guest.game.commands()).toEqual(["b2-b4"]);
    expect(host.game.commands()).toEqual(["b2-b4"]);
    expect(host.adopted).toBe(0);
  });
});

describe("a drop and the return", () => {
  it("shows the opponent away and connected again, and the one that is behind catches up", async () => {
    const { network, host, guest } = await connected();
    play(host, "b2-b4");
    network.cut(guest.room());
    expect(host.session.status).toBe("away");
    expect(guest.session.status).toBe("away");
    // The host plays while the guest is away: nobody receives it.
    play(guest, "b10-b8");
    expect(host.game.commands()).toEqual(["b2-b4"]);
    network.heal(guest.room());
    await settle();
    expect(host.session.status).toBe("connected");
    // The guest was ahead by one play; the host catches up.
    expect(host.game.commands()).toEqual(["b2-b4", "b10-b8"]);
    expect(guest.game.commands()).toEqual(["b2-b4", "b10-b8"]);
    expect(host.statuses).toEqual(["connected", "away", "connected"]);
  });

  it("a browser that comes back from a reload with the match it saved gets the rest", async () => {
    const { network, host, guest } = await connected();
    play(host, "b2-b4");
    play(guest, "b10-b8");
    // The guest closes the tab...
    guest.session.dispose();
    await settle();
    expect(host.session.status).toBe("away");
    play(host, "b4-b5");
    // ...and opens it again with the match it had saved (two plays).
    const back = peer(network, "black", false);
    back.game.replace(["b2-b4", "b10-b8"]);
    back.session.start();
    await settle();
    expect(back.game.commands()).toEqual(["b2-b4", "b10-b8", "b4-b5"]);
    expect(host.session.status).toBe("connected");
    expect(back.adopted).toBeGreaterThan(0);
  });
});

describe("resigning", () => {
  it("tells the other side, which stops taking plays", async () => {
    const { host, guest } = await connected();
    play(host, "b2-b4");
    expect(guest.session.resign()).toBe(true);
    expect(host.resigned).toBe(1);
    expect(guest.resigned).toBe(0);
    play(guest, "b10-b8");
    expect(host.game.commands()).toEqual(["b2-b4"]);
  });

  it("with no one there to tell, says so", async () => {
    const { network, host, guest } = await connected();
    network.cut(guest.room());
    expect(guest.session.resign()).toBe(false);
    expect(host.session.resign()).toBe(false);
    expect(host.resigned + guest.resigned).toBe(0);
  });

  it("ignores texts it cannot read", async () => {
    const { host, guest } = await connected();
    guest.room().send("hello");
    guest.room().send(JSON.stringify({ t: "state", v: 1, g: "v1.other..GQ" }));
    expect(host.game.commands()).toEqual([]);
    expect(host.adopted).toBe(0);
  });
});

describe("a message lost with the connection up", () => {
  /** The host and the guest joined, repeating their state every 20 ms. */
  async function resyncing() {
    const network = new FakeNetwork();
    const host = peer(network, "white", true, "game1", 20);
    const guest = peer(network, "black", false, "game1", 20);
    host.session.start();
    await settle();
    guest.session.start();
    await settle();
    return { network, host, guest };
  }
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  it("is made up for by the next state, which a side that missed a play adopts", async () => {
    const { network, host, guest } = await resyncing();
    network.filter = () => false;
    play(host, "b2-b4");
    network.filter = null;
    expect(guest.game.commands()).toEqual([]);
    await wait(80);
    expect(guest.game.commands()).toEqual(["b2-b4"]);
    expect(guest.adopted).toBe(1);
    host.session.dispose();
    guest.session.dispose();
  });

  it("sends nothing while nobody is there, and nothing after the session ends", async () => {
    const network = new FakeNetwork();
    const host = peer(network, "white", true, "game1", 20);
    host.session.start();
    await wait(60);
    expect(network.log).toEqual([]);
    const guest = peer(network, "black", false, "game1", 20);
    guest.session.start();
    await settle();
    host.session.dispose();
    guest.session.dispose();
    network.log.length = 0;
    await wait(60);
    expect(network.log).toEqual([]);
  });

  it("with the connection in order repeats the state without anyone adopting anything", async () => {
    const { network, host, guest } = await resyncing();
    play(host, "b2-b4");
    network.log.length = 0;
    await wait(70);
    expect(network.log.filter((entry) => decodeMessage(entry.text)?.t === "state").length).toBeGreaterThanOrEqual(2);
    expect(host.adopted + guest.adopted).toBe(0);
    host.session.dispose();
    guest.session.dispose();
  });
});
