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

// A skill is LEARNED (castable / on the hotbar) once its level reaches 1;
// level 0 means it's owned but unlearnt (appended by advancement, spent later).
export function isLearned(rt: SkillRuntime): boolean {
  return rt.level >= 1;
}

// Indexes into e.skills for the LEARNED skills (level >= 1), in slot order. This
// is the hotbar/hotkey order: hotkey slot N addresses learnedIndexes(e)[N].
export function learnedIndexes(e: Entity): number[] {
  const out: number[] = [];
  e.skills.forEach((rt, i) => {
    if (isLearned(rt)) out.push(i);
  });
  return out;
}

export function canCast(rt: SkillRuntime): boolean {
  return isLearned(rt) && rt.cooldownLeftMs <= 0 && rt.usesLeft !== 0;
}

// After a cast: unlimited skills (usesLeft < 0) are unchanged; limited skills
// decrement, and depleting the last use starts the cooldown and refills uses.
export function afterCast(rt: SkillRuntime, skill: Skill): SkillRuntime {
  const cooldownLeftMs = skill.params.cooldown ? Math.round(skill.params.cooldown(rt.level) * 1000) : skill.cooldownMs;
  if (rt.usesLeft < 0) {
    // Unlimited-use skills still enter cooldown when they define one (active-cooldown skills).
    return cooldownLeftMs > 0 ? { ...rt, cooldownLeftMs } : rt;
  }
  const usesLeft = rt.usesLeft - 1;
  if (usesLeft <= 0) {
    return { ...rt, usesLeft: skill.uses ?? -1, cooldownLeftMs };
  }
  return { ...rt, usesLeft };
}

// Cooldowns always tick down, regardless of which slot is selected.
export function tickCooldowns(e: Entity, dt: number): SkillRuntime[] {
  return e.skills.map((rt) => {
    if (rt.cooldownLeftMs <= 0) return rt;
    return { ...rt, cooldownLeftMs: Math.max(0, rt.cooldownLeftMs - dt) };
  });
}
