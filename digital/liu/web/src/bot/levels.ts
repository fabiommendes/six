import type { BotLevel, BotLevelId } from "./protocol";

/**
 * The levels of the start screen, as specs of the bots of `liu-bots` with
 * the default weights. Measured in 2-player games
 * (`dev/notes/bots-do-liu.md`):
 *
 * - Easy: the greedy bot choosing among the commands up to 1 point
 *   below the best. Beats a random player (+303 Elo), loses to Medium
 *   (-246).
 * - Medium: the greedy bot, one command of lookahead.
 * - Hard: the Monte Carlo bot with its default budget, +192 Elo over
 *   Medium; about 130 ms per command in WebAssembly.
 */
export const BOT_LEVELS: readonly BotLevel[] = [
  { id: "easy", label: "Fácil", spec: "greedy:noise=1" },
  { id: "medium", label: "Médio", spec: "greedy" },
  { id: "hard", label: "Difícil", spec: "pimc" },
];

export function botLevel(id: BotLevelId): BotLevel {
  return BOT_LEVELS.find((level) => level.id === id)!;
}

export function isBotLevelId(value: unknown): value is BotLevelId {
  return BOT_LEVELS.some((level) => level.id === value);
}
