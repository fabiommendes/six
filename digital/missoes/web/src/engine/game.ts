import { Game } from "@missoes-wasm";
import type { Action } from "@wire/Action";
import type { Answer } from "@wire/Answer";
import type { Decision } from "@wire/Decision";
import type { Die } from "@wire/Die";
import type { Kind } from "@wire/Kind";
import type { Mission } from "@wire/Mission";
import type { Pending } from "@wire/Pending";
import type { Played } from "@wire/Played";
import type { RoundView } from "@wire/RoundView";
import type { Setup } from "@wire/Setup";
import type { Spot } from "@wire/Spot";
import type { Step } from "@wire/Step";
import type { Use } from "@wire/Use";
import type { View } from "@wire/View";

export type { Action, Answer, Decision, Die, Kind, Mission, Pending, Played, RoundView, Setup, Spot, Step, Use, View };

/** A random seed for the rolls of a new game. */
export function randomSeed(): bigint {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(words[0]!) << 32n) | BigInt(words[1]!);
}

/**
 * A game of the missions on this device. The engine decides what is legal;
 * an illegal answer rejects and changes nothing. Every call is async so the
 * game can run in a Worker: the greedy bot can think for a second or two.
 */
export interface MissionsGame {
  view(): Promise<View>;
  /** Plays the answer of the person who decides now. */
  apply(answer: Answer): Promise<Step>;
  /** The bot who decides now answers. */
  playBot(): Promise<Step>;
  dispose(): void;
}

/** The wasm `Game` in this thread: for the tests, and inside the Worker. */
export class LocalGame implements MissionsGame {
  private readonly game: Game;

  /** Throws on a bad setup (2 to 4 seats) or an unknown bot. */
  constructor(setup: Setup, seed: bigint = randomSeed()) {
    this.game = new Game(JSON.stringify(setup), seed);
  }

  viewNow(): View {
    return JSON.parse(this.game.view()) as View;
  }

  applyNow(answer: Answer): Step {
    return JSON.parse(this.game.apply(JSON.stringify(answer))) as Step;
  }

  playBotNow(): Step {
    return JSON.parse(this.game.playBot()) as Step;
  }

  botToMove(): boolean {
    return this.game.botToMove();
  }

  view(): Promise<View> {
    return attempt(() => this.viewNow());
  }

  apply(answer: Answer): Promise<Step> {
    return attempt(() => this.applyNow(answer));
  }

  playBot(): Promise<Step> {
    return attempt(() => this.playBotNow());
  }

  dispose(): void {
    this.game.free();
  }
}

function attempt<T>(run: () => T): Promise<T> {
  try {
    return Promise.resolve(run());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}
