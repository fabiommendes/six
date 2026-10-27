import type { BotLevel, BotLevelId } from "./protocol";

/**
 * The levels of the start screen, as specs of the bots of `sia-bots` with
 * the default weights.
 *
 * - Easy: the greedy bot choosing among the commands up to 1 point below
 *   the best, so it often plays a worse command.
 * - Medium: the greedy bot, one command of lookahead.
 * - Hard: the Monte Carlo bot with its default budget.
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
