import type { Entity, Skill, SkillRuntime } from '../types';
import { getSkill } from '../data-skills';
import { areEnemies } from './entities';
import { key } from './grid';
import { shapeFor } from './shapes';

export function activeSkillOf(e: Entity): Skill | undefined {
  const rt = e.skills[e.activeSkillIndex];
  return rt ? getSkill(rt.skillId) : undefined;
}

// Heal/buff skills target allies; attack/debuff/dot target enemies.
export function targetsAllies(skill: Skill): boolean {
  return skill.kind === 'heal' || skill.kind === 'buff';
}

// The dmg/heal multiplier applied on top of the caster's normal damage calc.
export function magnitude(skill: Skill, level: number): number {
  return (skill.params.dmg ?? skill.params.heal)?.(level) ?? 0;
}

// Targets = members whose offset from the caster matches the (level-scaled) shape.
export function skillTargets(caster: Entity, skill: Skill, members: Entity[], level: number): Entity[] {
  const shape = new Set(shapeFor(skill, level, caster.facing).map((o) => `${o.dx},${o.dy}`));
  const wantAlly = targetsAllies(skill);
  return members.filter((m) => {
    if (m.id === caster.id) return wantAlly && shape.has('0,0');
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
    const skill = getSkill(rt.skillId);
    const shouldTick = skill.cooldownType === 'passive' || i === e.activeSkillIndex;
    if (!shouldTick) return rt;
    return { ...rt, cooldownLeftMs: Math.max(0, rt.cooldownLeftMs - dt) };
  });
}
