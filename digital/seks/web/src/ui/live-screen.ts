import { type Command, type SeksGame } from "../engine/game";
import { markResigned, opposite, type MailGame } from "../logic/mail-games";
import { gameFromStart, seksRuleset } from "../logic/seks-link";
import { LIVE } from "../logic/texts";
import { FallbackTimer } from "../net/fallback-timer";
import { LiveSession, type LiveGame, type LiveStatus } from "../net/live-session";
import { roomIdOf, type Transport } from "../net/transport";
import { GameScreen, type LiveView } from "./game";

/** How long a resignation is given to reach the other player before the connection is closed. */
export const LEAVE_DELAY_MS = 400;

export interface LiveScreenOptions {
  readonly host: HTMLElement;
  /** The saved game, with `live` set. */
  readonly entry: MailGame;
  readonly transport: Transport;
  /** The URL that invites the other player, for the one who invited; `null` for the guest. */
  readonly invite: string | null;
  /** Whether the camera starts tilted (read at every build of the screen). */
  readonly tilted: () => boolean;
  readonly onTilt: (tilted: boolean) => void;
  /** Writes the game in the saved list. */
  readonly save: (game: MailGame) => void;
  readonly remove: (id: string) => void;
  /** The game goes on by correspondence (already saved as such): the page opens it, with a notice if there is one. */
  readonly toMail: (game: MailGame, notice: string | null) => void;
  /** The player left a game the other one was told about: back to the start screen. */
  readonly toStart: () => void;
  /** The player asked for a new game or the start screen. */
  readonly onNewGame: () => void;
  readonly fallbackAfterMs?: number;
  readonly resyncMs?: number;
}

/**
 * A live match on the page: the `GameScreen`, the `LiveSession` that talks to
 * the other browser and what joins them. The screen is built again when the
 * session replaces the match (the other player's was the reference).
 */
export class LiveScreen {
  private screen: GameScreen;
  private game: SeksGame;
  private latest: MailGame;
  private readonly session: LiveSession | null;
  private readonly timer: FallbackTimer | null;
  private view: LiveView = { status: "connecting", offered: false, error: null };
  private ended = false;

  /** The match as the session sees it: whatever screen is current. */
  private readonly proxy: LiveGame = {
    commands: () => this.screen.commands(),
    hash: () => this.screen.hash(),
    apply: (command) => this.screen.playRemote(command),
    replace: (commands) => this.rebuild(commands),
  };

  constructor(private readonly options: LiveScreenOptions) {
    this.latest = options.entry;
    this.game = gameFromStart(options.entry.start);
    this.screen = this.build(this.game, options.entry.commands);
    // A game that is over needs no connection: it is only shown.
    if (options.entry.over) {
      this.session = null;
      this.timer = null;
      return;
    }
    this.timer = new FallbackTimer((offered) => this.show({ offered }), "connecting", options.fallbackAfterMs);
    this.session = new LiveSession({
      transport: options.transport,
      id: options.entry.id,
      roomId: roomIdOf(options.entry.id),
      host: options.entry.live?.host ?? false,
      ruleset: seksRuleset,
      game: this.proxy,
      resyncMs: options.resyncMs,
      onStatus: (status) => this.onStatus(status),
      onResign: () => this.onOpponentResigned(),
      onError: (reason) => this.show({ error: reason }),
    });
  }

  /** Shows the position and joins the room. */
  async start(): Promise<void> {
    const started = this.screen.start();
    this.session?.start();
    await started;
  }

  dispose(): void {
    if (this.ended) return;
    this.ended = true;
    this.timer?.dispose();
    this.session?.dispose();
    this.screen.dispose();
    this.game.free();
  }

  private build(game: SeksGame, commands: readonly Command[]): GameScreen {
    const screen = new GameScreen(this.options.host, {
      mode: { kind: "live", human: this.latest.player, id: this.latest.id },
      game,
      resume: commands,
      tilted: this.options.tilted(),
      onTilt: this.options.onTilt,
      bot: null,
      live: {
        invite: this.options.invite,
        onPlay: () => this.session?.sendMove(),
        onChange: (change) => this.persist(change),
        onResign: () => this.resign(),
        onFallback: () => this.fallback(),
      },
      onNewGame: this.options.onNewGame,
    });
    screen.setLive(this.view);
    return screen;
  }

  /** The session put another match in place of this one: the screen is made again from its plays. */
  private rebuild(commands: readonly Command[]): void {
    if (this.ended) return;
    const old = { screen: this.screen, game: this.game };
    old.screen.dispose();
    old.game.free();
    this.game = gameFromStart(this.latest.start);
    this.screen = this.build(this.game, commands);
    void this.screen.start();
  }

  private show(change: Partial<LiveView>): void {
    if (this.ended) return;
    this.view = { ...this.view, ...change };
    this.screen.setLive(this.view);
  }

  private onStatus(status: LiveStatus): void {
    this.timer?.update(status);
    this.show({ status, ...(status === "connected" ? { error: null } : {}) });
  }

  private persist(change: { commands: readonly Command[]; toMove: MailGame["toMove"]; over: boolean }): void {
    const same = change.commands.length === this.latest.commands.length && change.toMove === this.latest.toMove && change.over === this.latest.over;
    if (same) return;
    // What is played live is known to the other player, so none of it can be undone: all of it is shared.
    this.latest = { ...this.latest, ...change, shared: change.commands.length, updated: Date.now() };
    this.options.save(this.latest);
  }

  /**
   * The player gives up. With the other player here they are told and the game
   * leaves the list; without them it goes on as a game by correspondence,
   * resigned, and the link that tells it is the way to tell.
   */
  private resign(): void {
    if (this.session?.resign()) {
      this.options.remove(this.latest.id);
      // The connection is closed only after the message had time to leave.
      setTimeout(() => {
        if (!this.ended) this.options.toStart();
      }, LEAVE_DELAY_MS);
      return;
    }
    const game = markResigned({ ...this.latest, live: null });
    this.options.save(game);
    this.options.toMail(game, null);
  }

  /** The connection does not come: the game goes on by correspondence, from this position. */
  private fallback(): void {
    // The other player has every play but, maybe, the last one if it is ours: the link is to be sent.
    const unsent = this.latest.toMove !== this.latest.player && this.latest.commands.length > 0 ? 1 : 0;
    const game: MailGame = { ...this.latest, live: null, shared: this.latest.commands.length - unsent, updated: Date.now() };
    this.options.save(game);
    this.options.toMail(game, LIVE.fellBack);
  }

  /** The other player left: the game is by correspondence from now on, with them gone. */
  private onOpponentResigned(): void {
    const game: MailGame = { ...this.latest, live: null, leftBy: opposite(this.latest.player), updated: Date.now() };
    this.options.save(game);
    this.options.toMail(game, null);
  }
}
