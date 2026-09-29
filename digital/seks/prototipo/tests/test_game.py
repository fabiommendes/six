import pytest

from seks.game import UNDO_DEBOUNCE_FRAMES, Game
from seks.grid import Grid
from seks.types import GameMode, Player, SimpleMsg


def click(game: Game, i: int, j: int) -> None:
    game.click_cell(i, j)


def test_white_starts():
    assert Game().current_player is Player.White


def test_dice_move_up_to_their_value_in_straight_lines():
    game = Game()
    assert sorted(game.valid_movements(1, 9)) == [
        (1, (0, 8)),
        (1, (1, 8)),
        (1, (1, 10)),
        (1, (2, 8)),
        (2, (1, 7)),
        (2, (3, 7)),
    ]


def test_movements_are_blocked_by_other_dice():
    game = Game()
    # A 1 on the back row can only step into the empty cells next to it.
    assert sorted(game.valid_movements(0, 10)) == [(1, (1, 10))]


def test_move_sets_die_value_to_distance_and_passes_turn():
    game = Game()
    click(game, 1, 9)
    click(game, 1, 7)
    assert game.grid[1, 7] == 2
    assert game.grid[1, 9] == 0
    assert game.current_player is Player.Black
    assert game.mode is GameMode.Idle


def test_short_move_lowers_die_value():
    game = Game()
    click(game, 1, 9)
    click(game, 1, 8)
    assert game.grid[1, 8] == 1


def test_clicking_selected_die_increments_it():
    game = Game()
    click(game, 1, 9)
    click(game, 1, 9)
    assert game.grid[1, 9] == 3
    assert game.current_player is Player.Black


def test_die_with_six_cannot_be_incremented():
    game = Game()
    game.grid.setitem((1, 9), 6)
    click(game, 1, 9)
    click(game, 1, 9)
    assert game.grid[1, 9] == 6
    assert game.current_player is Player.White
    assert game.mode is GameMode.Idle


def test_cannot_select_opponent_die():
    game = Game()
    click(game, 1, 1)
    assert game.mode is GameMode.Idle


def test_invalid_destination_deselects():
    game = Game()
    click(game, 1, 9)
    click(game, 5, 5)
    assert game.mode is GameMode.Idle
    assert game.current_player is Player.White


def test_reaching_opponent_back_row_wins():
    game = Game()
    game.grid.setitem((5, 3), 3)
    click(game, 5, 3)
    click(game, 5, 0)
    assert game.mode is GameMode.Finished
    assert game.current_player is Player.White


def test_undo_restores_board_and_player():
    game = Game()
    before = game.grid.save()
    click(game, 1, 9)
    click(game, 1, 7)
    game.undo()
    assert game.grid.save() == before
    assert game.current_player is Player.White


def test_take_message_is_cleared_after_reading():
    game = Game()
    game._message = SimpleMsg.RESTART_GAME
    assert game.take_message() is SimpleMsg.RESTART_GAME
    assert game.take_message() is None


def play_opening(game: Game) -> None:
    """White moves (1, 9) -> (1, 7), then Black moves (1, 1) -> (1, 3)."""
    click(game, 1, 9)
    click(game, 1, 7)
    click(game, 1, 1)
    click(game, 1, 3)


def test_undo_gives_turn_back_to_each_player_in_order():
    game = Game()
    play_opening(game)
    game.undo()
    assert game.current_player is Player.Black
    game.undo()
    assert game.current_player is Player.White


def test_undo_winning_move_resumes_the_game():
    game = Game()
    game.grid.setitem((5, 3), 3)
    click(game, 5, 3)
    click(game, 5, 0)
    game.undo()
    assert game.mode is GameMode.Idle
    assert game.current_player is Player.White
    assert game.grid[5, 3] == 3
    assert game.grid[5, 0] == 0


def test_undo_clears_the_selection():
    game = Game()
    click(game, 1, 9)
    click(game, 1, 7)
    click(game, 1, 1)  # Black selects a die, then presses undo
    game.undo()
    assert game.mode is GameMode.Idle


def test_undo_without_history_changes_nothing():
    game = Game()
    before = game.grid.save()
    game.undo()
    assert game.grid.save() == before
    assert game.current_player is Player.White
    assert game.mode is GameMode.Idle


def test_save_and_load_roundtrip_between_games():
    source = Game()
    play_opening(source)
    target = Game()
    target.load(source.save())
    assert target.save() == source.save()


def test_load_replaces_the_board():
    source = Game()
    source.grid.setitem((5, 5), -4)
    game = Game()
    game.load(source.save())
    assert game.grid[5, 5] == -4


def test_load_clears_undo_history():
    loaded = Game().save()
    game = Game()
    play_opening(game)
    game.load(loaded)
    game.undo()
    assert game.save() == loaded


