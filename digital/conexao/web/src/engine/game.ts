import { Bot, Game } from "@conexao-wasm";
import type { Captured } from "@wire/Captured";
import type { Die } from "@wire/Die";
import type { End } from "@wire/End";
import type { Goal } from "@wire/Goal";
import type { Move } from "@wire/Move";
import type { Rules } from "@wire/Rules";
import type { State } from "@wire/State";
import type { Transition } from "@wire/Transition";
import type { View } from "@wire/View";

export type { Captured, Die, End, Goal, Move, Rules, State, Transition, View };

/** The stride of a square: a square is `row * GRID + col` on every board size. */
export const GRID = 11;
/** The highest value of a die. */
export const MAX_VALUE = 6;
/** The lowest value of a die that can be captured, when it gets as many neighbors as its value. */
export const CAPTURE_VALUE = 4;

export const rowOf = (square: number) => Math.floor(square / GRID);
export const colOf = (square: number) => square % GRID;
export const squareOf = (row: number, col: number) => row * GRID + col;

/** The squares that touch `square` by a side or a corner, on a board of `size`. */
export function neighborsOf(square: number, size: number): number[] {
  const row = rowOf(square);
  const col = colOf(square);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr;
      const c = col + dc;
      if ((dr !== 0 || dc !== 0) && r >= 0 && c >= 0 && r < size && c < size) out.push(squareOf(r, c));
    }
  }
  return out;
}

/** The dice next to the die (or the empty square) on `square`. */
export function neighborCount(view: Pick<View, "cells" | "rules">, square: number): number {
  return neighborsOf(square, view.rules.size).filter((n) => view.cells[n] != null).length;
}

/** The rules of the proposal: 11 by 11, the line, 16 dice, no capture. */
export function defaultRules(): Rules {
  return JSON.parse(Game.defaultRules()) as Rules;
}

/**
 * A game of the connection game on this device, over the engine in
 * WebAssembly, with typed JSON. The engine decides what is legal; errors are
 * thrown and change nothing.
 */
export class ConexaoGame {
  private constructor(readonly wasm: Game) {}

  /** A new game; throws on rules out of range. */
  static create(rules: Rules = defaultRules()): ConexaoGame {
    return new ConexaoGame(Game.withRules(JSON.stringify(rules)));
  }

  /** A game from a saved `State`; throws if the engine could not have reached it. */
  static fromState(state: State | string): ConexaoGame {
    return new ConexaoGame(Game.fromState(typeof state === "string" ? state : JSON.stringify(state)));
  }

  state(): State {
    return JSON.parse(this.wasm.state()) as State;
  }

  view(): View {
    return JSON.parse(this.wasm.view()) as View;
  }

  /** Plays `move`; throws if it is illegal. */
  play(move: Move): Transition {
    return JSON.parse(this.wasm.play(JSON.stringify(move))) as Transition;
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

/** A bot of `conexao-bots` in WebAssembly, built from its name (`"greedy"`, `"lookahead"`, `"search"`...). */
export class ConexaoBot {
  private readonly bot: Bot;

  /** Throws on a name the bots do not know. */
  constructor(name: string, seed: number) {
    this.bot = new Bot(name, seed >>> 0);
  }

  /** The move to play on `game`. Throws if the game is over. */
  choose(game: ConexaoGame): Move {
    return JSON.parse(this.bot.choose(game.wasm)) as Move;
  }

  free(): void {
    this.bot.free();
  }
}
