import { Game } from "@seks-wasm";
import type { Command } from "@wire/Command";
import type { DieOptions } from "@wire/DieOptions";
import type { Side } from "@wire/Side";
import type { State } from "@wire/State";
import type { Transition } from "@wire/Transition";
import type { View } from "@wire/View";
import type { Cell } from "./cells";

export type { Command, DieOptions, Side, State, Transition, View };

/**
 * A game of Seks: a thin typed layer over the `Game` of `seks-wasm`, which
 * parses its JSON. The rules stay in the engine; nothing here decides what is
 * legal. Errors of the engine are thrown as `Error`s.
 */
export class SeksGame {
  private constructor(private readonly game: Game) {}

  /** The initial position, the Whites to move. */
  static create(): SeksGame {
    return new SeksGame(new Game());
  }

  /** A game that continues from a `State`, with nothing to undo. */
  static fromState(state: State): SeksGame {
    return SeksGame.fromStateJson(JSON.stringify(state));
  }

  /** Same as `fromState`, from the JSON text of `stateJson()` (what a Worker receives). */
  static fromStateJson(stateJson: string): SeksGame {
    return new SeksGame(Game.fromState(stateJson));
  }

  /** A position written as the text diagram of the engine (11 lines, row 11 first). */
  static fromDiagram(diagram: string, toMove: Side): SeksGame {
    return new SeksGame(Game.fromDiagram(diagram, toMove));
  }

  /** The whole state as JSON text, to hand the game to a Worker. */
  stateJson(): string {
    return this.game.state();
  }

  state(): State {
    return JSON.parse(this.game.state()) as State;
  }

  view(): View {
    return JSON.parse(this.game.view()) as View;
  }

  /** Where the die in `cell` can move and whether it can be incremented, for the side to move. */
  options(cell: Cell): DieOptions {
    return JSON.parse(this.game.options(cell)) as DieOptions;
  }

  legalCommands(): Command[] {
    return JSON.parse(this.game.legalCommands()) as Command[];
  }

  /** Plays a command (`b2-b4` moves, `b2+` increments). Throws if it is illegal. */
  command(command: Command): Transition {
    return JSON.parse(this.game.command(command)) as Transition;
  }

  canUndo(): boolean {
    return this.game.canUndo();
  }

  /** Takes back the last play. */
  undo(): View {
    return JSON.parse(this.game.undo()) as View;
  }

  free(): void {
    this.game.free();
  }
}
