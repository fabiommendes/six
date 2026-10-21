import { SiaBot, SiaGame } from "../engine/game";
import type { BotRequest, BotResponse } from "./protocol";

/**
 * Answers one request: rebuilds the game from its state, as the Worker
 * does, and plays. It never throws; a failure becomes an `error` answer.
 * The bot plays on reseeded copies of the state, so the dice generator in
 * the JSON tells it nothing.
 */
export function handleBotRequest(request: BotRequest, random: () => number = Math.random): BotResponse {
  let game: SiaGame | null = null;
  let bot: SiaBot | null = null;
  try {
    game = SiaGame.fromState(request.state);
    bot = new SiaBot(request.spec);
    const seed = Math.floor(random() * 2 ** 32);
    return { id: request.id, command: bot.choose(game, seed) };
  } catch (error) {
    return { id: request.id, error: error instanceof Error ? error.message : String(error) };
  } finally {
    bot?.free();
    game?.free();
  }
}
