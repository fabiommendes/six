import pytest

from seks.grid import Captures, Grid, Play, PlayIncrement, PlayMove
from seks.types import Player


def empty_grid(**cells: int) -> Grid:
    """Build a grid from keyword cells named like ``c3_4`` for (3, 4)."""
    grid = Grid()
    for name, value in cells.items():
        i, j = map(int, name[1:].split("_"))
        grid.setitem((i, j), value)
    return grid


def test_initial_grid_has_16_dice_per_player():
    assert Grid.initial().count_pieces() == (16, 16)


def test_initial_grid_places_white_at_the_bottom():
    grid = Grid.initial()
    assert grid[0, 10] == 1
    assert grid[0, 9] == 2
    assert grid[0, 0] == -1
    assert grid[0, 1] == -2
    assert grid[5, 1] == grid[5, 9] == 0


def test_setitem_validates_value_and_index():
    grid = Grid()
    with pytest.raises(ValueError):
        grid.setitem((0, 0), 7)
    with pytest.raises(IndexError):
        grid.setitem((11, 0), 1)
    with pytest.raises(IndexError):
        grid.setitem((0, -1), 1)


def test_save_and_load_roundtrip():
    grid = Grid.initial()
    grid.setitem((5, 5), -4)
    assert Grid.load(grid.save()).save() == grid.save()


def test_captures_sandwiched_adversary():
    # White moves to (5, 5), black at (6, 5) is flanked by white at (7, 5).
    grid = empty_grid(c6_5=-3, c7_5=2)
    assert grid.captures((5, 5), Player.White) == Captures(east=-3)


def test_no_capture_without_partner():
    grid = empty_grid(c6_5=-3)
    assert grid.captures((5, 5), Player.White) == Captures()


def test_no_capture_at_board_edge():
    grid = empty_grid(c10_5=-3)
    assert grid.captures((9, 5), Player.White) == Captures()


def test_do_and_undo_move_with_capture():
    grid = empty_grid(c5_8=3, c6_5=-3, c7_5=2)
    move = Play.Move(
        origin=(5, 8),
        destination=(5, 5),
        starting_value=3,
        ending_value=3,
        captures=grid.captures((5, 5), Player.White),
    )
    before = grid.save()

    grid.do(move)
    assert grid[5, 8] == 0
    assert grid[5, 5] == 3
    assert grid[6, 5] == 0

    grid.undo(move)
    assert grid.save() == before


def test_do_and_undo_increment():
    grid = empty_grid(c2_2=-2)
    play = Play.Increment((2, 2), -2, -3)
    grid.do(play)
    assert grid[2, 2] == -3
    grid.undo(play)
    assert grid[2, 2] == -2


def test_increment_empty_cell_is_an_error():
    with pytest.raises(ValueError):
        Grid().do(Play.Increment((2, 2), 0, 1))


@pytest.mark.parametrize(
    ("destination", "value", "wins"),
    [
        ((3, 0), 2, True),
        ((3, 10), 2, False),
        ((3, 10), -2, True),
        ((3, 0), -2, False),
        ((3, 5), 2, False),
    ],
)
def test_winning_move_reaches_opponent_back_row(destination, value, wins):
    move = PlayMove((3, 5), destination, value, value)
    assert move.is_winning_move() is wins


def test_increment_never_wins():
    assert not PlayIncrement((3, 0), 1, 2).is_winning_move()


@pytest.mark.parametrize("coord", [(-1, 0), (0, -1), (-1, -1), (11, 0), (0, 11)])
def test_indexing_outside_the_board_raises(coord):
    with pytest.raises(IndexError):
        Grid.initial()[coord]


def test_no_capture_across_the_left_edge():
    # Enemy in column 10 and a teammate in column 9 must not be seen as the
    # neighbors west of column 0.
    grid = empty_grid(c10_5=-3, c9_5=2)
    assert grid.captures((0, 5), Player.White) == Captures()


def test_no_capture_across_the_top_edge():
    grid = empty_grid(c4_10=-3, c4_9=2)
    assert grid.captures((4, 0), Player.White) == Captures()


VALID_ROW = ",".join(["0"] * 11)


@pytest.mark.parametrize(
    "data",
    [
        "",
        "\n".join([VALID_ROW] * 10),  # missing a row
        "\n".join([VALID_ROW] * 12),  # extra row
        "\n".join([VALID_ROW] * 10 + [",".join(["0"] * 10)]),  # short row
        "\n".join([VALID_ROW] * 10 + ["a" + VALID_ROW[1:]]),  # not an integer
        "\n".join([VALID_ROW] * 10 + ["7" + VALID_ROW[1:]]),  # out of range
    ],
    ids=["empty", "10-rows", "12-rows", "short-row", "non-integer", "out-of-range"],
)
def test_load_rejects_malformed_data(data):
    with pytest.raises(ValueError):
        Grid.load(data)
