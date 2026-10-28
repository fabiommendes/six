import type { Command } from "../engine/game";

/** The ids of the bot levels shown on the start screen. */
export type BotLevelId = "easy" | "medium" | "hard";

/** A difficulty level: the name of the bot of `shesh-bots` and the name shown to the player. */
export interface BotLevel {
  readonly id: BotLevelId;
  /** The name shown to the player. */
  readonly label: string;
  /** The name read by `shesh_bots::by_name`. */
  readonly spec: string;
}

/** What the page sends to the bot Worker: the game to play on, as `SheshGame.state()` JSON, and the bot. */
export interface BotRequest {
  readonly id: number;
  readonly state: string;
  readonly spec: string;
}

/** What the Worker answers: the command the bot plays, or why it could not. */
export type BotResponse =
  | { readonly id: number; readonly command: Command }
  | { readonly id: number; readonly error: string };
