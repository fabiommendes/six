import { decodeLink, encodeLink, type Ruleset } from "../logic/link";
import { decodeMessage, encodeMessage, type Message } from "./live-protocol";
import type { Room, Transport } from "./transport";

/** Where the connection with the other player stands. */
export type LiveStatus =
  /** Nobody else has come to the room yet. */
  | "connecting"
  | "connected"
  /** The other player was here and is gone. */
  | "away";

/** The match as the session sees it: the board of the page, which owns the engine. */
export interface LiveGame {
  /** The plays made so far, from the standard position. */
  commands(): readonly string[];
  /** The hash of the position now. */
  hash(): string;
  /** Plays what the other player played; throws if the engine refuses it (illegal, or not their turn). */
  apply(command: string): void;
  /** Puts a match made of exactly these plays in place of the current one. */
  replace(commands: readonly string[]): void;
}

export interface LiveSessionOptions {
  readonly transport: Transport;
  /** The id of the match, which names the room. */
  readonly id: string;
  /** The room name (the same on both sides). */
  readonly roomId: string;
  /** Who invited: the reference when the two sides disagree. */
  readonly host: boolean;
  readonly ruleset: Ruleset;
  readonly game: LiveGame;
  readonly onStatus?: (status: LiveStatus) => void;
  /** The match was replaced by the other player's (the guest took the host's, or one side caught up): the screen redraws. */
  readonly onAdopt?: () => void;
  /** The other player resigned. */
  readonly onResign?: () => void;
  /** The room could not be joined. */
  readonly onError?: (reason: string) => void;
  /**
   * While connected, the session repeats its `state` every so many ms, so a
   * message lost on a connection that stays up (the turn would hang forever)
   * is made up for. `0` turns it off. Default: `RESYNC_MS`.
   */
  readonly resyncMs?: number;
}

/** How often a connected session repeats its `state`. */
export const RESYNC_MS = 10_000;

const isPrefix = (short: readonly string[], long: readonly string[]) => short.length <= long.length && short.every((command, i) => command === long[i]);

/**
 * The protocol of a live match over a `Transport` (see `live-protocol.ts`).
 * Each side checks what arrives with its own engine; when the two disagree
 * the host is the reference and sends the whole match in the format of the
 * link. It knows nothing of the DOM, of Seks or of the library of the transport.
 */
export class LiveSession {
  private room: Room | null = null;
  private current: LiveStatus = "connecting";
  private ended = false;
  private resync: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: LiveSessionOptions) {}

  get status(): LiveStatus {
    return this.current;
  }

  /** Joins the room. */
  start(): void {
    if (this.room !== null || this.ended) return;
    this.room = this.options.transport.join(this.options.roomId, {
      onMessage: (text) => this.receive(text),
      onJoin: () => {
        this.setStatus("connected");
        this.sendState();
      },
      onLeave: () => {
        if (this.room !== null && this.room.peers === 0) this.setStatus("away");
      },
      onError: (reason) => this.options.onError?.(reason),
    });
    // A peer already there when the room was joined has no `onJoin` to come.
    if (this.room.peers > 0) {
      this.setStatus("connected");
      this.sendState();
    }
  }

  /** Tells the other player about the play just made on the board (the last of `commands()`). */
  sendMove(): void {
    const commands = this.options.game.commands();
    const command = commands.at(-1);
    if (command === undefined) return;
    this.send({ t: "move", n: commands.length - 1, c: command, h: this.options.game.hash() });
  }

  /** Tells the other player that this one resigned. `false` if nobody is there to be told. */
  resign(): boolean {
    if (this.room === null || this.room.peers === 0) return false;
    this.send({ t: "resign" });
    return true;
  }

  /** Leaves the room. The session does nothing more. */
  dispose(): void {
    this.ended = true;
    this.stopResync();
    this.room?.leave();
    this.room = null;
  }

  private setStatus(status: LiveStatus): void {
    if (status === this.current) return;
    this.current = status;
    if (status === "connected") this.startResync();
    else this.stopResync();
    this.options.onStatus?.(status);
  }

  private startResync(): void {
    const every = this.options.resyncMs ?? RESYNC_MS;
    if (every <= 0 || this.resync !== null) return;
    this.resync = setInterval(() => this.sendState(), every);
  }

  private stopResync(): void {
    if (this.resync === null) return;
    clearInterval(this.resync);
    this.resync = null;
  }

  private send(message: Message): void {
    this.room?.send(encodeMessage(message));
  }

  private sendState(): void {
    this.send({ t: "state", g: encodeLink({ id: this.options.id, start: "", commands: this.options.game.commands() }, this.options.ruleset) });
  }

  private receive(text: string): void {
    if (this.ended) return;
    const message = decodeMessage(text);
    if (message === null) return;
    if (message.t === "resign") {
      this.ended = true;
      this.stopResync();
      this.options.onResign?.();
    } else if (message.t === "move") this.receiveMove(message);
    else this.receiveState(message.g);
  }

  private receiveMove(message: Extract<Message, { t: "move" }>): void {
    const game = this.options.game;
    const own = [...game.commands()];
    if (message.n < own.length) {
      // A play already seen is no problem; a different one at the same point is.
      if (own[message.n] !== message.c) this.disagree();
      return;
    }
    if (message.n > own.length) {
      // Plays were lost on the way.
      this.disagree();
      return;
    }
    try {
      game.apply(message.c);
    } catch {
      this.disagree();
      return;
    }
    if (game.hash() !== message.h) {
      game.replace(own);
      this.options.onAdopt?.();
      this.disagree();
    }
  }

  /** The two sides do not agree on the position: say what this one has, and the reference answers. */
  private disagree(): void {
    this.sendState();
  }

  private receiveState(fragment: string): void {
    let theirs: readonly string[];
    try {
      const link = decodeLink(fragment, this.options.ruleset);
      if (link.id !== this.options.id || link.start !== "") throw new Error("another match");
      theirs = link.commands;
    } catch {
      // Not a match this side can read: it answers with its own.
      this.sendState();
      return;
    }
    const own = this.options.game.commands();
    if (theirs.length === own.length && isPrefix(theirs, own)) return;
    if (isPrefix(theirs, own)) {
      // The other side is behind.
      this.sendState();
    } else if (isPrefix(own, theirs) || !this.options.host) {
      // This side is behind, or the two diverged and the other side is the host.
      this.options.game.replace(theirs);
      this.options.onAdopt?.();
    } else {
      // The two diverged and this side is the host: the reference.
      this.sendState();
    }
  }
}
