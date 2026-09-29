from collections.abc import Iterable
from dataclasses import dataclass

import pyxel

from .grid import Cell, Grid
from .style import Layout, Style
from .types import Coord, Player


@dataclass
class Renderer:
    layout: Layout
    style: Style

    def render_board(self, grid: Grid):
        size = self.layout.board_size
        x0, y0 = self.layout.board_origin
        pyxel.rect(x0, y0, size, size, self.style.background)

        for i in range(11):
            for j in range(11):
                cell = grid[i, j]
                x, y = self.layout.screen_coord(i, j)

                # Draw empty cells
                if cell == 0:
                    pyxel.rect(x, y, 16, 16, self.style.empty_cell)
                    pyxel.rectb(x, y, 16, 16, self.style.empty_cell_border)
                    for xx, yy in [(x, y), (x + 15, y), (x, y + 15), (x + 15, y + 15)]:
                        pyxel.pset(xx, yy, self.style.background)
                    continue

                # Draw dice
                player = Player.White if cell > 0 else Player.Black
                img_x = (abs(cell) - 1) * 16
                img_y = self._dice_y(player)
                # img_x = min(abs(cell), 5) * 16
                # img_y = self._dice_y(player, selected=True)
                pyxel.blt(x, y, 0, img_x, img_y, 16, 16, self.style.transparent)

    def render_selected_dice(
        self,
        cell: Cell,
        coord: Coord,
        valid_movements: Iterable[tuple[Cell, Coord]],
    ):
        (i, j) = coord
        x, y = self.layout.screen_coord(i, j)

        # Draw dice
        player = Player.White if cell > 0 else Player.Black
        img_x = min(abs(cell), 5) * 16
        img_y = self._dice_y(player, selected=True)
        pyxel.blt(x, y, 0, img_x, img_y, 16, 16, self.style.transparent)

        cols = [self.style.empty_cell, self.style.accent]
        for k in range((pyxel.frame_count // 3) % 3):
            pyxel.rectb(x - k, y - k, 16 + 2 * k, 16 + 2 * k, cols[k])

        # Display valid movements
        for num, (i, j) in valid_movements:
            x, y = self.layout.screen_coord(i, j)
            img_x = (abs(num) - 1) * 16
            img_y = 64
            pyxel.blt(x, y, 0, img_x, img_y, 16, 16, self.style.transparent)

    def render_victory_screen(
        self,
        current_player: Player,
    ):
        size = self.layout.board_size
        x0, y0 = self.layout.board_origin
        pyxel.dither(0.15)
        pyxel.rect(x0, y0, size, size, pyxel.COLOR_BLACK)
        pyxel.dither(1.0)
        width = 96
        pyxel.rect(
            size // 2 - width // 2 + x0 - 5,
            y0 + size // 2 - 13,
            width + 10,
            26,
            pyxel.COLOR_BLACK,
        )
        pyxel.blt(
            size // 2 - width // 2 + x0,
            y0 + size // 2 - 8,
            0,
            0,
            80 if current_player == Player.White else 96,
            width,
            16,
        )

    def render_current_player_overlay(self, player: Player):
        _, height = self.layout.screen_size

        if player == Player.White:
            msg = "White's Turn"
            y = (
                height
                - self.layout.interface_margin
                - 16
                + (pyxel.FONT_HEIGHT + 6) // 2
            )
        else:
            msg = "Black's Turn"
            y = self.layout.interface_margin + (pyxel.FONT_HEIGHT + 6) // 2

        n = len(msg)
        x = self.layout.board_size // 2 - (n // 2) * pyxel.FONT_WIDTH
        pyxel.rect(
            x - 4,
            y - 3,
            n * pyxel.FONT_WIDTH + 8,
            pyxel.FONT_HEIGHT + 6,
            self.style.accent,
        )
        pyxel.rect(
            x - 3,
            y - 2,
            n * pyxel.FONT_WIDTH + 6,
            pyxel.FONT_HEIGHT + 4,
            pyxel.COLOR_BLACK,
        )
        pyxel.text(x, y, msg.upper(), self.style.accent)

    def render_captured_dice(self, grid: Grid):
        x0, _ = self.layout.board_origin
        n_white, n_black = grid.count_pieces()

        pyxel.blt(x0, x0, 0, 0, 0, 16, 16, pyxel.COLOR_GRAY)
        pyxel.blt(x0, 273, 0, 0, 32, 16, 16, pyxel.COLOR_GRAY)

        pyxel.text(23, 10, f"X {16 - n_white}", self.style.screen_text)
        pyxel.text(23, 279, f"X {16 - n_black}", self.style.screen_text)

    def _dice_y(self, player: Player, selected=False) -> int:
        delta = 16 if selected else 0
        if player == Player.White:
            return 0 + delta
        else:
            return 32 + delta
