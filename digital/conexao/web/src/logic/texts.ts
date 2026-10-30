import { colOf, CAPTURE_VALUE, neighborCount, rowOf, type Captured, type End, type Move, type Rules, type View } from "../engine/game";
import { fromBoard, reserveValueOf, type Selection } from "./selection";

/**
 * Every text the player reads, in Portuguese. The terms are those of the RFC
 * (`dev/rfc/jogo-de-conexao.md`): Brancas e Pretas, reserva, vizinhos,
 * limite, aumentar, colocar, aumentar e bloquear, dado bloqueante, fileiras
 * centrais, fileira de fundo, linha, captura.
 */

export const DEFAULT_NAMES = ["Jogador 1", "Jogador 2"] as const;

/** The color of each seat, as the texts say it. */
export const SIDES = ["Brancas", "Pretas"] as const;

/** The color of a die of each seat. */
const DIE_COLORS = ["branco", "preto"] as const;

/** The default name of a bot at seat `i` (from 0). */
export function botName(i: number): string {
  return `Bot ${i + 1}`;
}

export const ACTIONS = {
  increase: "Aumentar",
  cancel: "Cancelar",
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
  rules: "Regras",
  leave: "Sair",
  confirmLeave: "Sair e abandonar a partida?",
  stay: "Continuar jogando",
  seeTable: "Ver a mesa",
  results: "Resultado",
} as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "3 dados" */
export function diceCount(n: number): string {
  return plural(n, "dado", "dados");
}

/** A square as the player reads it: column letter and row number, counted from the White side ("f1"). */
export function squareName(square: number): string {
  return `${"abcdefghijk"[colOf(square)]}${rowOf(square) + 1}`;
}

/** The goal of the rules, in a few words. */
export function goalText(rules: Pick<Rules, "goal">): string {
  return rules.goal === "line" ? "uma linha de dados seus da sua fileira de fundo à do adversário" : "um dado seu na fileira de fundo do adversário";
}

/** The reserve dice of a player at the start, counted by value: [value, count] pairs, highest value first. */
export function startReserve(rules: Pick<Rules, "dice" | "placedValue" | "extra">): [number, number][] {
  const counts = [...rules.extra];
  counts[rules.placedValue] = (counts[rules.placedValue] ?? 0) + Math.max(0, rules.dice - 1 - rules.extra.reduce((a, b) => a + b, 0));
  return counts.flatMap((n, value): [number, number][] => (n > 0 ? [[value, n]] : [])).reverse();
}

/** Whether the reserve starts with dice of more than one value. */
export function variedReserve(rules: Pick<Rules, "dice" | "placedValue" | "extra">): boolean {
  return startReserve(rules).length > 1;
}

