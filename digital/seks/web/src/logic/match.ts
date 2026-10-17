import type { BotPlayer } from "../bot/client";
import { BotCancelled } from "../bot/client";
import type { BotLevel } from "../bot/protocol";
import type { Cell } from "../engine/cells";
import type { Command, SeksGame, Side, Transition, View } from "../engine/game";
import type { Event } from "@wire/Event";
import { NO_MARKS, type Marks } from "./marks";
import { click, type Selection, type SelectionBoard } from "./selection";

/** Two players on the same screen. */
export interface HotseatMode {
  readonly kind: "hotseat";
}

/** One human against the bot, which plays the other side. */
export interface BotMode {
  readonly kind: "bot";
  readonly human: Side;
  readonly level: BotLevel;
}

/**
 * One human by correspondence: the other side plays elsewhere and its plays
 * arrive in a link. Only `human` plays here.
 */
export interface CorrespondenceMode {
  readonly kind: "correspondence";
  readonly human: Side;
  /** The id of the game in the link and in the saved list. */
  readonly id: string;
}

/** A mode the development server can save in the session (see `session.ts`). */
export type LocalMode = HotseatMode | BotMode;

export type Mode = LocalMode | CorrespondenceMode;

/** A die that left the board. */
export interface Captured {
  readonly side: Side;
  readonly value: number;
}

/** The last play, for the marks and the text under the board. */
export interface LastPlay {
  readonly side: Side;
  /** The cell the die left; `null` for an increment. */
  readonly from: Cell | null;
  /** Where the die went, or the cell of the incremented die. */
  readonly to: Cell;
  /** The value of the die after the play. */
  readonly value: number;
  /** How many dice the play captured. */
  readonly captures: number;
}

/**
 * What the board renderer offers to a match. The match decides what is on
 * screen; the stage draws it (Three.js in the page, a recorder in the tests).
 */
export interface Stage {
  /** Shows a position at once, without animation. */
  show(view: View, marks: Marks): void;
  /** Changes the marks only (a selection). */
  setMarks(marks: Marks): void;
  /** Plays the events of a transition and ends on `view`. */
  animate(events: readonly Event[], view: View, marks: Marks): Promise<void>;
}

/** What a match starts with besides the position (a loaded position has a history the engine does not keep). */
export interface Seed {
  readonly last?: LastPlay | null;
  readonly captured?: readonly Captured[];
}

/** Everything the screen shows of a match. */
export interface MatchSnapshot {
  readonly mode: Mode;
  readonly view: View;
  readonly selection: Selection | null;
  readonly last: LastPlay | null;
  readonly captured: readonly Captured[];
  /** The bot is thinking. */
  readonly thinking: boolean;
  /** A play is being animated: the board takes no input. */
  readonly busy: boolean;
  readonly canUndo: boolean;
  /** Whether the next play is the human's (always, in hotseat) and the game is on. */
  readonly humanToMove: boolean;
  readonly error: string | null;
}

interface HistoryEntry {
  readonly command: Command;
  readonly side: Side;
  readonly last: LastPlay;
  readonly captured: readonly Captured[];
}

/** The last play and the dice taken, from the events of a transition. */
function summarize(events: readonly Event[]): { last: LastPlay; captured: Captured[] } {
  let last: LastPlay | null = null;
  const captured: Captured[] = [];
  for (const event of events) {
    if (event.type === "moved") last = { side: event.side, from: event.from, to: event.to, value: event.value, captures: 0 };
    else if (event.type === "incremented") last = { side: event.side, from: null, to: event.at, value: event.value, captures: 0 };
    else if (event.type === "captured") captured.push({ side: event.side, value: event.value });
  }
  if (last === null) throw new Error("a play without a move or an increment");
  return { last: { ...last, captures: captured.length }, captured };
}

/**
 * A match on the screen: the game, the selection, the history of plays, the
 * bot and the undo. It never decides what is legal: destinations and
 * increments come from the engine through the `Game`.
 */
export class Match {
  private readonly history: HistoryEntry[] = [];
  private selection: Selection | null = null;
  private inFlight: HistoryEntry | null = null;
  private thinking = false;
  private busy = false;
  private error: string | null = null;
  /** Bumped to drop a bot answer that is no longer wanted (undo, new game). */
  private epoch = 0;
  private disposed = false;
  /** The plies up to here cannot be undone (the opponent has them). */
  private floor = 0;
  private readonly listeners = new Set<(snapshot: MatchSnapshot) => void>();
  /** The position the match started from, to save it. */
  private readonly base: string;

  constructor(
    private readonly game: SeksGame,
    readonly mode: Mode,
    private readonly stage: Stage,
    private readonly bot: BotPlayer | null = null,
    private readonly seed: Seed = {},
  ) {
    this.base = game.stateJson();
  }

  /**
   * What it takes to open the same match again: the position it started
   * from and the commands played since (the ones taken back are gone). The
   * game keeps its own undo history, so replaying the commands rebuilds it.
   */
  record(): { base: string; commands: Command[] } {
    return { base: this.base, commands: this.history.map((entry) => entry.command) };
  }

  /**
   * Replays `commands` on the game without animation, as if they were played.
   * Call before `start()`. The first `locked` of them (all, by default, in a
   * match by correspondence) cannot be undone.
   */
  resume(commands: readonly Command[], locked?: number): void {
    for (const command of commands) this.history.push(this.entry(command, this.game.command(command)));
    if (locked !== undefined) this.floor = Math.min(locked, this.history.length);
  }

