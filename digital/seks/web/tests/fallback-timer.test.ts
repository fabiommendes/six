import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_AFTER_MS, FallbackTimer } from "../src/net/fallback-timer";

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

describe("the wait before offering correspondence", () => {
  it("offers it once the connection has been missing for the whole wait", () => {
    const seen: boolean[] = [];
    const timer = new FallbackTimer((offered) => seen.push(offered), "connecting", 1000);
    vi.advanceTimersByTime(999);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([true]);
    expect(timer.isOffered).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([true]);
  });

  it("never offers it to a connection that comes in time", () => {
    const seen: boolean[] = [];
    const timer = new FallbackTimer((offered) => seen.push(offered), "connecting", 1000);
    vi.advanceTimersByTime(500);
    timer.update("connected");
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([]);
    expect(timer.isOffered).toBe(false);
  });

  it("withdraws the offer when the connection is back, and starts over when it drops", () => {
    const seen: boolean[] = [];
    const timer = new FallbackTimer((offered) => seen.push(offered), "connecting", 1000);
    vi.advanceTimersByTime(1000);
    timer.update("connected");
    expect(seen).toEqual([true, false]);
    timer.update("away");
    vi.advanceTimersByTime(999);
    expect(seen).toEqual([true, false]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([true, false, true]);
  });

  it("a status that stays away keeps the first clock instead of restarting it", () => {
    const seen: boolean[] = [];
    const timer = new FallbackTimer((offered) => seen.push(offered), "connected", 1000);
    timer.update("away");
    vi.advanceTimersByTime(600);
    timer.update("connecting");
    timer.update("away");
    vi.advanceTimersByTime(400);
    expect(seen).toEqual([true]);
  });

  it("does nothing after it is disposed", () => {
    const seen: boolean[] = [];
    const timer = new FallbackTimer((offered) => seen.push(offered), "connecting", 1000);
    timer.dispose();
    vi.advanceTimersByTime(5000);
    timer.update("away");
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([]);
  });

  it("waits 20 seconds by default", () => {
    expect(FALLBACK_AFTER_MS).toBe(20_000);
  });
});
