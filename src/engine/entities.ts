import type { Cell, EnemyAsset, Entity, EntityId, CombatClass, Faction, JobId, Primaries, Skill, SkillRuntime } from '../types';
import { JOBS, archetypeForJob, combatClassForJob } from '../data';
import { ARCHETYPE_WEIGHTS, allocatePrimaries, deriveStats, scaleStats, START_SKILL_LEVEL } from '../config-stats';
import { kitOf } from './jobs';
import { NPC_ASSET_FILE, JOB_NPC_TILES, JOB_NPC_NAME, JOB_NPC_GREETING } from '../data-npc';

export function skillRuntime(skill: Skill): SkillRuntime {
  return { skillId: skill.id, level: START_SKILL_LEVEL, usesLeft: skill.uses ?? -1, cooldownLeftMs: 0 };
}

// Heroes derive their kit from the job DAG (kitOf); monsters pass an explicit
// `skills` list (+ growth) since they aren't part of the player class tree.
export function makeEntity(params: {
  id: EntityId;
  faction: Faction;
  name: string;
  sprite?: string;
  asset?: EnemyAsset;
  cell: Cell;
  level: number;
  jobId: JobId;
  primaries?: Primaries; // enemies pass explicit primaries; heroes auto-allocate by job
  combatClass?: CombatClass; // enemies pass their class; heroes derive it from the job
  statMult?: number; // uniform derived-stat multiplier (early-enemy penalty; 1 = none)
  skills?: Skill[];
  growth?: number;
  attainedJobs?: JobId[];
  elite?: boolean;
}): Entity {
  const job = JOBS[params.jobId];
  const growth = params.growth ?? job?.growth ?? 1;
  const primaries = params.primaries ?? allocatePrimaries(ARCHETYPE_WEIGHTS[archetypeForJob(params.jobId)], params.level, growth);
  const combatClass = params.combatClass ?? combatClassForJob(params.jobId);
  const stats = scaleStats(deriveStats(primaries, params.level, combatClass), params.statMult ?? 1);
  const kit = params.skills ?? kitOf(params.jobId);
  return {
    id: params.id,
    faction: params.faction,
    name: params.name,
    sprite: params.sprite ?? '',
    asset: params.asset,
    cell: params.cell,
    home: params.cell,
    facing: 'down',
    level: params.level,
    xp: 0,
    jobId: params.jobId,
    attainedJobs: params.attainedJobs ?? [params.jobId],
    primaries,
    combatClass,
    stats,
    hp: stats.maxHp,
    mp: stats.maxMp,
    skills: kit.map(skillRuntime),
    activeSkillIndex: 0,
    castTimerMs: 0,
    attrPoints: 3,
    skillPoints: 1,
    statuses: [],
    attacksPerRound: 1,
    elite: params.elite,
  };
}

// A non-combatant town NPC: neutral faction, spritesheet portrait from
// town-npc.png, and the themed dialogue lines shown when talked to. Builds on
// makeEntity with an unknown jobId ('npc') so archetype/class default to a
// balanced beginner and kitOf resolves to an empty skill list (they never fight).
// Level 1 with trivial derived stats; fully serializable.
export function makeNpc(params: { id: EntityId; name: string; tile: string; cell: Cell; dialogue: string[] }): Entity {
  const e = makeEntity({
    id: params.id,
    faction: 'npc',
    name: params.name,
    asset: { filename: NPC_ASSET_FILE, tiles: params.tile },
    cell: params.cell,
    level: 1,
    jobId: 'npc', // unknown job => balanced archetype, beginner class, empty kit (no skills)
    skills: [], // explicit: townsfolk carry no skills
  });
  e.dialogue = params.dialogue;
  e.npcRole = 'chat'; // ordinary townsfolk: opens dialogue when talked to
  e.attrPoints = 0; // townsfolk don't level/allocate
  e.skillPoints = 0;
  return e;
}

// The per-town job-advancement NPC (the Guildmaster): a neutral, non-combatant
// entity with the 2x2 Guildmaster sprite and npcRole 'jobAdvance'. Talking to it
// (later UI) opens the advancement panel. No random dialogue — carries a single
// fixed greeting line.
export function makeJobNpc(params: { id: EntityId; cell: Cell }): Entity {
  const e = makeEntity({
    id: params.id,
    faction: 'npc',
    name: JOB_NPC_NAME,
    asset: { filename: NPC_ASSET_FILE, tiles: JOB_NPC_TILES },
    cell: params.cell,
    level: 1,
    jobId: 'npc', // unknown job => balanced archetype, beginner class, empty kit (no skills)
    skills: [],
  });
  e.dialogue = [JOB_NPC_GREETING];
  e.npcRole = 'jobAdvance';
  e.attrPoints = 0;
  e.skillPoints = 0;
  return e;
}

export function isAlive(e: Entity): boolean {
  return e.hp > 0;
}

// Enemy faction is hostile to everyone non-enemy; players/allies are friendly.
// NPCs are neutral to everyone (never fight, never targeted).
export function areEnemies(a: Entity, b: Entity): boolean {
  if (a.faction === 'npc' || b.faction === 'npc') return false;
  const hostile = (f: Faction) => f === 'enemy';
  return hostile(a.faction) !== hostile(b.faction);
}
