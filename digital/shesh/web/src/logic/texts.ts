import type { EndReason, Event, Move, View } from "../engine/game";
import { destinationOf } from "./selection";
import { EXIT } from "../table/layout";

/**
 * Every text the player reads, in Portuguese. The terms are those of the RFC
 * (`dev/rfc/jogo-de-corrida.md`): reserva, pista de entrada, do meio e de
 * saída, roseta, dado binário, comer, fundir, ultrapassar, encostar.
 */

export const DEFAULT_NAMES = ["Jogador 1", "Jogador 2"] as const;

/** The default name of a bot at seat `i` (from 0). */
export function botName(i: number): string {
  return `Bot ${i + 1}`;
}

export const ACTIONS = {
  play: "Jogar",
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
  rules: "Regras",
  leave: "Sair",
  confirmLeave: "Sair e abandonar a partida?",
  stay: "Continuar jogando",
  seeTable: "Ver a mesa",
  results: "Resultado",
} as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "3 casas" */
export function squaresText(n: number): string {
  return plural(n, "casa", "casas");
}

/** "3 pontos" */
export function pointsText(n: number): string {
  return plural(n, "ponto", "pontos");
}

/** The lane of a square along the path of its player, for texts. */
export function laneText(square: number): string {
  return square < 5 ? "pista de entrada" : square <= 15 ? "pista do meio" : "pista de saída";
}

/** A square as the texts say it: "casa 7". */
const square = (n: number) => (n >= EXIT ? "a saída" : `a casa ${n}`);

export function endText(reason: EndReason, names: readonly string[], view?: Pick<View, "players">): string {
  const name = names[reason.player] ?? "";
  switch (reason.kind) {
    case "points":
      return `${name} chegou a 12 pontos.`;
    case "allHome": {
      const points = view ? ` (${pointsText(view.players[reason.player]!.points)} contra ${view.players[1 - reason.player]!.points})` : "";
      return `Todos os dados de um jogador saíram da trilha, e a partida acabou. Venceu quem tem mais pontos${points}: ${name}.`;
    }
  }
}

/** One line of the log for an event, or null for events not worth a line. */
export function eventText(event: Event, names: readonly string[], view?: Pick<View, "players">): string | null {
  const name = (i: number) => names[i] ?? "";
  switch (event.kind) {
    case "rolled":
      return `${name(event.player)} rolou os dados binários: ${event.roll}.`;
    case "entered":
      return `${name(event.player)} entrou com o dado ${event.value} na casa ${event.square}.`;
    case "moved":
      return `${name(event.player)} moveu o dado da casa ${event.from} para ${square(event.to)}.`;
    case "overtook":
      return `Ultrapassou: o dado perde 1 e fica com ${event.value}.`;
    case "fused":
      return `Fundiu na casa ${event.square}: o dado fica com ${event.value}${event.lost > 0 ? ` (o excesso de ${event.lost} se perde)` : ""}.`;
    case "traded":
      return `Troca na casa ${event.square}: o dado ${event.value} e o dado ${event.taken} do adversário voltam para as reservas.`;
    case "captured":
      return `Comeu na casa ${event.square}: o dado ${event.taken} do adversário volta para a reserva, o dado fica com ${event.value} e ${name(event.player)} ganha um dado ${event.taken} na reserva.`;
    case "touched":
      return `Encostou: o dado do adversário na casa ${event.square} perde 1 e fica com ${event.value}.`;
    case "exited":
      return `${name(event.player)} tirou um dado ${event.value} da trilha e tem ${pointsText(event.points)}.`;
    case "extraTurn":
      return `${name(event.player)} joga de novo.`;
    case "passed":
      return `${name(event.player)} passou.`;
    case "ended":
      return `Fim do jogo. ${endText(event.reason, names, view)}`;
  }
}

/** A short line about an event for the prompt while it plays on the table. */
export function happeningText(event: Event, names: readonly string[], view?: Pick<View, "players">): string | null {
  if (event.kind === "rolled") return `${names[event.player]} rola os dados binários.`;
  return eventText(event, names, view);
}

/** The word floated over the table for an event, or null for events without one. */
export function floatText(event: Event): string | null {
  switch (event.kind) {
    case "overtook":
      return "Ultrapassou −1";
    case "fused":
      return event.lost > 0 ? `Fundiu · ${event.value} (−${event.lost})` : `Fundiu · ${event.value}`;
    case "traded":
      return "Troca";
    case "captured":
      return `Comeu o ${event.taken}`;
    case "touched":
      return "Encostou −1";
    case "exited":
      return `Saiu · +${event.value}`;
    case "passed":
      return "Passou";
    default:
      return null;
  }
}

