import type { MatchSnapshot } from "../logic/match";
import { BUTTONS, endCard, MAIL } from "../logic/texts";
import type { Side } from "../engine/game";
import { need } from "./dom";

/** The card over the board at the end of the game: its markup and what it shows. */
export class EndCardView {
  /** The markup, to put inside the board's wrap. */
  static readonly html = `
    <div class="end-card" role="dialog" aria-label="Fim da partida" hidden>
      <h2 class="end-title"></h2>
      <p class="end-reason"></p>
      <p class="end-extra" hidden></p>
      <div class="end-buttons">
        <button type="button" data-action="new"></button>
        <button type="button" data-action="dismiss-end">${BUTTONS.viewBoard}</button>
      </div>
    </div>`;

  /** The player closed the card to look at the board. */
  private dismissed = false;

  constructor(private readonly host: HTMLElement) {}

  /** Closes the card until the game ends again. */
  dismiss(): void {
    this.dismissed = true;
  }

  /**
   * Shows the card on the side of the board away from the last play.
   * `home` is the text of the button that leaves the game, `sendLink` whether
   * the card also asks to send the link, and `viewpoint` the side seen from the bottom.
   */
  render(snapshot: MatchSnapshot, home: string, sendLink: boolean, viewpoint: Side): void {
    const card = endCard(snapshot);
    if (card === null) this.dismissed = false;
    const element = need(this.host, ".end-card");
    // The card waits for the last play to land.
    element.hidden = card === null || this.dismissed || snapshot.busy;
    if (card === null) return;
    element.dataset.tone = card.tone;
    need(this.host, ".end-title").textContent = card.title;
    need(this.host, ".end-reason").textContent = card.reason;
    const extra = need(this.host, ".end-extra");
    extra.hidden = !sendLink;
    extra.textContent = sendLink ? MAIL.sendResult : "";
    need(this.host, '.end-card [data-action="new"]').textContent = home;
    // Seen from the bottom, a play in the upper half of the board is far from a card at the bottom.
    const row = snapshot.last === null ? 1 : Number(snapshot.last.to.slice(1));
    const fromBottom = viewpoint === "white" ? row : 12 - row;
    element.classList.toggle("top", fromBottom <= 6);
    element.classList.toggle("bottom", fromBottom > 6);
  }
}
