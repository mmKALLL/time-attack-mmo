import type { Cell, Entity, EntityId, Faction, JobId, SkillId, SkillRuntime } from '../types';
import { JOBS, SKILLS } from '../data';
import { statsFor } from '../config';

export function skillRuntime(skillId: string): SkillRuntime {
  const s = SKILLS[skillId];
  return { skillId, usesLeft: s?.uses ?? -1, cooldownLeftMs: 0 };
}

// Flexible factory: heroes pass a `jobId` (looked up in JOBS for growth + kit);
// monsters pass explicit `growth` + `skillIds` and a non-JOBS `jobId` string.
export function makeEntity(params: {
  id: EntityId;
  faction: Faction;
  name: string;
  sprite: string;
  cell: Cell;
  level: number;
  jobId: JobId;
  skillIds?: SkillId[];
  growth?: number;
  attainedJobs?: JobId[];
  elite?: boolean;
}): Entity {
  const job = JOBS[params.jobId];
  const growth = params.growth ?? job?.growth ?? 1;
  const stats = statsFor(params.level, growth);
  const skillIds = params.skillIds ?? job?.grantsSkills ?? [];
  return {
    id: params.id,
    faction: params.faction,
    name: params.name,
    sprite: params.sprite,
    cell: params.cell,
    facing: 'down',
    level: params.level,
    jobId: params.jobId,
    attainedJobs: params.attainedJobs ?? [params.jobId],
    stats,
    hp: stats.maxHp,
    mp: stats.maxMp,
    skills: skillIds.map(skillRuntime),
    activeSkillIndex: 0,
    statuses: [],
    attacksPerRound: 1,
    elite: params.elite,
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
