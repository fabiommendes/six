import type { BotLevel, BotLevelId } from "./protocol";

/**
 * The bots of the start screen, from `conexao-bots`.
 *
 * - Greedy: the move that best shortens its path against the other's, one
 *   move ahead.
 * - Lookahead: the greedy reply of the other player to its 8 best moves.
 * - Search: alpha-beta, 3 moves deep over the 8 best moves; it takes a few
 *   seconds per move.
 */
export const BOT_LEVELS: readonly BotLevel[] = [
  { id: "greedy", label: "Guloso", detail: "olha um lance à frente", spec: "greedy" },
  { id: "lookahead", label: "Dois lances", detail: "olha a resposta do adversário", spec: "lookahead" },
  { id: "search", label: "Busca", detail: "três lances; pensa alguns segundos", spec: "search" },
];

export function botLevel(id: BotLevelId): BotLevel {
  return BOT_LEVELS.find((level) => level.id === id)!;
}

export function isBotLevelId(value: unknown): value is BotLevelId {
  return BOT_LEVELS.some((level) => level.id === value);
}
