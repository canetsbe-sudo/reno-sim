# Reno Sim

A cozy renovation game for the browser. Pick a tired old house, clear it out, deal with whatever is hiding in the walls, design every finish, and watch the crew bring it to life.

Play it at https://canetsbe-sudo.github.io/reno-sim/ (published from `main`).

## Branches

- `dev` is where new work lands. Pull requests target `dev`, and every change to it is published to the preview at https://canetsbe-sudo.github.io/reno-sim/dev/ (it keeps a separate save from the main game).
- `main` is the stable game. When dev looks good, open a pull request from `dev` into `main` and merge it to promote everything at once.

## What's in this version

The kitchen, end to end:

1. **Clear it out**: haul junk, demo the old kitchen, rip up the floor, strip the walls.
2. **Fix it up**: handle what you found. A proper fix costs more; a patch is cheaper but can come back during the build.
3. **Design it**: floors, walls, windows, cabinets, counters, furniture, big upgrades, and lighting mood.
4. **Build**: every choice costs materials plus crew days. The crew may call with surprises.
5. **Reveal**: before/after slider, cozy rating, and coins.

Four starting scenarios (Grandma's house, Neglected fixer, Mid-century gem, Coastal style challenge) and two modes (Budget and Freedom).

Controls: click to place, `R` to rotate (arrows show which way the front faces), `Q`/`E` or the ⟲ ⟳ buttons to turn the room and build against any wall, `Delete` to remove, `Esc` to stop placing, `Ctrl+Z` to undo.

## Development

```sh
npm install
npm run dev     # local dev server
npm test        # game rules tests
npm run build   # production build in dist/
```

Code layout:

- `src/data.ts`: finishes, furniture, hidden issues, scenarios
- `src/state.ts`: game state and rules (no DOM, covered by `tests/`)
- `src/render.ts`: isometric canvas renderer
- `src/main.ts`: UI panels and input
