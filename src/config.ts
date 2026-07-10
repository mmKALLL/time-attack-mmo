import type { Biome, CombatClass, MapConfig } from './types';

// ---------- Debug ----------
export const DEBUG = false; // dev: start skills at Lv2 (else Lv1)
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
export const PLAYER_SPRITE_SCALE = 1.0; // player sprite render size vs one cell; scales taller+wider from the feet
export const FLOOR_CHECKER_SIZE = 4; // floor checkerboard alternates every N tiles
// Per-biome map defaults: footprint, generator params, spawn cadence, and
// lighting. A data-map field segment can override width/height and room count.
export const MAP_CONFIG: Record<Biome, MapConfig> = {
  town: {
    width: 15,
    height: 12,
    gen: { roomCount: 1, roomMin: 5, roomMax: 8, roomShape: 'rectangular', corridorWidth: 2, torchDensity: 4, obstacleCount: 2 },
    spawns: { maxAmount: 0, spawnInterval: 999, spawnAmount: 0 },
    light: { duskColor: 0x0a0a12, ambientDuskLevel: 0, torchGlowDistance: 7 },
  },
  forest: {
    width: 20,
    height: 15,
    gen: { roomCount: 2, roomMin: 5, roomMax: 8, roomShape: 'natural', corridorWidth: 2, torchDensity: 3, obstacleCount: 4 },
    spawns: { maxAmount: 5, spawnInterval: 6, spawnAmount: 1 },
    light: { duskColor: 0x0a0a12, ambientDuskLevel: 10, torchGlowDistance: 7 },
  },
  lake: {
    width: 22,
    height: 17,
    gen: { roomCount: 3, roomMin: 5, roomMax: 8, roomShape: 'natural', corridorWidth: 2, torchDensity: 3, obstacleCount: 7 },
    spawns: { maxAmount: 7, spawnInterval: 6, spawnAmount: 1 },
    light: { duskColor: 0x0a0e18, ambientDuskLevel: 0, torchGlowDistance: 7 },
  },
  deepForest: {
    width: 26,
    height: 20,
    gen: { roomCount: 3, roomMin: 5, roomMax: 8, roomShape: 'natural', corridorWidth: 1, torchDensity: 6, obstacleCount: 7 },
    spawns: { maxAmount: 6, spawnInterval: 10, spawnAmount: 1 },
    light: { duskColor: 0x05060e, ambientDuskLevel: 20, torchGlowDistance: 7 },
  },
};
// ---------- Lighting & screen overlays (drawn in render/WorldRenderer.ts) ----------
// Elliptical glow behind each enemy (wCells/hCells in tiles; pulseMs 0 = steady).
export const ENEMY_GLOW = { color: 0xff5a5a, wCells: 1.2, hCells: 1.5, intensity: 0.6, pulseMs: 2000 };
// export const ENEMY_GLOW = { color: 0x111111, wCells: 1.2, hCells: 1.7, intensity: 0.8, pulseMs: 0 };
// Additive torch glow (reach is per-biome MAP_CONFIG.light.torchGlowDistance).
export const TORCH_GLOW = { color: 0xffc27a, intensity: 0.5, pulseMs: 8000 };
// Celebratory level-up burst on a character (render/WorldRenderer.ts): flash +
// golden pillar + expanding rings + rotating starburst rays + rising sparkles +
// a popped "LEVEL UP!" banner. Tuned live; colors are the game's ember/gold.
export const LEVELUP_FX = {
  durationMs: 2800, // total lifetime of one burst (flash..banner fade)
  coreColor: 0xffffff, // the initial flash + brightest cores
  goldColor: 0xffce6b, // pillar / rays / banner glow (COLORS.emberHi)
  warmColor: 0xe08a3a, // warm accent on outer rings (COLORS.ember)
  pillarCells: 3.2, // pillar height, in tiles, rising from the character
  ringCount: 3, // staggered expanding halos at the feet/torso
  rayCount: 12, // starburst spokes radiating from the character
  particleCount: 16, // rising twinkling sparkle glints (capped, no per-frame textures)
} as const;
// Screen-edge vignette per biome. innerRadius = fully-clear centre, outerRadius =
// full-dark edge (fractions of the screen's min/max side).
export const VIGNETTE: Record<Biome, { edgeAlpha: number; warmAlpha: number; innerRadius: number; outerRadius: number }> = {
  town: { edgeAlpha: 0.35, warmAlpha: 0.0, innerRadius: 0.38, outerRadius: 0.68 },
  forest: { edgeAlpha: 0.65, warmAlpha: 0.0, innerRadius: 0.3, outerRadius: 0.62 },
  lake: { edgeAlpha: 0.42, warmAlpha: 0.05, innerRadius: 0.34, outerRadius: 0.66 },
  deepForest: { edgeAlpha: 0.8, warmAlpha: 0.0, innerRadius: 0.22, outerRadius: 0.56 },
};

// ---------- Timing ----------
export const SIM_TICK_MS = 50; // fixed simulation step (divides STEP_MS evenly)
export const STEP_MS = 250; // skill trigger rates are authored in these steps
export const COMBAT_TICK_MS = 1500; // default per-skill trigger interval (6 * STEP_MS)
export const KNOCKBACK_STEP_MS = 200; // a knocked-back foe slides one tile per this interval (engine/combat.ts)
export const ANIM_FRAME_MS = 420; // renderer 2-frame idle cadence
export const ANIM_FRAMES = 2; // handoff sprites have 2 animation frames
export const DAMAGE_FLOAT_MS = 1150;
export const DAMAGE_FLOAT_STACK_TILES = 0.3; // vertical gap between numbers stacking on the SAME character (in tiles)
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

// ---------- Progression ----------
// XP needed to advance from `level` to `level + 1`.
export function xpToNext(level: number): number {
  return Math.round((1.0 * Math.pow(level + 8, 2.4)) / 10) * 10; // 200, 250, 320, 390, 470, 560, 660, 780, 900, 1030
}
// XP granted for defeating an enemy of the given level.
export function xpReward(enemyLevel: number): number {
  return Math.round(42 * Math.pow(1.132883, enemyLevel - 1)); // Double every 6 levels
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
