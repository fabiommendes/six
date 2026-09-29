# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-29

### Added

- First public release on PyPI, with a `seks` command to start the game.
- Rules manual with screenshots in the README.
- Test suite, linting, type checking and CI on GitHub Actions.

### Fixed

- A die now wins when it reaches the opponent's back row instead of its own.
- A winning move now ends the game and shows the victory screen.
- Clicking after a victory starts a new game.
- Undoing a move that captured dice no longer crashes.
- The victory screen no longer crashes when it is drawn.
- Clicking a selected die that already shows 6 now cancels the selection.
- Game sprites load from the installed package, not from the working directory.
- Clicking the board margin no longer selects a die on the opposite edge, and
  the first gutter pixel after a cell no longer counts as part of the cell.
- A die on the board edge no longer captures dice on the opposite edge.
- Undo gives the turn back to the player who made the play, also after a
  winning move, and clears the current selection.
- Loading a board (`Ctrl+L`) clears the undo history, and an invalid save file
  is rejected with a warning instead of crashing the game.
- The victory screen overlay stays inside the board and its banner is centered.
- Save files also record whose turn it is, so loading a game restores the
  player to move. Files that only contain the board are rejected.
- Errors while reading or writing the save file are logged instead of closing
  the game.
- A player who cannot play (no dice left, or only blocked 6s) now loses,
  instead of the game getting stuck.
- Holding the undo button no longer undoes several plays in a row: presses
  less than one second apart are ignored.

### Changed

- With a die selected, clicking another of your dice now selects it instead
  of cancelling the selection.

[Unreleased]: https://github.com/fabiommendes/seks/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/fabiommendes/seks/releases/tag/v0.1.0
