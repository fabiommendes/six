import type { LiveStatus } from "../net/live-session";
import { LIVE } from "../logic/texts";
import { esc, need } from "./dom";

/** What the panel of a live match shows. */
export interface LivePanelState {
  readonly status: LiveStatus;
  /** The wait ran out: correspondence is offered. */
  readonly offered: boolean;
  /** The invite is shown below: the text says to send it. */
  readonly inviting: boolean;
  /** The game is over: the panel goes away. */
  readonly over: boolean;
  /** Why the room could not be joined, if it could not. */
  readonly error: string | null;
}

/** The part of the panel for a live match: where the connection stands and the way back to correspondence. */
export class LivePanel {
  static readonly html = `
      <div class="live" hidden>
        <p class="live-status" aria-live="polite"><span class="live-dot" aria-hidden="true"></span><span class="live-text"></span></p>
        <div class="live-fallback" hidden>
          <p class="live-fallback-text">${esc(LIVE.fallbackAsk)}</p>
          <button type="button" data-action="fallback">${esc(LIVE.fallback)}</button>
        </div>
      </div>`;

  constructor(private readonly host: HTMLElement) {}

  render(state: LivePanelState): void {
    const live = need(this.host, ".live");
    live.hidden = state.over;
    if (state.over) return;
    live.dataset.status = state.status;
    const title = state.status === "connected" ? LIVE.connected : state.status === "away" ? LIVE.away : LIVE.connecting;
    const rest = state.error !== null ? LIVE.error(state.error) : state.status === "connected" ? "" : state.status === "away" ? LIVE.awayRest : state.inviting ? LIVE.inviteNote : LIVE.connectingRest;
    need(this.host, ".live-text").innerHTML = `<b>${esc(title)}</b>${rest ? ` ${esc(rest)}` : ""}`;
    need(this.host, ".live-fallback").hidden = !state.offered;
  }
}

