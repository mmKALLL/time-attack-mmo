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
export type CooldownType = 'passive' | 'active';
export type SkillCategory = 'point' | 'adjacent' | 'line' | 'area';
export type Skill = {
  id: SkillId;
  name: string;
  shape: Offset[]; // cells hit, relative to caster's cell
  power: number; // multiplier on atk
  triggerMs?: number; // auto-cast interval; multiple of STEP_MS (250), default 1500
  uses?: number; // limited uses before cooldown; omitted = unlimited
  cooldownMs: number;
  cooldownType: CooldownType;
  // --- optional metadata (drives Phase 2 systems / HUD; skeleton mostly ignores) ---
  category?: SkillCategory;
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
export type Role = 'Tank' | 'Healer' | 'DPS' | 'Support' | 'Control' | 'Bruiser';
export type JobNode = {
  id: JobId;
  name: string;
  requires: JobId[]; // all must be attained (empty = starter); 2+ parents = "mixing"
  growth: number; // placeholder per-job stat growth (Phase 2: per-class primary bias)
  grantsSkills: SkillId[];
  role?: Role; // display: role chip
  accent?: string; // display: class-accent hex (party frames, hotbar labels)
};

// ---------- Entities ----------
export type Faction = 'player' | 'ally' | 'enemy';
export type Entity = {
  id: EntityId;
  faction: Faction;
  name: string;
  sprite: string; // sprites.js builder name (e.g. 'ranger', 'slime')
  cell: Cell;
  facing: Direction;
  level: number;
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
