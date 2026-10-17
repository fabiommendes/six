import type { Command, SeksGame } from "../engine/game";
import type { BotLevel } from "./protocol";

/**
 * The play of the bot. PROVISIONAL: it draws one of the legal commands and
 * ignores `level`. The real bot (`seks-bots` in WASM) replaces this function
 * and nothing else: the Worker, its protocol and the match stay as they are.
 */
export function chooseCommand(game: SeksGame, _level: BotLevel, random: () => number = Math.random): Command {
  const legal = game.legalCommands();
  const chosen = legal[Math.floor(random() * legal.length)];
  if (chosen === undefined) throw new Error("no legal command: the game is over");
  return chosen;
}
