import { describe, expect, it } from "vitest";
import { SeksGame } from "../src/engine/game";
import { EXPLAINED_TIMES, LEGEND_KEY, LegendMemory, marksOnBoard, type MarkOccasion } from "../src/logic/legend";
import { arrivalValue } from "../src/logic/marks";
import type { PreferenceStore } from "../src/logic/view-preference";
import { newMatch } from "./fakes";

class MemoryStore implements PreferenceStore {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const selected = (at: string): MarkOccasion[] => [
  { mark: "selected", occasion: at },
  { mark: "destination", occasion: at },
];

describe("the value on the rings", () => {
  it("is the number of cells the die walks, along a line or a diagonal", () => {
    expect(arrivalValue("b2", "b3")).toBe(1);
    expect(arrivalValue("b2", "b6")).toBe(4);
    expect(arrivalValue("b2", "e5")).toBe(3);
    expect(arrivalValue("f6", "a6")).toBe(5);
  });

  it("goes with each destination of the selected die", async () => {
    const { match, stage } = newMatch(SeksGame.create(), { kind: "hotseat" });
    await match.start();
    await match.click("b2");
    const marks = stage.marks.at(-1)!;
    expect(marks.arrivals).toEqual(marks.destinations.map((cell) => arrivalValue("b2", cell)));
    expect(marks.arrivals).toContain(2);
  });
});

describe("the legend", () => {
  it("lists the marks on the board, in its order", async () => {
    const { match } = newMatch(SeksGame.create(), { kind: "hotseat" });
    await match.start();
    expect(marksOnBoard(match.snapshot())).toEqual([]);
    await match.click("b2");
    expect(marksOnBoard(match.snapshot()).map((m) => m.mark)).toEqual(["selected", "destination"]);
    await match.click("b4");
    // The line of the last play explains its marks: the legend leaves them out.
    expect(marksOnBoard(match.snapshot()).map((m) => m.mark)).toEqual([]);
  });

  it(`explains a mark the first ${EXPLAINED_TIMES} times it is on the board, then leaves it out`, () => {
    const memory = new LegendMemory(new MemoryStore());
    for (let i = 0; i < EXPLAINED_TIMES; i++) expect(memory.update(selected(`c${i + 1}`))).toEqual(["selected", "destination"]);
    expect(memory.update(selected("k9"))).toEqual([]);
  });

  it("counts an occasion once, however many times the screen draws it", () => {
    const memory = new LegendMemory(new MemoryStore());
    for (let i = 0; i < 10; i++) expect(memory.update(selected("c2"))).toEqual(["selected", "destination"]);
  });

  it("remembers across matches through the store, and ignores what it cannot read", () => {
    const store = new MemoryStore();
    const first = new LegendMemory(store);
    for (let i = 0; i <= EXPLAINED_TIMES; i++) first.update(selected(`c${i + 1}`));
    expect(new LegendMemory(store).update([...selected("d4"), { mark: "target", occasion: "d4" }])).toEqual(["target"]);
    for (const value of ["", "[", "null", "7", '{"selected":"x"}']) {
      store.items.set(LEGEND_KEY, value);
      expect(new LegendMemory(store).update(selected("e5")), value).toEqual(["selected", "destination"]);
    }
  });

  it("works with no store or a blocked one", () => {
    const blocked: PreferenceStore = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("full");
      },
    };
    expect(new LegendMemory(null).update(selected("c2"))).toEqual(["selected", "destination"]);
    expect(new LegendMemory(blocked).update(selected("c2"))).toEqual(["selected", "destination"]);
  });
});
