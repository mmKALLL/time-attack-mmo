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
// Primary attributes are allocated (by class archetype × level); deriveStats
// turns them into the derived stats combat reads (see config.deriveStats and
// design-doc §"Stat system"). Every primary feeds several derived stats.
export type Primaries = { str: number; dex: number; int: number; vit: number };
// Base class a character resolves to for combat weighting (phys/mag split,
// min-damage ratio, attack speed, power). Config maps it to numbers.
export type CombatClass = 'beginner' | 'fighter' | 'archer' | 'magician' | 'rogue' | 'leader';
export type Stats = {
  maxHp: number;
  maxMp: number;
  minDmg: number; // damage roll floor (before skill multiplier + defense)
  maxDmg: number; // damage roll ceiling; also the "power" heals scale on
  def: number;
  accuracy: number; // vs the target's dodge -> hit chance
  crit: number; // crit chance %
  dodge: number;
  statusResist: number; // % chance to resist status effects (read by the future status system)
  attackSpeed: number; // skill-trigger speed multiplier as a % (100 = normal); scales DEX
};

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
export type ParamName = 'dmg' | 'heal' | 'healPercentage' | 'pct' | 'dur' | 'tiles' | 'hits' | 'uses' | 'targets' | 'delay' | 'cooldown';
export type SkillParams = Partial<Record<ParamName, SkillParamFunction>>;

export type SkillKind = 'attack' | 'heal' | 'buff' | 'debuff' | 'dot';
export type SkillElement = 'neutral' | 'steel' | 'guardian' | 'holy' | 'blade' | 'precision' | 'volley' | 'nature' | 'arcane' | 'fire' | 'primal' | 'guile' | 'poison' | 'shadow' | 'trap';
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
  telegraphMs?: number; // AoE wind-up (ms) before it resolves; required in practice on enemy AoE skills
  uses?: number; // cooldown charges (distinct from the {uses}/{hits} display params)
  cooldownMs: number; // level-1 cooldown in ms, derived from params.cooldown; backs the Hud passive-tag read
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
  primaries: Primaries; // allocated attributes (STR/DEX/INT/VIT)
  combatClass: CombatClass; // drives phys/mag split, attack speed, power
  stats: Stats; // derived from primaries + level via config.deriveStats
  hp: number;
  mp: number;
  skills: SkillRuntime[];
  activeSkillIndex: number; // hotkey slot 0..8
  castTimerMs: number; // per-entity auto-cast accumulator (attack speed varies by class)
  armed?: boolean; // player-only: a skill hotkey pressed OUT of combat winds up a ranged fire-and-engage (engine/combat.ts advanceArming); lazily false/undefined

  approachTimerMs?: number; // enemy-only: accumulates toward one greedy approach step while out of range (engine/combat.ts); lazily initialized
  attrPoints: number; // unspent attribute points (heroes; +3/level)
  skillPoints: number; // unspent skill points (heroes; +1/level)
  statuses: StatusEffect[]; // active DoTs/buffs/debuffs (empty in skeleton)
  attacksPerRound: number; // 1 normally; rogues stack 2–3 (Phase 2)
  elite?: boolean;
  home?: Cell; // spawn cell; roaming enemies have a small bias to drift back toward it
  // Idle-enemy roaming state (serializable; see engine/roaming.ts). Ungrouped
  // enemies alternate wait/move phases: `timerMs` counts down the current phase,
  // `dir`/`tilesLeft` describe the in-progress move sequence. Lazily initialized.
  roam?: { phase: 'wait' | 'move'; timerMs: number; dir: Direction; tilesLeft: number };
};

// ---------- Combat groups (sticky blocks) ----------
// Casting is per-entity (see Entity.castTimerMs); the group only tracks membership.
export type CombatGroup = {
  id: GroupId;
  memberIds: EntityId[];
};

// ---------- Maps ----------
export type MapId = string;
export type Biome = 'forest' | 'deepForest' | 'lake' | 'town'; // aligned with the tileset quadrants, eventually add all of farmland / plains / forest / mythical misty forest / deep dark forest / wet forest swamp / dry open swamp / lake / hill / mountain / tundra / snowy plains / snowy forest / cave / dungeon / village / town / city
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
// tops up by `spawnAmount` (never exceeding the cap). Each enemy's level is
// fixed by its definition, so the pool determines the difficulty band.
export type SpawnRule = {
  pool: string[];
  maxAmount: number;
  spawnInterval: number; // seconds
  spawnAmount: number;
};

