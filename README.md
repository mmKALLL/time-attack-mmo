# Time Attack MMO

MMO-like single player RPG experience with speedy and unique real time combat mechanics.

## Running the prototype

```
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (Vitest)
npm run typecheck
npm run build      # typecheck + production bundle
```

**Controls (Dungeon screen):** arrow keys move one cell per press; walk into an
enemy to start sticky-block combat; keys **1–9** switch the active skill. The
top-right nav jumps between screens (only the Dungeon is playable so far).

## Architecture

A pure, framework-agnostic simulation lives under `src/engine/` as a reducer
`tick(state, inputs, dt) -> state`, importing only the fixed data files. An
ESLint rule forbids `engine/` + `types.ts`/`config.ts`/`data.ts` from importing
React or Pixi — that boundary is what keeps the future MMO (server-authoritative
`tick`) extraction cheap.

```
src/
  types.ts        shared types
  config.ts       tunables + stat/damage formulas + Emberdeep color tokens
  data.ts         content: class DAG, named skills, monsters, party, maps
  engine/         pure sim: grid, entities, jobs, skills, combat, world (tick)
  state/store.ts  Zustand scene machine + engine bridge
  app/            GameLoop (fixed timestep) + App scene router
  render/         PixiStage + WorldRenderer + sprites.js (vendored) + hud/
  screens/        DungeonScreen (playable) + 6 stubs
  ui/             shared React primitives
```

Design + implementation notes live in `docs/plans/`; the visual/data source of
truth is the combat & class handoff in `docs/design_handoff_combat_and_classes/`
(Direction A "Emberdeep").
