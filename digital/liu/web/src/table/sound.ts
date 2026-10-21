/**
 * The sounds of the table, made on the fly with Web Audio: a die that lands,
 * dice that roll, a soft chime for a complete line and for the turn. Nothing
 * plays until the player has touched the page, as browsers require.
 */
export type SoundKind = "land" | "roll" | "line" | "turn" | "pick";

const KEY = "liu.som";

export class Sounds {
  private context: AudioContext | null = null;
  private on: boolean;

  constructor() {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      // No storage: sound on.
    }
    this.on = stored !== "off";
  }

  get enabled(): boolean {
    return this.on;
  }

  set enabled(on: boolean) {
    this.on = on;
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      // Nothing to do.
    }
  }

  /** Starts the audio after a gesture of the player. */
  unlock(): void {
    if (!this.on) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") void this.context.resume();
    } catch {
      this.context = null;
    }
  }

  play(kind: SoundKind, strength = 1): void {
    const ctx = this.context;
    if (!this.on || !ctx || ctx.state !== "running") return;
    switch (kind) {
      case "land":
        this.knock(ctx, 0, 0.5 * strength, 900 + Math.random() * 500);
        break;
      case "pick":
        this.knock(ctx, 0, 0.18, 2400);
        break;
      case "roll":
        for (let i = 0; i < 7; i++) this.knock(ctx, i * (0.04 + Math.random() * 0.05), 0.25 + Math.random() * 0.2, 800 + Math.random() * 900);
        break;
      case "line":
        this.tone(ctx, 0, 659, 0.12);
        this.tone(ctx, 0.09, 988, 0.12);
        break;
      case "turn":
        this.tone(ctx, 0, 523, 0.07);
        break;
    }
  }

  /** A short knock of wood: filtered noise with a quick decay. */
  private knock(ctx: AudioContext, delay: number, gain: number, frequency: number): void {
    const length = Math.floor(ctx.sampleRate * 0.06);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 1.4;
    const volume = ctx.createGain();
    volume.gain.value = gain;
    source.connect(filter).connect(volume).connect(ctx.destination);
    source.start(ctx.currentTime + delay);
  }

  private tone(ctx: AudioContext, delay: number, frequency: number, gain: number): void {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const volume = ctx.createGain();
    const t = ctx.currentTime + delay;
    volume.gain.setValueAtTime(0, t);
    volume.gain.linearRampToValueAtTime(gain, t + 0.01);
    volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(volume).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }
}
