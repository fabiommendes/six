from __future__ import annotations

import abc
import io
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import ClassVar, NamedTuple

from .types import Cell, Coord, Player


class Grid:
    """
    Represents the state of a 11 x 11 board.
    """

    @classmethod
    def initial(cls) -> Grid:
        grid = Grid()
        for i in range(0, 11, 2):
            grid.setitem((i, 0), -1)
            grid.setitem((i, 10), +1)
        for i in range(11):
            if i == 5:
                continue
            grid.setitem((i, 1), -2)
            grid.setitem((i, 9), +2)
        return grid

    @classmethod
    def load(cls, data: str) -> Grid:
        try:
            rows = [[int(x) for x in row.split(",")] for row in data.splitlines()]
        except ValueError:
            raise ValueError("save data must contain only integers") from None
        if len(rows) != 11 or any(len(row) != 11 for row in rows):
            raise ValueError("save data must be 11 rows of 11 columns")
        if any(not -6 <= x <= 6 for row in rows for x in row):
            raise ValueError("save data values must be in the [-6, 6] range")
        new = object.__new__(Grid)
        new._data = rows
        return new

    def __init__(self):
        self._data: list[list[int]] = [[0 for _ in range(11)] for _ in range(11)]

    def __getitem__(self, item: Coord) -> Cell:
        i, j = item
        assert isinstance(i, int), i
        assert isinstance(j, int), j
        if not (0 <= i < 11 and 0 <= j < 11):
            raise IndexError(f"invalid index: {item}")
        return self._data[i][j]

    def setitem(self, item: Coord, value: int) -> None:
        i, j = item
        if not isinstance(value, int):
            raise TypeError("cell must be integer")
        if value < -6 or value > 6:
            raise ValueError(f"cell must be in the [-6, 6] range, got: {value!r}")
        if i < 0 or i >= 11:
            raise IndexError(f"invalid column index: i={i}")
        if j < 0 or j >= 11:
            raise IndexError(f"invalid row index: j={j}")
        self._data[i][j] = value

    def do(self, play: Play) -> None:
        """
        Commit a given play to the grid.
        """
        match play:
            case PlayIncrement((i, j), _, value):
                if self[i, j] == 0:
                    raise ValueError("incrementing empty cell")
                else:
                    self.setitem((i, j), value)

            case PlayMove((i, j), (ii, jj), _, value, captures):
                self.setitem((ii, jj), value)
                self.setitem((i, j), 0)
                for captured, _ in captures.enumerate_from((ii, jj)):
                    self.setitem(captured, 0)

    def undo(self, play: Play) -> None:
        """
        Reverse the changes proposed from the last play.
        """
        match play:
            case PlayIncrement((i, j), value, _):
                if self[i, j] == 0:
                    raise ValueError("incrementing empty cell")
                else:
                    self.setitem((i, j), value)
            case PlayMove((i, j), (ii, jj), value, _, captures):
                self.setitem((i, j), value)
                self.setitem((ii, jj), 0)
                for captured, cell in captures.enumerate_from((ii, jj)):
                    self.setitem(captured, cell)

    def captures(self, dest: Coord, player: Player) -> Captures:
        """
        Compute the captured pieces after making a move to dest by the given
        player.
        """

        kwargs = {}
        (i, j) = dest
        for attr, (dx, dy) in CAPTURE_DIRECTIONS.items():
            coords_captured = i + dx, j + dy
            coords_partner = i + 2 * dx, j + 2 * dy
            try:
                (capture,) = (
                    player.is_adversary(captured := self[coords_captured])
                    and player.is_teammate(self[coords_partner]),
                )
            except IndexError:
                continue
            if capture:
                kwargs[attr] = captured

        return Captures(**kwargs)

    def count_pieces(self) -> tuple[int, int]:
        """
        Return a tuple with (num of white pieces, num of black pieces).
        """

        n_white = n_black = 0
        for row in self._data:
            for cell in row:
                if cell > 0:
                    n_white += 1
                elif cell < 0:
                    n_black += 1

        return (n_white, n_black)

    def save(self) -> str:
        fd = io.StringIO()
        for row in self._data:
            print(",".join(map(repr, row)), file=fd)
        return fd.getvalue()


# ----------------------------------------------------------------------------
# Play ADT
# ----------------------------------------------------------------------------
#: Offset of the neighbor cell in each direction that can be captured.
CAPTURE_DIRECTIONS: dict[str, Coord] = {
    "north": (0, 1),
    "west": (-1, 0),
    "south": (0, -1),
    "east": (1, 0),
}


class Captures(NamedTuple):
    """
    List the captured pieces in each direction.

    If zero, no piece was captured in the given direction.
    """

    north: Cell = 0
    west: Cell = 0
    south: Cell = 0
    east: Cell = 0

    def enumerate_from(self, coord: Coord) -> Iterator[tuple[Coord, Cell]]:
        i, j = coord

        if self.north != 0:
            yield (i, j + 1), self.north
        if self.west != 0:
            yield (i - 1, j), self.west
        if self.south != 0:
            yield (i, j - 1), self.south
        if self.east != 0:
            yield (i + 1, j), self.east


class Play(abc.ABC):
    """
    Describes an action that promotes a change to the grid.

    Move(origin, dest, [captures])
    Increment(coord)
    """

    Move: ClassVar[type[PlayMove]]
    Increment: ClassVar[type[PlayIncrement]]

    starting_value: int

    @abc.abstractmethod
    def is_winning_move(self) -> bool:
        """
        Return True if the play ends the game.
        """


@dataclass
class PlayMove(Play):
    origin: Coord
    destination: Coord
    starting_value: int
    ending_value: int
    captures: Captures = field(default_factory=Captures)

    def is_winning_move(self) -> bool:
        """
        A move wins when a die reaches the opponent's back row: white starts at
        the bottom (j = 10) and wins at j = 0, black does the opposite.
        """
        _, j = self.destination
        return (j == 0 and self.ending_value > 0) or (j == 10 and self.ending_value < 0)


@dataclass
class PlayIncrement(Play):
    coord: Coord
    starting_value: int
    ending_value: int

    def is_winning_move(self) -> bool:
        return False


Play.Move = PlayMove
Play.Increment = PlayIncrement
