# Time Attack MMO — Scaffold Design

**Date:** 2026-07-01
**Status:** Approved
**Scope:** Framework scaffold + one playable "walking skeleton" slice for a single-player, old-school-MMO-style RPG (TS + React, frontend-only), architected to extend into a networked MMO later.

---

## 1. Goals & constraints

- **Now:** frontend-only TS + React prototype at a fixed **1920×1080** design resolution.
- **Later:** extensible into a real MMO — so the simulation must be a pure, framework-agnostic reducer that could run server-authoritative unchanged.
- **Feel:** fast, real-time, roguelite-ish combat; symmetric player/enemy stats so a same-level 1v1 is ~50/50; the fun is in grinding/questing ~5 levels below you.

### Decisions locked during brainstorming
| Fork | Decision |
| --- | --- |
| World rendering | **PixiJS v8** (WebGL) for the world; **React** for all menu/UI screens |
| Simulation architecture | **Pure sim/view split** + lightweight stores (Zustand) |
| Initial scaffold scope | **Walking skeleton** — one genuinely playable screen, rest are stubs |
| Placeholder art | **Emoji** on colored 64×64 tiles |

---

## 2. Stack & tooling

- **Vite + React 18 + TypeScript (strict)**
- **PixiJS v8** mounted via a thin *imperative* wrapper (`<PixiStage>` owns the `Application` and runs a render-from-sim loop). Deliberately **not** using `@pixi/react`'s reconciler — imperative rendering keeps the sim/view boundary clean.
- **Zustand** for reactive UI state + the screen/scene machine (no react-router — a game is a scene state machine, not URLs).
- **Vitest** for unit tests; the pure engine is the primary TDD surface.
- **ESLint / Prettier**, TS strict, plus an **import-boundary rule** forbidding `engine/`, `types.ts`, `config.ts`, and `data.ts` from importing React or Pixi. That single rule is what keeps the MMO-extraction path open.

---

## 3. Project layout

Fixed, well-known files the user prefers (`types.ts` / `config.ts` / `data.ts`), around a pure `engine/`:

```
src/
  types.ts             # most shared types (Entity, CombatGroup, Skill, JobNode, Cell, WorldState…)
  types-rendering.ts   # (split out when >~200 LOC) Pixi/render-facing types — engine never imports this
  config.ts            # dev-tweakable params + PURE formulas: stat(level,growth), damage calc,
                       #   COMBAT_TICK_MS=1500, CELL_PX=64, DESIGN_W=1920, DESIGN_H=1080…
  data.ts              # content: class DAG, skill defs, enemy defs, map/tile metadata (→ JSON later)
  engine/              # PURE logic. imports only types.ts/config.ts/data.ts. NO React, NO Pixi.
    grid.ts            #   cell coords, tile map, occupancy, collision
    entities.ts        #   entity construction, symmetric stat model
    jobs.ts            #   job DAG traversal + "mixing" unlock resolution
    skills.ts          #   shape resolution, uses/cooldown bookkeeping
    combat.ts          #   combat groups (sticky blocks) + 1.5s tick resolution
    world.ts           #   tick(state, inputs, dt) -> state   (top-level reducer)
    index.ts
    __tests__/         #   Vitest specs
  state/store.ts       # Zustand: scene machine + bridge between engine state and React
  render/
    PixiStage.tsx      #   React wrapper: mounts Pixi App, runs render loop
    WorldRenderer.ts   #   imperative: draws grid/entities/combat from engine state
    hud/               #   square skill-timer, hotkey bar (React overlay on the canvas)
  screens/             # 7 screens; DungeonScreen is the playable one
    WorldMapScreen.tsx
    DungeonScreen.tsx
    ShopScreen.tsx
    SkillAllocationScreen.tsx
    CharacterCreationScreen.tsx
    HotkeyConfigScreen.tsx
    NpcChatScreen.tsx
  ui/                  # shared React primitives (design system placeholders)
  app/
    App.tsx            #   scene router
    GameLoop.ts        #   fixed-timestep driver
    main.tsx
```

