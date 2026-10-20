import type { Outcome } from "@wire/Outcome";
import type { Cell } from "../engine/cells";
import type { Side, View } from "../engine/game";
import { LinkError } from "./link";
import type { LastPlay, MatchSnapshot, Mode } from "./match";
import { isResigned, mailStatus, type MailGame } from "./mail-games";
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
  home: "Voltar ao início",
  leave: "Sair da partida",
  stopBots: "Interromper",
  backToStart: "Voltar para o início",
  finishWithBots: "Terminar com bots",
  resign: "Desistir",
  viewBoard: "Ver tabuleiro",
  cancel: "Cancelar",
} as const;

export const LEGEND = {
  selected: "dado selecionado",
  destination: "casa ao alcance",
  target: "alvo do tiro",
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
  mail: "Por correspondência",
  mailNote: "Cada jogada vai num link, pelo meio que você quiser. Sem conta e sem servidor.",
  rules: "Ler as regras",
  collection: "Os seis jogos do Six",
  live: "Ao vivo",
  liveNote: "Cada um no seu navegador, ao mesmo tempo. Você manda um link de convite. Sem conta.",
} as const;

/** Play by correspondence: the saved list on the start screen and the panel with the link. */
export const MAIL = {
  listHeading: "Suas partidas guardadas",
  you: (side: Side) => `Você joga com as ${SIDE_NAME[side]}`,
  yours: "Sua vez",
  waiting: (side: Side) => `Aguardando as ${SIDE_NAME[side]}`,
  over: "Partida terminada",
  open: "Continuar",
  remove: "Remover",
  linkLabel: "Link da partida",
  copy: "Copiar link",
  share: "Compartilhar",
  copied: "Link copiado. Cole onde o outro jogador vai ver.",
  sharedDone: "Link compartilhado.",
  copyFailed: "O navegador não deixou copiar. Selecione o link e copie.",
  shareTitle: "Seks",
  shareLeftText: "Saí da nossa partida de Seks. Abra o link para escolher o que fazer com ela.",
  levelLabel: "Nível do bot",
  sendResult: "Mande o link para o outro jogador ver o resultado.",
  continueWithBot: "Continuar contra o bot",
  end: "Encerrar",
  leaveAsk: "Sair da partida? Você pode voltar ao início, ou deixar os bots jogarem os dois lados até o fim, enquanto você assiste.",
  resignAsk: "Desistir da partida? O outro jogador recebe um link avisando e escolhe entre continuar contra o bot e encerrar. A partida sai da sua lista depois que você enviar o link.",
  resignConfirm: "Desistir",
  resignedTitle: "Você saiu da partida.",
  resignedRest: "Mande o link para avisar o outro jogador.",
  leftTitle: (side: Side) => `As ${SIDE_NAME[side]} saíram da partida.`,
  leftRest: "Você pode continuar contra o bot, a partir desta posição, ou encerrar a partida.",
  leftOverRest: "A partida já tinha terminado. Você pode encerrá-la.",
  shareText: "Minha jogada no Seks. Abra o link para ver a partida e jogar.",
  stale: "Este link é de uma jogada anterior. Abri a partida guardada, que está mais adiantada.",
  missing: "Esta partida não está mais guardada neste navegador.",
  otherGame: "Este link tem o código de uma partida guardada aqui, mas não é a mesma partida. Ele não foi aberto.",
  diverged: "Este link segue outro caminho que a partida guardada neste navegador. Ele não foi aberto.",
} as const;

/** Live play: the status of the connection, the invite and the way back to correspondence. */
export const LIVE = {
  tag: "ao vivo",
  inviteLabel: "Link de convite",
  inviteNote: "Mande este link para o outro jogador. Quando ele abrir, a partida começa.",
  connecting: "Conectando…",
  connected: "Conectado",
  away: "O outro jogador saiu da conexão.",
  connectingRest: "Esperando o outro jogador entrar.",
  awayRest: "Se ele voltar, a partida continua de onde parou.",
  fallbackAsk: "A conexão está demorando ou não sai. Você pode continuar esta partida por correspondência, com um link a cada jogada.",
  fallback: "Continuar por correspondência",
  fellBack: "A partida agora segue por correspondência. Mande o link para o outro jogador.",
  resignAsk: "Desistir da partida? O outro jogador é avisado e escolhe entre continuar contra o bot e encerrar a partida.",
  error: (reason: string) => `Não foi possível entrar na sala: ${reason}`,
  waiting: (side: Side) => `Aguardando as ${SIDE_NAME[side]}.`,
  waitingRest: "Elas jogam pela conexão; a jogada aparece aqui.",
} as const;

