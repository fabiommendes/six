import { randomSeed, type Answer, type MissionsGame, type Setup, type Step, type View } from "./game";
import type { GameRequest, GameResponse } from "./protocol";

/** The part of a `Worker` that `RemoteGame` uses (a fake in the tests). */
export interface WorkerLike {
  postMessage(message: GameRequest): void;
  onmessage: ((event: { data: GameResponse }) => void) | null;
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
  worker.onmessage = (event: MessageEvent<GameResponse>) => like.onmessage?.({ data: event.data });
  worker.onerror = (event) => like.onerror?.(event);
  return like;
}

type Distribute<T> = T extends unknown ? Omit<T, "id"> : never;

interface Waiting {
  resolve(response: GameResponse): void;
  reject(error: Error): void;
}

/** A game that runs in a Worker, request by request. */
export class RemoteGame implements MissionsGame {
  private nextId = 0;
  private readonly waiting = new Map<number, Waiting>();

  private constructor(private readonly worker: WorkerLike) {
    worker.onmessage = (event) => {
      const found = this.waiting.get(event.data.id);
      if (!found) return;
      this.waiting.delete(event.data.id);
      found.resolve(event.data);
    };
    worker.onerror = () => this.rejectAll(new Error("o jogo parou de responder"));
  }

  /** Starts a game of `setup` in the Worker; rejects on a bad setup. */
  static async start(worker: WorkerLike, setup: Setup, seed: bigint = randomSeed()): Promise<RemoteGame> {
    const game = new RemoteGame(worker);
    await game.request({ op: "start", setup, seed: seed.toString() });
    return game;
  }

  async view(): Promise<View> {
    const response = await this.request({ op: "view" });
    if (!("view" in response)) throw new Error("expected a view");
    return response.view;
  }

  apply(answer: Answer): Promise<Step> {
    return this.step({ op: "apply", answer });
  }

  playBot(): Promise<Step> {
    return this.step({ op: "bot" });
  }

  dispose(): void {
    this.rejectAll(new Error("o jogo foi encerrado"));
    this.worker.terminate();
  }

  private async step(request: Distribute<GameRequest>): Promise<Step> {
    const response = await this.request(request);
    if (!("step" in response)) throw new Error("expected a step");
    return response.step;
  }

  private request(request: Distribute<GameRequest>): Promise<GameResponse> {
    const id = ++this.nextId;
    return new Promise<GameResponse>((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.worker.postMessage({ ...request, id } as GameRequest);
    }).then((response) => {
      if ("error" in response) throw new Error(response.error);
      return response;
    });
  }

  private rejectAll(error: Error): void {
    const all = [...this.waiting.values()];
    this.waiting.clear();
    for (const w of all) w.reject(error);
  }
}