def test_load_clears_the_selection():
    game = Game()
    click(game, 1, 9)
    game.load(Game().save())
    assert game.mode is GameMode.Idle


def test_load_invalid_data_raises_and_keeps_the_game():
    game = Game()
    play_opening(game)
    before = game.save()
    with pytest.raises(ValueError):
        game.load("not a board")
    assert game.save() == before


def test_save_and_load_preserve_whose_turn_it_is():
    source = Game()
    click(source, 1, 9)
    click(source, 1, 7)  # now Black to move
    target = Game()
    target.load(source.save())
    assert target.current_player is Player.Black


def test_load_rejects_board_only_data_and_keeps_the_game():
    game = Game()
    play_opening(game)
    before = game.save()
    with pytest.raises(ValueError):
        game.load(Grid.initial().save())
    assert game.save() == before


def test_save_to_file_and_load_from_file_roundtrip(tmp_path):
    path = tmp_path / "game.save"
    source = Game()
    click(source, 1, 9)
    click(source, 1, 7)
    assert source.save_to_file(path)
    target = Game()
    assert target.load_from_file(path)
    assert target.save() == source.save()


def test_load_from_missing_file_fails_and_keeps_the_game(tmp_path):
    game = Game()
    play_opening(game)
    before = game.save()
    assert not game.load_from_file(tmp_path / "missing.save")
    assert game.save() == before


def test_load_from_invalid_file_fails_and_keeps_the_game(tmp_path):
    path = tmp_path / "game.save"
    path.write_text("garbage")
    game = Game()
    play_opening(game)
    before = game.save()
    assert not game.load_from_file(path)
    assert game.save() == before


def test_save_to_unwritable_path_fails(tmp_path):
    # A directory cannot be written as a file.
    assert not Game().save_to_file(tmp_path)


def test_clicking_another_own_die_switches_the_selection():
    game = Game()
    click(game, 1, 9)
    click(game, 3, 9)
    assert game.mode == GameMode.Selected(3, 9)
    assert game.current_player is Player.White


def test_switching_selection_does_not_change_the_board():
    game = Game()
    before = game.save()
    click(game, 1, 9)
    click(game, 3, 9)
    assert game.save() == before


def lone_die_game() -> Game:
    """White to move with dice at (5, 8) and (7, 5); Black has a 3 at (6, 5)."""
    game = Game()
    game.load("white\n" + Grid().save())
    game.grid.setitem((5, 8), 3)
    game.grid.setitem((7, 5), 2)
    game.grid.setitem((6, 5), -3)
    return game


def test_capturing_the_last_opponent_die_wins():
    game = lone_die_game()
    click(game, 5, 8)
    click(game, 5, 5)
    assert game.mode is GameMode.Finished
    assert game.current_player is Player.White


def test_blocking_every_opponent_play_wins():
    # Black's only die is a 6 in the corner, walled in by white dice: it can
    # neither move nor be incremented.
    game = Game()
    game.load("white\n" + Grid().save())
    game.grid.setitem((0, 0), -6)
    for cell in [(1, 0), (0, 1), (1, 1)]:
        game.grid.setitem(cell, 1)
    game.grid.setitem((5, 8), 1)
    click(game, 5, 8)
    click(game, 5, 7)
    assert game.mode is GameMode.Finished
    assert game.current_player is Player.White


def test_game_goes_on_while_the_opponent_can_play():
    game = lone_die_game()
    click(game, 5, 8)
    click(game, 5, 7)
    assert game.mode is GameMode.Idle
    assert game.current_player is Player.Black


def test_undo_after_winning_by_capture_resumes_the_game():
    game = lone_die_game()
    click(game, 5, 8)
    click(game, 5, 5)
    game.undo()
    assert game.mode is GameMode.Idle
    assert game.current_player is Player.White
    assert game.grid[6, 5] == -3


def test_request_undo_undoes_the_last_play():
    game = Game()
    before = game.save()
    click(game, 1, 9)
    click(game, 1, 7)
    assert game.request_undo(frame=100)
    assert game.save() == before


def test_request_undo_ignores_presses_inside_the_debounce_window():
    game = Game()
    play_opening(game)
    game.request_undo(frame=100)
    after_first = game.save()
    assert not game.request_undo(frame=100 + UNDO_DEBOUNCE_FRAMES - 1)
    assert game.save() == after_first


def test_holding_the_undo_button_undoes_only_once():
    game = Game()
    play_opening(game)
    # Press at frame 100, then pyxel repeats after 16 frames, every 2 frames.
    frames = [100, *range(116, 200, 2)]
    undone = [game.request_undo(frame=frame) for frame in frames]
    assert undone.count(True) == 1


def test_request_undo_works_again_after_a_quiet_period():
    game = Game()
    play_opening(game)
    game.request_undo(frame=100)
    assert game.request_undo(frame=100 + UNDO_DEBOUNCE_FRAMES)
