import type { Stats } from './types';

// ---------- Debug ----------
export const DEBUG = true; // dev: start all skills at level 3 (else 0)
export const START_SKILL_LEVEL = DEBUG ? 3 : 0;
export const DEFAULT_SEED = 1337; // starting RNG seed for the demo world

// ---------- Display / geometry ----------
export const DESIGN_W = 1920;
export const DESIGN_H = 1080;
export const CELL_PX = 256; // logical tile size (px); 1 enemy-asset tile == 1 cell
export const SPRITE_SRC = 32; // procedural (player) sprites authored at 32x32
export const ENEMY_TILE_SRC = 256; // enemy spritesheet: one quadrant cell is 256x256
export const CAMERA_ZOOM_PCT = 25; // follow-camera zoom (256px tile * 0.5 = 128px on screen)
export const FLOOR_CHECKER_SIZE = 4; // floor checkerboard alternates every N tiles

// ---------- Timing ----------
export const SIM_TICK_MS = 50; // fixed simulation step (divides STEP_MS evenly)
export const STEP_MS = 250; // skill trigger rates are authored in these steps
export const COMBAT_TICK_MS = 1500; // default per-skill trigger interval (6 * STEP_MS)
export const ANIM_FRAME_MS = 420; // renderer 2-frame idle cadence
export const ANIM_FRAMES = 2; // handoff sprites have 2 animation frames
export const DAMAGE_FLOAT_MS = 1150;
export const MOVE_REPEAT_DELAY_MS = 0; // delay after the first step before auto-repeat kicks in
export const MOVE_REPEAT_MS = 250; // held-key auto-repeat cadence for movement

// ---------- Symmetric stat model (used for BOTH players and enemies) ----------
// Placeholder for Phase 2's deriveStats(primaries, level).
const BASE = { maxHp: 60, maxMp: 30, atk: 9, def: 3 };
const PER_LEVEL = { maxHp: 74, maxMp: 8, atk: 3, def: 1.5 };

export function statsFor(level: number, growth: number): Stats {
  return {
    maxHp: Math.round((BASE.maxHp + PER_LEVEL.maxHp * (level - 1)) * growth),
    maxMp: Math.round((BASE.maxMp + PER_LEVEL.maxMp * (level - 1)) * growth),
    atk: Math.round((BASE.atk + PER_LEVEL.atk * (level - 1)) * growth),
    def: Math.round((BASE.def + PER_LEVEL.def * (level - 1)) * growth),
  };
}

// ---------- Damage ----------
export function damage(attackerAtk: number, skillPower: number, defenderDef: number): number {
  return Math.max(1, Math.round(attackerAtk * skillPower - defenderDef));
}

// ---------- Progression ----------
// XP needed to advance from `level` to `level + 1`.
export function xpToNext(level: number): number {
  return Math.round(60 * Math.pow(1.18, level - 1));
}
// XP granted for defeating an enemy of the given level.
export function xpReward(enemyLevel: number): number {
  return Math.round(15 * Math.pow(1.25, enemyLevel - 1));
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
