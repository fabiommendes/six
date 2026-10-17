import type { Event } from "@wire/Event";
import { BotCancelled, type BotPlayer } from "../src/bot/client";
import type { BotLevel } from "../src/bot/protocol";
import type { Command, SeksGame, View } from "../src/engine/game";
import { Match, type Mode, type Seed, type Stage } from "../src/logic/match";
import type { Marks } from "../src/logic/marks";

/** A stage that records what the match asked it to draw. */
export class RecordingStage implements Stage {
  shown: { view: View; marks: Marks }[] = [];
  marks: Marks[] = [];
  animations: { events: readonly Event[]; view: View; marks: Marks }[] = [];
  /** When set, `animate` waits for it. */
  gate: Promise<void> | null = null;

  show(view: View, marks: Marks): void {
    this.shown.push({ view, marks });
  }

  setMarks(marks: Marks): void {
    this.marks.push(marks);
  }

  async animate(events: readonly Event[], view: View, marks: Marks): Promise<void> {
    this.animations.push({ events, view, marks });
    if (this.gate) await this.gate;
  }

  get lastMarks(): Marks {
    const last = this.marks.at(-1);
    if (!last) throw new Error("no marks yet");
    return last;
  }
}

/** A bot that plays what the test says, when the test says. */
export class ScriptedBot implements BotPlayer {
  requests: { state: string; level: BotLevel }[] = [];
  cancelled = 0;
  private waiting: { resolve(command: Command): void; reject(error: Error): void }[] = [];
  /** Commands to answer at once, in order; when empty, the request waits for `answer`. */
  queue: Command[] = [];

  choose(state: string, level: BotLevel): Promise<Command> {
    this.requests.push({ state, level });
    const next = this.queue.shift();
    if (next !== undefined) return Promise.resolve(next);
    return new Promise((resolve, reject) => this.waiting.push({ resolve, reject }));
  }

  answer(command: Command): void {
    const request = this.waiting.shift();
    if (!request) throw new Error("the bot was not asked");
    request.resolve(command);
  }

  fail(error: Error): void {
    this.waiting.shift()?.reject(error);
  }

  cancel(): void {
    this.cancelled++;
    for (const request of this.waiting.splice(0)) request.reject(new BotCancelled());
  }

  dispose(): void {
    this.cancel();
  }
}

export function newMatch(game: SeksGame, mode: Mode, bot: BotPlayer | null = null, seed: Seed = {}) {
  const stage = new RecordingStage();
  const match = new Match(game, mode, stage, bot, seed);
  return { match, stage, game };
}
