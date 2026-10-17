import { SeksBot, type Command, type SeksGame } from "../engine/game";
import type { BotLevel, BotLevelId } from "./protocol";

/**
 * The play of the bot: the alpha-beta bot of `seks-bots` in WASM, with the
 * search budget of the level. A runner keeps the bot (and its search table)
 * between plays, so one runner serves one game; it runs in the Worker.
 */
export class BotRunner {
  private current: { readonly id: BotLevelId; readonly bot: SeksBot } | null = null;

  /** The command for the side to move in `game`; `seed` is any integer. Throws if the game is over. */
  choose(game: SeksGame, level: BotLevel, seed: number): Command {
    if (this.current?.id !== level.id) {
      this.dispose();
      this.current = { id: level.id, bot: new SeksBot(level) };
    }
    return this.current.bot.choose(game, seed);
  }

  /** Frees the bot. The runner can still be used afterwards. */
  dispose(): void {
    this.current?.bot.free();
    this.current = null;
  }
}
