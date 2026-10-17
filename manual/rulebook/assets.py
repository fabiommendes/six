"""Copy the stylesheets into build/site/assets/ and write the palette as CSS.

No fonts yet: the manual uses system fonts until the visual identity picks
fonts with a commercial license (dev/rfc/identidade-visual.md).
"""

import shutil

from . import palette, paths


def build() -> None:
    css = paths.ASSETS / "css"
    shutil.copytree(paths.STYLES, css, dirs_exist_ok=True)
    (css / "cores.css").write_text(palette.css(), encoding="utf-8")