/** What a legal move does, in a few words, from the events the engine previews for it. */
export function effectsText(move: Move): string {
  const parts: string[] = [];
  for (const event of move.events) {
    switch (event.kind) {
      case "overtook":
        parts.push(`ultrapassa (fica com ${event.value})`);
        break;
      case "fused":
        parts.push(`funde (fica com ${event.value}${event.lost > 0 ? `, perde ${event.lost}` : ""})`);
        break;
      case "traded":
        parts.push(`troca (o ${event.value} e o ${event.taken} voltam para as reservas)`);
        break;
      case "captured":
        parts.push(`come o ${event.taken} (fica com ${event.value})`);
        break;
      case "touched":
        parts.push(`encosta (o dado do adversário fica com ${event.value})`);
        break;
      case "exited":
        parts.push(`sai e vale ${pointsText(event.value)}`);
        break;
    }
  }
  return parts.join(", ");
}

/** A legal move as a sentence, for the list of the dock: "Mover o 4 da casa 6 para a casa 8 · come o 2". */
export function moveText(view: View, move: Move): string {
  const me = view.players[view.toMove]!;
  const to = destinationOf(view, move);
  let head: string;
  switch (move.command.kind) {
    case "enter":
      head = `Entrar com o ${move.command.value} na casa ${to}`;
      break;
    case "move":
      head = `Mover o ${me.track[move.command.from]} da casa ${move.command.from} para ${square(to!)}`;
      break;
    case "pass":
      return "Passar";
  }
  const effects = effectsText(move);
  return effects ? `${head} · ${effects}` : head;
}

/** What the player to move can do now, given the chosen move; for a bot, that it is thinking. */
export function hint(view: View, chosen: Move | null, names: readonly string[], bot = false): string {
  if (view.end !== null) return endText(view.end, names, view);
  if (bot) return `${names[view.toMove]} está pensando…`;
  const roll = view.roll;
  if (view.moves.length === 1 && view.moves[0]!.command.kind === "pass") return `Os dados binários deram ${roll}, mas nenhum dado pode andar ${squaresText(roll)}. Passe a vez.`;
  if (chosen) return `${moveText(view, chosen)}. Toque no destino, no dado de novo ou em Jogar.`;
  const entry = view.rules.orderedEntry ? " Da reserva entra sempre o menor dado." : "";
  return `Os dados binários deram ${roll}: escolha um dado para andar ${squaresText(roll)}.${entry}`;
}

/** The big line of the dock: whose turn it is, said to that player when a person plays. */
export function turnTitle(view: View, names: readonly string[], bot: boolean, people: number): string {
  if (view.end !== null) return "Fim do jogo";
  const name = names[view.toMove] ?? "";
  if (bot) return `Vez de ${name}`;
  return people > 1 ? `Sua vez, ${name}` : "Sua vez";
}

export function winnerText(winner: number | null, names: readonly string[]): string {
  return winner === null ? "" : `${names[winner]} venceu!`;
}

/** "3 na reserva, 2 na trilha": where the dice of a player are. */
export function diceText(reserve: number, track: number): string {
  return `${reserve} na reserva, ${track} na trilha`;
}

/** The rules in a few lines, for the card on the screen. */
export const RULES_CARD: readonly { readonly title: string; readonly text: string }[] = [
  { title: "Turno", text: "Role os 4 dados binários e some: 1 a 4. Se todos derem 0, role de novo. Mova um dado seu exatamente essa quantidade de casas, ou entre com um dado da reserva na casa de mesmo número. Se puder jogar, é obrigado." },
  { title: "Entrada", text: "Da reserva entra sempre o dado de menor valor." },
  { title: "Fundir", text: "Um dado que termina numa casa com outro seu funde com ele: fica um dado só, com a soma. O que passa de 6 se perde." },
  { title: "Comer", text: "Em casa de adversário, na pista do meio: se o seu dado é menor ou igual, os dois voltam para as reservas. Se é maior, o dado dele volta, o seu fica com o valor reduzido pelo dele e você ganha na reserva um dado com o valor do comido." },
  { title: "Ultrapassar e encostar", text: "Na pista do meio, passar por cima de dados do adversário tira 1 do seu dado (uma vez por jogada). Parar logo atrás de um dado do adversário tira 1 dele. Um 1 não perde." },
  { title: "Roseta", text: "A casa vermelha do centro protege o dado de ser comido ou encostado, e o adversário não pode parar nela." },
  { title: "Saída e fim", text: "Um dado sai com o número exato que o leva à saída, e o valor dele vira pontos. Vence quem chegar a 12 pontos. Se um jogador tira da trilha todos os seus dados, a partida acaba e vence quem tem mais pontos (no empate, quem encerrou)." },
];
