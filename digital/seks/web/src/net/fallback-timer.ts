import type { LiveStatus } from "./live-session";

/** How long without a connection before the interface offers play by correspondence. */
export const FALLBACK_AFTER_MS = 20_000;

/**
 * Tells when the live connection has been missing long enough to offer play by
 * correspondence (`dev/rfc/rede-sem-servidor.md`): the clock starts when the
 * status leaves `connected` (or at the start, while still `connecting`) and
 * stops when it is back.
 */
export class FallbackTimer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private offered = false;
  private ended = false;

  /**
   * `onChange` gets `true` when the wait ran out and `false` when the connection is back.
   * `status` is where the connection stands now, and so when the wait begins.
   */
  constructor(
    private readonly onChange: (offered: boolean) => void,
    status: LiveStatus = "connecting",
    private readonly afterMs: number = FALLBACK_AFTER_MS,
  ) {
    this.update(status);
  }

  /** Whether the wait has run out and not been cleared by a connection. */
  get isOffered(): boolean {
    return this.offered;
  }

  /** The status of the connection changed. */
  update(status: LiveStatus): void {
    if (this.ended) return;
    if (status === "connected") {
      this.clear();
      if (this.offered) {
        this.offered = false;
        this.onChange(false);
      }
      return;
    }
    if (this.timer !== null || this.offered) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.offered = true;
      this.onChange(true);
    }, this.afterMs);
  }

  /** Stops the clock for good. */
  dispose(): void {
    this.ended = true;
    this.clear();
  }

  private clear(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
