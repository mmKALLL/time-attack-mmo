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
  shape: Offset[];                 // cells hit, relative to caster
  power: number;                   // multiplier on atk
  uses?: number;                   // limited uses before cooldown
  cooldownMs: number;
  cooldownType: 'passive' | 'active'; // passive ticks always; active only while selected
  // --- optional metadata (drives the deeper systems; skeleton ignores) ---
  category?: 'point' | 'adjacent' | 'line' | 'area';
  directional?: boolean;           // shape rotates to face the engaged side
  maxTargets?: number;
  accuracy?: number;               // hit chance (hunter low / sniper high)
  critChance?: number;
  appliesStatus?: { kind: StatusKind; potency: number; rounds: number };
  telegraphRounds?: number;        // enemy AoE warning (1–3 rounds)
  mpCost?: number;
  healing?: number;                // heals allies instead of damaging foes
  targetsAllies?: boolean;
};
```
- Hotkeys **1–9** set the active skill. Full attack-shape conventions per class are in **§4b**.

### Jobs / classes
- A **DAG** of job nodes progressing Beginner → base → second → merged → high; "mixing" is a node requiring two second classes (e.g. *flame ranger* requires *ranger* **and** *fire wizard*). The full multi-tier model, roster, and generative merged-class scheme are in **§4b**.

### Stat system (primaries → derived)
- **Primary stats (allocatable): STR, DEX, INT, VIT.** Players distribute points on the Skill/Attribute screen; enemies auto-distribute by level and class archetype so a same-level enemy mirrors a player.
- **Derived stats:** `maxHp`, `maxMp`, `atk` (attack power), `def`, `accuracy` (vs miss), `critChance`, `dodgeChance` (and later `attackSpeed`).
- **Every stat matters for every class:** each derived stat is a weighted blend of *several* primaries, with class-specific but **never-zero** weights — no dump stats. E.g. `atk = a·STR + b·DEX + c·INT + …`; VIT and DEX always contribute (VIT → maxHp/def, **DEX → accuracy/crit/dodge** plus a trickle to everything — LUK's old role is folded into DEX).
- **Symmetry preserved:** enemies run the *same* `deriveStats(primaries, level)`; their primaries come from a per-class auto-allocation of `pointsForLevel(level)`. So a level-N enemy ≈ a level-N player of that archetype → ~50/50, and hunting ~5 levels down is the intended fun grind.
- `config.ts` owns the weights and `deriveStats`. The **skeleton ships a simplified placeholder** (`statsFor(level, growth)` → `{maxHp, atk, def}`) until the full primary system lands (plan **Phase 2**).

---

## 4b. Class system (expanded)

### Tiers
- **Tier 0 — Beginner (root).** Everyone starts here. Character creation sets appearance/name; at a set level the Beginner advances into one of the four base classes.
- **Tier 1 — Base classes (4):** Swordsman, Archer, Magician, Rogue — broad flavors.
- **Tier 2 — Second classes (12; 3 per base):** each shifts the base into a distinct MMO role and grants **2–3 guaranteed skills**.
- **Merged classes (any pair):** *any* two second classes combine (unordered; **same-base pairs allowed** → **66** merges). Kit = A.guaranteed ∪ B.guaranteed ∪ **2–3 pair-specialized skills** ⇒ **6–9 skills**.
- **Tier 3 — "High" variations (later):** each merged class gets a "high" upgrade via the same generative pattern.

### Roster
| Base (flavor) | Second classes (role) |
| --- | --- |
| **Swordsman** — tanky, easy melee; 1v1 + adjacent 4/8-tile hits | **Knight** (tank) · **Paladin** (mild heals + more area) · **Duelist** (stronger 1v1 DPS, weak ranged/debuff) |
| **Archer** — nimble 1v1; ranged start; straight-line attacks only | **Hunter** (fast attack speed, high miss) · **Sniper** (slow, accurate crits) · **Ranger** (nature/buffs/arcane, lower DPS) |
| **Magician** — slow mob attacker; large directional hitboxes; many cooldowns | **Arcane Mage** (buff/debuff, Gandalf/D&D) · **Fire Wizard** (fire DPS) · **Druid** (huge slow attacks + heal + buff, Diablo 2 feel) |
| **Rogue** — glass cannon; close+far; stacks thief attacks | **Assassin** (crit, poison, debilitation; strong vs status-afflicted) · **Shadower** (very high dodge, melee, strong solo) · **Ninja** (throwing stars/ranged, traps) |

### Generative data model
- `BASE_CLASSES: Record<BaseId, { name; flavor; secondClassIds }>`
- `SECOND_CLASSES: Record<SecondId, { name; baseId; role; guaranteedSkills: SkillId[] }>`
- `PAIR_SKILLS: Record<PairKey, SkillId[]>` where `PairKey = [a, b].sort().join('+')`
- Derived: `mergedSkills(a, b) = unique([...gA, ...gB, ...PAIR_SKILLS[key(a,b)]])`; `mergedName(a, b)` from an optional bespoke-name map (e.g. "Flame Ranger") with a composed fallback until names are authored.
- The unlock DAG is derived from tiers: Beginner → base (requires Beginner) → second (requires base) → merged (requires both seconds) → high (requires merged).
- **Content backlog:** the 12 second classes' guaranteed skills, the 66 pairs' specialized skills, and bespoke merged names are authored incrementally — the schema above makes that additive.

### Attack-shape conventions
- **Swordsman:** point (1v1) and adjacent 4-/8-tile clusters.
- **Archer:** **straight lines only** — never diagonal, never large areas; may fire in multiple cardinal directions; longer reach.
- **Magician:** **large directional hitboxes** (wide/deep cones or rectangles).
- **Rogue:** point (close) + short line (far), resolved as **stacked** multi-attacks per round.

## 4c. Combat depth (expanded)

### Status effects
- Intentionally **very debilitating**. **Poison = 10% max HP/round.** Extensible `StatusKind` (poison, stun, slow, atk/def buffs & debuffs…).
- A target's **incoming critical-hit rate rises with the number of status effects on it** — stacking statuses makes a target increasingly fragile (core Assassin synergy).
- Model: `StatusEffect { kind; potency; roundsLeft }` on `entity.statuses`, ticked each combat round (DoT + expiry) alongside skill resolution.

### Ranged engagement — "invisible slots" (Archer opener)
- An archer opens combat at range. Between the engaged enemy and the player sit **invisible slots**: cells that **collide with walls but not with other enemies** (multiple enemies close through the same lane).
- A ranged-engaged enemy joins the combat group with `slotDistance > 0` and spends the first rounds **closing in** (one slot/round along the lane, blocked only by walls) until `slotDistance = 0`, then melees.
- Ranged attackers can strike members at range; melee only at `slotDistance 0`. The block still moves as a rigid unit; closing enemies trail at their slot offsets. *(Trickiest integration with the sticky-block; scheduled after the skeleton.)*

### Attack stacking (Rogue)
- A rogue resolves **multiple** attacks per combat round: **2** at base (first) class, **3** from second class onward. Modeled as `attacksPerRound` on the entity; that many stacked skills resolve per 1.5s tick.

### Enemy AI
- **Telegraphed AoE:** enemy area attacks are announced **1–3 rounds ahead** (target area shown); entities still standing in it when it fires take the hit.
- **Default behavior:** otherwise an enemy attacks the **player that first engaged it / nearest player in range**, hitting within its **8-adjacent** cells.
- **Free dodging:** player movement is **not** gated to combat rounds, so players step out of telegraphs and re-position between ticks — a skilled player dodges well **unless overwhelmed** by too many stuck enemies. Symmetric stats mean challenge scales with how many foes you take at once.

### Scaffold scope for §4b/§4c
The walking skeleton keeps its **simple** sticky combat (placeholder `statsFor` stats, a few basic skills, one attack/round, no statuses/ranged/telegraphs). The **types and data schema** for all the above are added up front so nothing is reworked, but the deep systems are built in the plan's **Phase 2**.

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
