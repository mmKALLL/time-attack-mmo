import type { Biome, CombatClass, Primaries, Stats } from './types';

// ---------- Debug ----------
export const DEBUG = false; // dev: start skills at Lv2 (else Lv1)
export const START_SKILL_LEVEL = DEBUG ? 2 : 1;
// ---------- Leveling: points granted per level + skill-level caps ----------
export const ATTR_POINTS_PER_LEVEL = 3;
export const SKILL_POINTS_PER_LEVEL = 1;
export const SKILL_CAP_BEGINNER = 5; // beginner skills cap at 5, later jobs at 10
export const SKILL_CAP = 10;
const isTest = import.meta.env?.MODE === 'test'; // deterministic maps/enemies under vitest
export const DEFAULT_SEED = DEBUG || isTest ? 1337 : Math.floor(Math.random() * 1e7); // starting RNG seed for the demo world
export const OBSTACLE_OVERLAY_ALPHA = 0.26; // red tint over obstacle-prop cells (0 to disable)

// ---------- Display / geometry ----------
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;
export const CELL_PX = 256; // logical tile size (px); 1 enemy-asset tile == 1 cell
export const SPRITE_SRC = 32; // procedural (player) sprites authored at 32x32
export const ENEMY_TILE_SRC = 256; // enemy spritesheet: one quadrant cell is 256x256
export const CAMERA_ZOOM_PERCENT = 50; // follow-camera zoom (256px tile * 0.5 = 128px on screen)
export const FLOOR_CHECKER_SIZE = 4; // floor checkerboard alternates every N tiles
// Default map footprint (tiles) per biome; a data-map field segment can override it.
export const MAP_SIZE: Record<Biome, { width: number; height: number }> = {
  town: { width: 15, height: 12 },
  forest: { width: 20, height: 15 },
  lake: { width: 22, height: 17 },
  deepForest: { width: 26, height: 20 },
};
// ---------- Lighting & screen overlays (drawn in render/WorldRenderer.ts) ----------
// Elliptical glow behind each enemy (wCells/hCells in tiles; pulseMs 0 = steady).
export const ENEMY_GLOW = { color: 0xff5a5a, wCells: 1.2, hCells: 1.5, intensity: 0.7, pulseMs: 2000 };
// export const ENEMY_GLOW = { color: 0x111111, wCells: 1.2, hCells: 1.7, intensity: 0.8, pulseMs: 0 };
// Additive torch glow (cells = diameter in tiles).
export const TORCH_GLOW = { color: 0xffc27a, cells: 7, intensity: 0.5, pulseMs: 8000 };
// Ambient "dusk" veil over the map, per biome (alpha 0 = none).
export const DUSK_OVERLAY: Record<Biome, { color: number; alpha: number }> = {
  town: { color: 0x0a0a12, alpha: 0 },
  forest: { color: 0x0a0a12, alpha: 0.1 },
  lake: { color: 0x0a0e18, alpha: 0 },
  deepForest: { color: 0x05060e, alpha: 0.2 },
};
// Screen-edge vignette per biome. innerRadius = fully-clear centre, outerRadius =
// full-dark edge (fractions of the screen's min/max side).
export const VIGNETTE: Record<Biome, { edgeAlpha: number; warmAlpha: number; innerRadius: number; outerRadius: number }> = {
  town: { edgeAlpha: 0.35, warmAlpha: 0.0, innerRadius: 0.38, outerRadius: 0.68 },
  forest: { edgeAlpha: 0.6, warmAlpha: 0.0, innerRadius: 0.3, outerRadius: 0.62 },
  lake: { edgeAlpha: 0.42, warmAlpha: 0.05, innerRadius: 0.34, outerRadius: 0.66 },
  deepForest: { edgeAlpha: 0.8, warmAlpha: 0.0, innerRadius: 0.22, outerRadius: 0.56 },
};

// ---------- Timing ----------
export const SIM_TICK_MS = 50; // fixed simulation step (divides STEP_MS evenly)
export const STEP_MS = 250; // skill trigger rates are authored in these steps
export const COMBAT_TICK_MS = 1500; // default per-skill trigger interval (6 * STEP_MS)
export const ANIM_FRAME_MS = 420; // renderer 2-frame idle cadence
export const ANIM_FRAMES = 2; // handoff sprites have 2 animation frames
export const DAMAGE_FLOAT_MS = 1150;
export const MOVE_REPEAT_DELAY_MS = 40; // delay after the first step before auto-repeat kicks in
export const MOVE_REPEAT_MS = 220; // held-key auto-repeat cadence (screens/DungeonScreen.tsx)
// Draw-only glide for a one-tile step; logic cell updates instantly (render/WorldRenderer.ts).
export const MOVE_LERP_MS = 90;

