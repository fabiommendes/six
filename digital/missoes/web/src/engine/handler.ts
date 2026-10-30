import { LocalGame } from "./game";
import type { GameRequest, GameResponse } from "./protocol";

/**
 * The game of a Worker: answers one request on it. It never throws; a
 * failure becomes an `error` answer.
 */
export class GameHandler {
  private game: LocalGame | null = null;

  handle(request: GameRequest): GameResponse {
    try {
      switch (request.op) {
        case "start":
          this.game?.dispose();
          this.game = new LocalGame(request.setup, BigInt(request.seed));
          return { id: request.id, view: this.game.viewNow() };
        case "view":
          return { id: request.id, view: this.need().viewNow() };
        case "apply":
          return { id: request.id, step: this.need().applyNow(request.answer) };
        case "bot":
          return { id: request.id, step: this.need().playBotNow() };
      }
    } catch (error) {
      return { id: request.id, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private need(): LocalGame {
    if (!this.game) throw new Error("no game started");
    return this.game;
  }
}
