"""
Color themes.

Pyxel draws with a 16-color palette and the game sprites refer to palette
indices, so a theme recolors the whole game by assigning a color to each index
that has a role in it.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, fields

import pyxel

#: Palette index of each role. The sprites in resources.pyxres use indices 0, 1,
#: 2, 7, 10 and 15; Style picks the others.
ROLE_INDEX: dict[str, int] = {
    "black_die": 0,  # also text and overlays
    "white_pips": 1,  # also the fill of move hints
    "black_selected": 2,
    "accent": 3,  # turn banner and selection highlight
    "screen": 5,
    "screen_text": 6,
    "white_die": 7,  # also the numbers of move hints
    "board": 8,
    "cell_border": 9,
    "black_pips": 10,  # also the undo icon
    "cell": 14,
    "white_selected": 15,
}

#: Name of the theme used when none is given.
DEFAULT_THEME = "felt"


@dataclass(frozen=True)
class Theme:
    """
    Colors of each role in the game, as 0xRRGGBB integers.
    """

    board: int
    cell: int
    cell_border: int
    white_die: int
    white_pips: int
    white_selected: int
    black_die: int
    black_pips: int
    black_selected: int
    accent: int
    screen: int
    screen_text: int

    def palette(self, base: Sequence[int]) -> list[int]:
        """
        Return a copy of the 16-color base palette with the theme colors
        assigned to their role indices.
        """
        colors = list(base)
        for field in fields(self):
            colors[ROLE_INDEX[field.name]] = getattr(self, field.name)
        return colors

    def apply(self) -> None:
        """
        Install the theme in Pyxel's palette. Call it after pyxel.init().
        """
        pyxel.colors[:] = self.palette(list(pyxel.colors))


#: Available themes, by name.
THEMES: dict[str, Theme] = {
    # Green casino felt with ivory dice.
    "felt": Theme(
        board=0x1E5E40,
        cell=0x2E7D55,
        cell_border=0x286E4B,
        white_die=0xF4F1E8,
        white_pips=0x8B1E22,
        white_selected=0xFFF1B0,
        black_die=0x141414,
        black_pips=0xE3B341,
        black_selected=0x3E3E3E,
        accent=0xE3B341,
        screen=0xF4F1E8,
        screen_text=0x141414,
    ),
    # The original colors of the game.
    "classic": Theme(
        board=0xD4186C,
        cell=0xFF9798,
        cell_border=0xD38441,
        white_die=0xEEEEEE,
        white_pips=0x2B335F,
        white_selected=0xEDC7B0,
        black_die=0x000000,
        black_pips=0xE9C35B,
        black_selected=0x7E2072,
        accent=0xD4186C,
        screen=0xEEEEEE,
        screen_text=0x000000,
    ),
    # A walnut board with maple cells.
    "wood": Theme(
        board=0x7A4B2A,
        cell=0xE6C89A,
        cell_border=0xC9A06E,
        white_die=0xF6F0E4,
        white_pips=0xB5462F,
        white_selected=0xFFE3A3,
        black_die=0x1E1A17,
        black_pips=0xE6C89A,
        black_selected=0x5A4030,
        accent=0xF2A541,
        screen=0xF6F0E4,
        screen_text=0x1E1A17,
    ),
    # Cobalt blue and white tiles.
    "azulejo": Theme(
        board=0x1F4E8C,
        cell=0xDCE7F3,
        cell_border=0x9DB8D6,
        white_die=0xFFFFFF,
        white_pips=0x2F7FC1,
        white_selected=0xFFF1B8,
        black_die=0x1B2433,
        black_pips=0xF2C14E,
        black_selected=0x34507A,
        accent=0xF2C14E,
        screen=0xFFFFFF,
        screen_text=0x1B2433,
    ),
    # Quiet warm grays.
    "paper": Theme(
        board=0xB9B1A3,
        cell=0xEDE8DD,
        cell_border=0xD6CFC1,
        white_die=0xFFFFFF,
        white_pips=0x4A6FA5,
        white_selected=0xFFE08A,
        black_die=0x2A2724,
        black_pips=0xF3EFE6,
        black_selected=0x5C5246,
        accent=0xD9534F,
        screen=0xFFFFFF,
        screen_text=0x2A2724,
    ),
    # https://www.nordtheme.com
    "nord": Theme(
        board=0x2E3440,
        cell=0x434C5E,
        cell_border=0x4C566A,
        white_die=0xECEFF4,
        white_pips=0x5E81AC,
        white_selected=0xEBCB8B,
        black_die=0x1F232B,
        black_pips=0x88C0D0,
        black_selected=0x3B4252,
        accent=0x88C0D0,
        screen=0x242933,
        screen_text=0xECEFF4,
    ),
    # https://catppuccin.com (Mocha flavor)
    "catppuccin-mocha": Theme(
        board=0x1E1E2E,
        cell=0x313244,
        cell_border=0x45475A,
        white_die=0xCDD6F4,
        white_pips=0x1E66F5,
        white_selected=0xF9E2AF,
        black_die=0x11111B,
        black_pips=0xFAB387,
        black_selected=0x585B70,
        accent=0xCBA6F7,
        screen=0x181825,
        screen_text=0xCDD6F4,
    ),
    # https://catppuccin.com (Latte flavor)
    "catppuccin-latte": Theme(
        board=0xBCC0CC,
        cell=0xE6E9EF,
        cell_border=0xCCD0DA,
        white_die=0xFFFFFF,
        white_pips=0x1E66F5,
        white_selected=0xF9E2AF,
        black_die=0x4C4F69,
        black_pips=0xF9E2AF,
        black_selected=0x6C6F85,
        accent=0xCBA6F7,
        screen=0xEFF1F5,
        screen_text=0x4C4F69,
    ),
    # https://draculatheme.com
    "dracula": Theme(
        board=0x282A36,
        cell=0x44475A,
        cell_border=0x6272A4,
        white_die=0xF8F8F2,
        white_pips=0x6272A4,
        white_selected=0xF1FA8C,
        black_die=0x191A21,
        black_pips=0xBD93F9,
        black_selected=0x5A3E8E,
        accent=0xFF79C6,
        screen=0x21222C,
        screen_text=0xF8F8F2,
    ),
    # https://github.com/morhetz/gruvbox (dark)
    "gruvbox": Theme(
        board=0x282828,
        cell=0x3C3836,
        cell_border=0x504945,
        white_die=0xEBDBB2,
        white_pips=0xAF3A03,
        white_selected=0xFABD2F,
        black_die=0x1D2021,
        black_pips=0xFABD2F,
        black_selected=0x665C54,
        accent=0x8EC07C,
        screen=0x1D2021,
        screen_text=0xEBDBB2,
    ),
    # https://ethanschoonover.com/solarized (light)
    "solarized": Theme(
        board=0x93A1A1,
        cell=0xEEE8D5,
        cell_border=0xD8D2BF,
        white_die=0xFDF6E3,
        white_pips=0x268BD2,
        white_selected=0xF5DCA0,
        black_die=0x073642,
        black_pips=0xEEE8D5,
        black_selected=0x586E75,
        accent=0xB58900,
        screen=0xFDF6E3,
        screen_text=0x586E75,
    ),
    # https://github.com/folke/tokyonight.nvim
    "tokyo-night": Theme(
        board=0x1A1B26,
        cell=0x292E42,
        cell_border=0x414868,
        white_die=0xC0CAF5,
        white_pips=0x3D59A1,
        white_selected=0xE0AF68,
        black_die=0x101014,
        black_pips=0xFF9E64,
        black_selected=0x565F89,
        accent=0xBB9AF7,
        screen=0x16161E,
        screen_text=0xC0CAF5,
    ),
    # https://rosepinetheme.com
    "rose-pine": Theme(
        board=0x1F1D2E,
        cell=0x403D52,
        cell_border=0x524F67,
        white_die=0xE0DEF4,
        white_pips=0x31748F,
        white_selected=0xF6C177,
        black_die=0x12101A,
        black_pips=0xEBBCBA,
        black_selected=0x6E6A86,
        accent=0xEB6F92,
        screen=0x191724,
        screen_text=0xE0DEF4,
    ),
}