/** The line that says where a saved game stands. */
export function mailGameStatus(game: MailGame): string {
  if (isResigned(game)) return MAIL.resignedTitle;
  if (game.leftBy !== null) return MAIL.leftTitle(game.leftBy);
  const status = mailStatus(game);
  const live = game.live !== null && status !== "over" ? ` · ${LIVE.tag}` : "";
  if (status === "yours") return MAIL.yours + live;
  if (status === "over") return MAIL.over;
  return MAIL.waiting(game.toMove) + live;
}

/** The notice for a link that does not open. */
export function linkErrorText(error: LinkError): string {
  switch (error.code) {
    case "version":
      return "Este link é de uma versão do jogo que esta página não conhece. Atualize a página ou use outro link.";
    case "start":
      return "A posição inicial deste link não é válida. Quem o mandou pode gerar outro.";
    case "move":
      return `A jogada ${(error.ply ?? 0) + 1} deste link não é permitida pelas regras. Quem o mandou pode gerar outro.`;
    default:
      return "Este link está incompleto ou foi alterado. Copie-o de novo ou use outro link.";
  }
}

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
  if (mode.kind === "bots") return `${mode.stopped ? "Partida interrompida" : "Os bots jogam o resto da partida"} · Brancas contra Pretas`;
  if (mode.kind === "correspondence") return `Por correspondência · você joga com as ${SIDE_NAME[mode.human]}`;
  if (mode.kind === "live") return `Ao vivo · você joga com as ${SIDE_NAME[mode.human]}`;
  return `Contra o bot, nível ${mode.level.label} · você joga com as ${SIDE_NAME[mode.human]}`;
}

/** The turn belongs to the bot: it is thinking, or its play is about to be asked for. */
function botsTurn(snapshot: MatchSnapshot): boolean {
  return snapshot.view.outcome === null && snapshot.mode.kind === "bot" && snapshot.view.to_move !== snapshot.mode.human;
}

/** The line under the turn title. */
export function turnSubtitle(snapshot: MatchSnapshot): string {
  if (snapshot.view.outcome !== null) return "";
  if (snapshot.mode.kind === "bots") return snapshot.mode.stopped ? "Os bots pararam." : "Os bots estão jogando.";
  if (snapshot.thinking || botsTurn(snapshot)) return "O bot está pensando…";
  if ((snapshot.mode.kind === "correspondence" || snapshot.mode.kind === "live") && !snapshot.humanToMove) return `Aguardando as ${SIDE_NAME[snapshot.view.to_move]}.`;
  if (snapshot.mode.kind !== "hotseat") return "Sua vez: mova ou incremente um dado.";
  return "Mova ou incremente um dado.";
}

/** The mark of each side in the list of sides: who plays it against the bot. */
export function sideTag(mode: Mode, side: Side): string {
  if (mode.kind === "hotseat") return "";
  if (mode.kind === "bots") return "bot";
  if (mode.human === side) return "você";
  return mode.kind === "bot" ? "bot" : "adversário";
}

