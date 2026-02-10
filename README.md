# Bikegame: Draft & Sprint

A browser-based cycling road racing game focused on realistic racecraft:

- **Drafting** behind opponents to conserve and recover stamina.
- **Collecting water bottles** to build sprint strength.
- **Timing your sprint** and attacks across wind and hill sectors.

## How to play

Open `index.html` in a modern browser.

### Controls

- `↑` / `W`: Increase effort
- `↓` / `S`: Decrease effort
- `←` / `A`: Move left
- `→` / `D`: Move right
- `Space`: Trigger sprint (uses sprint strength)
- `R`: Restart after race end

## Core mechanics

- **Effort** drives speed, but higher effort burns more stamina.
- **Stamina** impacts your maximum sustainable speed.
- **Drafting** occurs when you ride closely behind another rider in-lane:
  - sharply reduced stamina drain
  - slight stamina recovery
  - slipstream speed gain
- **Water bottles** increase your **Sprint Strength** reserve.
- **Sprint Strength** fuels short, powerful bursts with `Space`.
- **Terrain & weather sectors**:
  - **Headwind** sectors increase energy cost.
  - **Climb** sectors increase stamina drain and reduce speed.

## Winning

Reach the finish line ahead of the AI riders. Balance pacing, drafting, and sprint timing to place well.
