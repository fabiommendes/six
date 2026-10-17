import { SeksGame } from "../engine/game";
import { chooseCommand } from "./chooser";
import type { BotRequest, BotResponse } from "./protocol";

/**
 * Answers one request: rebuilds the game from its state, as the Worker does
 * (`Game.fromState`), and plays. It never throws; a failure becomes an
 * `error` answer.
 */
export function handleBotRequest(request: BotRequest, random?: () => number): BotResponse {
  let game: SeksGame | null = null;
  try {
    game = SeksGame.fromStateJson(request.state);
    return { id: request.id, command: chooseCommand(game, request.level, random) };
  } catch (error) {
    return { id: request.id, error: error instanceof Error ? error.message : String(error) };
  } finally {
    game?.free();
  }
}
