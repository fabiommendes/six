import pytest

from seks.style import Layout
from seks.types import GameMode, Player
from seks.utils import sign


@pytest.mark.parametrize(("value", "expected"), [(-4, -1), (0, 0), (3, 1)])
def test_sign(value, expected):
    assert sign(value) == expected


def test_player_ownership():
    assert Player.White.owns(3)
    assert not Player.White.owns(-3)
    assert Player.Black.owns(-1)
    assert not Player.Black.owns(0)


def test_player_relations():
    assert Player.White.other() is Player.Black
    assert Player.Black.other() is Player.White
    assert Player.White.is_adversary(-2)
    assert Player.White.is_teammate(5)
    assert not Player.Black.is_adversary(0)


def test_layout_screen_and_cell_coordinates_roundtrip():
    layout = Layout()
    for i, j in [(0, 0), (5, 7), (10, 10)]:
        x, y = layout.screen_coord(i, j)
        assert layout.cell_coord(x + 8, y + 8) == (i, j)


def test_layout_gutter_is_not_a_cell():
    layout = Layout()
    x, y = layout.screen_coord(3, 3)
    assert layout.cell_coord(x + layout.piece_size + 2, y + 8) is None


# Layout.cell_coord: default layout has cells 16 px wide, 5 px gutters and a
# 10 px board margin. Cell (0, 0) spans x in [13, 28] and y in [32, 47].
@pytest.mark.parametrize(
    ("x", "y", "expected"),
    [
        (13, 32, (0, 0)),  # first pixel of the first cell
        (28, 47, (0, 0)),  # last pixel of the first cell
        (34, 53, (1, 1)),  # first pixel of the second cell
        (238, 257, (10, 10)),  # last pixel of the last cell
    ],
)
def test_cell_coord_inside_cells(x, y, expected):
    assert Layout().cell_coord(x, y) == expected


@pytest.mark.parametrize(
    ("x", "y"),
    [
        (5, 40),  # left board margin
        (12, 40),  # pixel just before the first column
        (20, 25),  # top board margin
        (20, 31),  # pixel just before the first row
        (29, 40),  # first gutter pixel after a cell
        (33, 40),  # last gutter pixel before the next cell
        (20, 48),  # first gutter pixel below a cell
        (239, 40),  # right of the last column
        (20, 258),  # below the last row
        (0, 0),  # top ribbon corner
    ],
)
def test_cell_coord_outside_cells_is_none(x, y):
    assert Layout().cell_coord(x, y) is None


FLAGS = ["is_idle", "is_finished", "is_locked", "is_selected"]


@pytest.mark.parametrize(
    ("mode", "flag"),
    [
        (GameMode.Idle, "is_idle"),
        (GameMode.Finished, "is_finished"),
        (GameMode.Locked, "is_locked"),
        (GameMode.Selected(1, 2), "is_selected"),
    ],
)
def test_game_mode_flags(mode, flag):
    assert {name: getattr(mode, name) for name in FLAGS} == {
        name: name == flag for name in FLAGS
    }