// ---------- Enemy combat AI (engine/combat.ts) ----------
// Static attack range per class, in Chebyshev tiles (max(|dx|,|dy|); diagonals
// count). Fighters/rogues/leaders are melee (2); archers/mages are ranged (4).
// An enemy attacks its nearest hero only when that hero is within this range.
export const ENEMY_ATTACK_RANGE: Record<CombatClass, number> = {
  beginner: 2,
  fighter: 2,
  archer: 4,
  magician: 4,
  rogue: 2,
  leader: 2,
};
// While out of range, an enemy accumulates this many ms before taking one greedy
// 4-way step toward its target (then resets). Intentionally slow/dumb approach.
export const ENEMY_APPROACH_MS = 2000;
// Lead time before a telegraphed AoE (mage/rogue/leader) resolves — the window
// the player has to walk off the marked tiles and dodge. ~1500ms ≈ one combat
// round (COMBAT_TICK_MS), long enough to read the danger overlay and step clear.
// A single global for now; per-skill "1–3 round" variety can key off the skill later.
export const ENEMY_TELEGRAPH_MS = 1500;

// ---------- Idle-enemy roaming ----------
// Ungrouped, alive enemies wander lazily (see engine/roaming.ts).
export const ENEMY_ROAM = {
  minDelayMs: 2000,
  maxDelayMs: 8000,
  minTiles: 1,
  maxTiles: 4,
  tileDelayMs: 1000,
  homeBias: 0.1, // chance per sequence to steer back toward the spawn point (soft leash)
} as const;

// ---------- Primary-stat allocation (symmetric for players AND enemies) ----------
// Points are spread by class archetype so every stat matters for every class
// (all weights non-zero). Enemies allocate the same way by level, keeping a
// same-level fight ~50/50.
export type Archetype = 'str' | 'dex' | 'int' | 'balanced';
export const PRIMARY_BASE = 5; // each primary at level 1
export const PRIMARY_POINTS_PER_LEVEL = 3; // design-doc: +3 attribute points / level
export const ARCHETYPE_WEIGHTS: Record<Archetype, Primaries> = {
  str: { str: 40, dex: 15, int: 15, vit: 30 },
  dex: { str: 20, dex: 40, int: 15, vit: 25 },
  int: { str: 15, dex: 15, int: 40, vit: 30 },
  balanced: { str: 25, dex: 25, int: 25, vit: 25 },
};
export function allocatePrimaries(w: Primaries, level: number, growth = 1): Primaries {
  const pts = PRIMARY_POINTS_PER_LEVEL * Math.max(0, level - 1) * growth;
  const sum = w.str + w.dex + w.int + w.vit || 1;
  const at = (k: keyof Primaries) => PRIMARY_BASE + Math.round((pts * w[k]) / sum);
  return { str: at('str'), dex: at('dex'), int: at('int'), vit: at('vit') };
}
// Which archetype each enemy class allocates toward — tune enemy stat leanings here.
export const ENEMY_CLASS_ARCHETYPE: Record<string, Archetype> = {
  fighter: 'str',
  archer: 'dex',
  mage: 'int',
  rogue: 'dex',
  leader: 'balanced',
};

// Per-class combat weighting (design-doc): `phys` = physical share of damage
// (magical = 1 - phys); `minDamageRatio` = minimum damage as a fraction of maximum
// (rogues 40%, everyone else 60%). `speed` scales attack cadence (rogues quicker,
// mages slower) and `power` scales per-hit damage (slow mages hit harder). Tune here.
export const CLASS_COMBAT: Record<CombatClass, { phys: number; minDamageRatio: number; speed: number; power: number }> = {
  beginner: { phys: 0.5, minDamageRatio: 0.6, speed: 1.0, power: 1.0 },
  fighter: { phys: 0.8, minDamageRatio: 0.6, speed: 1.0, power: 1.0 },
  archer: { phys: 0.4, minDamageRatio: 0.6, speed: 1.0, power: 1.0 },
  magician: { phys: 0.2, minDamageRatio: 0.6, speed: 0.8, power: 1.25 },
  rogue: { phys: 0.6, minDamageRatio: 0.4, speed: 1.5, power: 0.8 },
  leader: { phys: 0.5, minDamageRatio: 0.7, speed: 1.0, power: 1.0 },
};
// Enemy class -> combat class (enemies use 'mage'; players use 'magician').
export const ENEMY_CLASS_COMBAT: Record<string, CombatClass> = { fighter: 'fighter', archer: 'archer', mage: 'magician', rogue: 'rogue', leader: 'leader' };

