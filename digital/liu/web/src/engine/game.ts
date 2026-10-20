import { Game } from "@liu-wasm";
import type { Command } from "@wire/Command";
import type { Event } from "@wire/Event";
import type { State } from "@wire/State";
import type { Transition } from "@wire/Transition";
import type { View } from "@wire/View";

export type { Command, Event, State, Transition, View };
export type { Pos } from "@wire/Pos";
export type { PlayerView } from "@wire/PlayerView";
export type { Score } from "@wire/Score";
export type { EndReason } from "@wire/EndReason";

/** A random seed for the dice of a new game. */
export function randomSeed(): bigint {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(words[0]!) << 32n) | BigInt(words[1]!);
}

/**
 * A game of Liu on this device, over the engine in WebAssembly, with typed
 * JSON. The engine decides what is legal; errors are thrown and change
 * nothing.
 */
export class LiuGame {
  private constructor(private readonly game: Game) {}

  static create(players: number, seed: bigint = randomSeed()): LiuGame {
    return new LiuGame(new Game(players, seed));
  }

  /** A game from a saved `State`; throws if the engine could not have reached it. */
  static fromState(state: State | string): LiuGame {
    return new LiuGame(Game.fromState(typeof state === "string" ? state : JSON.stringify(state)));
  }

  openingEvents(): Event[] {
    return JSON.parse(this.game.openingEvents()) as Event[];
  }

  state(): State {
    return JSON.parse(this.game.state()) as State;
  }

  view(): View {
    return JSON.parse(this.game.view()) as View;
  }

  legalCommands(): Command[] {
    return JSON.parse(this.game.legalCommands()) as Command[];
  }

  command(command: Command): Transition {
    return JSON.parse(this.game.command(JSON.stringify(command))) as Transition;
  }

  canUndo(): boolean {
    return this.game.canUndo();
  }

  undo(): View {
    return JSON.parse(this.game.undo()) as View;
  }

  free(): void {
    this.game.free();
  }
}
