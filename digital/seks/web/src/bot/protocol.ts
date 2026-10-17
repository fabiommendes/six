import type { Command } from "../engine/game";

/** The ids of the bot levels shown on the start screen. */
export type BotLevelId = "easy" | "medium" | "hard";

/**
 * A difficulty level: the parameters that the bots of `seks-bots` expose
 * (`dev/issues/bots-do-seks.md`). The provisional bot ignores them.
 */
export interface BotLevel {
  readonly id: BotLevelId;
  /** The name shown to the player. */
  readonly label: string;
  /** Search nodes per play. */
  readonly nodes: number;
  /** Depth limit of the search, or `null` to let the nodes decide. */
  readonly depth: number | null;
  /** Noise at the root of the search, from 0 (always the best play) up. */
  readonly noise: number;
}

/** What the page sends to the bot Worker: the game to play on, as `SeksGame.stateJson()`. */
export interface BotRequest {
  readonly id: number;
  readonly state: string;
  readonly level: BotLevel;
}

/** What the Worker answers: the command the bot plays, or why it could not. */
export type BotResponse =
  | { readonly id: number; readonly command: Command }
  | { readonly id: number; readonly error: string };
