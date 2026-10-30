/** The bots of the start screen, as names of `missoes_bots::by_name`. */
export const BOT_LEVELS = [
  { id: "random", label: "Bot fácil" },
  { id: "greedy", label: "Bot médio" },
] as const;

export type BotId = (typeof BOT_LEVELS)[number]["id"];

export const isBotId = (value: unknown): value is BotId => BOT_LEVELS.some((l) => l.id === value);

export const DEFAULT_NAMES = ["Ana", "Bia", "Caio", "Davi"] as const;

export const botName = (seat: number) => `Bot ${seat + 1}`;

/** The goals offered: the rules' 30 points, or a shorter game. */
export const GOALS = [30, 15] as const;
