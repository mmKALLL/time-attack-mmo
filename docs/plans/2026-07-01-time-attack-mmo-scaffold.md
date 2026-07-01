# Time Attack MMO — Scaffold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up a TS + React (PixiJS world + React UI) frontend-only prototype with a pure, testable simulation engine and one genuinely playable "walking skeleton" dungeon slice, architected to extend into a networked MMO later.

**Architecture:** A pure, framework-agnostic engine (`tick(state, inputs, dt) -> state`) lives under `src/engine/` and imports only `types.ts` / `config.ts` / `data.ts` — never React or Pixi. A Zustand store bridges engine state to React; a fixed-timestep game loop drives it. PixiJS renders the world imperatively from engine state; React renders all menus/HUD. Design resolution is a fixed 1920×1080 stage, CSS scale-to-fit.

**Tech Stack:** Vite, React 18, TypeScript (strict), PixiJS v8, Zustand v5, Vitest + Testing Library, ESLint (with an import-boundary rule) + Prettier.

---

## Conventions (read once, apply everywhere)

- **Fixed files:** `src/types.ts` (shared types), `src/config.ts` (tunables + pure formulas), `src/data.ts` (content: jobs/skills/enemies/maps). Split a group into `types-<domain>.ts` only when it passes ~200 LOC. These four keep the engine pure — **they must never import React or Pixi.**
- **Immutability boundary:** Pure *query* helpers (grid math, targeting, `isAlive`) never mutate. *Command* helpers (`moveOrStick`, `advanceCombat`, `stick`) mutate a `WorldState` **in place**. The only place that clones is `tick()`, which does `structuredClone(state)` once, runs commands against the copy, and returns it. So callers never observe mutation, but internal code stays simple. Tests of command helpers may build a state and assert on the mutated object directly.
- **Determinism:** No `Math.random`, no `Date.now` in the engine. All ids come from a monotonic `WorldState.seq` counter. (This is what makes server-authoritative replay possible later.)
- **TDD:** engine tasks are test-first. Run the test, watch it fail, implement minimally, watch it pass, commit. View/tooling tasks verify via typecheck / dev-server smoke instead of unit tests.
- **Commits:** one per task (or per green test cluster). Conventional-commit prefixes.

## Task overview

1. Project bootstrap (Vite + TS + Vitest + ESLint boundaries)
2. `types.ts` + `config.ts` (stat/damage formulas — TDD)
3. `data.ts` (jobs DAG, skills, enemies, demo map)
4. `engine/grid.ts` (coords, tiles, collision — TDD)
5. `engine/entities.ts` (construction, symmetric stats, factions — TDD)
6. `engine/jobs.ts` (DAG unlock + "mixing" — TDD)
7. `engine/skills.ts` (shape targeting, uses/cooldown — TDD)
8. `engine/combat.ts` (sticky groups, group movement, tick resolution — TDD)
9. `engine/demo.ts` + `engine/world.ts` (`tick` reducer — TDD)
10. `state/store.ts` (Zustand scene machine + engine bridge — TDD smoke)
11. `app/GameLoop.ts` (fixed-timestep driver)
12. `render/PixiStage.tsx` + `render/WorldRenderer.ts` (imperative Pixi, 1080p scaling)
13. `render/hud/` (square skill-timer + hotkey bar)
14. `screens/DungeonScreen.tsx` (playable slice: input + loop + render wiring)
15. `app/App.tsx` scene router + 6 stub screens + README run notes

---

## Task 1: Project bootstrap

**Files (all Create):** `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.prettierrc`, `eslint.config.js`, `vitest.setup.ts`, `src/main.tsx`, `src/app/App.tsx`, `src/vite-env.d.ts`

**Step 1: Create `package.json`**

```json
{
  "name": "time-attack-mmo",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "pixi.js": "^8.6.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.10",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "eslint": "^9.12.0",
    "eslint-plugin-boundaries": "^5.0.1",
    "jsdom": "^25.0.1",
    "prettier": "^3.3.3",
    "typescript": "^5.6.2",
    "typescript-eslint": "^8.8.0",
    "vite": "^5.4.8",
    "vitest": "^2.1.2"
  }
}
```

**Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": false
  },
  "include": ["src", "vitest.setup.ts", "vite.config.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 3: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 4: Create `vite.config.ts`** (Vite + Vitest share one config)

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

**Step 5: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom';
```

**Step 6: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Time Attack MMO</title>
    <style>
      html, body, #root { margin: 0; height: 100%; background: #0b0b12; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 7: Create `.gitignore`**

```
node_modules
dist
*.local
.DS_Store
```

**Step 8: Create `.prettierrc`**

```json
{ "semi": true, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

**Step 9: Create `eslint.config.js`** (flat config; the boundary rule is the MMO hedge)

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'pure', pattern: 'src/(types|config|data).ts', mode: 'file' },
        { type: 'pure', pattern: 'src/engine/**' },
        { type: 'app', pattern: 'src/(state|render|screens|ui|app)/**' },
      ],
    },
    rules: {
      // Engine + fixed data files must never reach into React/Pixi.
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['react', 'react-dom', 'pixi.js'], message: 'engine/types/config/data must stay framework-agnostic' },
        ],
      }],
    },
  },
  {
    // Only apply the framework-import ban to the pure layer.
    files: ['src/engine/**', 'src/types.ts', 'src/config.ts', 'src/data.ts'],
  },
  {
    // The rest of the app may import React/Pixi freely.
    files: ['src/state/**', 'src/render/**', 'src/screens/**', 'src/ui/**', 'src/app/**', 'src/main.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
```

**Step 10: Create `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

**Step 11: Create a minimal `src/app/App.tsx` and `src/main.tsx`** (real router comes in Task 15)

`src/app/App.tsx`:
```tsx
export default function App() {
  return <div style={{ color: '#eee', fontFamily: 'sans-serif', padding: 24 }}>Time Attack MMO — booting…</div>;
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Step 12: Install and verify**

Run: `npm install`
Expected: dependencies install without errors.

Run: `npm run typecheck`
Expected: no type errors.

Run: `npm run dev` (then Ctrl-C)
Expected: Vite serves at `http://localhost:5173`, page shows "Time Attack MMO — booting…".

**Step 13: Commit**

```bash
git add -A
git commit -m "chore: bootstrap Vite + React + TS + Vitest + ESLint boundaries"
```

---

## Task 2: `types.ts` + `config.ts` (stat & damage formulas)

**Files:**
- Create: `src/types.ts`
- Create: `src/config.ts`
- Test: `src/__tests__/config.test.ts`

**Step 1: Create `src/types.ts`** (no logic, no imports)

```ts
// ---------- Grid ----------
export type Cell = { x: number; y: number };
export type Offset = { dx: number; dy: number };
export type Direction = 'up' | 'down' | 'left' | 'right';
export type TileKind = 'floor' | 'wall';
export type TileMap = { width: number; height: number; tiles: TileKind[] };

// ---------- Ids ----------
export type EntityId = string;
export type SkillId = string;
export type JobId = string;
export type GroupId = string;

// ---------- Stats ----------
// Skeleton ships `Stats` as placeholder DERIVED stats. Phase 2 replaces the
// generator with deriveStats(primaries, level); `Primaries` is defined now so
// the shape is forward-compatible (see design §"Stat system").
export type Stats = { maxHp: number; atk: number; def: number };
export type Primaries = { str: number; dex: number; int: number; vit: number };

// ---------- Status effects (Phase 2 systems; type present now) ----------
export type StatusKind = 'poison' | 'stun' | 'slow' | 'atkUp' | 'atkDown' | 'defDown';
export type StatusEffect = { kind: StatusKind; potency: number; roundsLeft: number };

// ---------- Skills ----------
export type CooldownType = 'passive' | 'active';
export type Skill = {
  id: SkillId;
  name: string;
  shape: Offset[]; // cells hit, relative to caster's cell
  power: number; // multiplier on atk
  triggerMs?: number; // auto-cast interval; multiple of STEP_MS (250), default 1500
  uses?: number; // limited uses before cooldown; omitted = unlimited
  cooldownMs: number;
  cooldownType: CooldownType;
  // --- optional metadata (drives Phase 2 systems; skeleton ignores) ---
  category?: 'point' | 'adjacent' | 'line' | 'area';
  directional?: boolean; // shape rotates to face the engaged side
  maxTargets?: number;
  accuracy?: number; // hit chance (hunter low / sniper high)
  critChance?: number;
  appliesStatus?: { kind: StatusKind; potency: number; rounds: number };
  telegraphRounds?: number; // enemy AoE warning (1–3 rounds)
  mpCost?: number;
  healing?: number; // heals allies instead of damaging foes
  targetsAllies?: boolean;
};
export type SkillRuntime = {
  skillId: SkillId;
  usesLeft: number; // -1 = unlimited
  cooldownLeftMs: number;
};

// ---------- Jobs ----------
export type JobNode = {
  id: JobId;
  name: string;
  requires: JobId[]; // all must be attained (empty = starter); 2+ parents = "mixing"
  growth: number; // per-job stat growth multiplier
  grantsSkills: SkillId[];
};

// ---------- Entities ----------
export type Faction = 'player' | 'ally' | 'enemy';
export type Entity = {
  id: EntityId;
  faction: Faction;
  name: string;
  glyph: string; // emoji placeholder
  cell: Cell;
  facing: Direction;
  level: number;
  jobId: JobId;
  attainedJobs: JobId[];
  stats: Stats; // placeholder derived stats (Phase 2: computed from `primaries`)
  primaries?: Primaries; // populated once the primary-stat system lands
  hp: number;
  skills: SkillRuntime[];
  activeSkillIndex: number; // hotkey slot 0..8
  statuses: StatusEffect[]; // active DoTs/buffs/debuffs (empty in skeleton)
  attacksPerRound: number; // 1 normally; rogues stack 2–3 (Phase 2)
};

// ---------- Combat groups (sticky blocks) ----------
export type CombatGroup = {
  id: GroupId;
  memberIds: EntityId[];
  timerMs: number; // accumulates to COMBAT_TICK_MS then fires
};

// ---------- World ----------
export type WorldState = {
  map: TileMap;
  entities: Record<EntityId, Entity>;
  groups: Record<GroupId, CombatGroup>;
  playerId: EntityId;
  seq: number; // monotonic id source (deterministic)
  tickCount: number;
};

// ---------- Inputs ----------
export type Input =
  | { type: 'move'; dir: Direction }
  | { type: 'selectSkill'; slot: number }; // 0..8 => keys 1..9
```

**Step 2: Write the failing test `src/__tests__/config.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { statsFor, damage } from '../config';

describe('symmetric stat model', () => {
  it('gives identical stats to a player and an enemy of the same level and growth', () => {
    expect(statsFor(25, 1)).toEqual(statsFor(25, 1));
  });
  it('scales up with level', () => {
    expect(statsFor(10, 1).atk).toBeGreaterThan(statsFor(1, 1).atk);
  });
  it('applies job growth as a multiplier', () => {
    expect(statsFor(20, 1.2).maxHp).toBeGreaterThan(statsFor(20, 1).maxHp);
  });
});

describe('damage', () => {
  it('is attack*power minus defense, floored at 1', () => {
    expect(damage(10, 1, 3)).toBe(7);
    expect(damage(2, 1, 100)).toBe(1); // never below 1
  });
});
```

**Step 3: Run to verify it fails**

Run: `npm test -- config`
Expected: FAIL — cannot import `statsFor` / `damage` from `../config`.

**Step 4: Create `src/config.ts`**

```ts
import type { Stats } from './types';

// ---------- Display ----------
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;
export const CELL_PX = 64;

// ---------- Timing ----------
export const SIM_TICK_MS = 50; // fixed simulation step (divides STEP_MS evenly)
export const STEP_MS = 250; // skill trigger rates are authored in these steps
export const COMBAT_TICK_MS = 1500; // default per-skill trigger interval (6 * STEP_MS)
export const ANIM_FRAME_MS = 400; // renderer animation cadence
export const ANIM_FRAMES = 3;

// ---------- Symmetric stat model (used for BOTH players and enemies) ----------
const BASE = { maxHp: 40, atk: 8, def: 3 };
const PER_LEVEL = { maxHp: 12, atk: 3, def: 1.5 };

export function statsFor(level: number, growth: number): Stats {
  return {
    maxHp: Math.round((BASE.maxHp + PER_LEVEL.maxHp * (level - 1)) * growth),
    atk: Math.round((BASE.atk + PER_LEVEL.atk * (level - 1)) * growth),
    def: Math.round((BASE.def + PER_LEVEL.def * (level - 1)) * growth),
  };
}

// ---------- Damage ----------
export function damage(attackerAtk: number, skillPower: number, defenderDef: number): number {
  return Math.max(1, Math.round(attackerAtk * skillPower - defenderDef));
}
```

**Step 5: Run to verify it passes**

Run: `npm test -- config`
Expected: PASS (5 assertions).

**Step 6: Commit**

```bash
git add src/types.ts src/config.ts src/__tests__/config.test.ts
git commit -m "feat: core types and symmetric stat/damage formulas"
```

---

## Task 3: `data.ts` (jobs DAG, skills, enemies, demo map)

**Files:**
- Create: `src/data.ts`
- Test: `src/__tests__/data.test.ts`

**Step 1: Write the failing test `src/__tests__/data.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { JOBS, SKILLS, ENEMY_TEMPLATES, demoMap } from '../data';

describe('content data', () => {
  it('models class mixing: flameRanger requires two parents', () => {
    expect(JOBS.flameRanger.requires).toEqual(expect.arrayContaining(['ranger', 'fireWizard']));
  });
  it('every job grants only skills that exist', () => {
    for (const job of Object.values(JOBS)) {
      for (const s of job.grantsSkills) expect(SKILLS[s]).toBeDefined();
    }
  });
  it('demo map is a floor field with a wall border', () => {
    const m = demoMap();
    expect(m.tiles).toHaveLength(m.width * m.height);
    expect(m.tiles[0]).toBe('wall'); // top-left corner
  });
  it('provides at least one enemy template', () => {
    expect(ENEMY_TEMPLATES.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm test -- data`
Expected: FAIL — module `../data` not found.

**Step 3: Create `src/data.ts`** (imports only `types`)

```ts
import type { JobNode, Skill, TileKind, TileMap } from './types';

// ---------- Skills ----------
export const SKILLS: Record<string, Skill> = {
  strike: {
    id: 'strike',
    name: 'Strike',
    shape: [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }],
    power: 1.0,
    cooldownMs: 0,
    cooldownType: 'passive',
  },
  rowCleave: {
    id: 'rowCleave',
    name: 'Row Cleave',
    shape: [{ dx: -2, dy: 0 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }],
    power: 0.8,
    uses: 3,
    cooldownMs: 4000,
    cooldownType: 'active',
  },
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    shape: [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }],
    power: 1.6,
    uses: 2,
    cooldownMs: 6000,
    cooldownType: 'passive',
  },
};

// ---------- Jobs ----------
// FLAT PLACEHOLDER DAG for the skeleton: real class names, `requires` encodes the
// tiers, and `flameRanger` demonstrates mixing. Phase 2 replaces this with the
// generative BASE_CLASSES / SECOND_CLASSES / PAIR_SKILLS model (design §4b);
// `growth` here stands in for the per-class primary bias until then.
export const JOBS: Record<string, JobNode> = {
  // Tier 0
  beginner: { id: 'beginner', name: 'Beginner', requires: [], growth: 1.0, grantsSkills: ['strike'] },
  // Tier 1 — base classes
  swordsman: { id: 'swordsman', name: 'Swordsman', requires: ['beginner'], growth: 1.05, grantsSkills: ['strike'] },
  archer: { id: 'archer', name: 'Archer', requires: ['beginner'], growth: 1.05, grantsSkills: ['rowCleave'] },
  magician: { id: 'magician', name: 'Magician', requires: ['beginner'], growth: 1.05, grantsSkills: ['fireball'] },
  rogue: { id: 'rogue', name: 'Rogue', requires: ['beginner'], growth: 1.05, grantsSkills: ['strike'] },
  // Tier 2 — second classes (3 per base)
  knight: { id: 'knight', name: 'Knight', requires: ['swordsman'], growth: 1.12, grantsSkills: [] },
  paladin: { id: 'paladin', name: 'Paladin', requires: ['swordsman'], growth: 1.12, grantsSkills: [] },
  duelist: { id: 'duelist', name: 'Duelist', requires: ['swordsman'], growth: 1.12, grantsSkills: [] },
  hunter: { id: 'hunter', name: 'Hunter', requires: ['archer'], growth: 1.12, grantsSkills: ['rowCleave'] },
  sniper: { id: 'sniper', name: 'Sniper', requires: ['archer'], growth: 1.12, grantsSkills: [] },
  ranger: { id: 'ranger', name: 'Ranger', requires: ['archer'], growth: 1.12, grantsSkills: [] },
  arcaneMage: { id: 'arcaneMage', name: 'Arcane Mage', requires: ['magician'], growth: 1.12, grantsSkills: [] },
  fireWizard: { id: 'fireWizard', name: 'Fire Wizard', requires: ['magician'], growth: 1.12, grantsSkills: ['fireball'] },
  druid: { id: 'druid', name: 'Druid', requires: ['magician'], growth: 1.12, grantsSkills: [] },
  assassin: { id: 'assassin', name: 'Assassin', requires: ['rogue'], growth: 1.12, grantsSkills: [] },
  shadower: { id: 'shadower', name: 'Shadower', requires: ['rogue'], growth: 1.12, grantsSkills: [] },
  ninja: { id: 'ninja', name: 'Ninja', requires: ['rogue'], growth: 1.12, grantsSkills: [] },
  // Merged (example of mixing any two second classes)
  flameRanger: { id: 'flameRanger', name: 'Flame Ranger', requires: ['ranger', 'fireWizard'], growth: 1.25, grantsSkills: [] },
};

// ---------- Enemies ----------
export const ENEMY_TEMPLATES = [
  { name: 'Rat', glyph: '🐀', jobId: 'beginner' },
  { name: 'Slime', glyph: '🟢', jobId: 'beginner' },
  { name: 'Bat', glyph: '🦇', jobId: 'archer' },
] as const;

// ---------- Maps (tile data will move to JSON later) ----------
export function demoMap(width = 20, height = 12): TileMap {
  const tiles: TileKind[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      tiles.push(border ? 'wall' : 'floor');
    }
  }
  return { width, height, tiles };
}
```

**Step 4: Run to verify it passes**

Run: `npm test -- data`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/data.ts src/__tests__/data.test.ts
git commit -m "feat: content data — jobs DAG, skills, enemies, demo map"
```

---

## Task 4: `engine/grid.ts`

**Files:**
- Create: `src/engine/grid.ts`
- Test: `src/engine/__tests__/grid.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { DIRECTIONS, inBounds, isWall, step, equals } from '../grid';
import { demoMap } from '../../data';

const map = demoMap(5, 5);

describe('grid', () => {
  it('steps one cell in a direction', () => {
    expect(step({ x: 2, y: 2 }, 'left')).toEqual({ x: 1, y: 2 });
    expect(step({ x: 2, y: 2 }, 'down')).toEqual({ x: 2, y: 3 });
  });
  it('detects bounds', () => {
    expect(inBounds(map, { x: 0, y: 0 })).toBe(true);
    expect(inBounds(map, { x: -1, y: 0 })).toBe(false);
  });
  it('treats the border and out-of-bounds as walls', () => {
    expect(isWall(map, { x: 0, y: 0 })).toBe(true); // border
    expect(isWall(map, { x: 2, y: 2 })).toBe(false); // interior floor
    expect(isWall(map, { x: 99, y: 99 })).toBe(true); // oob
  });
  it('has four cardinal directions', () => {
    expect(Object.keys(DIRECTIONS).sort()).toEqual(['down', 'left', 'right', 'up']);
  });
  it('compares cells', () => {
    expect(equals({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true);
    expect(equals({ x: 1, y: 1 }, { x: 1, y: 2 })).toBe(false);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm test -- grid`
Expected: FAIL — module `../grid` not found.

**Step 3: Create `src/engine/grid.ts`**

```ts
import type { Cell, Direction, Offset, TileKind, TileMap } from '../types';

export const DIRECTIONS: Record<Direction, Offset> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function inBounds(map: TileMap, c: Cell): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
}

export function tileAt(map: TileMap, c: Cell): TileKind | undefined {
  if (!inBounds(map, c)) return undefined;
  return map.tiles[c.y * map.width + c.x];
}

export function isWall(map: TileMap, c: Cell): boolean {
  return tileAt(map, c) !== 'floor'; // out-of-bounds counts as wall
}

export function add(c: Cell, o: Offset): Cell {
  return { x: c.x + o.dx, y: c.y + o.dy };
}

export function step(c: Cell, dir: Direction): Cell {
  return add(c, DIRECTIONS[dir]);
}

export function equals(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function key(c: Cell): string {
  return `${c.x},${c.y}`;
}
```

**Step 4: Run to verify it passes**

Run: `npm test -- grid`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/engine/grid.ts src/engine/__tests__/grid.test.ts
git commit -m "feat(engine): grid coords, tiles, and collision"
```

---

## Task 5: `engine/entities.ts`

**Files:**
- Create: `src/engine/entities.ts`
- Test: `src/engine/__tests__/entities.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { makeEntity, isAlive, areEnemies } from '../entities';

const hero = makeEntity({ id: 'p1', faction: 'player', name: 'Hero', glyph: '🧙', cell: { x: 1, y: 1 }, level: 25, jobId: 'beginner' });
const rat = makeEntity({ id: 'e1', faction: 'enemy', name: 'Rat', glyph: '🐀', cell: { x: 2, y: 1 }, level: 25, jobId: 'beginner' });

describe('entities', () => {
  it('starts at full hp derived from stats', () => {
    expect(hero.hp).toBe(hero.stats.maxHp);
    expect(hero.stats.maxHp).toBeGreaterThan(0);
  });
  it('grants the job’s skills as runtime slots (unlimited uses => -1)', () => {
    expect(hero.skills[0].skillId).toBe('strike');
    expect(hero.skills[0].usesLeft).toBe(-1);
  });
  it('same level + same job => symmetric stats for player and enemy', () => {
    expect(hero.stats).toEqual(rat.stats);
  });
  it('detects living entities', () => {
    expect(isAlive(hero)).toBe(true);
    expect(isAlive({ ...hero, hp: 0 })).toBe(false);
  });
  it('players and enemies are mutual enemies; players and allies are not', () => {
    const ally = makeEntity({ id: 'a1', faction: 'ally', name: 'Ally', glyph: '🧝', cell: { x: 0, y: 0 }, level: 25, jobId: 'beginner' });
    expect(areEnemies(hero, rat)).toBe(true);
    expect(areEnemies(hero, ally)).toBe(false);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm test -- entities`
Expected: FAIL — module `../entities` not found.

**Step 3: Create `src/engine/entities.ts`**

```ts
import type { Cell, Entity, EntityId, Faction, JobId, SkillRuntime } from '../types';
import { JOBS, SKILLS } from '../data';
import { statsFor } from '../config';

export function skillRuntime(skillId: string): SkillRuntime {
  const s = SKILLS[skillId];
  return { skillId, usesLeft: s.uses ?? -1, cooldownLeftMs: 0 };
}

export function makeEntity(params: {
  id: EntityId;
  faction: Faction;
  name: string;
  glyph: string;
  cell: Cell;
  level: number;
  jobId: JobId;
  attainedJobs?: JobId[];
}): Entity {
  const job = JOBS[params.jobId];
  const stats = statsFor(params.level, job.growth);
  const skills = job.grantsSkills.map(skillRuntime);
  return {
    id: params.id,
    faction: params.faction,
    name: params.name,
    glyph: params.glyph,
    cell: params.cell,
    facing: 'down',
    level: params.level,
    jobId: params.jobId,
    attainedJobs: params.attainedJobs ?? [params.jobId],
    stats,
    hp: stats.maxHp,
    skills,
    activeSkillIndex: 0,
    statuses: [], // Phase 2 populates DoTs/buffs
    attacksPerRound: 1, // Phase 2: rogues raise this to 2–3
  };
}

export function isAlive(e: Entity): boolean {
  return e.hp > 0;
}

// Enemy faction is hostile to everyone non-enemy; players/allies are friendly.
export function areEnemies(a: Entity, b: Entity): boolean {
  const hostile = (f: Faction) => f === 'enemy';
  return hostile(a.faction) !== hostile(b.faction);
}
```

**Step 4: Run to verify it passes**

Run: `npm test -- entities`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/engine/entities.ts src/engine/__tests__/entities.test.ts
git commit -m "feat(engine): entity construction, symmetric stats, factions"
```

---

## Task 6: `engine/jobs.ts` (DAG unlock + mixing)

**Files:**
- Create: `src/engine/jobs.ts`
- Test: `src/engine/__tests__/jobs.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { canUnlock, availableJobs } from '../jobs';

describe('job DAG unlocking', () => {
  it('starter jobs are always unlockable', () => {
    expect(canUnlock('beginner', [])).toBe(true);
  });
  it('requires the parent before a child', () => {
    expect(canUnlock('archer', [])).toBe(false);
    expect(canUnlock('archer', ['beginner'])).toBe(true);
  });
  it('mixing requires BOTH parents', () => {
    expect(canUnlock('flameRanger', ['ranger'])).toBe(false);
    expect(canUnlock('flameRanger', ['ranger', 'fireWizard'])).toBe(true);
  });
  it('lists newly-available (not-yet-attained) jobs', () => {
    const avail = availableJobs(['beginner']);
    expect(avail).toEqual(expect.arrayContaining(['swordsman', 'archer', 'magician', 'rogue']));
    expect(avail).not.toContain('beginner'); // already attained
    expect(avail).not.toContain('ranger'); // parent (archer) not yet attained
  });
  it('surfaces a merged class only once both second classes are attained', () => {
    expect(availableJobs(['ranger', 'fireWizard'])).toContain('flameRanger');
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm test -- jobs`
Expected: FAIL — module `../jobs` not found.

**Step 3: Create `src/engine/jobs.ts`**

```ts
import type { JobId } from '../types';
import { JOBS } from '../data';

export function canUnlock(jobId: JobId, attained: JobId[]): boolean {
  const job = JOBS[jobId];
  if (!job) return false;
  return job.requires.every((r) => attained.includes(r));
}

export function availableJobs(attained: JobId[]): JobId[] {
  return Object.keys(JOBS).filter((id) => !attained.includes(id) && canUnlock(id, attained));
}
```

**Step 4: Run to verify it passes**

Run: `npm test -- jobs`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/engine/jobs.ts src/engine/__tests__/jobs.test.ts
git commit -m "feat(engine): job DAG unlocking with class mixing"
```

---

## Task 7: `engine/skills.ts` (shape targeting, uses/cooldown)

**Files:**
- Create: `src/engine/skills.ts`
- Test: `src/engine/__tests__/skills.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { skillTargets, canCast, afterCast, tickCooldowns } from '../skills';
import { makeEntity } from '../entities';
import { SKILLS } from '../../data';
import type { Entity } from '../../types';

function at(id: string, faction: 'player' | 'enemy', cell: { x: number; y: number }): Entity {
  return makeEntity({ id, faction, name: id, glyph: '?', cell, level: 10, jobId: 'beginner' });
}

describe('skill targeting by shape', () => {
  it('hits only opposing members whose offset matches the shape', () => {
    const caster = at('p', 'player', { x: 5, y: 5 });
    const rightFoe = at('e1', 'enemy', { x: 6, y: 5 }); // offset (1,0) — in strike
    const farFoe = at('e2', 'enemy', { x: 8, y: 5 }); // offset (3,0) — not in strike
    const targets = skillTargets(caster, SKILLS.strike, [caster, rightFoe, farFoe]);
    expect(targets.map((t) => t.id)).toEqual(['e1']);
  });
  it('never targets allies of the caster', () => {
    const caster = at('p', 'player', { x: 5, y: 5 });
    const friend = at('p2', 'player', { x: 6, y: 5 });
    expect(skillTargets(caster, SKILLS.strike, [caster, friend])).toEqual([]);
  });
});

describe('uses and cooldown bookkeeping', () => {
  it('unlimited skills (usesLeft -1) are always castable and never deplete', () => {
    const rt = { skillId: 'strike', usesLeft: -1, cooldownLeftMs: 0 };
    expect(canCast(rt)).toBe(true);
    expect(afterCast(rt, SKILLS.strike)).toEqual(rt);
  });
  it('depleting the last use starts the cooldown and refills uses', () => {
    let rt = { skillId: 'rowCleave', usesLeft: 1, cooldownLeftMs: 0 };
    rt = afterCast(rt, SKILLS.rowCleave);
    expect(rt.cooldownLeftMs).toBe(SKILLS.rowCleave.cooldownMs);
    expect(rt.usesLeft).toBe(SKILLS.rowCleave.uses);
    expect(canCast(rt)).toBe(false); // cooling down
  });
  it('passive cooldowns tick regardless of selection; active only while selected', () => {
    const e = makeEntity({ id: 'm', faction: 'player', name: 'm', glyph: '?', cell: { x: 0, y: 0 }, level: 10, jobId: 'magician' });
    e.skills = [
      { skillId: 'fireball', usesLeft: 2, cooldownLeftMs: 1000 }, // passive
      { skillId: 'rowCleave', usesLeft: 3, cooldownLeftMs: 1000 }, // active
    ];
    e.activeSkillIndex = 0; // fireball selected
    const ticked = tickCooldowns(e, 400);
    expect(ticked[0].cooldownLeftMs).toBe(600); // passive always ticks
    expect(ticked[1].cooldownLeftMs).toBe(1000); // active, not selected => frozen
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm test -- skills`
Expected: FAIL — module `../skills` not found.

**Step 3: Create `src/engine/skills.ts`**

```ts
import type { Entity, Skill, SkillRuntime } from '../types';
import { SKILLS } from '../data';
import { areEnemies } from './entities';
import { key } from './grid';

export function activeSkillOf(e: Entity): Skill | undefined {
  const rt = e.skills[e.activeSkillIndex];
  return rt ? SKILLS[rt.skillId] : undefined;
}

export function skillTargets(caster: Entity, skill: Skill, members: Entity[]): Entity[] {
  const shape = new Set(skill.shape.map((o) => `${o.dx},${o.dy}`));
  return members.filter(
    (m) =>
      m.id !== caster.id &&
      areEnemies(caster, m) &&
      shape.has(key({ x: m.cell.x - caster.cell.x, y: m.cell.y - caster.cell.y })),
  );
}

export function canCast(rt: SkillRuntime): boolean {
  return rt.cooldownLeftMs <= 0 && rt.usesLeft !== 0;
}

// After a cast: unlimited skills are unchanged; limited skills decrement,
// and depleting the last use starts the cooldown and refills the uses.
export function afterCast(rt: SkillRuntime, skill: Skill): SkillRuntime {
  if (rt.usesLeft < 0) return rt;
  const usesLeft = rt.usesLeft - 1;
  if (usesLeft <= 0) {
    return { ...rt, usesLeft: skill.uses ?? -1, cooldownLeftMs: skill.cooldownMs };
  }
  return { ...rt, usesLeft };
}

// Passive cooldowns always tick; active cooldowns tick only for the selected slot.
export function tickCooldowns(e: Entity, dt: number): SkillRuntime[] {
  return e.skills.map((rt, i) => {
    if (rt.cooldownLeftMs <= 0) return rt;
    const skill = SKILLS[rt.skillId];
    const shouldTick = skill.cooldownType === 'passive' || i === e.activeSkillIndex;
    if (!shouldTick) return rt;
    return { ...rt, cooldownLeftMs: Math.max(0, rt.cooldownLeftMs - dt) };
  });
}
```

**Step 4: Run to verify it passes**

Run: `npm test -- skills`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/engine/skills.ts src/engine/__tests__/skills.test.ts
git commit -m "feat(engine): shape-based targeting and use/cooldown rules"
```

---

## Task 8: `engine/combat.ts` (sticky groups, group movement, tick resolution)

This is the heart of the game. Build it in three green clusters, committing after each.

**Files:**
- Create: `src/engine/combat.ts`
- Test: `src/engine/__tests__/combat.test.ts`

### Cluster A — sticking & queries

**Step 1: Write the failing test (append to `combat.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { moveOrStick, advanceCombat, groupOf, enemyAt } from '../combat';
import { makeEntity } from '../entities';
import { demoMap } from '../../data';
import type { Entity, WorldState } from '../../types';

function world(entities: Entity[]): WorldState {
  return {
    map: demoMap(10, 10),
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    groups: {},
    playerId: 'p1',
    seq: 0,
    tickCount: 0,
  };
}
const hero = (cell: { x: number; y: number }) => makeEntity({ id: 'p1', faction: 'player', name: 'Hero', glyph: '🧙', cell, level: 20, jobId: 'beginner' });
const rat = (id: string, cell: { x: number; y: number }) => makeEntity({ id, faction: 'enemy', name: 'Rat', glyph: '🐀', cell, level: 20, jobId: 'beginner' });

describe('movement & sticking', () => {
  it('walks onto empty floor', () => {
    const s = world([hero({ x: 3, y: 3 })]);
    moveOrStick(s, 'p1', 'right');
    expect(s.entities.p1.cell).toEqual({ x: 4, y: 3 });
  });
  it('is blocked by walls', () => {
    const s = world([hero({ x: 1, y: 1 })]);
    moveOrStick(s, 'p1', 'up'); // into top border wall
    expect(s.entities.p1.cell).toEqual({ x: 1, y: 1 });
  });
  it('sticks an enemy instead of moving into it, forming a 2-member group', () => {
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 4, y: 3 })]);
    moveOrStick(s, 'p1', 'right');
    expect(s.entities.p1.cell).toEqual({ x: 3, y: 3 }); // did not move
    const g = groupOf(s, 'p1');
    expect(g?.memberIds.sort()).toEqual(['e1', 'p1']);
  });
  it('enemyAt finds a living enemy on a cell', () => {
    const s = world([rat('e1', { x: 5, y: 5 })]);
    expect(enemyAt(s, { x: 5, y: 5 })?.id).toBe('e1');
    expect(enemyAt(s, { x: 6, y: 5 })).toBeUndefined();
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm test -- combat`
Expected: FAIL — module `../combat` not found.

**Step 3: Create `src/engine/combat.ts` (queries + stick + solo move first)**

```ts
import type { Cell, CombatGroup, Direction, Entity, EntityId, WorldState } from '../types';
import { DIRECTIONS, isWall, equals, key } from './grid';
import { SKILLS } from '../data';
import { areEnemies, isAlive } from './entities';
import { skillTargets, canCast, afterCast, tickCooldowns } from './skills';
import { damage, COMBAT_TICK_MS } from '../config';

// ---------- Queries (never mutate) ----------
export function groupOf(s: WorldState, id: EntityId): CombatGroup | undefined {
  return Object.values(s.groups).find((g) => g.memberIds.includes(id));
}
export function membersOf(s: WorldState, g: CombatGroup): Entity[] {
  return g.memberIds.map((id) => s.entities[id]).filter(Boolean) as Entity[];
}
export function enemyAt(s: WorldState, c: Cell): Entity | undefined {
  return Object.values(s.entities).find((e) => e.faction === 'enemy' && isAlive(e) && equals(e.cell, c));
}

// ---------- Commands (mutate `s` in place) ----------
// Attach `enemyId` (and any group it already belongs to) into `byId`'s group.
export function stick(s: WorldState, byId: EntityId, enemyId: EntityId): void {
  let group = groupOf(s, byId);
  if (!group) {
    const id = 'g' + s.seq++;
    group = { id, memberIds: [byId], timerMs: 0 };
    s.groups[id] = group;
  }
  const enemyGroup = groupOf(s, enemyId);
  const toAdd = enemyGroup ? [...enemyGroup.memberIds] : [enemyId];
  for (const mid of toAdd) if (!group.memberIds.includes(mid)) group.memberIds.push(mid);
  if (enemyGroup && enemyGroup.id !== group.id) delete s.groups[enemyGroup.id];
}

export function moveOrStick(s: WorldState, id: EntityId, dir: Direction): void {
  const e = s.entities[id];
  if (!e) return;
  e.facing = dir;
  const off = DIRECTIONS[dir];
  const g = groupOf(s, id);

  if (!g) {
    const target: Cell = { x: e.cell.x + off.dx, y: e.cell.y + off.dy };
    if (isWall(s.map, target)) return;
    const foe = enemyAt(s, target);
    if (foe) return void stick(s, id, foe.id);
    e.cell = target; // players/allies may share a cell; move freely
    return;
  }

  // Grouped: rigid translation with leading-edge collision.
  const members = membersOf(s, g);
  const footprint = new Set(members.map((m) => key(m.cell)));
  const leading = members
    .map((m) => ({ x: m.cell.x + off.dx, y: m.cell.y + off.dy }))
    .filter((c) => !footprint.has(key(c)));

  if (leading.some((c) => isWall(s.map, c))) return; // wall blocks the whole group
  const memberIds = new Set(g.memberIds);
  const foes = leading.map((c) => enemyAt(s, c)).filter((f): f is Entity => !!f && !memberIds.has(f.id));
  if (foes.length) {
    for (const f of foes) stick(s, id, f.id); // touched more enemies -> grow the block
    return;
  }
  for (const m of members) m.cell = { x: m.cell.x + off.dx, y: m.cell.y + off.dy };
}
```

> Note: `advanceCombat` is imported by the test but defined in Cluster B. To keep Cluster A green, add a temporary stub `export function advanceCombat(_s: WorldState, _dt: number): void {}` now and replace it in Cluster B. (Or split the import; the stub is simpler.)

**Step 4: Run to verify it passes**

Run: `npm test -- combat`
Expected: PASS (Cluster A tests).

**Step 5: Commit**

```bash
git add src/engine/combat.ts src/engine/__tests__/combat.test.ts
git commit -m "feat(engine): sticky-block formation and movement"
```

### Cluster B — combat tick resolution

**Step 1: Add failing tests (append to `combat.test.ts`)**

```ts
describe('combat tick resolution', () => {
  it('does not fire until the 1.5s timer elapses, then deals damage', () => {
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 4, y: 3 })]);
    moveOrStick(s, 'p1', 'right'); // form the fight
    const before = s.entities.e1.hp;
    advanceCombat(s, 1000); // < 1500ms
    expect(s.entities.e1.hp).toBe(before);
    advanceCombat(s, 600); // crosses 1500ms total
    expect(s.entities.e1.hp).toBeLessThan(before);
  });
  it('removes a dead enemy and dissolves a one-sided group', () => {
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 4, y: 3 })]);
    s.entities.e1.hp = 1;
    moveOrStick(s, 'p1', 'right');
    advanceCombat(s, 1500);
    expect(s.entities.e1).toBeUndefined(); // dead enemy removed from board
    expect(groupOf(s, 'p1')).toBeUndefined(); // group dissolved
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm test -- combat`
Expected: FAIL — `advanceCombat` is a no-op stub, hp never changes.

**Step 3: Replace the stub with the real `advanceCombat` (+ helpers) in `combat.ts`**

```ts
export function advanceCombat(s: WorldState, dt: number): void {
  for (const e of Object.values(s.entities)) e.skills = tickCooldowns(e, dt);

  for (const g of Object.values(s.groups)) {
    g.timerMs += dt;
    while (g.timerMs >= COMBAT_TICK_MS) {
      g.timerMs -= COMBAT_TICK_MS;
      fireSkills(s, g);
    }
  }
  cleanupDead(s);
}

function fireSkills(s: WorldState, g: CombatGroup): void {
  for (const caster of membersOf(s, g)) {
    if (!isAlive(caster)) continue;
    const rt = caster.skills[caster.activeSkillIndex];
    if (!rt || !canCast(rt)) continue;
    const skill = SKILLS[rt.skillId];
    const living = membersOf(s, g).filter(isAlive);
    for (const t of skillTargets(caster, skill, living)) {
      t.hp = Math.max(0, t.hp - damage(caster.stats.atk, skill.power, t.stats.def));
    }
    caster.skills = caster.skills.map((r, i) => (i === caster.activeSkillIndex ? afterCast(r, skill) : r));
  }
}

function cleanupDead(s: WorldState): void {
  for (const g of Object.values(s.groups)) {
    g.memberIds = g.memberIds.filter((id) => s.entities[id] && isAlive(s.entities[id]));
    const factions = new Set(g.memberIds.map((id) => s.entities[id].faction));
    const hasEnemy = factions.has('enemy');
    const hasHero = factions.has('player') || factions.has('ally');
    if (!hasEnemy || !hasHero || g.memberIds.length < 2) delete s.groups[g.id];
  }
  for (const e of Object.values(s.entities)) {
    if (e.faction === 'enemy' && !isAlive(e)) delete s.entities[e.id];
  }
}
```

Remove the temporary stub added in Cluster A.

**Step 4: Run to verify it passes**

Run: `npm test -- combat`
Expected: PASS (Clusters A + B).

**Step 5: Commit**

```bash
git add src/engine/combat.ts src/engine/__tests__/combat.test.ts
git commit -m "feat(engine): 1.5s combat tick, damage, death cleanup"
```

### Cluster C — group grows by bumping more enemies

**Step 1: Add failing test (append)**

```ts
describe('growing the block', () => {
  it('adds a second enemy when the group bumps into it instead of translating', () => {
    // Hero at (3,3), rat A at (4,3) already sticky; rat B at (5,3) to the right of A.
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 4, y: 3 }), rat('e2', { x: 5, y: 3 })]);
    moveOrStick(s, 'p1', 'right'); // stick e1 -> group {p1,e1}
    moveOrStick(s, 'p1', 'right'); // leading edge hits e2 -> stick, no translation
    const g = groupOf(s, 'p1');
    expect(g?.memberIds.sort()).toEqual(['e1', 'e2', 'p1']);
    expect(s.entities.p1.cell).toEqual({ x: 3, y: 3 }); // never moved
  });
});
```

**Step 2: Run to verify it fails or passes**

Run: `npm test -- combat`
Expected: PASS already (the Cluster A group-movement branch handles this). If it fails, fix `moveOrStick`'s leading-edge enemy detection. Either way, keep the test.

**Step 3: (only if red) fix, then Step 4 re-run.**

**Step 5: Commit**

```bash
git add src/engine/__tests__/combat.test.ts
git commit -m "test(engine): group grows by bumping additional enemies"
```

---

## Task 9: `engine/demo.ts` + `engine/world.ts` (the `tick` reducer)

**Files:**
- Create: `src/engine/demo.ts`
- Create: `src/engine/world.ts`
- Create: `src/engine/index.ts`
- Test: `src/engine/__tests__/world.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { tick } from '../world';
import { createDemoWorld } from '../demo';

describe('world reducer', () => {
  it('does not mutate the input state (immutability boundary)', () => {
    const s0 = createDemoWorld();
    const p0 = s0.entities[s0.playerId].cell;
    const s1 = tick(s0, [{ type: 'move', dir: 'right' }], 50);
    expect(s0.entities[s0.playerId].cell).toBe(p0); // original untouched
    expect(s1).not.toBe(s0);
    expect(s1.tickCount).toBe(1);
  });
  it('applies a queued move and advances the clock', () => {
    const s0 = createDemoWorld();
    const start = s0.entities[s0.playerId].cell;
    const s1 = tick(s0, [{ type: 'move', dir: 'right' }], 50);
    expect(s1.entities[s1.playerId].cell.x).toBe(start.x + 1);
  });
  it('selectSkill switches the active hotkey slot (clamped to owned skills)', () => {
    const s0 = createDemoWorld();
    // player only owns 1 skill here; slot 5 should be ignored, slot 0 valid
    const s1 = tick(s0, [{ type: 'selectSkill', slot: 5 }], 50);
    expect(s1.entities[s1.playerId].activeSkillIndex).toBe(0);
  });
  it('demo world has 3 heroes and some enemies', () => {
    const s = createDemoWorld();
    const facts = Object.values(s.entities).map((e) => e.faction);
    expect(facts.filter((f) => f === 'player' || f === 'ally').length).toBe(3);
    expect(facts.filter((f) => f === 'enemy').length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm test -- world`
Expected: FAIL — modules `../world` / `../demo` not found.

**Step 3: Create `src/engine/demo.ts`**

```ts
import type { Entity, WorldState } from '../types';
import { makeEntity } from './entities';
import { demoMap, ENEMY_TEMPLATES } from '../data';

export function createDemoWorld(): WorldState {
  const map = demoMap(20, 12);
  const heroes: Entity[] = [
    makeEntity({ id: 'p1', faction: 'player', name: 'Hero', glyph: '🧙', cell: { x: 4, y: 6 }, level: 25, jobId: 'beginner' }),
    makeEntity({ id: 'p2', faction: 'ally', name: 'Ranya', glyph: '🏹', cell: { x: 3, y: 6 }, level: 24, jobId: 'archer' }),
    makeEntity({ id: 'p3', faction: 'ally', name: 'Pyra', glyph: '🔥', cell: { x: 3, y: 7 }, level: 24, jobId: 'magician' }),
  ];
  const enemies: Entity[] = [
    { t: ENEMY_TEMPLATES[0], cell: { x: 10, y: 5 } },
    { t: ENEMY_TEMPLATES[1], cell: { x: 12, y: 6 } },
    { t: ENEMY_TEMPLATES[2], cell: { x: 11, y: 8 } },
    { t: ENEMY_TEMPLATES[0], cell: { x: 14, y: 4 } },
  ].map((spec, i) =>
    makeEntity({ id: 'e' + i, faction: 'enemy', name: spec.t.name, glyph: spec.t.glyph, cell: spec.cell, level: 20, jobId: spec.t.jobId }),
  );

  const all = [...heroes, ...enemies];
  return {
    map,
    entities: Object.fromEntries(all.map((e) => [e.id, e])),
    groups: {},
    playerId: 'p1',
    seq: 0,
    tickCount: 0,
  };
}
```

**Step 4: Create `src/engine/world.ts`**

```ts
import type { Input, WorldState } from '../types';
import { moveOrStick, advanceCombat } from './combat';

export function applyInput(s: WorldState, input: Input): void {
  if (input.type === 'move') {
    moveOrStick(s, s.playerId, input.dir);
  } else if (input.type === 'selectSkill') {
    const p = s.entities[s.playerId];
    if (p && input.slot >= 0 && input.slot < p.skills.length) p.activeSkillIndex = input.slot;
  }
}

// Pure reducer: clones once, mutates the copy via commands, returns it.
// This exact signature is what a future authoritative server would run.
export function tick(state: WorldState, inputs: Input[], dt: number): WorldState {
  const s = structuredClone(state) as WorldState;
  for (const input of inputs) applyInput(s, input);
  advanceCombat(s, dt);
  s.tickCount += 1;
  return s;
}
```

**Step 5: Create `src/engine/index.ts`** (public surface for the app layer)

```ts
export * from './world';
export * from './demo';
export * from './combat';
export * from './skills';
export * from './jobs';
export * from './entities';
export * from './grid';
```

**Step 6: Run to verify it passes**

Run: `npm test -- world`
Expected: PASS.

Run: `npm test`
Expected: ALL suites green.

Run: `npm run typecheck`
Expected: no errors.

**Step 7: Commit**

```bash
git add src/engine/demo.ts src/engine/world.ts src/engine/index.ts src/engine/__tests__/world.test.ts
git commit -m "feat(engine): tick reducer and demo world factory"
```

---

## Task 10: `state/store.ts` (Zustand scene machine + engine bridge)

**Files:**
- Create: `src/state/store.ts`
- Test: `src/state/__tests__/store.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../store';

describe('game store', () => {
  beforeEach(() => useGame.getState().reset());
  it('starts on the dungeon scene with a demo world', () => {
    const st = useGame.getState();
    expect(st.scene).toBe('dungeon');
    expect(Object.keys(st.world.entities).length).toBeGreaterThan(0);
  });
  it('switches scenes', () => {
    useGame.getState().setScene('shop');
    expect(useGame.getState().scene).toBe('shop');
  });
  it('advance() drains the input queue into the engine', () => {
    const start = useGame.getState().world.entities.p1.cell.x;
    useGame.getState().enqueue({ type: 'move', dir: 'right' });
    useGame.getState().advance(50);
    expect(useGame.getState().world.entities.p1.cell.x).toBe(start + 1);
    expect(useGame.getState().inputQueue).toHaveLength(0);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm test -- store`
Expected: FAIL — module `../store` not found.

**Step 3: Create `src/state/store.ts`**

```ts
import { create } from 'zustand';
import type { Input, WorldState } from '../types';
import { createDemoWorld, tick } from '../engine';

export type Scene =
  | 'title'
  | 'worldMap'
  | 'dungeon'
  | 'shop'
  | 'skills'
  | 'charCreate'
  | 'hotkeys'
  | 'npcChat';

type GameStore = {
  scene: Scene;
  world: WorldState;
  inputQueue: Input[];
  setScene: (scene: Scene) => void;
  enqueue: (input: Input) => void;
  advance: (dt: number) => void;
  reset: () => void;
};

export const useGame = create<GameStore>((set, get) => ({
  scene: 'dungeon',
  world: createDemoWorld(),
  inputQueue: [],
  setScene: (scene) => set({ scene }),
  enqueue: (input) => set((st) => ({ inputQueue: [...st.inputQueue, input] })),
  advance: (dt) => set((st) => ({ world: tick(st.world, st.inputQueue, dt), inputQueue: [] })),
  reset: () => set({ scene: 'dungeon', world: createDemoWorld(), inputQueue: [] }),
}));

// Non-reactive read for the render loop (avoids re-subscribing every frame).
export const getWorld = () => get().world; // note: replaced below if lint complains
```

> If ESLint flags the trailing `getWorld` using `get` outside the creator, delete that last line and instead read via `useGame.getState().world` in the renderer. Keep the store minimal.

**Step 4: Run to verify it passes**

Run: `npm test -- store`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/state/store.ts src/state/__tests__/store.test.ts
git commit -m "feat(state): zustand scene machine and engine bridge"
```

---

## Task 11: `app/GameLoop.ts` (fixed-timestep driver)

**Files:**
- Create: `src/app/GameLoop.ts`

**Step 1: Create `src/app/GameLoop.ts`**

```ts
import { SIM_TICK_MS } from '../config';
import { useGame } from '../state/store';

// Fixed-timestep accumulator driven by requestAnimationFrame.
// Movement inputs are queued elsewhere; each sim step drains them.
export function startGameLoop(): () => void {
  let raf = 0;
  let last = 0;
  let acc = 0;
  let running = true;

  const frame = (t: number) => {
    if (!running) return;
    if (last === 0) last = t;
    acc = Math.min(acc + (t - last), SIM_TICK_MS * 5); // clamp to avoid spiral of death
    last = t;
    while (acc >= SIM_TICK_MS) {
      useGame.getState().advance(SIM_TICK_MS);
      acc -= SIM_TICK_MS;
    }
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}
```

**Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

**Step 3: Commit**

```bash
git add src/app/GameLoop.ts
git commit -m "feat(app): fixed-timestep game loop driver"
```

---

## Task 12: `render/PixiStage.tsx` + `render/WorldRenderer.ts`

Imperative Pixi: one `Application`, a 1920×1080 world container scaled to fit, redrawn from engine state each frame. Emoji entities via `Text`.

**Files:**
- Create: `src/render/WorldRenderer.ts`
- Create: `src/render/PixiStage.tsx`

**Step 1: Create `src/render/WorldRenderer.ts`**

```ts
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { WorldState } from '../types';
import { CELL_PX, DESIGN_W, DESIGN_H, ANIM_FRAME_MS, ANIM_FRAMES } from '../config';

// Draws the grid + entities imperatively from engine state. No React here.
export class WorldRenderer {
  readonly stage = new Container();
  private tiles = new Container();
  private actors = new Container();
  private tilesDrawn = false;

  constructor(private app: Application) {
    this.stage.addChild(this.tiles, this.actors);
    app.stage.addChild(this.stage);
  }

  private fit(world: WorldState) {
    const pxW = world.map.width * CELL_PX;
    const pxH = world.map.height * CELL_PX;
    const scale = Math.min(DESIGN_W / pxW, DESIGN_H / pxH, 1);
    this.stage.scale.set(scale);
    this.stage.x = (DESIGN_W - pxW * scale) / 2;
    this.stage.y = (DESIGN_H - pxH * scale) / 2;
  }

  private drawTilesOnce(world: WorldState) {
    if (this.tilesDrawn) return;
    const g = new Graphics();
    for (let y = 0; y < world.map.height; y++) {
      for (let x = 0; x < world.map.width; x++) {
        const wall = world.map.tiles[y * world.map.width + x] === 'wall';
        g.rect(x * CELL_PX, y * CELL_PX, CELL_PX - 1, CELL_PX - 1).fill(wall ? 0x22223a : 0x14142a);
      }
    }
    this.tiles.addChild(g);
    this.tilesDrawn = true;
    this.fit(world);
  }

  render(world: WorldState, elapsedMs: number) {
    this.drawTilesOnce(world);
    this.actors.removeChildren();
    const frame = Math.floor(elapsedMs / ANIM_FRAME_MS) % ANIM_FRAMES;

    for (const e of Object.values(world.entities)) {
      const inFight = Object.values(world.groups).some((gr) => gr.memberIds.includes(e.id));
      const cx = e.cell.x * CELL_PX;
      const cy = e.cell.y * CELL_PX;

      if (inFight) {
        const hi = new Graphics().rect(cx, cy, CELL_PX - 1, CELL_PX - 1).stroke({ width: 2, color: 0xff5555 });
        this.actors.addChild(hi);
      }
      // simple 3-frame "breathing" bob as an animation placeholder
      const bob = frame === 1 ? -3 : frame === 2 ? 3 : 0;
      const glyph = new Text({ text: e.glyph, style: { fontSize: 40 } });
      glyph.x = cx + CELL_PX / 2 - glyph.width / 2;
      glyph.y = cy + CELL_PX / 2 - glyph.height / 2 + bob;
      this.actors.addChild(glyph);

      // hp bar
      const pct = Math.max(0, e.hp / e.stats.maxHp);
      const bar = new Graphics()
        .rect(cx + 6, cy + CELL_PX - 8, CELL_PX - 12, 4).fill(0x333333)
        .rect(cx + 6, cy + CELL_PX - 8, (CELL_PX - 12) * pct, 4).fill(0x55dd55);
      this.actors.addChild(bar);
    }
  }

  destroy() {
    this.stage.destroy({ children: true });
  }
}
```

**Step 2: Create `src/render/PixiStage.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { DESIGN_W, DESIGN_H } from '../config';
import { useGame } from '../state/store';
import { WorldRenderer } from './WorldRenderer';

// Mounts one Pixi Application, scales the 1920x1080 stage to the viewport,
// and redraws from the live engine state every animation frame.
export function PixiStage() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current!;
    const app = new Application();
    let renderer: WorldRenderer | null = null;
    let raf = 0;
    let disposed = false;
    let start = 0;

    (async () => {
      await app.init({ width: DESIGN_W, height: DESIGN_H, background: 0x0b0b12, antialias: true });
      if (disposed) return app.destroy(true);
      host.appendChild(app.canvas);
      fit();
      window.addEventListener('resize', fit);
      renderer = new WorldRenderer(app);

      const loop = (t: number) => {
        if (start === 0) start = t;
        renderer!.render(useGame.getState().world, t - start);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();

    function fit() {
      const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
      app.canvas.style.transformOrigin = 'top left';
      app.canvas.style.transform = `scale(${scale})`;
      app.canvas.style.position = 'absolute';
      app.canvas.style.left = `${(window.innerWidth - DESIGN_W * scale) / 2}px`;
      app.canvas.style.top = `${(window.innerHeight - DESIGN_H * scale) / 2}px`;
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      renderer?.destroy();
      app.destroy(true);
    };
  }, []);

  return <div ref={hostRef} style={{ position: 'fixed', inset: 0 }} />;
}
```

**Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/render/WorldRenderer.ts src/render/PixiStage.tsx
git commit -m "feat(render): imperative Pixi world renderer with 1080p scaling"
```

---

## Task 13: `render/hud/` (square skill-timer + hotkey bar)

React overlay reading the store reactively.

**Files:**
- Create: `src/render/hud/SquareTimer.tsx`
- Create: `src/render/hud/HotkeyBar.tsx`
- Create: `src/render/hud/Hud.tsx`

**Step 1: Create `src/render/hud/SquareTimer.tsx`**

```tsx
import { useGame } from '../../state/store';
import { COMBAT_TICK_MS } from '../../config';

// Square countdown to the next auto-cast, driven by the player's group timer.
export function SquareTimer() {
  const world = useGame((s) => s.world);
  const group = Object.values(world.groups).find((g) => g.memberIds.includes(world.playerId));
  if (!group) return null;
  const pct = 1 - group.timerMs / COMBAT_TICK_MS;

  const size = 72;
  return (
    <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)' }}>
      <div style={{ width: size, height: size, background: '#1a1a2e', border: '2px solid #444', position: 'relative' }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: `${pct * 100}%`, background: '#5bd1ff' }} />
      </div>
    </div>
  );
}
```

**Step 2: Create `src/render/hud/HotkeyBar.tsx`**

```tsx
import { useGame } from '../../state/store';
import { SKILLS } from '../../data';

// Hotkeys 1..9 select the active skill; the active slot is highlighted.
export function HotkeyBar() {
  const world = useGame((s) => s.world);
  const player = world.entities[world.playerId];
  if (!player) return null;

  return (
    <div style={{ position: 'absolute', bottom: 24, right: 24, display: 'flex', gap: 8 }}>
      {player.skills.map((rt, i) => {
        const skill = SKILLS[rt.skillId];
        const active = i === player.activeSkillIndex;
        const cd = rt.cooldownLeftMs > 0;
        return (
          <div
            key={rt.skillId}
            style={{
              width: 64, height: 64, padding: 4, textAlign: 'center', fontSize: 12,
              color: '#eee', background: active ? '#2a3a5a' : '#1a1a2e',
              border: `2px solid ${active ? '#5bd1ff' : '#444'}`, opacity: cd ? 0.5 : 1,
            }}
          >
            <div style={{ fontWeight: 700 }}>{i + 1}</div>
            <div>{skill.name}</div>
            <div>{rt.usesLeft < 0 ? '∞' : rt.usesLeft}</div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: Create `src/render/hud/Hud.tsx`**

```tsx
import { SquareTimer } from './SquareTimer';
import { HotkeyBar } from './HotkeyBar';

export function Hud() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      <SquareTimer />
      <HotkeyBar />
    </div>
  );
}
```

**Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

**Step 5: Commit**

```bash
git add src/render/hud
git commit -m "feat(render): square skill-timer and hotkey bar HUD"
```

---

## Task 14: `screens/DungeonScreen.tsx` (playable slice)

Wires input → store, starts the game loop, mounts Pixi + HUD.

**Files:**
- Create: `src/screens/DungeonScreen.tsx`

**Step 1: Create `src/screens/DungeonScreen.tsx`**

```tsx
import { useEffect } from 'react';
import type { Direction } from '../types';
import { useGame } from '../state/store';
import { startGameLoop } from '../app/GameLoop';
import { PixiStage } from '../render/PixiStage';
import { Hud } from '../render/hud/Hud';

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export function DungeonScreen() {
  useEffect(() => startGameLoop(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return; // one cell per physical press; no speed limit, just no auto-repeat spam
      const dir = KEY_TO_DIR[e.key];
      if (dir) {
        e.preventDefault();
        useGame.getState().enqueue({ type: 'move', dir });
        return;
      }
      if (e.key >= '1' && e.key <= '9') {
        useGame.getState().enqueue({ type: 'selectSkill', slot: Number(e.key) - 1 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <PixiStage />
      <Hud />
    </>
  );
}
```

**Step 2: Manual smoke test**

Run: `npm run dev`
Then in the browser:
- Arrow keys move the 🧙 one cell per press.
- Walk into an enemy → red highlight appears (sticky block), enemy HP bar starts dropping every ~1.5s, square timer fills.
- Press `1`..`9` → active hotkey highlight changes.

Expected: all of the above work; killing an enemy removes it and dissolves the fight.

**Step 3: Commit**

```bash
git add src/screens/DungeonScreen.tsx
git commit -m "feat(screens): playable dungeon slice (movement + sticky auto-combat)"
```

---

## Task 15: `app/App.tsx` scene router + stub screens + README

**Files:**
- Create: `src/screens/WorldMapScreen.tsx`, `ShopScreen.tsx`, `SkillAllocationScreen.tsx`, `CharacterCreationScreen.tsx`, `HotkeyConfigScreen.tsx`, `NpcChatScreen.tsx`
- Create: `src/ui/StubScreen.tsx`
- Modify: `src/app/App.tsx`
- Modify: `README.md`

**Step 1: Create `src/ui/StubScreen.tsx`** (shared placeholder)

```tsx
import type { ReactNode } from 'react';
import { useGame } from '../state/store';

export function StubScreen({ title, children }: { title: string; children?: ReactNode }) {
  const setScene = useGame((s) => s.setScene);
  return (
    <div style={{ position: 'fixed', inset: 0, color: '#eee', fontFamily: 'sans-serif', padding: 32 }}>
      <button onClick={() => setScene('dungeon')} style={{ marginBottom: 16 }}>← Back to Dungeon</button>
      <h1>{title}</h1>
      <p style={{ opacity: 0.6 }}>Placeholder — awaiting Claude Design layout.</p>
      {children}
    </div>
  );
}
```

**Step 2: Create the six stub screens** (each identical shape)

```tsx
// src/screens/WorldMapScreen.tsx
import { StubScreen } from '../ui/StubScreen';
export function WorldMapScreen() { return <StubScreen title="World Map" />; }
```
Repeat for: `ShopScreen` ("Shop"), `SkillAllocationScreen` ("Skills & Attributes"), `CharacterCreationScreen` ("Character Creation"), `HotkeyConfigScreen` ("Hotkey Configuration"), `NpcChatScreen` ("NPC Chat & Quest").

**Step 3: Replace `src/app/App.tsx`** with the scene router + dev nav

```tsx
import { useGame, type Scene } from '../state/store';
import { DungeonScreen } from '../screens/DungeonScreen';
import { WorldMapScreen } from '../screens/WorldMapScreen';
import { ShopScreen } from '../screens/ShopScreen';
import { SkillAllocationScreen } from '../screens/SkillAllocationScreen';
import { CharacterCreationScreen } from '../screens/CharacterCreationScreen';
import { HotkeyConfigScreen } from '../screens/HotkeyConfigScreen';
import { NpcChatScreen } from '../screens/NpcChatScreen';

const SCREENS: Record<Scene, () => JSX.Element> = {
  title: DungeonScreen,
  dungeon: DungeonScreen,
  worldMap: WorldMapScreen,
  shop: ShopScreen,
  skills: SkillAllocationScreen,
  charCreate: CharacterCreationScreen,
  hotkeys: HotkeyConfigScreen,
  npcChat: NpcChatScreen,
};

const NAV: { scene: Scene; label: string }[] = [
  { scene: 'dungeon', label: 'Dungeon' },
  { scene: 'worldMap', label: 'World Map' },
  { scene: 'shop', label: 'Shop' },
  { scene: 'skills', label: 'Skills' },
  { scene: 'charCreate', label: 'Create' },
  { scene: 'hotkeys', label: 'Hotkeys' },
  { scene: 'npcChat', label: 'NPC' },
];

export default function App() {
  const scene = useGame((s) => s.scene);
  const setScene = useGame((s) => s.setScene);
  const Screen = SCREENS[scene];
  return (
    <>
      <Screen />
      <nav style={{ position: 'fixed', top: 8, left: 8, display: 'flex', gap: 6, zIndex: 10 }}>
        {NAV.map((n) => (
          <button key={n.scene} onClick={() => setScene(n.scene)}
            style={{ background: scene === n.scene ? '#2a3a5a' : '#1a1a2e', color: '#eee', border: '1px solid #444', padding: '4px 8px' }}>
            {n.label}
          </button>
        ))}
      </nav>
    </>
  );
}
```

**Step 4: Update `README.md`** — append a "Running the prototype" section

```markdown
## Running the prototype

    npm install
    npm run dev      # http://localhost:5173
    npm test         # engine unit tests
    npm run typecheck

**Controls (Dungeon screen):** arrow keys move one cell per press; walk into an
enemy to start combat; keys 1–9 switch the active skill. The top-left nav jumps
between screens (only the Dungeon is playable so far).

See `docs/plans/` for the design and implementation plan.
```

**Step 5: Full verification**

Run: `npm test`
Expected: all engine suites pass.

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors (in particular, the boundary rule confirms `engine/` imports no React/Pixi).

Run: `npm run dev`
Expected: nav bar switches screens; Dungeon is fully playable; stubs show placeholders.

**Step 6: Commit**

```bash
git add src/screens src/ui src/app/App.tsx README.md
git commit -m "feat(app): scene router, screen stubs, and run docs"
```

---

## Done — what you have

- A pure, unit-tested engine (`tick(state, inputs, dt) -> state`) with grid movement, sticky-block combat, shape-based skill targeting, use/cooldown rules, and a job DAG with class mixing.
- A PixiJS world renderer + React HUD at a scaled 1920×1080, with emoji placeholders.
- One playable dungeon slice and six navigable screen stubs ready for Claude Design's layouts.
- The import-boundary rule keeping the engine framework-agnostic, so the MMO extraction later is: move `engine/` + `types/config/data` into a shared package and run `tick` server-authoritatively.

## Phase 2 — full class & combat systems (separate plan, after the skeleton)

These implement the depth captured in design **§4b/§4c**. Each is an independent, TDD-able
task against the already-forward-compatible types. Sequence roughly as listed.

- **P2-A — Primary stat system.** Replace the `statsFor(level, growth)` placeholder with
  `deriveStats(primaries, level)` in `config.ts` (STR/DEX/INT/VIT → maxHp, maxMp, atk, def,
  accuracy, critChance, dodgeChance; every derived stat blends several primaries with
  class-specific but non-zero weights). Add `pointsForLevel(level)` + per-class auto-allocation
  for enemies so symmetry holds. Populate `Entity.primaries`; wire the Skill/Attribute screen to
  allocate points. Unit-test that a same-level player and enemy of an archetype stay ~50/50.
- **P2-B — Generative merged classes.** Replace the flat `JOBS` placeholder with
  `BASE_CLASSES` / `SECOND_CLASSES` / `PAIR_SKILLS` in `data.ts`; add `mergedSkills(a,b)` and
  `mergedName(a,b)` to `jobs.ts`; derive the unlock DAG from tiers. Author the 12 second classes'
  guaranteed skills and pair-specialized skills incrementally (66 pairs).
- **P2-C — Status effects.** Tick `entity.statuses` each combat round (poison = 10% maxHp;
  stun/slow/buffs/debuffs); scale a target's incoming crit rate with `statuses.length`; let
  skills apply statuses via `appliesStatus`.
- **P2-D — Ranged "invisible slots".** Give closing enemies `slotDistance`; decrement one
  slot/round along a wall-collided (enemy-permeable) lane; gate melee to `slotDistance 0`; let
  ranged skills hit at range. This is the trickiest sticky-block integration — spike it first.
- **P2-E — Rogue attack stacking.** Resolve `attacksPerRound` (2 base / 3 second+) stacked
  skills per tick, honoring per-skill uses/cooldowns.
- **P2-F — Telegraphed enemy AI.** Enemies announce AoE `telegraphRounds` (1–3) ahead and fire
  on the target area; default to attacking the first-engaged / nearest player within 8-adjacency;
  verify players can dodge by moving between ticks.
- **P2-G — Per-skill trigger rates, MP & attack speed.** Give each skill its own `triggerMs`
  accumulator (multiples of `STEP_MS` = 250; default 1500) so skills fire on independent
  cadences; the square timer tracks the player's active skill. Spend `mpCost` from `maxMp`;
  scale each skill's effective interval by a derived `attackSpeed` (hunter fast / sniper slow).
- **P2-H — Healing/buff skills & the "high" tier.** `healing`/`targetsAllies` skills for
  Paladin/Druid/Ranger; add the tier-3 "high" variations via the same generative pattern.

## Done — what the skeleton gives you
- A pure, unit-tested engine (`tick(state, inputs, dt) -> state`) with grid movement, sticky-block
  combat, shape-based skill targeting, use/cooldown rules, and a job DAG with class mixing.
- Forward-compatible types (`Primaries`, `StatusEffect`, `Skill` metadata, `Entity.statuses` /
  `attacksPerRound`) so Phase 2 adds behavior without reshaping data.
- A PixiJS world renderer + React HUD at a scaled 1920×1080, with emoji placeholders.
- One playable dungeon slice and six navigable screen stubs ready for Claude Design's layouts.
- The import-boundary rule keeping the engine framework-agnostic, so the MMO extraction later is:
  move `engine/` + `types/config/data` into a shared package and run `tick` server-authoritatively.

## Other follow-ups
- Replace emoji with Claude Design sprite sheets (swap `WorldRenderer` glyph drawing).
- Flesh out the six stub screens against Claude Design mockups.
- Add facing-based shape rotation for directional attacks.
- Extract `engine/` into a workspace package when the server work begins.