// Early enemies (level <= maxLevel) take a flat stat penalty so a fresh, under-
// leveled player isn't overwhelmed. Applied to enemy derived stats only.
export const ENEMY_STAT_PENALTY = { maxLevel: 9, factor: 0.7 };

export function enemyStatMult(level: number): number {
  return level <= ENEMY_STAT_PENALTY.maxLevel ? ENEMY_STAT_PENALTY.factor : 1;
}

// ---------- Derived stats (design-doc formulas) ----------
// Crit grows as (dex*2+int)^0.7, softening to ^0.6 past 300; never a sure crit.
function critCurve(base: number): number {
  if (base <= 0) return 0;
  const c = base < 300 ? Math.pow(base, 0.7) : Math.pow(300, 0.7) + Math.pow(base - 300, 0.6);
  return Math.min(95, c);
}
// Power is a class-weighted blend of physical + magical (beginner 50/50); the
// class also sets how far minDmg sits below maxDmg.
export function deriveStats(p: Primaries, level: number, cls: CombatClass = 'beginner'): Stats {
  const physical = p.str * 4 + p.dex * 2;
  const magical = p.int * 4 + p.dex * 2;
  const { phys, minDamageRatio } = CLASS_COMBAT[cls];
  const power = (phys * physical + (1 - phys) * magical) * 2;
  const accuracy = p.dex * 2;
  return {
    maxHp: p.vit * 20 + p.str * 4 + level * 10 - 10,
    maxMp: p.int * 8 + level * 2 - 2,
    minDmg: Math.round(power * minDamageRatio),
    maxDmg: Math.round(power),
    def: p.str * 4,
    accuracy,
    crit: critCurve(p.dex * 2 + p.int),
    dodge: accuracy * 0.25,
  };
}

// Uniformly scale every derived stat (used for the early-enemy stat penalty).
export function scaleStats(s: Stats, mult: number): Stats {
  if (mult === 1) return s;
  return {
    maxHp: Math.max(1, Math.round(s.maxHp * mult)),
    maxMp: Math.round(s.maxMp * mult),
    minDmg: Math.round(s.minDmg * mult),
    maxDmg: Math.round(s.maxDmg * mult),
    def: Math.round(s.def * mult),
    accuracy: Math.round(s.accuracy * mult),
    crit: s.crit * mult,
    dodge: s.dodge * mult,
  };
}

// ---------- Damage / accuracy ----------
export const CRIT_MULT = 1.8; // crit deals 180% damage
// Hit rate = 1.2 - dodge/accuracy (5x accuracy over dodge => guaranteed hit).
export function hitChance(accuracy: number, dodge: number): number {
  if (accuracy <= 0) return 0.05;
  return Math.max(0.05, Math.min(1, 1.2 - dodge / accuracy));
}
// Final damage from a rolled base value, the skill multiplier, and target defense.
export function rawDamage(rolled: number, mult: number, def: number): number {
  return Math.max(1, Math.round(rolled * mult - def));
}

// ---------- Progression ----------
// XP needed to advance from `level` to `level + 1`.
export function xpToNext(level: number): number {
  return Math.round(60 * Math.pow(1.18, level - 1));
}
// XP granted for defeating an enemy of the given level.
export function xpReward(enemyLevel: number): number {
  return Math.round(15 * Math.pow(1.15, enemyLevel - 1));
}

// ---------- Combat world palette (Direction A "Emberdeep") ----------
export const COLORS = {
  stageBg: 0x07080b,
  floor: 0x4a4640,
  floorAlt: 0x524d45,
  gridLine: 0x2e2b27,
  wallTop: 0x6b5f50,
  wallBottom: 0x463d31,
  void: 0x16130f,
  attackCurrentFill: 0xe87c2c,
  attackCurrentBorder: 0xf4922e,
  attackPreview: 0xf09646,
  blockOutline: 0xe2e7f0,
  hp: 0xd8524a,
  hpEnemy: 0xc9463c,
  mp: 0x4a8fe0,
  timerPlayer: 0xe08a3a,
  timerEnemy: 0xc9463c,
  timerBorder: 0xe6c583,
  ember: 0xe08a3a,
  emberHi: 0xffce6b,
  gold: 0xc2a06a,
  critText: 0xf4922e,
  healText: 0x8fe0a0,
  normalText: 0xf2e8d2,
} as const;
