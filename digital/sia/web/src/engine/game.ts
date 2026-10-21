import { Bot, Game } from "@sia-wasm";
import type { Command } from "@wire/Command";
import type { Event } from "@wire/Event";
import type { State } from "@wire/State";
import type { Transition } from "@wire/Transition";
import type { View } from "@wire/View";

export type { Command, Event, State, Transition, View };
export type { Die } from "@wire/Die";
export type { EndReason } from "@wire/EndReason";
export type { Formation } from "@wire/Formation";
export type { FormationKind } from "@wire/FormationKind";
export type { PlayerView } from "@wire/PlayerView";
export type { SideView } from "@wire/SideView";
export type { StoneView } from "@wire/StoneView";

/** A random seed for the dice of a new game. */
export function randomSeed(): bigint {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(words[0]!) << 32n) | BigInt(words[1]!);
}

/**
 * A game of Sia on this device, over the engine in WebAssembly, with typed
 * JSON. The engine decides what is legal; errors are thrown and change
 * nothing.
 */
export class SiaGame {
  private constructor(readonly wasm: Game) {}

  static create(seed: bigint = randomSeed()): SiaGame {
    return new SiaGame(new Game(seed));
  }

  /** A game from a saved `State`; throws if the engine could not have reached it. */
  static fromState(state: State | string): SiaGame {
    return new SiaGame(Game.fromState(typeof state === "string" ? state : JSON.stringify(state)));
  }

  openingEvents(): Event[] {
    return JSON.parse(this.wasm.openingEvents()) as Event[];
  }

  state(): State {
    return JSON.parse(this.wasm.state()) as State;
  }

  view(): View {
    return JSON.parse(this.wasm.view()) as View;
  }

  legalCommands(): Command[] {
    return JSON.parse(this.wasm.legalCommands()) as Command[];
  }

  command(command: Command): Transition {
    return JSON.parse(this.wasm.command(JSON.stringify(command))) as Transition;
  }

  canUndo(): boolean {
    return this.wasm.canUndo();
  }

  undo(): View {
    return JSON.parse(this.wasm.undo()) as View;
  }

  free(): void {
    this.wasm.free();
  }
}

/** A bot of `sia-bots` in WebAssembly, built from its spec (`"greedy"`, `"pimc"`). */
export class SiaBot {
  private readonly bot: Bot;

  /** Throws on a spec the bots do not read. */
  constructor(spec: string) {
    this.bot = new Bot(spec);
  }

  /** The command to play on `game`; the same `seed` gives the same command. Throws if the game is over. */
  choose(game: SiaGame, seed: number): Command {
    return JSON.parse(this.bot.choose(game.wasm, seed >>> 0)) as Command;
  }

  free(): void {
    this.bot.free();
  }
}