export type TilesetName = 'forest' | 'lake' | 'deepForest' | 'town'; // floor/obstacle quadrants
export type GenParams = {
  width: number;
  height: number;
  tileset: TilesetName;
  roomCountMin: number;
  roomCountMax: number;
  roomShape: 'rectangular' | 'natural';
  corridorWidth: number;
  roomMin: number; // room side length (tiles)
  roomMax: number;
  torchDensity: number; // torches per 100 wall tiles
  obstacleCount: number;
};

// Per-biome map defaults. MapDef.gen/MapDef.spawns hold the fully-resolved
// per-map values; MAP_CONFIG (config.ts) supplies these biome defaults that the
// data-map builders start from and override per segment.
export type MapConfig = {
  width: number;
  height: number;
  gen: {
    roomCount: number; // base rooms; field() resolves to roomCountMin=roomCount, roomCountMax=roomCount+1
    roomMin: number; // room side length (tiles)
    roomMax: number;
    roomShape: 'rectangular' | 'natural';
    corridorWidth: number;
    torchDensity: number; // torches per 100 wall tiles
    obstacleCount: number;
  };
  spawns: {
    maxAmount: number;
    spawnInterval: number; // seconds
    spawnAmount: number;
  };
  light: {
    duskColor: number;
    ambientLightLevel: number; // 0-100 opacity of the dusk veil over un-torched areas (= old DUSK_OVERLAY.alpha * 100)
    torchGlowDistance: number; // cells a torch's glow reaches (= old TORCH_GLOW.cells)
  };
};

export type MapDef = {
  id: MapId;
  name: string;
  biome: Biome;
  recommended: [number, number]; // recommended level range (zone banner)
  description?: string; // towns: a one-line mythical blurb shown in the zone banner instead of the level
  gen: GenParams;
  connections: MapConnection[];
  spawns: SpawnRule[];
};

// Combat text events produced by a tick (damage/crit/heal/miss), for the renderer
// to spawn floating numbers. Carries the cell so a killing blow still shows after
// the target is removed. Reset each tick; consumed by tickCount.
export type HitEvent = { cell: Cell; from?: Cell; kind: 'damage' | 'crit' | 'heal' | 'miss'; amount: number };

// A telegraphed, dodgeable AoE (engine/combat.ts). On cast the footprint is
// snapped to ABSOLUTE map cells (centered on the target hero's cell) and LOCKED —
// it never moves again, even if the caster/block is dragged. After `remainingMs`
// it resolves, hitting whichever heroes still stand on `tiles`. The damage snapshot
// is taken at cast time so the hit rolls the same way `resolveAttack` does even if
// the caster dies during the delay. Serializable (plain data; threads through tick).
export type Telegraph = {
  tiles: Cell[]; // locked absolute map cells the AoE will strike
  remainingMs: number; // countdown to resolution (the dodge window)
  totalMs: number; // full wind-up (= the skill's telegraphMs); lets the renderer escalate the warning
  from: Cell; // caster's cell at cast (hit-event origin, for float drift)
  // Frozen attacker damage inputs (mirror caster.stats + class power + skill mag).
  accuracy: number;
  minDmg: number;
  maxDmg: number;
  power: number; // CLASS_COMBAT[class].power
  crit: number; // crit chance %
  mag: number; // skill damage multiplier = magnitude(skill, level)
};

// ---------- World ----------
export type WorldState = {
  mapId: MapId;
  map: TileMap;
  features: MapFeature[]; // obstacles + torches for the current map
  exits: MapExit[]; // generated portal tiles for the current map
  discovered: MapId[]; // maps the party has entered (serializable set; world-map "discovered zones")
  entities: Record<EntityId, Entity>;
  groups: Record<GroupId, CombatGroup>;
  playerId: EntityId;
  seq: number; // monotonic id source (deterministic)
  rng: number; // seeded PRNG state (deterministic)
  spawnClockMs: number; // accumulates toward the next respawn wave
  tickCount: number;
  hits: HitEvent[]; // combat text events from the latest tick
  telegraphs: Telegraph[]; // pending dodgeable AoEs on the current map (map-local)
};

// ---------- Inputs ----------
export type PrimaryKey = keyof Primaries;
export type Input =
  | { type: 'move'; dir: Direction }
  | { type: 'selectSkill'; slot: number } // 0..8 => keys 1..9
  | { type: 'spendAttr'; key: PrimaryKey } // raise a primary from the attribute pool
  | { type: 'levelUpSkill'; index: number } // raise a skill from the skill pool
  | { type: 'travelToMap'; mapId: MapId } // quick-travel to a discovered town from the world map
  | { type: 'respawn' }; // return to the starting town at full health
