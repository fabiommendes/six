from dataclasses import dataclass

import pyxel

from .types import Coord, Pos


@dataclass
class Style:
    background: int = pyxel.COLOR_RED
    empty_cell: int = pyxel.COLOR_PINK
    empty_cell_border: int = pyxel.COLOR_ORANGE
    transparent: int = pyxel.COLOR_GRAY
    screen_color: int = pyxel.COLOR_WHITE
    undo_button_white: Pos = Pos(0, 112)
    undo_button_black: Pos = Pos(0, 112)


@dataclass
class Layout:
    gutter: int = 5
    board_margin: int = 10
    interface_margin: int = 3
    button_size: int = 16
    piece_size: int = 16
    num_places: int = 11

    @property
    def undo_button_white(self) -> Pos:
        w, h = self.screen_size
        x = w - self.interface_margin - self.button_size
        y = h - self.interface_margin - self.button_size
        return Pos(x, y)

    @property
    def undo_button_black(self) -> Pos:
        w, _ = self.screen_size
        x = w - self.interface_margin - self.button_size
        y = self.interface_margin
        return Pos(x, y)

    @property
    def screen_size(self) -> tuple[int, int]:
        size = self.board_size
        ribbon_size = 2 * self.interface_margin + self.piece_size
        return (size + 2 * self.interface_margin, size + 2 * ribbon_size)

    @property
    def board_size(self) -> int:
        return (
            self.piece_size * self.num_places
            + self.gutter * (self.num_places - 1)
            + 2 * self.board_margin
        )

    @property
    def board_origin(self) -> Pos:
        x = self.interface_margin
        y = 2 * self.interface_margin + self.piece_size
        return Pos(x, y)

    def screen_coord(self, i: int, j: int) -> Pos:
        """
        Return (x, y) point in the screen for the upper-leftmost pixel of the
        (i, j) cell.
        """
        x0, y0 = self.board_origin
        return Pos(self._screen_coord(i) + x0, self._screen_coord(j) + y0)

    def _screen_coord(self, i: int) -> int:
        return self.board_margin + i * self.piece_size + i * self.gutter

    def cell_coord(self, x: int, y: int) -> Coord | None:
        """
        Return the coordinates for the cell in the (x, y) screen coordinate.

        If (x, y) does not point to any valid cell, return None.
        """
        x0, y0 = self.board_origin
        x0 += self.board_margin
        y0 += self.board_margin
        match (self._cell_coord(x - x0), self._cell_coord(y - y0)):
            case (None, _) | (_, None):
                return None
            case (i, j):
                return (i, j)
        return None

    def _cell_coord(self, x: int) -> int | None:
        displacement = self.gutter + self.piece_size
        if x < 0:
            return None
        k, offset = divmod(x, displacement)
        if offset >= self.piece_size or k >= self.num_places:
            return None
        return k
