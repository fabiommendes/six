"""
Play a short scripted game and save screenshots used in the README.

The moves go through the same click handler used by the mouse, so the images
always reflect the real rules. Run it with ``task screenshots`` (it needs a
display; on a headless machine use ``xvfb-run -a task screenshots``).
"""

from pathlib import Path

import pyxel

from seks.app import App
from seks.game import Game
from seks.types import GameMode

OUTPUT_DIR = Path(__file__).parent.parent / "assets" / "screenshots"
SCALE = 2

# Each step is (player, cells clicked, screenshot name or None). The screenshot
# is taken after the clicks.
SCRIPT: list[tuple[str, list[tuple[int, int]], str | None]] = [
    ("white", [], "01-setup"),
    ("white", [(3, 9)], "02-select"),
    ("white", [(3, 9)], "03-increment"),
    ("black", [(4, 1), (4, 3)], None),
    ("white", [(3, 9), (3, 6)], "04-move"),
    ("black", [(0, 1), (0, 3)], None),
    ("white", [(8, 9), (8, 9)], None),
    ("black", [(10, 1), (10, 3)], None),
    ("white", [(8, 9), (8, 6)], None),
    ("black", [(9, 1), (9, 2)], None),
    ("white", [(8, 6), (5, 3)], None),
    ("black", [(0, 3), (0, 5)], None),
    ("white", [(3, 6)], "05-before-capture"),
    ("white", [(3, 3)], "06-capture"),
    ("black", [(10, 3), (10, 5)], None),
    ("white", [(5, 3)], "07-before-victory"),
    ("white", [(5, 0)], "08-victory"),
]


def click(game: Game, i: int, j: int) -> None:
    game.click_cell(i, j)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    app = App()
    game = app.state

    for player, cells, name in SCRIPT:
        assert game.current_player.value == player, (player, cells)
        for cell in cells:
            click(game, *cell)
        if name is not None:
            app.draw()
            pyxel.screen.save(str(OUTPUT_DIR / name), SCALE)
            print(f"saved {name}.png")

    assert game.mode is GameMode.Finished, "the scripted game should end in a win"


if __name__ == "__main__":
    main()