**Separation of concerns:** `types.ts` = shapes, `data.ts` = content/instances, `config.ts` = tunables + pure formulas, `engine/*.ts` = behavior. One Vite app with an isolated `engine/` (not a monorepo yet); extraction into a shared package later is cheap because of the import-boundary rule.

---

## 4. Core simulation model

The engine is a **pure reducer**: `tick(state: WorldState, inputs: Input[], dt: number) -> WorldState`. This signature is the entire MMO hedge — later it runs server-authoritative with clients sending `inputs`.

### Grid & movement
- Integer cell coordinates; a tile map of floor/wall.
- Arrow key → attempt to move **1 cell** in that direction. Blocked by walls and by enemy occupancy.
- **No speed limit** = no movement cooldown; one cell per keypress.
- Players (and allies) may pass through each other; **enemies can never overlap**.

### Sticky-block combat
- Moving into an enemy does **not** move you — it *sticks*. A `CombatGroup` is a rigid body: a set of members at relative cell offsets (touch an enemy on your left → a 2×1 group).
- Pressing arrows translates the **whole group** (collision-checked against walls/other occupancy).
- Touching more enemies adds them to the group → fights of arbitrary size/shape.
- Other players/allies join a fight by moving into the group.

### Combat tick
- A fixed accumulator fires every **`COMBAT_TICK_MS` (1500ms)**; each member auto-casts its active skill.
- A skill's `shape: Offset[]` is resolved against the group's layout to select targets; `config.ts` damage formula applies.
- The on-screen **square timer** is a visualization of that accumulator (0 → 1).

### Skills
```ts
type Skill = {
  id: SkillId; name: string;
  shape: Offset[];            // relative cells hit (e.g. 3×1 row)
  power: number;
  uses?: number;              // limited uses before cooldown
  cooldownMs: number;
  cooldownType: 'passive' | 'active'; // passive ticks always; active only while selected
};
```
- Hotkeys **1–9** set the active skill.

### Jobs / classes
- A **DAG** of job nodes. Each node has `requires: JobId[]` — "mixing" is a node with two parents (e.g. *flame ranger* requires *ranger* **and** *fire wizard*).
- Character tracks attained jobs + current job; stats derive from job growth + level + allocations.

### Symmetric stats
- One shared formula `stat(level, jobGrowth)` in `config.ts`, used for **both** players and enemies, so a same-level 1v1 is ~50/50 by construction; hunting ~5 levels down is the intended fun grind.

---

## 5. Game loop & display

- **Fixed-timestep sim** (~50ms tick) drives combat timers, cooldowns, and 2–3 frame animation cycling; Pixi renders at rAF.
- Fixed **1920×1080** design stage, CSS scale-to-fit with letterbox → correct on any monitor.
- Placeholder entities: **emoji** on colored 64×64 cells (🐀 "Rat Lv5"), swappable for real sprite sheets later.

---

## 6. Walking-skeleton scope (what actually runs)

- **`DungeonScreen` — playable:** 3-player party placeholder, arrow-key grid movement, walk into an emoji enemy → sticky-block forms → auto-combat with the square timer → HP ticks down → hotkeys 1–9 swap the active skill.
- **Other 6 screens — navigable stubs:** world map, shop, skill/attribute allocation, character creation, hotkey config, NPC chat + quest — layout placeholders only.
- **Vitest specs** covering: movement/collision, sticking, group translation, shape-based targeting, cooldown/uses bookkeeping, and job-unlock (mixing) logic.

---

## 7. Explicit non-goals (YAGNI for this scaffold)

- No networking/server, no persistence, no real art, no audio.
- No balancing pass beyond the symmetric-stat formula existing and being unit-testable.
- No monorepo/workspace split yet — deferred behind the import-boundary rule.
- Non-dungeon screens carry no real game logic yet.
