**Seks** is a two-player abstract strategy game played with dice on an 11×11
board. Every die is a piece whose face tells how far it can travel. Moving
spends that strength, so a player keeps choosing between advancing now and
charging dice up for later. It is built with [Pyxel](https://github.com/kitao/pyxel).

<p align="center">
  <img src="https://raw.githubusercontent.com/fabiommendes/seks/main/assets/screenshots/01-setup.png" width="320" alt="The initial position">
</p>


## Installation

Seks needs Python 3.12 or newer. The easiest way to install the game is as a
standalone tool:

```bash
uv tool install seks    # or: pipx install seks
```

A plain `pip install seks` works too.


## Usage

Start the game with:

```bash
seks
```

`python -m seks` does the same thing. To run it from a clone of this
repository, use `uv run seks`.

| Action                        | Control                                        |
|-------------------------------|------------------------------------------------|
| Select one of your dice       | Left click on it                               |
| Move the selected die         | Left click on a highlighted cell               |
| Increment the selected die    | Left click on it again                         |
| Switch the selection          | Left click on another of your dice             |
| Cancel the selection          | Left click anywhere else                       |
| Undo the last play            | Click the ↺ button in a corner of the screen (at most once per second; holding it undoes a single play) |
| Save / load the board         | `Ctrl+S` / `Ctrl+L` (uses `game.save` in the current directory) |
| Start a new game after a win  | Left click anywhere                            |
| Quit                          | `Esc`                                          |


## Rules

### Setup

The board has 11 columns and 11 rows. Each player starts with 16 dice:

* 6 dice showing **1** on their back row, on every other cell;
* 10 dice showing **2** on the row in front of it, which is full except for the
  center column.

White starts at the bottom of the screen and Black at the top. **White plays
first**, and the players take turns after that.

### Your turn

On your turn, click one of your dice to select it, then do **exactly one** of
the following.

**1. Move.** A die moves in a straight line in any of the 8 directions
(orthogonal or diagonal) by **at most as many cells as its value**. It cannot
jump over other dice or land on an occupied cell. After the move, **the die
shows the number of cells it traveled**: a 4 that moves 2 cells becomes a 2.

When you select a die, every cell it can reach is highlighted, and the number
shown on each cell is the value the die will have if it lands there. The
selected die itself shows a preview of its incremented value (see below).

<p align="center">
  <img src="https://raw.githubusercontent.com/fabiommendes/seks/main/assets/screenshots/02-select.png" width="300" alt="A selected die and its possible moves">
  <img src="https://raw.githubusercontent.com/fabiommendes/seks/main/assets/screenshots/04-move.png" width="300" alt="The die after moving three cells">
</p>

*Left: a white 2 is selected and can move one or two cells. Right: later on,
a white 3 moved three cells forward and still shows 3.*

**2. Increment.** Click the selected die again to add 1 to its value. This uses
up your turn. A die can reach at most **6**. Clicking a selected 6 again only
cancels the selection.

<p align="center">
  <img src="https://raw.githubusercontent.com/fabiommendes/seks/main/assets/screenshots/03-increment.png" width="300" alt="A white die incremented from 2 to 3">
</p>

*White spent its first turn turning a 2 into a 3.*

### Captures

Captures are **custodial**: after you move a die, every enemy die that sits
orthogonally next to the cell where it landed (up, down, left or right) and
has one of your dice directly on its other side is captured and removed from
the board.

* A single move can capture in several directions at once.
* Diagonal neighbors are never captured.
* Only the player who moves captures: moving a die between two enemy dice is
  safe.
* Incrementing a die never captures.

<p align="center">
  <img src="https://raw.githubusercontent.com/fabiommendes/seks/main/assets/screenshots/05-before-capture.png" width="300" alt="Before the capture">
  <img src="https://raw.githubusercontent.com/fabiommendes/seks/main/assets/screenshots/06-capture.png" width="300" alt="After the capture">
</p>

*The black 2 is flanked on its right by a white 3. White moves the other 3
up to the left of the black die and captures it.*

The counters on the left side of the screen show how many dice each player
has lost. The top counter counts White's losses and the bottom one counts
Black's.

### Winning

You win as soon as **one of your dice moves onto the opponent's back row**:
the top row for White, the bottom row for Black.

You also win when, after your play, **your opponent cannot play**: they have
lost every die, or each of their dice is a 6 with no free cell to move to.

<p align="center">
  <img src="https://raw.githubusercontent.com/fabiommendes/seks/main/assets/screenshots/07-before-victory.png" width="300" alt="A white 3 with a free path to the top row">
  <img src="https://raw.githubusercontent.com/fabiommendes/seks/main/assets/screenshots/08-victory.png" width="300" alt="White wins">
</p>

*The center column starts with a gap in the second row. This white 3 uses it
to reach the top row and win.*


## Development

The project uses [uv](https://docs.astral.sh/uv/) and
[taskipy](https://github.com/taskipy/taskipy):

```bash
git clone https://github.com/fabiommendes/seks.git
cd seks
uv sync
uv run task --list
```

The main tasks are `task test`, `task lint`, `task docs`, `task ci` and
`task release`. `task screenshots` plays a scripted game and regenerates the
images in this README. See [CONTRIBUTING.md](https://github.com/fabiommendes/seks/blob/main/CONTRIBUTING.md)
for details.


## About the name

*Seks* means "six" in Danish, Norwegian and Faroese, after the highest face of
a die.


## License

Seks is released under the [MIT License](https://github.com/fabiommendes/seks/blob/main/LICENSE).