import type { EndReason, Event, Score, View } from "../engine/game";
import type { Selection } from "./selection";

/**
 * Every text the player reads, in Portuguese. The terms are those of
 * `regras/liu/GLOSSARY.md`; the words of its "Não usar" lines never appear.
 */

export const DEFAULT_NAMES = ["Jogador 1", "Jogador 2", "Jogador 3", "Jogador 4"] as const;

/** The default name of a bot at seat `i` (from 0). */
export function botName(i: number): string {
  return `Bot ${i + 1}`;
}

export const ACTIONS = {
  keep: "Guardar na mão",
  reroll: "Rolar de novo",
  pass: "Passar",
  undo: "Desfazer",
  newGame: "Nova partida",
  start: "Começar",
  resume: "Continuar a partida",
} as const;

const dice = (values: readonly number[]) => values.join(" ");

/** "um 3", the way the texts mention a single die. */
const a = (value: number) => `um ${value}`;

export function endText(reason: EndReason, names: readonly string[]): string {
  switch (reason.kind) {
    case "windowComplete":
      return `${names[reason.player]} completou a janela.`;
    case "noPlacement":
      return "Uma rodada inteira passou sem que ninguém pusesse dado na janela.";
  }
}

/**
 * One line of the log for an event, or null for events not worth a line.
 * `market` is the market once the events are over: an empty one means a
 * round began with nothing to share.
 */
export function eventText(event: Event, names: readonly string[], market?: readonly number[]): string | null {
  switch (event.kind) {
    case "marketFilled":
      return event.drawn.length === 0
        ? "O mercado já estava pronto: ninguém tirou dado do saco."
        : `Saíram do saco: ${dice(event.drawn)}.`;
    case "marketRerolled":
      return `O saco acabou. O mercado foi rolado de novo ${event.rolls === 1 ? "1 vez" : `${event.rolls} vezes`} até um número de selo ter a maioria: ${dice(event.market)}.`;
    case "roundStarted":
      return market?.length === 0
        ? `Rodada ${event.round}. O saco e o mercado estão vazios: começa de novo ${names[event.first]}.`
        : `Rodada ${event.round}. Começa ${names[event.first]}, que tem a maioria no mercado.`;
    case "placed":
      return event.fromHand
        ? `${names[event.player]} pôs o ${event.value} da mão na janela.`
        : `${names[event.player]} pôs ${a(event.value)} na janela.`;
    case "kept":
      return `${names[event.player]} guardou ${a(event.value)} na mão.`;
    case "rerolled":
      return `${names[event.player]} devolveu o ${event.returned} da mão e rolou o mercado de novo: ${dice(event.market)}.`;
    case "passed":
      return `${names[event.player]} passou.`;
    case "sealBonus":
      return `Bônus do selo: ${names[event.player]} recebe ${a(event.value)} na mão.`;
    case "gameOver":
      return `Fim do jogo. ${endText(event.reason, names)}`;
  }
}

/** What the player to move can do now, given what is selected; for a bot, that it is thinking. */
export function hint(view: View, selection: Selection, names: readonly string[], bot = false): string {
  if (view.end !== null) return endText(view.end, names);
  if (bot) return `${names[view.toMove]} está pensando…`;
  const me = view.players[view.toMove]!;
  switch (selection.kind) {
    case "market": {
      const value = view.market[selection.die]!;
      const fits = (view.targets[value - 1] ?? []).length > 0;
      if (!fits) {
        return view.canKeep ? `O ${value} não cabe na sua janela. Você pode guardá-lo na mão.` : `O ${value} não cabe na sua janela.`;
      }
      return view.canKeep
        ? `Escolha uma casa marcada para o ${value}, ou guarde-o na mão.`
        : `Escolha uma casa marcada para o ${value}.`;
    }
    case "hand":
      return `Escolha uma casa marcada para o ${me.hand} da mão.`;
    case "handAt":
      return `Agora escolha o dado do mercado que vai para a mão no lugar do ${me.hand}.`;
    case "none":
      break;
  }
  if (view.rerolled) return "Você rolou o mercado de novo. Pegue um dado: ponha na janela ou guarde na mão.";
  const parts = ["Escolha um dado do mercado"];
  if (view.canPlaceFromHand) parts.push("ou o dado da sua mão");
  return `${parts.join(" ")}. Você também pode passar.`;
}

/** "12 pontos" */
export function points(n: number): string {
  return n === 1 ? "1 ponto" : `${n} pontos`;
}

/** What a score is made of, in one sentence. */
export function scoreText(score: Score): string {
  const lines = score.lines.length;
  if (lines === 0) return "Nenhuma linha ou coluna completa.";
  const runs = score.lines.filter((l) => l.run).length;
  const codes = score.lines.filter((l) => l.code).length;
  const parts = [lines === 1 ? "1 linha ou coluna completa" : `${lines} linhas e colunas completas`];
  if (runs > 0) parts.push(runs === 1 ? "1 sequência" : `${runs} sequências`);
  if (codes > 0 && score.code) parts.push(`${codes} com o código ${dice(score.code)}`);
  return `${parts.join(", ")}.`;
}

export function winnersText(winners: readonly number[], names: readonly string[]): string {
  if (winners.length === 1) return `${names[winners[0]!]} venceu!`;
  const who = winners.map((i) => names[i]!);
  return `${who.slice(0, -1).join(", ")} e ${who.at(-1)} dividem a vitória.`;
}

export const TOOLS = {
  recenter: "Centralizar a mesa",
  closer: "Aproximar",
  farther: "Afastar",
  soundOn: "Som ligado",
  soundOff: "Som desligado",
  history: "Histórico",
  rules: "Regras",
  leave: "Sair",
  confirmLeave: "Sair e abandonar a partida?",
  stay: "Continuar jogando",
  seeTable: "Ver a mesa",
  results: "Resultado",
} as const;

/** The big line of the dock: whose turn it is, said to that player when a person plays. */
export function turnTitle(view: View, names: readonly string[], bot: boolean, people: number): string {
  if (view.end !== null) return "Fim do jogo";
  const name = names[view.toMove] ?? "";
  if (bot) return `Vez de ${name}`;
  return people > 1 ? `Sua vez, ${name}` : "Sua vez";
}

/** The banner of a new round: its number and who begins it. */
export function roundBanner(round: number, first: number, seal: number, names: readonly string[], marketEmpty = false): { title: string; detail: string } {
  if (marketEmpty) return { title: `Rodada ${round}`, detail: `Saco e mercado vazios: começa de novo ${names[first]}.` };
  return { title: `Rodada ${round}`, detail: `Começa ${names[first]}: o ${seal} tem a maioria no mercado.` };
}

/** "2 no mercado", how many dice of the market show a seal number. */
export function inMarket(count: number): string {
  return count === 1 ? "1 no mercado" : `${count} no mercado`;
}

/** "9 dados" in the window. */
export function diceCount(n: number): string {
  return n === 1 ? "1 dado" : `${n} dados`;
}

/** "28 no saco" */
export function bagText(n: number): string {
  return n === 1 ? "1 dado no saco" : `${n} dados no saco`;
}
