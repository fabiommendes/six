import type { BotParams, Command } from "../engine/game";

/** The ids of the bot levels shown on the start screen. */
export type BotLevelId = "easy" | "medium" | "hard";

/**
 * A difficulty level: the search budget of the bot of `seks-bots`
 * (`BotParams`) and the name shown to the player.
 */
export interface BotLevel extends BotParams {
  readonly id: BotLevelId;
  /** The name shown to the player. */
  readonly label: string;
}

/** What the page sends to the bot Worker: the game to play on, as `SeksGame.stateJson()`, and the level. */
export interface BotRequest {
  readonly id: number;
  readonly state: string;
  readonly level: BotLevel;
}

/** What the Worker answers: the command the bot plays, or why it could not. */
export type BotResponse =
  | { readonly id: number; readonly command: Command }
  | { readonly id: number; readonly error: string };
