import type { Die, EndReason, Event, SideView, View } from "../engine/game";
import { formationText, FORMATION_NAMES, rankText, SIDE_SIZE, sideText, stoneLetter } from "./formation";
import { rerollPreview, type Selection } from "./selection";
import { SUIT_NAMES } from "../ui/svg";

/**
 * Every text the player reads, in Portuguese. The terms are those of
 * `regras/sia/GLOSSARY.md`; the words of its "Não usar" lines never appear.
 */

export const DEFAULT_NAMES = ["Jogador 1", "Jogador 2"] as const;

/** The default name of a bot at seat `i` (from 0). */
export function botName(i: number): string {
  return `Bot ${i + 1}`;
}

export const ACTIONS = {
  reroll: "Rolar de novo",
  confirmReroll: "Rolar",
  cancel: "Cancelar",
  pass: "Passar",
  undo: "Desfazer",
  newGame: "Nova partida",
  start: "Começar",
  resume: "Continuar a partida",
} as const;

export const TOOLS = {
  recenter: "Centralizar a mesa",
  closer: "Aproximar",
  farther: "Afastar",
  soundOn: "Som ligado",
  soundOff: "Som desligado",
  history: "Histórico",
  formations: "Formações",
  rules: "Regras",
  leave: "Sair",
  confirmLeave: "Sair e abandonar a partida?",
  stay: "Continuar jogando",
  seeTable: "Ver a mesa",
  results: "Resultado",
} as const;

/** "um 3 vermelho": a die in a sentence. */
export function dieText(die: Die): string {
  return `${die.value} ${SUIT_NAMES[die.suit] === "dos marcos" ? "" : SUIT_NAMES[die.suit]}`.trim();
}

const stone = (index: number, number?: number) => (number === undefined ? `marco ${stoneLetter(index)}` : `marco ${stoneLetter(index)} (${number})`);

const dice = (list: readonly Die[]) => list.map((d) => d.value).join(" ");

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function endText(reason: EndReason, names: readonly string[]): string {
  switch (reason.kind) {
    case "stones":
      return `${names[reason.player]} tomou o quinto marco.`;
    case "neighbors":
      return `${names[reason.player]} tomou 3 marcos vizinhos.`;
    case "noRoom":
      return "Ninguém tem lugar para pôr dado: os marcos que sobraram foram decididos pelas formações.";
  }
}

/**
 * One line of the log for an event, or null for events not worth a line.
 * `view` is the view after the events, for the number of a stone.
 */
export function eventText(event: Event, names: readonly string[], view?: Pick<View, "stones">): string | null {
  const name = (i: number) => names[i] ?? "";
  const number = (index: number) => view?.stones[index]?.number;
  switch (event.kind) {
    case "stonesRolled":
      return `Os marcos foram rolados: ${event.stones.join(" ")}.`;
    case "drawn":
      return event.dice.length === 0 ? null : `${name(event.player)} tirou da bolsa: ${dice(event.dice)}.`;
    case "turnStarted":
      return null;
    case "rerolled": {
      const own = event.target === event.player;
      const changes = event.rolled.map((r) => `${r.from.value} virou ${r.to.value}`).join(", ");
      return `${name(event.player)} perdeu para sempre o ${dieText(event.lost)} e rolou de novo ${plural(event.rolled.length, "dado", "dados")} ${own ? "da própria mão" : `da mão de ${name(event.target)}`}: ${changes}.`;
    }
    case "claimed": {
      const how = event.proven ? " Nada que o adversário ainda complete vence." : "";
      return `${name(event.player)} reivindicou o ${stone(event.stone, number(event.stone))} com ${formationText(event.formation).toLowerCase()}.${how}`;
    }
    case "placed":
      return `${name(event.player)} pôs o ${event.die.value} no ${stone(event.stone)}${event.completes ? ", completando o lado" : ""}.`;
    case "passed":
      return `${name(event.player)} passou: nenhum marco tem lugar para um dado dele.`;
    case "awarded":
      return event.player === null ? `O ${stone(event.stone)} ficou sem dono.` : `O ${stone(event.stone)} ficou com ${name(event.player)}.`;
    case "gameEnded":
      return `Fim do jogo. ${endText(event.reason, names)}`;
  }
}

/** A short line about an event for the prompt while it plays on the table. */
export function happeningText(event: Event, names: readonly string[], view?: Pick<View, "stones">): string | null {
  if (event.kind === "drawn") return event.dice.length === 0 ? null : `${names[event.player]} tira ${plural(event.dice.length, "dado", "dados")} da bolsa.`;
  if (event.kind === "stonesRolled") return "Os marcos são rolados.";
  return eventText(event, names, view);
}

