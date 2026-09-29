from __future__ import annotations

from pathlib import Path

import pyxel

from .game import Game
from .style import Layout, Style
from .types import SimpleMsg
from .utils import log

#: Pyxel resource file with the game sprites, shipped inside the package.
RESOURCES = Path(__file__).parent / "resources.pyxres"


class App:
    FPS = 20

    def __init__(self):
        self.title: str = "Seks - A dice abstract game"
        self.style = Style()
        self.layout = Layout()
        self.state: Game = self._new_game()

        width, height = self.layout.screen_size
        pyxel.init(width, height, self.title, fps=self.FPS)

        pyxel.load(str(RESOURCES))
        pyxel.mouse(True)

    def draw(self):
        pyxel.cls(self.style.screen_color)
        self.state.draw_all()

    def update(self):
        self.state.update_all()
        match self.state.take_message():
            case SimpleMsg.RESTART_GAME:
                log.info("Restarting the game")
                self.state = self._new_game()
            case SimpleMsg.QUIT:
                pyxel.quit()

    def run(self):
        pyxel.run(self.update, self.draw)

    def _new_game(self) -> Game:
        return Game(style=self.style, layout=self.layout)
