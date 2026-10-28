import { SheshBot, SheshGame } from "../engine/game";
import type { BotRequest, BotResponse } from "./protocol";

/**
 * Answers one request: rebuilds the game from its state, as the Worker
 * does, and plays. It never throws; a failure becomes an `error` answer.
 * The bots never read the generator of the state, so the rolls to come
 * tell them nothing.
 */
export function handleBotRequest(request: BotRequest, random: () => number = Math.random): BotResponse {
  let game: SheshGame | null = null;
  let bot: SheshBot | null = null;
  try {
    game = SheshGame.fromState(request.state);
    bot = new SheshBot(request.spec, Math.floor(random() * 2 ** 32));
    return { id: request.id, command: bot.choose(game) };
  } catch (error) {
    return { id: request.id, error: error instanceof Error ? error.message : String(error) };
  } finally {
    bot?.free();
    game?.free();
  }
}
