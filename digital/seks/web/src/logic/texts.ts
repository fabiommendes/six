import type { Outcome } from "@wire/Outcome";
import type { Cell } from "../engine/cells";
import type { Side, View } from "../engine/game";
import type { LastPlay, MatchSnapshot, Mode } from "./match";
import { drawStatus } from "./status";

/**
 * Every sentence the player reads, in Portuguese, with the terms of
 * `regras/seks/GLOSSARY.md` (and none of its `Não usar:` words). Code is in
 * English; this is game content.
 */

/** The side as the glossary names it, in the plural. */
export const SIDE_NAME: Record<Side, string> = { white: "Brancas", black: "Pretas" };

/** How the player activates a cell: a tap on a touch screen, a click otherwise. */
export type Gesture = "toque" | "clique";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const APP = {
  title: "Seks",
  brand: "six",
  boardLabel: "Tabuleiro do Seks",
} as const;

export const BUTTONS = {
  undo: "Desfazer",
  newGame: "Nova partida",
  tiltOn: "Vista inclinada",
  tiltOff: "Vista de cima",
  play: "Jogar",
} as const;

export const LEGEND = {
  selected: "dado selecionado",
  destination: "casa ao alcance",
  origin: "origem",
  last: "destino da última jogada",
} as const;

export const START = {
  heading: "Nova partida",
  modeLegend: "Como jogar",
  hotseat: "Dois jogadores",
  hotseatNote: "Os dois na mesma tela, um de cada vez.",
  bot: "Contra o bot",
  botNote: "Você joga contra o computador.",
  sideLegend: "Você joga com",
  sideWhite: "Brancas",
  sideWhiteNote: "jogam primeiro",
  sideBlack: "Pretas",
  sideBlackNote: "jogam em segundo",
  levelLegend: "Nível do bot",
} as const;

export const COUNTER = {
  label: "jogadas sem captura",
  limit: (max: number) => `o empate vem em ${max}`,
} as const;

export function diceCount(n: number): string {
  return `${n} ${n === 1 ? "dado" : "dados"}`;
}

export function turnTitle(side: Side): string {
  return `Vez das ${SIDE_NAME[side]}`;
}

export function modeLine(mode: Mode): string {
  if (mode.kind === "hotseat") return "Partida local · Brancas contra Pretas";
  return `Contra o bot, nível ${mode.level.label} · você joga com as ${SIDE_NAME[mode.human]}`;
}

/** The turn belongs to the bot: it is thinking, or its play is about to be asked for. */
function botsTurn(snapshot: MatchSnapshot): boolean {
  return snapshot.view.outcome === null && snapshot.mode.kind === "bot" && snapshot.view.to_move !== snapshot.mode.human;
}

/** The line under the turn title. */
export function turnSubtitle(snapshot: MatchSnapshot): string {
  if (snapshot.view.outcome !== null) return "";
  if (snapshot.thinking || botsTurn(snapshot)) return "O bot está pensando…";
  if (snapshot.mode.kind === "bot") return "Sua vez: mova ou incremente um dado.";
  return "Mova ou incremente um dado.";
}

/** The mark of each side in the list of sides: who plays it against the bot. */
export function sideTag(mode: Mode, side: Side): string {
  if (mode.kind === "hotseat") return "";
  return mode.human === side ? "você" : "bot";
}

export function lastPlayText(last: LastPlay): string {
  const who = SIDE_NAME[last.side];
  const what = last.from === null ? `${last.to} incrementado para ${last.value}` : `de ${last.from} para ${last.to}`;
  const captures = last.captures === 0 ? "" : last.captures === 1 ? ", com captura de 1 dado" : `, com captura de ${last.captures} dados`;
  return `Última jogada: ${who}, ${what}${captures}.`;
}

/** The note under the title: a bold lead and the rest of the sentence. */
export interface Hint {
  readonly strong: string;
  readonly rest: string;
}

