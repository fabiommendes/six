import type { BotLevel, BotLevelId } from "./protocol";

/**
 * The levels of the start screen, as bots of `shesh-bots`.
 *
 * - Easy: the random bot, any legal move.
 * - Medium: the greedy bot, which looks at the position after its move.
 * - Hard: the expectimax bot, which also averages over the next roll of the
 *   other player and takes their best reply.
 */
export const BOT_LEVELS: readonly BotLevel[] = [
  { id: "easy", label: "Fácil", spec: "random" },
  { id: "medium", label: "Médio", spec: "greedy" },
  { id: "hard", label: "Difícil", spec: "expecti" },
];

export function botLevel(id: BotLevelId): BotLevel {
  return BOT_LEVELS.find((level) => level.id === id)!;
}

export function isBotLevelId(value: unknown): value is BotLevelId {
  return BOT_LEVELS.some((level) => level.id === value);
}
