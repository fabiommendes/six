import type { BotLevel } from "./protocol";

/**
 * The levels of the start screen, as search budgets of the bot of
 * `seks-bots` (noise in the units of its evaluation, where a die is worth
 * 100). Measured in `seks-wasm` games with fixed seeds:
 *
 * - Easy: about 70% against a bot that plays at random, and loses nearly
 *   every game to Medium.
 * - Medium: wins about 97% of the games against a random player and loses
 *   every game to the default level.
 * - Hard: the default level of the bots (`SeksBot.defaultNodes()` nodes per
 *   play, no noise), the strongest one. `nodes: null` follows the default of
 *   `seks-bots` when it changes.
 */
export const BOT_LEVELS: readonly BotLevel[] = [
  { id: "easy", label: "Fácil", nodes: 200, depth: null, noise: 100 },
  { id: "medium", label: "Médio", nodes: 2000, depth: null, noise: 30 },
  { id: "hard", label: "Difícil", nodes: null, depth: null, noise: 0 },
];

/** The level selected on the start screen. */
export const DEFAULT_BOT_LEVEL: BotLevel = BOT_LEVELS[1]!;
