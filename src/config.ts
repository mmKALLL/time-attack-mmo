import type { CombatClass, Primaries, Stats } from './types';

// ---------- Debug ----------
export const DEBUG = false; // dev: start all skills at level 3 (else 0)
export const START_SKILL_LEVEL = DEBUG ? 3 : 0;
const isTest = import.meta.env?.MODE === 'test'; // deterministic maps/enemies under vitest
export const DEFAULT_SEED = DEBUG || isTest ? 1337 : Math.floor(Math.random() * 1e7); // starting RNG seed for the demo world
export const OBSTACLE_OVERLAY_ALPHA = 0.26; // red tint over obstacle-prop cells (0 to disable)

// ---------- Display / geometry ----------
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;
export const CELL_PX = 256; // logical tile size (px); 1 enemy-asset tile == 1 cell
export const SPRITE_SRC = 32; // procedural (player) sprites authored at 32x32
export const ENEMY_TILE_SRC = 256; // enemy spritesheet: one quadrant cell is 256x256
export const CAMERA_ZOOM_PCT = 40; // follow-camera zoom (256px tile * 0.5 = 128px on screen)
export const FLOOR_CHECKER_SIZE = 4; // floor checkerboard alternates every N tiles
// Elliptical glow behind each enemy. wCells/hCells are in tiles (h > w hugs a
// standing sprite); intensity is the additive alpha (0 disables).
// export const ENEMY_GLOW = { color: 0xff5a5a, wCells: 1.2, hCells: 1.7, intensity: 0.5 };
export const ENEMY_GLOW = { color: 0x1a1a1a, wCells: 1.5, hCells: 2, intensity: 0.8 };

// ---------- Timing ----------
export const SIM_TICK_MS = 50; // fixed simulation step (divides STEP_MS evenly)
export const STEP_MS = 250; // skill trigger rates are authored in these steps
export const COMBAT_TICK_MS = 1500; // default per-skill trigger interval (6 * STEP_MS)
export const ANIM_FRAME_MS = 420; // renderer 2-frame idle cadence
export const ANIM_FRAMES = 2; // handoff sprites have 2 animation frames
export const DAMAGE_FLOAT_MS = 1150;
export const MOVE_REPEAT_DELAY_MS = 0; // delay after the first step before auto-repeat kicks in
export const MOVE_REPEAT_MS = 225; // held-key auto-repeat cadence for movement

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
  rogue: { phys: 0.6, minDamageRatio: 0.4, speed: 1.3, power: 1.0 },
  leader: { phys: 0.5, minDamageRatio: 0.7, speed: 1.0, power: 1.0 },
};
// Enemy class -> combat class (enemies use 'mage'; players use 'magician').
export const ENEMY_CLASS_COMBAT: Record<string, CombatClass> = { fighter: 'fighter', archer: 'archer', mage: 'magician', rogue: 'rogue', leader: 'leader' };

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
  const power = phys * physical + (1 - phys) * magical;
  const accuracy = p.dex * 2;
  return {
    maxHp: p.vit * 30 + p.str * 5 + level * 10 + 15,
    maxMp: p.int * 8 + level * 2 - 2,
    minDmg: Math.round(power * minDamageRatio),
    maxDmg: Math.round(power),
    def: p.vit * 2 + p.str,
    accuracy,
    crit: critCurve(p.dex * 2 + p.int),
    dodge: accuracy * 0.25,
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
