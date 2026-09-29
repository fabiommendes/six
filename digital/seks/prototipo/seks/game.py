from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pyxel
from pyxel.editor.widgets.widget import Widget

from .grid import Grid, Play
from .renderer import Renderer
from .style import Layout, Style
from .types import Coord, GameMode, ImageButton, Msg, Player, SimpleMsg
from .utils import log, sign

#: Save file used by the Ctrl+S / Ctrl+L shortcuts, relative to the working dir.
SAVE_FILE = Path("game.save")

#: Minimum quiet time between undo button presses (1 s at 20 FPS). Holding the
#: button repeats the press every few frames; each repeat restarts the count.
UNDO_DEBOUNCE_FRAMES = 20


class Game(Widget):
    DIRECTIONS = [(i, j) for i in (0, -1, 1) for j in (0, -1, 1)][1:]

    def __init__(self, style: Style | None = None, layout: Layout | None = None):
        self.grid = Grid.initial()
        self.style = style or Style()
        self.layout = layout or Layout()
        self.mode: GameMode = GameMode.Idle
        self.history: list[Play] = []
        self.redo: list[Play] = []
        self.current_player: Player = Player.White
        self._message: Msg | None = None
        self._last_undo_request: int | None = None
        Widget.__init__(self, None, 0, 0, *self.layout.screen_size)

        # Init widget and buttons
        size = self.layout.button_size
        x, y = self.layout.undo_button_white
        u, v = self.style.undo_button_white
        self._undo_button_white = ImageButton(self, x, y, size, u=u, v=v)
        self._undo_button_white.add_event_listener("press", self.__on_undo_button)

        x, y = self.layout.undo_button_black
        u, v = self.style.undo_button_black
        self._undo_button_black = ImageButton(self, x, y, size, u=u, v=v)
        self._undo_button_black.add_event_listener("press", self.__on_undo_button)

        # Register events
        self.add_event_listener("update", self.__on_update)
        self.add_event_listener("draw", self.__on_draw)

    def take_message(self) -> Msg | None:
        """
        Return the message emitted by the last update and clear it.
        """
        msg, self._message = self._message, None
        return msg

    def click_cell(self, i: int, j: int) -> Msg | None:
        """
        Handle a click on the (i, j) board cell by the current player.
        """
        return self.__on_update_cell(i, j)

    def undo(self) -> None:
        """
        Revert the last play and give the turn back to the player who made it.
        """
        if self.history:
            self.grid.undo(play := self.history.pop())
            self.current_player = (
                Player.White if play.starting_value > 0 else Player.Black
            )
            self.mode = GameMode.Idle
            self.redo.append(play)

    def request_undo(self, frame: int) -> bool:
        """
        Undo from a button press at the given frame, ignoring presses that come
        less than UNDO_DEBOUNCE_FRAMES after the previous one. Return True if
        the undo happened.
        """
        last, self._last_undo_request = self._last_undo_request, frame
        if last is not None and frame - last < UNDO_DEBOUNCE_FRAMES:
            return False
        if not self.history:
            return False
        self.undo()
        return True

    def can_play(self, player: Player) -> bool:
        """
        Return True if the player has at least one die that can move or be
        incremented.
        """
        for i in range(11):
            for j in range(11):
                cell = self.grid[i, j]
                if not player.owns(cell):
                    continue
                if abs(cell) < 6 or next(self.valid_movements(i, j), None):
                    return True
        return False

    def save(self) -> str:
        """
        Serialize the board and whose turn it is to a string accepted by
        :meth:`load`.
        """
        return f"{self.current_player.value}\n{self.grid.save()}"

    def load(self, data: str) -> None:
        """
        Restore the board and the player to move from :meth:`save` output, and
        clear the undo history.

        Raise ValueError and keep the current game if data is invalid.
        """
        head, _, body = data.partition("\n")
        player = Player(head.strip())
        grid = Grid.load(body)
        self.grid = grid
        self.current_player = player
        self.history.clear()
        self.redo.clear()
        self.mode = GameMode.Idle

    def save_to_file(self, path: Path) -> bool:
        """
        Save the game to path. Return False and log a warning on failure.
        """
        try:
            path.write_text(self.save())
        except OSError as exc:
            log.warning("Could not save game to %r: %s", str(path), exc)
            return False
        log.info("Game saved to %r", str(path))
        return True

    def load_from_file(self, path: Path) -> bool:
        """
        Load the game from path. Return False, log a warning and keep the
        current game if the file cannot be read or is invalid.
        """
        try:
            self.load(path.read_text())
        except (OSError, ValueError) as exc:
            log.warning("Could not load game from %r: %s", str(path), exc)
            return False
        log.info("Game loaded from %r", str(path))
        return True

    def submit(self, play: Play) -> None:
        self.history.append(play)
        self.redo.clear()
        self.grid.do(play)

        # A player who cannot play (e.g. lost every die) loses the game.
        if play.is_winning_move() or not self.can_play(self.current_player.other()):
            self.mode = GameMode.Finished
        else:
            self.mode = GameMode.Idle
            self.current_player = self.current_player.other()

    def valid_movements(self, i: int, j: int) -> Iterator[tuple[int, Coord]]:
        def valid_movements_aux(grid, cell, i, j, dx, dy, sign):
            for k in range(1, abs(cell) + 1):
                ii = i + dx * k
                jj = j + dy * k
                if ii < 0 or jj < 0 or ii > 10 or jj > 10 or grid[ii, jj] != 0:
                    break
                yield sign * k, (ii, jj)

        cell = self.grid[i, j]
        for dx, dy in self.DIRECTIONS:
            yield from valid_movements_aux(self.grid, cell, i, j, dx, dy, sign(cell))

    def __on_update(self) -> None:
        self._message = self.__process_input()

    def __process_input(self) -> Msg | None:
        match self.mode:
            case GameMode.Finished:
                if pyxel.btnp(pyxel.MOUSE_BUTTON_LEFT):
                    return SimpleMsg.RESTART_GAME
                return None

        if pyxel.btnp(pyxel.MOUSE_BUTTON_LEFT):
            mouse_xy = pyxel.mouse_x, pyxel.mouse_y

            if (coord := self.layout.cell_coord(*mouse_xy)) is not None:
                return self.__on_update_cell(*coord)
            elif self.mode.is_selected:
                self.mode = GameMode.Idle
                return None

        if pyxel.btn(pyxel.KEY_CTRL) and pyxel.btnp(pyxel.KEY_S):
            self.save_to_file(SAVE_FILE)

        if pyxel.btn(pyxel.KEY_CTRL) and pyxel.btnp(pyxel.KEY_L):
            self.load_from_file(SAVE_FILE)

        return None

    def __on_update_cell(self, i: int, j: int) -> Msg | None:
        pointed_coord = (i, j)

        match self.mode:
            case GameMode.Idle if self.current_player.owns(self.grid[pointed_coord]):
                self.mode = GameMode.Selected(*pointed_coord)
            case GameMode.Idle | GameMode.Finished:
                pass
            case GameMode.Selected(x, y) if (x, y) == pointed_coord:
                # Do nothing if piece has the maximum value
                if abs(self.grid[pointed_coord]) == 6:
                    self.mode = GameMode.Idle
                else:
                    value = self.grid[pointed_coord]
                    play: Play = Play.Increment(
                        pointed_coord, value, value + self.current_player.sign()
                    )
                    self.submit(play)
            case GameMode.Selected() if self.current_player.owns(
                self.grid[pointed_coord]
            ):
                self.mode = GameMode.Selected(*pointed_coord)
            case GameMode.Selected(x, y):
                for dice_value, destination in self.valid_movements(x, y):
                    if pointed_coord == destination:
                        captures = self.grid.captures(destination, self.current_player)
                        move = Play.Move(
                            origin=(x, y),
                            destination=destination,
                            starting_value=self.grid[x, y],
                            ending_value=dice_value,
                            captures=captures,
                        )
                        self.submit(move)
                        break
                else:
                    self.mode = GameMode.Idle
            case _:
                raise RuntimeError
        return None

    def __on_undo_button(self) -> None:
        self.request_undo(pyxel.frame_count)

    def __on_draw(self):
        renderer = Renderer(self.layout, self.style)

        # Render board
        renderer.render_board(self.grid)
        renderer.render_captured_dice(self.grid)

        # Render selected dice
        match self.mode:
            case GameMode.Selected(i, j):
                movements = self.valid_movements(i, j)
                renderer.render_selected_dice(self.grid[i, j], (i, j), movements)
                renderer.render_current_player_overlay(self.current_player)
            case GameMode.Finished:
                renderer.render_victory_screen(self.current_player)
            case GameMode.Idle:
                renderer.render_current_player_overlay(self.current_player)

        # self._draw_captured_dice()

        # if self.mode == GameMode.Finished:
        #     self.render_victory_screen()
        # else:
        #     self._draw_buttons()
        #     self._draw_selected_dice_highlight()
        #     self._draw_current_player_overlay_text()