export function lastPlayText(last: LastPlay): string {
  const who = SIDE_NAME[last.side];
  const what = last.from === null ? `${last.to} incrementado para ${last.value}` : last.shot ? `tiro de ${last.from} em ${last.to}` : `de ${last.from} para ${last.to}`;
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
  if (snapshot.mode.kind === "bots" && snapshot.view.outcome === null) {
    if (snapshot.error !== null) return { strong: "Um bot não respondeu.", rest: `${snapshot.error}. Comece outra partida.` };
    if (snapshot.mode.stopped) return { strong: "Partida interrompida.", rest: "Os bots pararam na posição de agora. Comece outra partida quando quiser." };
    return { strong: "Assista.", rest: "Os bots jogam os dois lados até o fim. Você pode interrompê-los a qualquer momento." };
  }
  if (snapshot.error !== null) {
    return { strong: "O bot não respondeu.", rest: `${snapshot.error}. Desfaça a última jogada ou comece outra partida.` };
  }
  if (snapshot.view.outcome !== null) return { strong: "", rest: "" };
  if (snapshot.mode.kind === "correspondence" && !snapshot.humanToMove) return waitingHint(snapshot, snapshot.mode.human);
  if (snapshot.mode.kind === "live" && !snapshot.humanToMove) return { strong: LIVE.waiting(snapshot.view.to_move), rest: LIVE.waitingRest };
  if (snapshot.thinking || botsTurn(snapshot)) {
    return { strong: "O bot está pensando.", rest: snapshot.canUndo ? "Você pode desfazer a sua última jogada enquanto espera." : "" };
  }
  const selection = snapshot.selection;
  if (selection === null) {
    const whose = snapshot.mode.kind !== "hotseat" ? "num dos seus dados" : `num dado das ${SIDE_NAME[snapshot.view.to_move]}`;
    if (snapshot.view.first_turn) {
      return { strong: "Escolha um dado.", rest: `${Verb} ${whose} para ver aonde ele vai. No primeiro turno, as Brancas precisam mover.` };
    }
    return { strong: "Escolha um dado.", rest: `${Verb} ${whose} para ver aonde ele vai; ${verb} nele de novo para incrementar.` };
  }
  const value = snapshot.view.dice.find((die) => die.cell === selection.at)?.value ?? 0;
  const strong = `${value} em ${selection.at} selecionado.`;
  const near = selection.moves.length;
  const targets = selection.shots.length;
  if (targets > 0) {
    const shoot = `${Verb} num dado marcado para atirar: ${targets === 1 ? "1 alvo" : `${targets} alvos`}.`;
    const move = near > 0 ? ` Ou ${verb} numa casa marcada para mover.` : "";
    return { strong, rest: `${shoot}${move}` };
  }
  if (near > 0) {
    const mark = `${Verb} numa casa marcada para mover: ${moveCount(near)}.`;
    const again = selection.canIncrement
      ? `${Verb} no dado de novo para incrementar.`
      : snapshot.view.first_turn
        ? `No primeiro turno, as Brancas não incrementam; ${verb} no dado de novo para tirar a seleção.`
        : `Um ${value} não pode ser incrementado; ${verb} nele de novo para tirar a seleção.`;
    return { strong, rest: `${mark} ${again}` };
  }
  if (selection.canIncrement) {
    return { strong, rest: `Nenhuma casa ao alcance: o dado está cercado. ${Verb} nele de novo para incrementar.` };
  }
  const why = snapshot.view.first_turn ? "as Brancas não incrementam no primeiro turno" : `um ${value} não pode ser incrementado`;
  return { strong, rest: `Este dado não tem jogada: está cercado e ${why}. ${Verb} nele de novo para tirar a seleção.` };
}

/** The note while the other player has the turn in a match by correspondence. */
function waitingHint(snapshot: MatchSnapshot, human: Side): Hint {
  const other = SIDE_NAME[human === "white" ? "black" : "white"];
  if (snapshot.last === null) {
    return { strong: `Convide as ${other}.`, rest: "Mande o link: elas abrem, jogam e mandam outro de volta." };
  }
  if (snapshot.canUndo) {
    return { strong: "Mande o link.", rest: `A jogada só chega às ${other} pelo link. Até copiar ou compartilhar, você pode desfazer.` };
  }
  return { strong: `Aguardando as ${other}.`, rest: "Quando elas responderem, abra o link que mandarem." };
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

/** The card over the board when the game ends. */
export interface EndCard {
  readonly title: string;
  /** One line, with the terms of the glossary. */
  readonly reason: string;
  readonly tone: "win" | "loss" | "neutral";
}

/**
 * The card for the end of the game, from the point of view of who plays:
 * "Você venceu" or "Você perdeu" against the bot, by correspondence or live, the
 * side that won in hotseat, a draw with its reason. `null` while it goes on.
 */
export function endCard(snapshot: MatchSnapshot): EndCard | null {
  const outcome = snapshot.view.outcome;
  if (outcome === null) return null;
  const result = resultText(outcome, snapshot.view);
  const mode = snapshot.mode;
  if (result.winner !== null && (mode.kind === "bot" || mode.kind === "correspondence" || mode.kind === "live")) {
    const won = result.winner === mode.human;
    return { title: won ? "Você venceu" : "Você perdeu", reason: result.reason, tone: won ? "win" : "loss" };
  }
  return { title: result.title, reason: result.reason, tone: "neutral" };
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
