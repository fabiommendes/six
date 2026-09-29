from types import SimpleNamespace

import pytest

import seks.renderer
from seks.renderer import Renderer
from seks.style import Layout, Style
from seks.types import Player


@pytest.fixture
def rects(monkeypatch):
    """Replace pyxel in the renderer by a fake that records drawn rectangles."""
    drawn: list[tuple[int, int, int, int]] = []
    fake = SimpleNamespace(
        COLOR_BLACK=0,
        rect=lambda x, y, w, h, col: drawn.append((x, y, w, h)),
        blt=lambda *args, **kwargs: None,
        dither=lambda alpha: None,
    )
    monkeypatch.setattr(seks.renderer, "pyxel", fake)
    return drawn


def test_victory_screen_draws_only_inside_the_board(rects):
    layout = Layout()
    Renderer(layout, Style()).render_victory_screen(Player.White)
    x0, y0 = layout.board_origin
    size = layout.board_size
    assert rects
    for x, y, w, h in rects:
        assert x0 <= x and x + w <= x0 + size
        assert y0 <= y and y + h <= y0 + size


def test_victory_banner_is_vertically_centered_on_the_board(rects):
    layout = Layout()
    Renderer(layout, Style()).render_victory_screen(Player.Black)
    _, y0 = layout.board_origin
    banner = min(rects, key=lambda r: r[2] * r[3])
    _, y, _, h = banner
    assert abs((y + h / 2) - (y0 + layout.board_size / 2)) <= 1
