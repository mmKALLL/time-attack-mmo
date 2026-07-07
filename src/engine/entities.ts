import type { Cell, Entity, EntityId, Faction, JobId, Skill, SkillRuntime } from '../types';
import { JOBS } from '../data';
import { statsFor, START_SKILL_LEVEL } from '../config';
import { kitOf } from './jobs';

export function skillRuntime(skill: Skill): SkillRuntime {
  return { skillId: skill.id, level: START_SKILL_LEVEL, usesLeft: skill.uses ?? -1, cooldownLeftMs: 0 };
}

// Heroes derive their kit from the job DAG (kitOf); monsters pass an explicit
// `skills` list (+ growth) since they aren't part of the player class tree.
export function makeEntity(params: {
  id: EntityId;
  faction: Faction;
  name: string;
  sprite: string;
  cell: Cell;
  level: number;
  jobId: JobId;
  skills?: Skill[];
  growth?: number;
  attainedJobs?: JobId[];
  elite?: boolean;
}): Entity {
  const job = JOBS[params.jobId];
  const growth = params.growth ?? job?.growth ?? 1;
  const stats = statsFor(params.level, growth);
  const kit = params.skills ?? kitOf(params.jobId);
  return {
    id: params.id,
    faction: params.faction,
    name: params.name,
    sprite: params.sprite,
    cell: params.cell,
    facing: 'down',
    level: params.level,
    xp: 0,
    jobId: params.jobId,
    attainedJobs: params.attainedJobs ?? [params.jobId],
    stats,
    hp: stats.maxHp,
    mp: stats.maxMp,
    skills: kit.map(skillRuntime),
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
