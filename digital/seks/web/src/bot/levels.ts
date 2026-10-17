import type { BotLevel } from "./protocol";

/**
 * The levels of the start screen. PROVISIONAL: the numbers are placeholders
 * until the bots issue (`dev/issues/bots-do-seks.md`) and the bot in WASM
 * (R4 of `dev/issues/seks-wasm.md`) set them; the provisional bot ignores
 * all of them.
 */
export const BOT_LEVELS: readonly BotLevel[] = [
  { id: "easy", label: "Fácil", nodes: 200, depth: 2, noise: 0.3 },
  { id: "medium", label: "Médio", nodes: 3000, depth: null, noise: 0.1 },
  { id: "hard", label: "Difícil", nodes: 30000, depth: null, noise: 0 },
];

export const DEFAULT_BOT_LEVEL: BotLevel = BOT_LEVELS[1]!;
