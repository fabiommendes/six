from __future__ import annotations

import abc
import enum
from dataclasses import dataclass
from typing import ClassVar, NamedTuple

import pyxel
from pyxel.editor.widgets.button import Button

from .utils import sign


# ----------------------------------------------------------------------------
# App architecture
# ----------------------------------------------------------------------------
class Msg:
    pass


class SimpleMsg(Msg, enum.Enum):
    RESTART_GAME = "restart_game"
    QUIT = "quit"


# ----------------------------------------------------------------------------
# Simple types, namedtuples and aliases
# ----------------------------------------------------------------------------
#: An (i, j) coordinate in the board.
type Coord = tuple[int, int]


class Pos(NamedTuple):
    """
    An (x, y) coordinate in the screen
    """

    x: int
    y: int


#: The cell type in the board. A number from -6 to 6.
#:
#: Zero is the empty cell.
#: Negative values are black dice.
#: Positive values are white dice.
type Cell = int


# ----------------------------------------------------------------------------
# Game mode ADT
# ----------------------------------------------------------------------------
class GameMode(abc.ABC):
    """
    GameMode controls the state in which the main Game loop is:

    Idle
    Finished
    Selected(i, j)
    """

    Idle: ClassVar[GameMode]
    Finished: ClassVar[GameMode]
    Locked: ClassVar[GameMode]
    Selected: ClassVar[type[GameModeSelected]]

    is_idle = False
    is_finished = False
    is_locked = False
    is_selected = False


class GameModeIdle(GameMode):
    is_idle = True


class GameModeLocked(GameMode):
    is_locked = True


class GameModeFinished(GameMode):
    is_finished = True


@dataclass(frozen=True)
class GameModeSelected(GameMode):
    i: int
    j: int
    is_selected = True


GameMode.Idle = GameModeIdle()
GameMode.Finished = GameModeFinished()
GameMode.Locked = GameModeLocked()
GameMode.Selected = GameModeSelected


# ----------------------------------------------------------------------------
# Player
# ----------------------------------------------------------------------------
class Player(enum.Enum):
    """
    Represents the current player.

    The game starts with white and alternates.
    """

    Black = "black"
    White = "white"

    def owns(self, cell: Cell) -> bool:
        """
        Return True if player owns the given cell value.
        """
        return (cell > 0 and self == self.White) or (cell < 0 and self == self.Black)

    def other(self) -> Player:
        """
        Return the other player.
        """
        match self:
            case Player.White:
                return Player.Black
            case Player.Black:
                return Player.White

    def sign(self) -> int:
        """
        Convert player to integer: -1 for black and +1 for white
        """
        match self:
            case Player.White:
                return +1
            case Player.Black:
                return -1

    def is_adversary(self, other: Cell) -> bool:
        return sign(other) == -1 * self.sign()

    def is_teammate(self, other: Cell) -> bool:
        return sign(other) == self.sign()


# ----------------------------------------------------------------------------
# Widgets
# ----------------------------------------------------------------------------
class ImageButton(Button):
    """
    Variables:
        is_pressed_var

    Events:
        press
    """

    def __init__(self, parent, x, y, size, *, u, v, **kwargs):
        super().__init__(parent, x, y, size, size, **kwargs)
        self._img = 0
        self._u = u
        self._v = v

        # Set event listeners
        self.add_event_listener("draw", self.__on_draw)

    def __on_draw(self):
        pyxel.blt(
            self.x,
            self.y,
            self._img,
            self._u,
            self._v,
            self.width,
            self.height,
        )
