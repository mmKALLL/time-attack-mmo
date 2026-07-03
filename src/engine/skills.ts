import type { Entity, Skill, SkillRuntime } from '../types';
import { SKILLS } from '../data';
import { areEnemies } from './entities';
import { key } from './grid';

export function activeSkillOf(e: Entity): Skill | undefined {
  const rt = e.skills[e.activeSkillIndex];
  return rt ? SKILLS[rt.skillId] : undefined;
}

// Targets = members whose offset from the caster matches the skill shape.
// Healing/ally skills target allies; everything else targets enemies.
export function skillTargets(caster: Entity, skill: Skill, members: Entity[]): Entity[] {
  const shape = new Set(skill.shape.map((o) => `${o.dx},${o.dy}`));
  const wantAlly = skill.targetsAllies === true;
  return members.filter((m) => {
    if (m.id === caster.id) return skill.shape.some((o) => o.dx === 0 && o.dy === 0) && wantAlly;
    const friendly = !areEnemies(caster, m);
    if (wantAlly !== friendly) return false;
    return shape.has(key({ x: m.cell.x - caster.cell.x, y: m.cell.y - caster.cell.y }));
  });
}

export function canCast(rt: SkillRuntime): boolean {
  return rt.cooldownLeftMs <= 0 && rt.usesLeft !== 0;
}

// After a cast: unlimited skills (usesLeft < 0) are unchanged; limited skills
// decrement, and depleting the last use starts the cooldown and refills uses.
export function afterCast(rt: SkillRuntime, skill: Skill): SkillRuntime {
  if (rt.usesLeft < 0) return rt;
  const usesLeft = rt.usesLeft - 1;
  if (usesLeft <= 0) {
    return { ...rt, usesLeft: skill.uses ?? -1, cooldownLeftMs: skill.cooldownMs };
  }
  return { ...rt, usesLeft };
}

// Passive cooldowns always tick; active cooldowns tick only for the selected slot.
export function tickCooldowns(e: Entity, dt: number): SkillRuntime[] {
  return e.skills.map((rt, i) => {
    if (rt.cooldownLeftMs <= 0) return rt;
    const skill = SKILLS[rt.skillId];
    const shouldTick = skill.cooldownType === 'passive' || i === e.activeSkillIndex;
    if (!shouldTick) return rt;
    return { ...rt, cooldownLeftMs: Math.max(0, rt.cooldownLeftMs - dt) };
  });
}
