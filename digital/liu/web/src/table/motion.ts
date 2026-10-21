/** Easings and timed steps for the animations of the table. */

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Runs `step(t)` for `t` from 0 to 1 over `duration` ms, once per frame; at once when `duration` is 0. */
export function tween(duration: number, step: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    if (duration <= 0) {
      step(1);
      resolve();
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      step(t);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
