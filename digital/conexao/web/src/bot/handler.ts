import { ConexaoBot, ConexaoGame } from "../engine/game";
import type { BotRequest, BotResponse } from "./protocol";

/**
 * Answers one request: rebuilds the game from its state, as the Worker
 * does, and plays. It never throws; a failure becomes an `error` answer.
 */
export function handleBotRequest(request: BotRequest, random: () => number = Math.random): BotResponse {
  let game: ConexaoGame | null = null;
  let bot: ConexaoBot | null = null;
  try {
    game = ConexaoGame.fromState(request.state);
    bot = new ConexaoBot(request.spec, Math.floor(random() * 2 ** 32));
    return { id: request.id, move: bot.choose(game) };
  } catch (error) {
    return { id: request.id, error: error instanceof Error ? error.message : String(error) };
  } finally {
    bot?.free();
    game?.free();
  }
}
