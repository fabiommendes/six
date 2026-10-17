import type { Command } from "../engine/game";
import type { BotLevel, BotRequest, BotResponse } from "./protocol";

/** What the match needs from a bot. */
export interface BotPlayer {
  /** The command to play on the game in `state` (the JSON of `SeksGame.stateJson()`). */
  choose(state: string, level: BotLevel): Promise<Command>;
  /** Drops the request in progress: its promise rejects with `BotCancelled`. */
  cancel(): void;
  dispose(): void;
}

/** The rejection of a request that `cancel()` dropped. */
export class BotCancelled extends Error {
  constructor() {
    super("bot request cancelled");
  }
}

/** The part of a `Worker` that `WorkerBot` uses (a fake in the tests). */
export interface WorkerLike {
  postMessage(message: BotRequest): void;
  onmessage: ((event: { data: BotResponse }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

/** Wraps a real `Worker` as a `WorkerLike`. */
export function adaptWorker(worker: Worker): WorkerLike {
  const like: WorkerLike = {
    postMessage: (message) => worker.postMessage(message),
    onmessage: null,
    onerror: null,
    terminate: () => worker.terminate(),
  };
  worker.onmessage = (event: MessageEvent<BotResponse>) => like.onmessage?.({ data: event.data });
  worker.onerror = (event) => like.onerror?.(event);
  return like;
}

interface Pending {
  resolve(command: Command): void;
  reject(error: Error): void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A bot that runs in a Web Worker. `minThinkMs` keeps an instant answer from
 * looking like the bot did not think: the play shows up after at least that
 * long.
 */
export class WorkerBot implements BotPlayer {
  private worker: WorkerLike | null = null;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();

  constructor(
    private readonly spawn: () => WorkerLike,
    private readonly minThinkMs = 0,
  ) {}

  choose(state: string, level: BotLevel): Promise<Command> {
    const worker = this.ensureWorker();
    const id = ++this.nextId;
    const started = Date.now();
    const answer = new Promise<Command>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, state, level });
    });
    return answer.then(async (command) => {
      const wait = this.minThinkMs - (Date.now() - started);
      if (wait > 0) await sleep(wait);
      return command;
    });
  }

  cancel(): void {
    this.rejectAll(new BotCancelled());
  }

  dispose(): void {
    this.rejectAll(new BotCancelled());
    this.worker?.terminate();
    this.worker = null;
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.spawn();
    worker.onmessage = (event) => {
      const response = event.data;
      const pending = this.pending.get(response.id);
      if (!pending) return; // cancelled meanwhile
      this.pending.delete(response.id);
      if ("error" in response) pending.reject(new Error(response.error));
      else pending.resolve(response.command);
    };
    worker.onerror = () => {
      this.rejectAll(new Error("o bot parou de responder"));
      this.worker?.terminate();
      this.worker = null;
    };
    this.worker = worker;
    return worker;
  }

  private rejectAll(error: Error): void {
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const request of pending) request.reject(error);
  }
}
