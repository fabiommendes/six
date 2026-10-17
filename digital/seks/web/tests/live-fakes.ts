import { SeksGame, type Side } from "../src/engine/game";
import { seksRuleset } from "../src/logic/seks-link";
import { LiveSession, type LiveGame, type LiveStatus } from "../src/net/live-session";
import type { Room, RoomHandlers, Transport } from "../src/net/transport";

/** A room in memory: every member hears every other, as the real one does once connected. */
class FakeRoom implements Room {
  connected = true;
  constructor(
    readonly network: FakeNetwork,
    readonly roomId: string,
    readonly handlers: RoomHandlers,
  ) {}

  get peers(): number {
    return this.connected ? this.network.membersOf(this.roomId).filter((member) => member !== this && member.connected).length : 0;
  }

  send(text: string): void {
    for (const member of this.network.membersOf(this.roomId)) {
      if (member === this || !this.connected || !member.connected) continue;
      if (this.network.filter !== null && !this.network.filter(this, text)) continue;
      member.handlers.onMessage(text);
    }
  }

  leave(): void {
    this.network.remove(this);
    for (const member of this.network.membersOf(this.roomId)) if (member.connected) member.handlers.onLeave();
  }
}

/** The network of the tests: transports that meet in rooms, with a cable that can be cut. */
export class FakeNetwork {
  private readonly rooms = new Map<string, FakeRoom[]>();
  /** Returns `false` to lose a text on the way. */
  filter: ((from: FakeRoom, text: string) => boolean) | null = null;
  /** Every text sent, in order, with who sent it. */
  readonly log: { from: FakeRoom; text: string }[] = [];

  membersOf(roomId: string): FakeRoom[] {
    return this.rooms.get(roomId) ?? [];
  }

  remove(room: FakeRoom): void {
    this.rooms.set(
      room.roomId,
      this.membersOf(room.roomId).filter((member) => member !== room),
    );
  }

  /** A transport for one browser. Arrivals are told on a later tick, as the real library does. */
  transport(): Transport & { rooms: FakeRoom[] } {
    const mine: FakeRoom[] = [];
    return {
      rooms: mine,
      join: (roomId, handlers) => {
        const room = new FakeRoom(this, roomId, handlers);
        const send = room.send.bind(room);
        room.send = (text) => {
          this.log.push({ from: room, text });
          send(text);
        };
        const others = this.membersOf(roomId).filter((member) => member.connected);
        this.rooms.set(roomId, [...this.membersOf(roomId), room]);
        mine.push(room);
        queueMicrotask(() => {
          for (const other of others) {
            handlers.onJoin();
            other.handlers.onJoin();
          }
        });
        return room;
      },
    };
  }

  /** Cuts the cable of one browser: it and the others see each other leave. */
  cut(room: FakeRoom): void {
    if (!room.connected) return;
    const others = this.membersOf(room.roomId).filter((member) => member !== room && member.connected);
    room.connected = false;
    for (const other of others) {
      other.handlers.onLeave();
      room.handlers.onLeave();
    }
  }

  /** The cable is back: each side sees the other arrive. */
  heal(room: FakeRoom): void {
    if (room.connected) return;
    room.connected = true;
    for (const other of this.membersOf(room.roomId).filter((member) => member !== room && member.connected)) {
      room.handlers.onJoin();
      other.handlers.onJoin();
    }
  }
}

/** A `LiveGame` over the real engine, for the side `human`: the other side's plays are the ones that come in. */
export class TestGame implements LiveGame {
  private game = SeksGame.create();
  private played: string[] = [];
  replaced = 0;

  constructor(private readonly human: Side) {}

  commands(): readonly string[] {
    return this.played;
  }

  hash(): string {
    return this.game.hash();
  }

  /** A play of the player of this browser. */
  play(command: string): void {
    this.game.command(command);
    this.played.push(command);
  }

  apply(command: string): void {
    if (this.game.view().to_move === this.human) throw new Error("not their turn");
    this.play(command);
  }

  replace(commands: readonly string[]): void {
    this.game.free();
    this.game = SeksGame.create();
    this.played = [];
    for (const command of commands) this.play(command);
    this.replaced++;
  }
}

/** One side of a live match in the tests. */
export interface Peer {
  readonly session: LiveSession;
  readonly game: TestGame;
  readonly transport: ReturnType<FakeNetwork["transport"]>;
  readonly statuses: LiveStatus[];
  adopted: number;
  resigned: number;
  /** The room this side joined. */
  readonly room: () => FakeRoom;
}

export function peer(network: FakeNetwork, side: Side, host: boolean, id = "game1"): Peer {
  const transport = network.transport();
  const game = new TestGame(side);
  const result = { game, transport, statuses: [] as LiveStatus[], adopted: 0, resigned: 0 } as Peer;
  const session = new LiveSession({
    transport,
    id,
    roomId: `seks.${id}`,
    host,
    ruleset: seksRuleset,
    game,
    onStatus: (status) => result.statuses.push(status),
    onAdopt: () => void result.adopted++,
    onResign: () => void result.resigned++,
  });
  Object.assign(result, { session, room: () => transport.rooms[0]! });
  return result;
}

/** Lets the arrivals told on a later tick happen. */
export const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