/** The sentence of a reroll being built: what is missing, then what it costs. */
function rerollHint(view: View, selection: Selection, names: readonly string[]): string {
  const preview = rerollPreview(view, selection);
  if (!preview) return "";
  const me = view.toMove;
  if (preview.lost === null) return "Rolar de novo custa um dado seu, perdido para sempre. Toque no dado da sua mão que você perde.";
  const cost = `Você perde o ${dieText(preview.lost)} para sempre: sua mão fica limitada a ${preview.handLimit} dados.`;
  if (preview.target === null) return `${cost} Agora toque nos dados que serão rolados, na sua mão ou na de ${names[1 - me]}.`;
  const whose = preview.target === me ? "da sua mão" : `da mão de ${names[preview.target]}`;
  if (preview.rolled.length === 0) return `${cost} Toque nos dados ${whose} que serão rolados.`;
  return `${cost} Rola ${plural(preview.rolled.length, "dado", "dados")} ${whose} (${dice(preview.rolled)}).`;
}

/** What the player to move can do now, given what is selected; for a bot, that it is thinking. */
export function hint(view: View, selection: Selection, names: readonly string[], bot = false): string {
  if (view.end !== null) return endText(view.end, names);
  if (bot) return `${names[view.toMove]} está pensando…`;
  if (selection.kind === "reroll") return rerollHint(view, selection, names);
  const claims = view.claimable.flatMap((can, i) => (can ? [stoneLetter(i)] : []));
  if (selection.kind === "die") {
    const die = view.players[view.toMove]!.hand[selection.die];
    return `Escolha o marco onde pôr o ${die ? dieText(die) : "dado"}: o seu lado tem de ter menos de 3 dados.`;
  }
  const parts: string[] = [];
  if (claims.length > 0) parts.push(claims.length === 1 ? `Você pode reivindicar o marco ${claims[0]}: toque nele.` : `Você pode reivindicar os marcos ${claims.join(", ")}: toque neles.`);
  if (view.canPass) parts.push("Nenhum marco tem lugar para um dado seu: passe a vez.");
  else parts.push(view.step === "reroll" && view.canReroll ? "Escolha um dado da sua mão para pôr, ou role de novo." : "Escolha um dado da sua mão para pôr.");
  return parts.join(" ");
}

/** The big line of the dock: whose turn it is, said to that player when a person plays. */
export function turnTitle(view: View, names: readonly string[], bot: boolean, people: number): string {
  if (view.end !== null) return "Fim do jogo";
  const name = names[view.toMove] ?? "";
  if (bot) return `Vez de ${name}`;
  return people > 1 ? `Sua vez, ${name}` : "Sua vez";
}

export function winnersText(winners: readonly number[], names: readonly string[]): string {
  if (winners.length === 1) return `${names[winners[0]!]} venceu!`;
  return "Empate: os dois têm o mesmo número de marcos.";
}

/** "3 marcos" */
export function stonesCount(n: number): string {
  return plural(n, "marco", "marcos");
}

/** "mão 6 de 7": the dice in a hand and how many the rules still allow. */
export function handText(hand: number, handSize: number, lost: number): string {
  const limit = handSize - lost;
  return lost === 0 ? `${hand} dados` : `${hand} de ${limit} dados (${plural(lost, "perdido", "perdidos")})`;
}

/** The claim tag over a stone the player to move may take. */
export function claimTag(view: View, stoneIndex: number): string {
  const side = view.stones[stoneIndex]?.sides[view.toMove];
  return side?.formation ? `Reivindicar · ${formationText(side.formation)}` : "Reivindicar";
}

/** The three lines of a side on the card of a stone. */
export interface SideLines {
  /** The formation, or what is missing. */
  readonly title: string;
  /** Its place in the order, or what the side can still become. */
  readonly note: string;
  /** The sum that breaks a tie, said as such; empty for a side not complete. */
  readonly tiebreak: string;
}

/** Reads a side for the cards: the formation with its place in the order and the sum as the tiebreak, or what is missing. */
export function sideLines(side: Pick<SideView, "dice" | "formation" | "potential">): SideLines {
  if (side.formation) {
    return { title: FORMATION_NAMES[side.formation.kind], note: rankText(side.formation.kind), tiebreak: `desempate: soma ${side.formation.sum}` };
  }
  const missing = SIDE_SIZE - side.dice.length;
  const left = missing === 1 ? "falta 1 dado" : `faltam ${missing} dados`;
  if (side.dice.length === 0) return { title: "Vazio", note: left, tiebreak: "" };
  return { title: left[0]!.toUpperCase() + left.slice(1), note: `pode chegar a ${FORMATION_NAMES[side.potential.kind].toLowerCase()}`, tiebreak: "" };
}

export { sideText };