  /** Locks every play made so far: the opponent has them, so they cannot be undone. */
  lock(): void {
    if (this.disposed || this.floor === this.history.length) return;
    this.floor = this.history.length;
    this.notify();
  }

  /** Puts the position on the stage and, if the bot plays first, asks it. */
  start(): Promise<void> {
    this.stage.show(this.game.view(), this.marks());
    this.notify();
    return this.askBot();
  }

  subscribe(listener: (snapshot: MatchSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): MatchSnapshot {
    const view = this.game.view();
    const shown = this.history.filter((entry) => entry !== this.inFlight);
    return {
      mode: this.mode,
      view,
      selection: this.selection,
      last: this.lastPlay(),
      captured: [...(this.seed.captured ?? []), ...shown.flatMap((entry) => entry.captured)],
      thinking: this.thinking,
      busy: this.busy,
      canUndo: this.canUndo(),
      humanToMove: view.outcome === null && this.isHumanTurn(view),
      error: this.error,
    };
  }

  /**
   * A click or a tap on a cell, the one gesture of the game. Resolves when
   * the play it made has been animated and, against the bot, the bot has
   * answered too.
   */
  async click(cell: Cell): Promise<void> {
    if (this.disposed || this.busy || this.thinking) return;
    const view = this.game.view();
    if (view.outcome !== null || !this.isHumanTurn(view)) return;
    const result = click(this.selection, cell, this.selectionBoard(view));
    this.selection = result.selection;
    if (result.command !== null) {
      await this.play(result.command);
      return;
    }
    this.stage.setMarks(this.marks());
    this.notify();
  }

  /** Clears the selection: a click outside the cells of the board. */
  clearSelection(): void {
    if (this.disposed || this.busy || this.thinking || this.selection === null) return;
    this.selection = null;
    this.stage.setMarks(this.marks());
    this.notify();
  }

  /**
   * Takes back the last play. Against the bot it goes back to the last
   * human play, bot answers included, so the turn is the human's again.
   */
  undo(): void {
    if (this.disposed || !this.canUndo()) return;
    this.epoch++;
    this.bot?.cancel();
    this.thinking = false;
    this.error = null;
    this.selection = null;
    const human = this.mode.kind === "bot" ? this.mode.human : null;
    let view: View;
    let entry: HistoryEntry | undefined;
    do {
      entry = this.history.pop();
      view = this.game.undo();
    } while (human !== null && entry !== undefined && entry.side !== human);
    this.stage.show(view, this.marks());
    this.notify();
  }

  /** Stops the match: pending bot answers and animations end without touching anything. */
  dispose(): void {
    this.disposed = true;
    this.epoch++;
    this.bot?.cancel();
    this.listeners.clear();
  }

  private canUndo(): boolean {
    if (this.busy) return false;
    if (this.mode.kind === "correspondence") return this.history.length > this.floor;
    if (this.mode.kind === "hotseat") return this.history.length > 0;
    const human = this.mode.human;
    return this.history.some((entry) => entry.side === human);
  }

  private isHumanTurn(view: View): boolean {
    return this.mode.kind === "hotseat" || view.to_move === this.mode.human;
  }

  private lastPlay(): LastPlay | null {
    return this.history.at(-1)?.last ?? this.seed.last ?? null;
  }

  private marks(): Marks {
    const last = this.lastPlay();
    return {
      selected: this.selection?.at ?? null,
      destinations: this.selection?.moves ?? NO_MARKS.destinations,
      lastFrom: last?.from ?? null,
      lastTo: last?.to ?? null,
    };
  }

  private selectionBoard(view: View): SelectionBoard {
    const own = new Set(view.dice.filter((die) => die.side === view.to_move).map((die) => die.cell));
    return { isOwnDie: (cell) => own.has(cell), options: (cell) => this.game.options(cell) };
  }

  private async play(command: Command): Promise<void> {
    const transition = this.game.command(command);
    const entry = this.entry(command, transition);
    this.history.push(entry);
    this.inFlight = entry;
    this.selection = null;
    this.busy = true;
    this.error = null;
    this.notify();
    await this.stage.animate(transition.events, transition.view, this.marks());
    if (this.disposed) return;
    this.inFlight = null;
    this.busy = false;
    this.notify();
    await this.askBot();
  }

  private entry(command: Command, transition: Transition): HistoryEntry {
    const { last, captured } = summarize(transition.events);
    return { command, side: last.side, last, captured };
  }

  private async askBot(): Promise<void> {
    if (this.mode.kind !== "bot" || this.bot === null || this.disposed) return;
    const view = this.game.view();
    if (view.outcome !== null || view.to_move === this.mode.human) return;
    const token = ++this.epoch;
    this.thinking = true;
    this.error = null;
    this.notify();
    let command: Command;
    try {
      command = await this.bot.choose(this.game.stateJson(), this.mode.level);
    } catch (error) {
      if (token !== this.epoch || error instanceof BotCancelled) return;
      this.thinking = false;
      this.error = error instanceof Error ? error.message : String(error);
      this.notify();
      return;
    }
    if (token !== this.epoch || this.disposed) return;
    this.thinking = false;
    try {
      await this.play(command);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.notify();
    }
  }

  private notify(): void {
    if (this.listeners.size === 0) return;
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
