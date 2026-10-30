import type { Move } from "../engine/game";

/** The ids of the bots offered on the start screen. */
export type BotLevelId = "greedy" | "lookahead" | "search";

/** A bot of `conexao-bots` and the name shown to the player. */
export interface BotLevel {
  readonly id: BotLevelId;
  /** The name shown to the player. */
  readonly label: string;
  /** A line about how it plays, for the start screen. */
  readonly detail: string;
  /** The name read by `conexao_bots::by_name`. */
  readonly spec: string;
}

/** What the page sends to the bot Worker: the game to play on, as `ConexaoGame.state()` JSON, and the bot. */
export interface BotRequest {
  readonly id: number;
  readonly state: string;
  readonly spec: string;
}

/** What the Worker answers: the move the bot plays, or why it could not. */
export type BotResponse =
  | { readonly id: number; readonly move: Move }
  | { readonly id: number; readonly error: string };
