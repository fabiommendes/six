import { SeksGame } from "../engine/game";
import { BotRunner } from "./chooser";
import type { BotRequest, BotResponse } from "./protocol";

/**
 * Answers one request: rebuilds the game from its state, as the Worker does
 * (`Game.fromState`), and plays. It never throws; a failure becomes an
 * `error` answer. The Worker passes one `runner` for the whole game, so the
 * bot keeps its search table; without one, the bot lives for this request.
 */
export function handleBotRequest(
  request: BotRequest,
  runner?: BotRunner,
  random: () => number = Math.random,
): BotResponse {
  const own = runner ?? new BotRunner();
  let game: SeksGame | null = null;
  try {
    game = SeksGame.fromStateJson(request.state);
    const seed = Math.floor(random() * 2 ** 32);
    return { id: request.id, command: own.choose(game, request.level, seed) };
  } catch (error) {
    return { id: request.id, error: error instanceof Error ? error.message : String(error) };
  } finally {
    game?.free();
    if (runner === undefined) own.dispose();
  }
}
