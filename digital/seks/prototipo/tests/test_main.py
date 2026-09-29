import pytest

from seks.main import parse_args
from seks.themes import THEMES


def test_theme_defaults_to_felt():
    assert parse_args([]).theme is THEMES["felt"]


@pytest.mark.parametrize("name", sorted(THEMES))
def test_theme_option_selects_the_theme(name):
    assert parse_args(["--theme", name]).theme is THEMES[name]


def test_unknown_theme_is_rejected(capsys):
    with pytest.raises(SystemExit):
        parse_args(["--theme", "no-such-theme"])
    assert "no-such-theme" in capsys.readouterr().err
