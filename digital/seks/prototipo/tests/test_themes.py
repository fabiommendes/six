import pytest

from seks.themes import DEFAULT_THEME, ROLE_INDEX, THEMES, Theme

ROLES = [
    "board",
    "cell",
    "cell_border",
    "white_die",
    "white_pips",
    "white_selected",
    "black_die",
    "black_pips",
    "black_selected",
    "accent",
    "screen",
    "screen_text",
]

# Sprites in resources.pyxres draw with these indices, so their roles are fixed.
SPRITE_INDICES = {
    "black_die": 0,
    "white_pips": 1,
    "black_selected": 2,
    "white_die": 7,
    "black_pips": 10,
    "white_selected": 15,
}

# Index 13 is the transparent color key of every sprite.
TRANSPARENT = 13


def luminance(color: int) -> float:
    """WCAG relative luminance of a 0xRRGGBB color."""

    def channel(c: int) -> float:
        x = c / 255
        return x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4

    r, g, b = (color >> 16) & 0xFF, (color >> 8) & 0xFF, color & 0xFF
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(a: int, b: int) -> float:
    """WCAG contrast ratio between two colors, from 1 to 21."""
    la, lb = sorted([luminance(a), luminance(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def test_contrast_helper():
    assert contrast(0x000000, 0xFFFFFF) == pytest.approx(21)
    assert contrast(0x777777, 0x777777) == pytest.approx(1)


def test_default_theme_is_felt():
    assert DEFAULT_THEME == "felt"
    assert DEFAULT_THEME in THEMES


def test_classic_theme_keeps_the_original_colors():
    classic = THEMES["classic"]
    assert classic.board == 0xD4186C
    assert classic.cell == 0xFF9798
    assert classic.white_die == 0xEEEEEE
    assert classic.black_die == 0x000000


def test_every_role_has_its_own_palette_index():
    assert sorted(ROLE_INDEX) == sorted(ROLES)
    indices = list(ROLE_INDEX.values())
    assert len(set(indices)) == len(indices)
    assert TRANSPARENT not in indices
    assert all(0 <= i < 16 for i in indices)


def test_sprite_roles_use_the_sprite_indices():
    assert {role: ROLE_INDEX[role] for role in SPRITE_INDICES} == SPRITE_INDICES


def test_palette_assigns_role_colors_and_keeps_other_indices():
    base = list(range(100, 116))
    theme = Theme(**{role: n for n, role in enumerate(ROLES)})
    palette = theme.palette(base)
    expected = list(base)
    for n, role in enumerate(ROLES):
        expected[ROLE_INDEX[role]] = n
    assert palette == expected
    assert base == list(range(100, 116))  # the base palette is not modified


# Readability rules every theme must follow: (role, role, minimum contrast).
READABILITY = [
    ("white_pips", "white_die", 3.0),  # pips and move hint numbers
    ("black_pips", "black_die", 3.0),
    ("white_pips", "white_selected", 2.5),  # pips of a selected white die
    ("black_pips", "black_selected", 2.0),
    ("accent", "black_die", 3.0),  # turn banner text
    ("screen_text", "screen", 4.5),  # captured dice counters
    ("white_die", "black_die", 4.5),  # the two armies
    ("white_pips", "black_die", 1.5),  # move hints vs black dice
    ("white_pips", "cell", 1.5),  # move hints vs empty cells
    ("cell", "board", 1.2),  # the grid is visible
]


@pytest.mark.parametrize("name", sorted(THEMES))
@pytest.mark.parametrize(("role_a", "role_b", "minimum"), READABILITY)
def test_theme_is_readable(name, role_a, role_b, minimum):
    theme = THEMES[name]
    a, b = getattr(theme, role_a), getattr(theme, role_b)
    assert contrast(a, b) >= minimum, f"{name}: {role_a} vs {role_b}"


@pytest.mark.parametrize("name", sorted(THEMES))
def test_theme_colors_are_24_bit(name):
    theme = THEMES[name]
    assert all(0 <= getattr(theme, role) <= 0xFFFFFF for role in ROLES)
