import type { MatchSnapshot } from "./match";
import type { PreferenceStore } from "./view-preference";

/**
 * The legend explains each mark of play the first times it is on the board,
 * then leaves it out: a player who has seen a mark a few times knows it. What
 * the player has seen is kept in the local storage, across matches and
 * visits.
 */

export type LegendMark = "selected" | "destination" | "capture" | "victim" | "target" | "custody" | "origin" | "last" | "decisive";

export const LEGEND_KEY = "seks-web:legend";

/** How many times a mark is explained before the legend leaves it out. */
export const EXPLAINED_TIMES = 3;

/**
 * A mark on the board and the occasion it is there for: the same mark on a
 * new occasion (another selection, another last play) counts as another
 * time.
 */
export interface MarkOccasion {
  readonly mark: LegendMark;
  readonly occasion: string;
}

/** The marks on the board for this snapshot, in the order of the legend. */
export function marksOnBoard(snapshot: MatchSnapshot): MarkOccasion[] {
  const out: MarkOccasion[] = [];
  const last = snapshot.last;
  const lastKey = last === null ? "" : `${last.side}:${last.from ?? ""}:${last.to}`;
  const selection = snapshot.selection;
  if (selection !== null) {
    const key = `${lastKey}/${selection.at}`;
    out.push({ mark: "selected", occasion: key });
    if (selection.moves.length > 0) out.push({ mark: "destination", occasion: key });
    if (selection.captures.some((cells) => cells.length > 0)) {
      out.push({ mark: "capture", occasion: key });
      out.push({ mark: "victim", occasion: key });
    }
    if (selection.shots.length > 0) out.push({ mark: "target", occasion: key });
  }
  // A capture just made, until the player has seen the rule a few times: the last play names the cells, this says why.
  if (last !== null && last.captures > 0 && !last.shot && selection === null) out.push({ mark: "custody", occasion: lastKey });
  // The origin and the destination of the last play are explained by the line of the last play, with their icons.
  const outcome = snapshot.view.outcome;
  if (outcome !== null && outcome.kind === "win") out.push({ mark: "decisive", occasion: `${lastKey}/${outcome.reason}` });
  return out;
}

type Counts = Partial<Record<LegendMark, number>>;

function load(store: PreferenceStore | null): Counts {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(LEGEND_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    const counts: Counts = {};
    for (const [mark, n] of Object.entries(parsed)) {
      if (typeof n === "number" && Number.isFinite(n)) counts[mark as LegendMark] = n;
    }
    return counts;
  } catch {
    return {};
  }
}

/** Counts how many times each mark was on the board and says which ones the legend still explains. */
export class LegendMemory {
  private readonly counts: Counts;
  private readonly occasions = new Map<LegendMark, string>();

  constructor(private readonly store: PreferenceStore | null) {
    this.counts = load(store);
  }

  /** Records the marks on the board now and returns the ones to explain. */
  update(onBoard: readonly MarkOccasion[]): LegendMark[] {
    let changed = false;
    for (const { mark, occasion } of onBoard) {
      if (this.occasions.get(mark) === occasion) continue;
      this.occasions.set(mark, occasion);
      this.counts[mark] = (this.counts[mark] ?? 0) + 1;
      changed = true;
    }
    if (changed) this.save();
    return onBoard.map((on) => on.mark).filter((mark) => (this.counts[mark] ?? 0) <= EXPLAINED_TIMES);
  }

  private save(): void {
    try {
      this.store?.setItem(LEGEND_KEY, JSON.stringify(this.counts));
    } catch {
      // A full or blocked storage: the legend forgets when the page closes.
    }
  }
}
