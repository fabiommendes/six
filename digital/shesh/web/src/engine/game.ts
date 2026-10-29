import { Bot, Game } from "@shesh-wasm";
import type { Command } from "@wire/Command";
import type { EndReason } from "@wire/EndReason";
import type { Event } from "@wire/Event";
import type { Move } from "@wire/Move";
import type { PlayerView } from "@wire/PlayerView";
import type { Rules } from "@wire/Rules";
import type { State } from "@wire/State";
import type { Transition } from "@wire/Transition";
import type { View } from "@wire/View";

export type { Command, EndReason, Event, Move, PlayerView, Rules, State, Transition, View };

/** The track along the path of one player: squares 1 to 14, and 15 is off the board. */
export const EXIT = 15;
/** The squares of the middle lane, shared by both players. */
export const SHARED_FIRST = 5;
export const SHARED_LAST = 12;
/** The red square in the middle of the board. */
export const ROSETTE = 8;
/** Points that win. */
export const POINTS_TO_WIN = 10;

/** A random seed for the rolls of a new game. */
export function randomSeed(): bigint {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(words[0]!) << 32n) | BigInt(words[1]!);
}

/** Dice that add up to `points`, sixes first: stands in for the dice that left when they are not known. */
export function diceFor(points: number): number[] {
  const dice = Array.from({ length: Math.floor(points / 6) }, () => 6);
  if (points % 6 > 0) dice.push(points % 6);
  return dice;
}

/**
 * A game of Shesh on this device, over the engine in WebAssembly, with typed
 * JSON. The engine decides what is legal; errors are thrown and change
 * nothing.
 *
 * The engine keeps only the points of a player, not the dice that left the
 * track; the game keeps those, to show them beside the board, and takes them
 * back on undo.
 */
export class SheshGame {
  private readonly undoLeft: number[][][] = [];

  private constructor(
    readonly wasm: Game,
    private left: number[][],
  ) {}

  static create(seed: bigint = randomSeed()): SheshGame {
    return new SheshGame(new Game(seed), [[], []]);
  }

  /**
   * A game from a saved `State`; throws if the engine could not have reached
   * it. `left` are the dice that left the track, per player: used only if
   * they add up to the points of the state.
   */
  static fromState(state: State | string, left?: readonly (readonly number[])[]): SheshGame {
    const text = typeof state === "string" ? state : JSON.stringify(state);
    const game = Game.fromState(text);
    const points = (JSON.parse(game.state()) as State).points;
    const known = left && left.length === 2 && left.every((dice, p) => dice.every((v) => Number.isInteger(v) && v >= 1 && v <= 6) && dice.reduce((a, b) => a + b, 0) === points[p]);
    return new SheshGame(game, known ? left.map((dice) => [...dice]) : points.map(diceFor));
  }

  state(): State {
    return JSON.parse(this.wasm.state()) as State;
  }

  view(): View {
    return JSON.parse(this.wasm.view()) as View;
  }

  /** The dice that left the track, per player, in the order they left. */
  leftDice(): readonly (readonly number[])[] {
    return this.left;
  }

  legalCommands(): Command[] {
    return JSON.parse(this.wasm.legalCommands()) as Command[];
  }

  command(command: Command): Transition {
    const transition = JSON.parse(this.wasm.command(JSON.stringify(command))) as Transition;
    this.undoLeft.push(this.left);
    this.left = this.left.map((dice) => [...dice]);
    for (const event of transition.events) if (event.kind === "exited") this.left[event.player]!.push(event.value);
    return transition;
  }

  canUndo(): boolean {
    return this.wasm.canUndo();
  }

  undo(): View {
    const view = JSON.parse(this.wasm.undo()) as View;
    this.left = this.undoLeft.pop()!;
    return view;
  }

  free(): void {
    this.wasm.free();
  }
}

/** A bot of `shesh-bots` in WebAssembly, built from its name (`"random"`, `"greedy"`, `"expecti"`). */
export class SheshBot {
  private readonly bot: Bot;

  /** Throws on a name the bots do not know. */
  constructor(name: string, seed: number) {
    this.bot = new Bot(name, seed >>> 0);
  }

  /** The command to play on `game`. Throws if the game is over. */
  choose(game: SheshGame): Command {
    return JSON.parse(this.bot.choose(game.wasm)) as Command;
  }

  free(): void {
    this.bot.free();
  }
}
