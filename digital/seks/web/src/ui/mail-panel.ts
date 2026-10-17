import { BOT_LEVELS, DEFAULT_BOT_LEVEL } from "../bot/levels";
import type { BotLevelId } from "../bot/protocol";
import { MAIL } from "../logic/texts";
import { need } from "./dom";

/** What the panel of a game by correspondence asks of the screen around it. */
export interface MailPanelHooks {
  /** The URL to send now. */
  link(): string;
  /** Whether the player resigned: the link then tells it and sending it locks nothing. */
  resigned(): boolean;
  /** The link was copied or shared (and the player had not resigned): the opponent has the plies. */
  onSent(): void;
  /** The link copied or shared tells that the player resigned: it reached the one who sends it. */
  onResignSent(): void;
  /** The opponent left and the player goes on against the bot. */
  onContinue(level: BotLevelId): void;
  /** The opponent left and the player ends the game. */
  onEnd(): void;
}

/** What `MailPanel.render` shows. */
export interface MailPanelState {
  /** The link to send is shown. */
  readonly showLink: boolean;
  /** The opponent left and the player chooses what to do. */
  readonly showLeft: boolean;
  /** The game is over (nothing to continue against the bot). */
  readonly over: boolean;
  /** A notice above the link (a link older than the game kept here). */
  readonly notice: string | undefined;
}

/** The part of the panel for play by correspondence: the link, copy and share, the notice and the choice after the opponent left. */
export class MailPanel {
  static readonly html = `
      <p class="notice" hidden></p>
      <div class="mail" hidden>
        <input class="mail-link" type="text" readonly aria-label="${MAIL.linkLabel}">
        <div class="mail-buttons">
          <button type="button" data-action="copy">${MAIL.copy}</button>
          <button type="button" data-action="share" hidden>${MAIL.share}</button>
        </div>
        <p class="mail-status" aria-live="polite"></p>
      </div>
      <div class="left" hidden>
        <label class="left-level">${MAIL.levelLabel} <select>${BOT_LEVELS.map((level) => `<option value="${level.id}"${level.id === DEFAULT_BOT_LEVEL.id ? " selected" : ""}>${level.label}</option>`).join("")}</select></label>
        <div class="left-buttons">
          <button type="button" data-action="continue">${MAIL.continueWithBot}</button>
          <button type="button" data-action="end">${MAIL.end}</button>
        </div>
      </div>`;

  private linkShown = "";

  constructor(
    private readonly host: HTMLElement,
    private readonly hooks: MailPanelHooks,
  ) {}

  /** Runs the action if it is one of this panel; `false` otherwise. */
  handle(action: string | undefined): boolean {
    if (action === "copy") void this.copyLink();
    else if (action === "share") void this.shareLink();
    else if (action === "continue") this.hooks.onContinue(this.chosenLevel());
    else if (action === "end") this.hooks.onEnd();
    else return false;
    return true;
  }

  render(state: MailPanelState): void {
    const host = this.host;
    need(host, ".mail").hidden = !state.showLink;
    if (state.showLink) {
      const link = this.hooks.link();
      if (link !== this.linkShown) {
        this.linkShown = link;
        need<HTMLInputElement>(host, ".mail-link").value = link;
        this.setStatus("");
      }
      need(host, '[data-action="share"]').hidden = typeof navigator.share !== "function";
    }
    const notice = need(host, ".notice");
    notice.hidden = !state.notice;
    notice.textContent = state.notice ?? "";
    need(host, ".left").hidden = !state.showLeft;
    need(host, '[data-action="continue"]').hidden = state.over;
    need(host, ".left-level").hidden = state.over;
  }

  private chosenLevel(): BotLevelId {
    const value = need<HTMLSelectElement>(this.host, ".left-level select").value;
    return (BOT_LEVELS.find((level) => level.id === value) ?? DEFAULT_BOT_LEVEL).id;
  }

  private setStatus(text: string): void {
    need(this.host, ".mail-status").textContent = text;
  }

  private async copyLink(): Promise<void> {
    const input = need<HTMLInputElement>(this.host, ".mail-link");
    let copied = false;
    try {
      await navigator.clipboard.writeText(this.hooks.link());
      copied = true;
    } catch {
      input.select();
      copied = document.execCommand?.("copy") ?? false;
    }
    if (!copied) {
      input.select();
      this.setStatus(MAIL.copyFailed);
      return;
    }
    this.setStatus(MAIL.copied);
    this.sent();
  }

  private async shareLink(): Promise<void> {
    const resigned = this.hooks.resigned();
    try {
      await navigator.share({ title: MAIL.shareTitle, text: resigned ? MAIL.shareLeftText : MAIL.shareText, url: this.hooks.link() });
    } catch {
      // The player closed the sheet: nothing was sent.
      return;
    }
    this.setStatus(MAIL.sharedDone);
    this.sent();
  }

  private sent(): void {
    if (this.hooks.resigned()) this.hooks.onResignSent();
    else this.hooks.onSent();
  }
}