function moveCount(n: number): string {
  return n === 1 ? "1 casa ao alcance" : `${n} casas ao alcance`;
}

export function hint(snapshot: MatchSnapshot, gesture: Gesture): Hint {
  const verb = gesture;
  const Verb = capitalize(gesture);
  if (snapshot.error !== null) {
    return { strong: "O bot não respondeu.", rest: `${snapshot.error}. Desfaça a última jogada ou comece outra partida.` };
  }
  if (snapshot.view.outcome !== null) return { strong: "", rest: "" };
  if (snapshot.thinking || botsTurn(snapshot)) {
    return { strong: "O bot está pensando.", rest: snapshot.canUndo ? "Você pode desfazer a sua última jogada enquanto espera." : "" };
  }
  const selection = snapshot.selection;
  if (selection === null) {
    const whose = snapshot.mode.kind === "bot" ? "num dos seus dados" : `num dado das ${SIDE_NAME[snapshot.view.to_move]}`;
    return { strong: "Escolha um dado.", rest: `${Verb} ${whose} para ver aonde ele vai; ${verb} nele de novo para incrementar.` };
  }
  const value = snapshot.view.dice.find((die) => die.cell === selection.at)?.value ?? 0;
  const strong = `${value} em ${selection.at} selecionado.`;
  const near = selection.moves.length;
  if (near > 0) {
    const mark = `${Verb} numa casa marcada para mover: ${moveCount(near)}.`;
    const again = selection.canIncrement
      ? `${Verb} no dado de novo para incrementar.`
      : `Um ${value} não pode ser incrementado; ${verb} nele de novo para tirar a seleção.`;
    return { strong, rest: `${mark} ${again}` };
  }
  if (selection.canIncrement) {
    return { strong, rest: `Nenhuma casa ao alcance: o dado está cercado. ${Verb} nele de novo para incrementar.` };
  }
  return { strong, rest: `Este dado não tem jogada: está cercado e um ${value} não pode ser incrementado. ${Verb} nele de novo para tirar a seleção.` };
}

/** The warning of a near draw by repetition, or `null`. */
export function repetitionWarning(snapshot: MatchSnapshot): string | null {
  const status = drawStatus(snapshot.view);
  if (!status.repetitionWarning) return null;
  return `Atenção: uma jogada possível repetiria a posição pela ${status.repetitionsForDraw}ª vez e daria empate.`;
}

/** What a screen reader hears about the board. */
export function boardLabel(snapshot: MatchSnapshot): string {
  const base = `${APP.boardLabel}: ${turnTitle(snapshot.view.to_move).toLowerCase()}`;
  const selected: Cell | undefined = snapshot.selection?.at;
  return selected === undefined ? `${base}.` : `${base}; dado em ${selected} selecionado.`;
}

/** The end of a game as the screen words it: a headline and the reason. */
export interface ResultText {
  readonly title: string;
  readonly reason: string;
  readonly winner: "white" | "black" | null;
}

export function resultText(outcome: Outcome, view: View): ResultText {
  if (outcome.kind === "win") {
    const winner = outcome.winner;
    const loser = winner === "white" ? "black" : "white";
    const title = `Vitória das ${SIDE_NAME[winner]}`;
    const reason =
      outcome.reason === "back_row"
        ? `Um dado das ${SIDE_NAME[winner]} terminou o movimento na fileira de fundo das ${SIDE_NAME[loser]}.`
        : `As ${SIDE_NAME[loser]} ficaram sem jogada.`;
    return { title, reason, winner };
  }
  const reason =
    outcome.reason === "repetition"
      ? `A mesma posição apareceu pela ${view.repetitions_for_draw}ª vez.`
      : `${view.max_plies_without_capture} jogadas seguidas sem captura, ${view.max_plies_without_capture / 2} de cada jogador.`;
  return { title: "Empate", reason, winner: null };
}