/** The starting reserve in words: "um 6, um 5, um 4, um 3 e 11 dados 1". */
export function reserveText(rules: Pick<Rules, "dice" | "placedValue" | "extra">): string {
  const parts = startReserve(rules).map(([value, n]) => (n === 1 ? `um ${value}` : `${n} dados ${value}`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : (parts[0] ?? "");
}

/** How many captured dice make a player lose with `capture`: `dice - size + 1`. */
export function captureLimit(rules: Pick<Rules, "dice" | "size">): number {
  return rules.dice - rules.size + 1;
}

/** The rule switches in one line, for the start screen and the card of the rules. */
export function rulesSummary(rules: Rules): string {
  const parts = [
    `${rules.size}x${rules.size}`,
    rules.goal === "line" ? "meta: linha" : "meta: chegar",
    `${rules.dice} dados`,
    ...(variedReserve(rules) ? [`reserva: ${reserveText(rules)}`] : []),
    rules.capture ? "com captura" : "sem captura",
    rules.blockFromBoard ? "bloqueante da reserva ou do tabuleiro" : "bloqueante só da reserva",
  ];
  return parts.join(" · ");
}

export function endText(
  end: End,
  names: readonly string[],
  rules: Pick<Rules, "goal" | "maxTurns" | "capture" | "dice" | "size">,
  captured: readonly number[] = [0, 0],
): string {
  switch (end.kind) {
    case "goal":
      return rules.goal === "line"
        ? `${names[end.winner]} ligou a sua fileira de fundo à do adversário.`
        : `${names[end.winner]} chegou à fileira de fundo do adversário.`;
    case "noMove":
      // The engine reports the loss by captures as a win without a goal, like the loss of the player with no move.
      if (rules.capture && (captured[1 - end.winner] ?? 0) >= captureLimit(rules)) {
        return `${names[1 - end.winner]} perdeu dados demais: ${diceCount(captured[1 - end.winner]!)} capturados.`;
      }
      return `${names[1 - end.winner]} ficou sem jogada e perdeu.`;
    case "turnLimit":
      return `Empate: a partida chegou ao limite de ${rules.maxTurns} turnos.`;
  }
}

export function winnerText(end: End | null, names: readonly string[]): string {
  if (end === null) return "";
  return end.kind === "turnLimit" ? "Empate" : `${names[end.winner]} venceu!`;
}

/** One line of the history for a move, from the view before it. */
export function moveText(move: Move, before: View, names: readonly string[]): string {
  const who = names[before.toMove] ?? "";
  const value = (square: number) => before.cells[square]?.value ?? 0;
  const spent = reserveValueOf(move);
  const origin = (move: Extract<Move, { kind: "place" | "block" }>) =>
    "board" in move.from ? `, tirando o dado de ${squareName(move.from.board)}` : "";
  switch (move.kind) {
    case "increase":
      return `${who} aumentou o dado de ${squareName(move.at)} para ${value(move.at) + 1}.`;
    case "place":
      return `${who} colocou ${spent === null ? "um dado" : `um dado ${spent}`} em ${squareName(move.to)}${origin(move)}.`;
    case "block":
      return `${who} aumentou o dado de ${squareName(move.raise)} para ${value(move.raise) + 1} e bloqueou em ${squareName(move.to)}${spent !== null && spent !== 1 ? `, gastando um dado ${spent} da reserva` : ""}${origin(move)}.`;
  }
}

/** One line of the history for the dice a move captured. */
export function capturedText(captured: readonly Captured[]): string | null {
  if (captured.length === 0) return null;
  const list = captured.map((c) => `${DIE_COLORS[c.die.owner] ?? ""} em ${squareName(c.at)}`).join(", ");
  return captured.length === 1 ? `Capturado: o dado ${list}.` : `Capturados: os dados ${list}.`;
}

/** The neighbors of a die against its limit: "2 de 3 vizinhos". */
export function limitText(view: View, square: number): string {
  const die = view.cells[square];
  if (!die) return "";
  const n = neighborCount(view, square);
  const room = die.value - n;
  const capture = view.rules.capture && die.value >= CAPTURE_VALUE && room === 1 ? " O próximo vizinho o captura." : "";
  return `O ${die.value} tem ${plural(n, "vizinho", "vizinhos")}: ${room > 0 ? `cabe${room === 1 ? "" : "m"} mais ${room}` : "está cheio"}.${capture}`;
}

/** What the player to move can do now, given what they have chosen. */
export function hint(view: View, selection: Selection): string {
  const reserve = fromBoard(view) ? " Sua reserva acabou: o dado colocado sai do tabuleiro." : "";
  switch (selection.kind) {
    case "none":
      return `Toque num dado para aumentá-lo, ou numa casa com anel para colocar um dado.${view.rules.blocking ? " Para bloquear, escolha o dado a aumentar e depois a casa com losango." : ""}${reserve}`;
    case "raise": {
      const block = view.moves.some((m) => m.kind === "block" && m.raise === selection.at);
      return `${limitText(view, selection.at)} Toque nele de novo para aumentar${block ? ", ou numa casa com losango para aumentar e bloquear" : ""}.`;
    }
    case "block":
      return `Bloqueante em ${squareName(selection.to)}: toque no dado que vai aumentar junto.`;
    case "value":
      return `${selection.raise === null ? "Colocar" : "Bloquear"} em ${squareName(selection.to)}: escolha o valor do dado da reserva.`;
    case "origin":
      return `${selection.raise === null ? "Colocar" : "Bloquear"} em ${squareName(selection.to)}: toque no dado seu que sai do tabuleiro.`;
  }
}

/** The big line of the dock: whose turn it is, said to that player when a person plays. */
export function turnTitle(view: View, names: readonly string[], bot: boolean, people: number): string {
  if (view.end !== null) return "Fim do jogo";
  const name = names[view.toMove] ?? "";
  if (bot) return `Vez de ${name}`;
  return people > 1 ? `Sua vez, ${name}` : "Sua vez";
}

/** The rules in a few lines, for the card on the screen. */
export function rulesCard(rules: Rules): readonly { readonly title: string; readonly text: string }[] {
  const mid = Math.floor(rules.size / 2) + 1;
  const rows = `${mid - 1}, ${mid} e ${mid + 1}`;
  const card = [
    { title: "Meta", text: `Vence quem forma ${goalText(rules)}. Quem fica sem jogada perde. Com ${rules.maxTurns} turnos, empata.` },
    { title: "Vizinhos e limite", text: "Vizinhos se tocam pelo lado ou pela quina, de qualquer cor. O valor de um dado é o máximo de vizinhos que ele aceita: nenhuma colocação pode deixar um dado acima do limite." },
    { title: "Aumentar", text: "Soma 1 a um dado qualquer, seu ou do adversário, até 6." },
    { title: "Colocar", text: `Põe um dado da reserva${variedReserve(rules) ? `, à sua escolha (${reserveText(rules)} no início),` : ` (valor ${rules.placedValue})`} numa casa vazia vizinha a um dado seu.` },
  ];
  if (rules.blocking) {
    card.push({ title: "Aumentar e bloquear", text: `Aumenta um dado qualquer e põe um dado bloqueante, com valor 1${variedReserve(rules) ? ", gastando um dado da reserva à sua escolha," : ","} numa casa vazia vizinha a um dado adversário, só nas fileiras ${rows}${rules.blockHome ? " ou no seu campo" : ""}.` });
  }
  card.push({
    title: "Reserva vazia",
    text: `O dado colocado sai do tabuleiro, qualquer dado seu, e mantém o valor (como bloqueante, vira 1).${rules.blocking && !rules.blockFromBoard ? " O bloqueante só sai da reserva: sem ela, o bloqueio acaba." : ""}`,
  });
  if (rules.capture) {
    card.push({
      title: "Captura",
      text: `Um dado ${CAPTURE_VALUE} ou mais que fica cheio, com tantos vizinhos quanto o seu valor, sai do jogo, de qualquer cor. Só colocar ou bloquear captura, e o dado colocado não é capturado. Quem tem ${captureLimit(rules)} dados capturados perde na hora.`,
    });
  }
  return card;
}
