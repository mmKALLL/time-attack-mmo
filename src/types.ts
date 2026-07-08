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
export type Stats = { maxHp: number; maxMp: number; atk: number; def: number };
export type Primaries = { str: number; dex: number; int: number; vit: number };

// ---------- Status effects (Phase 2 systems; type present now) ----------
export type StatusKind = 'poison' | 'stun' | 'slow' | 'atkUp' | 'atkDown' | 'defDown';
export type StatusEffect = { kind: StatusKind; potency: number; roundsLeft: number };

// ---------- Skills ----------
export const MAX_SKILL_LEVEL = 5;
export type CooldownType = 'passive' | 'active';

// Each {param} in a description has its own per-level formula. For dmg/heal the
// returned number is a MULTIPLIER on the character's normal damage calc; other
// params (pct/dur/tiles/...) return their literal per-level value.
export type SkillParamFunction = (level: number) => number;
export type ParamName = 'dmg' | 'heal' | 'pct' | 'dur' | 'tiles' | 'hits' | 'uses' | 'targets' | 'delay';
export type SkillParams = Partial<Record<ParamName, SkillParamFunction>>;

export type SkillKind = 'attack' | 'heal' | 'buff' | 'debuff' | 'dot';
export type SkillElement =
  | 'neutral' | 'steel' | 'guardian' | 'holy' | 'blade' | 'precision' | 'volley'
  | 'nature' | 'arcane' | 'fire' | 'primal' | 'guile' | 'poison' | 'shadow' | 'trap';
export type ShapeKind = 'self' | 'melee' | 'point' | 'line' | 'arc' | 'area' | 'cross' | 'party';

export type Skill = {
  id: SkillId;
  name: string;
  description: string; // template with {param} placeholders
  kind: SkillKind; // first tag: attack | heal | buff | debuff | dot
  target: string; // middle tag, display only (e.g. 'melee', 'adjacent-arc', 'area (cross)')
  element: SkillElement; // third tag
  shapeKind: ShapeKind;
  params: SkillParams;
  triggerMs?: number; // auto-cast interval; multiple of STEP_MS (250), default 1500
  uses?: number; // cooldown charges (distinct from the {uses}/{hits} display params)
  cooldownMs: number;
  cooldownType: CooldownType;
};
export type SkillRuntime = {
  skillId: SkillId;
  level: number; // 1..MAX_SKILL_LEVEL
  usesLeft: number; // -1 = unlimited
  cooldownLeftMs: number;
};

// ---------- Jobs ----------
export type Role = 'Tank' | 'Healer' | 'DPS' | 'Support' | 'Control' | 'Bruiser';
export type JobNode = {
  id: JobId;
  name: string;
  requires: JobId[]; // all must be attained (empty = starter); 2+ parents = "mixing"
  growth: number; // placeholder per-job stat growth (Phase 2: per-class primary bias)
  // Skills are grouped under the job in data.SKILLS and derived via kitOf() —
  // no bare skill-id lists on the node.
  role?: Role; // display: role chip
  accent?: string; // display: class-accent hex (party frames, hotbar labels)
};

// ---------- Entities ----------
export type Faction = 'player' | 'ally' | 'enemy';
// Reference into an enemy spritesheet: a filename (within assets/) + one or more
// "q<quadrant>-<index>" tiles (1 = single, 2 = stacked, 4 = 2x2), and which way
// the art faces (right by default).
export type EnemyAsset = { filename: string; tiles: string | string[]; facing?: 'left' | 'right' };

export type Entity = {
  id: EntityId;
  faction: Faction;
  name: string;
  sprite: string; // procedural (sprites.js) builder name for players
  asset?: EnemyAsset; // spritesheet art for asset-based enemies (overrides sprite)
  cell: Cell;
  facing: Direction;
  level: number;
  xp: number; // progress toward the next level (heroes)
  jobId: JobId;
  attainedJobs: JobId[];
  stats: Stats; // placeholder derived stats (Phase 2: computed from `primaries`)
  primaries?: Primaries; // populated once the primary-stat system lands
  hp: number;
  mp: number;
  skills: SkillRuntime[];
  activeSkillIndex: number; // hotkey slot 0..8
  statuses: StatusEffect[]; // active DoTs/buffs/debuffs (empty in skeleton)
  attacksPerRound: number; // 1 normally; rogues stack 2–3 (Phase 2)
  elite?: boolean;
};

// ---------- Combat groups (sticky blocks) ----------
export type CombatGroup = {
  id: GroupId;
  memberIds: EntityId[];
  timerMs: number; // accumulates to COMBAT_TICK_MS then fires
};

// ---------- Maps ----------
export type MapId = string;
export type Compass = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type ObstacleSize = '1x1' | '1x3' | '3x1' | '3x3';

// Generated per-cell decorations that sit on the collision grid. Obstacle cells
// are also baked into the tile grid as 'wall' (blocking); the feature carries
// the size/shape for rendering. Torches sit on wall cells (light comes later).
export type MapFeature =
  | { kind: 'obstacle'; size: ObstacleSize; cell: Cell } // cell = top-left corner
  | { kind: 'torch'; cell: Cell };

export type MapExit = { cell: Cell; toMap: MapId }; // a generated portal tile
export type MapConnection = { dir: Compass; toMap: MapId }; // which edge links where

// Respawn: the map holds up to `maxAmount` enemies; every `spawnInterval`s it
// tops up by `spawnAmount` (never exceeding the cap).
export type SpawnRule = {
  pool: string[];
  levelMin: number;
  levelMax: number;
  maxAmount: number;
  spawnInterval: number; // seconds
  spawnAmount: number;
};

export type GenParams = {
  width: number;
  height: number;
  roomCountMin: number;
  roomCountMax: number;
  roomShape: 'rectangular' | 'natural';
  corridorWidth: number;
  roomMin: number; // room side length (tiles)
  roomMax: number;
  torchDensity: number; // torches per 100 wall tiles
  obstacleCount: number;
};

export type MapDef = {
  id: MapId;
  name: string;
  biome: string;
  recommended: [number, number]; // recommended level range (zone banner)
  gen: GenParams;
  connections: MapConnection[];
  spawns: SpawnRule[];
};

// ---------- World ----------
export type WorldState = {
  mapId: MapId;
  map: TileMap;
  features: MapFeature[]; // obstacles + torches for the current map
  exits: MapExit[]; // generated portal tiles for the current map
  entities: Record<EntityId, Entity>;
  groups: Record<GroupId, CombatGroup>;
  playerId: EntityId;
  seq: number; // monotonic id source (deterministic)
  rng: number; // seeded PRNG state (deterministic)
  spawnClockMs: number; // accumulates toward the next respawn wave
  tickCount: number;
};

// ---------- Inputs ----------
export type Input =
  | { type: 'move'; dir: Direction }
  | { type: 'selectSkill'; slot: number }; // 0..8 => keys 1..9
