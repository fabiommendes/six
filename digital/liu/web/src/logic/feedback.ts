import type { Command, Event, PlayerView, Pos, Score, View } from "../engine/game";
import type { Line } from "@wire/Line";

/** What the screen tells about a change: pure functions over views and events, kept apart from the drawing. */

const lineKey = (line: Line) => `${line.kind}:${line.index}`;

/** The rows and columns that `after` completes and `before` did not. */
export function newLines(before: Score, after: Score): Line[] {
  const had = new Set(before.lines.map((l) => lineKey(l.line)));
  return after.lines.filter((l) => !had.has(lineKey(l.line))).map((l) => l.line);
}

/** The cells of a line of a window, in order. */
export function lineCells(player: PlayerView, line: Line): Pos[] {
  const cells = player.window
    .filter((d) => (line.kind === "row" ? d.at.row === line.index : d.at.col === line.index))
    .map((d) => d.at);
  return cells.sort((a, b) => (line.kind === "row" ? a.col - b.col : a.row - b.row));
}

/** How many dice of the market show the seal number of each player. */
export function sealCounts(view: Pick<View, "players" | "market">): number[] {
  return view.players.map((p) => view.market.filter((v) => v === p.seal).length);
}

/** The seat whose seal number a die of `value` shows, or null. */
export function sealOwner(view: Pick<View, "players">, value: number): number | null {
  const i = view.players.findIndex((p) => p.seal === value);
  return i < 0 ? null : i;
}

/** For each die of the market, whether it fits the window of the player to move. */
export function marketFits(view: View): boolean[] {
  return view.market.map((value) => (view.targets[value - 1] ?? []).length > 0);
}

/** The market die a command takes, if it takes one. */
export function takenDie(command: Command): number | null {
  return command.kind === "placeFromMarket" || command.kind === "placeFromHand" || command.kind === "keep" ? command.die : null;
}

/** The player an event is about, if any. */
export function eventPlayer(event: Event): number | null {
  return "player" in event ? event.player : null;
}

/** The points a player made with a change: positive, zero, or negative when the best code changes. */
export function pointsGained(before: View, after: View, player: number): number {
  return (after.players[player]?.score.points ?? 0) - (before.players[player]?.score.points ?? 0);
}
