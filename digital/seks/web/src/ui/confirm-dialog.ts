import { BUTTONS, MAIL } from "../logic/texts";
import { need } from "./dom";

/** What the confirmation under the panel asks. */
export type Question = "resign" | "leave";

/** The confirmation under the panel ("Desistir" and "Sair da partida"): its markup and state. */
export class ConfirmDialog {
  static readonly html = `
      <div class="ask" role="alertdialog" aria-live="polite" hidden>
        <p class="ask-text"></p>
        <div class="ask-buttons"></div>
      </div>`;

  private asking: Question | null = null;

  constructor(private readonly host: HTMLElement) {}

  get question(): Question | null {
    return this.asking;
  }

  /** Opens the confirmation for `question`, or closes it with `null`. */
  set(question: Question | null): void {
    this.asking = question;
  }

  /** `canFinishWithBots`: whether "Sair da partida" offers "Terminar com bots". */
  render(canFinishWithBots: boolean): void {
    const ask = need(this.host, ".ask");
    ask.hidden = this.asking === null;
    if (this.asking === "leave") {
      need(this.host, ".ask-text").textContent = MAIL.leaveAsk;
      need(this.host, ".ask-buttons").innerHTML =
        `<button type="button" data-action="new">${BUTTONS.backToStart}</button>` +
        (canFinishWithBots ? `<button type="button" data-action="finish-with-bots">${BUTTONS.finishWithBots}</button>` : "") +
        `<button type="button" data-action="cancel">${BUTTONS.cancel}</button>`;
    }
    if (this.asking === "resign") {
      need(this.host, ".ask-text").textContent = MAIL.resignAsk;
      need(this.host, ".ask-buttons").innerHTML = `<button type="button" data-action="confirm-resign">${MAIL.resignConfirm}</button><button type="button" data-action="cancel">${BUTTONS.cancel}</button>`;
    }
  }
}
