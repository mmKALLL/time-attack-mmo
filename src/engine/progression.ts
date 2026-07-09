import type { PrimaryKey, WorldState } from '../types';
import { SKILLS } from '../data-skills';
import { SKILL_CAP, SKILL_CAP_BEGINNER, deriveStats } from '../config-stats';

// Beginner skills cap at 5; every other job's skills cap at 10.
export function skillCap(skillId: string): number {
  return SKILLS.beginner.some((s) => s.id === skillId) ? SKILL_CAP_BEGINNER : SKILL_CAP;
}

// Spend one attribute point raising a primary, then re-derive stats. Any HP/MP
// the higher VIT/INT unlock is added to the current pool (so it feels rewarding).
export function spendAttribute(s: WorldState, key: PrimaryKey): void {
  const p = s.entities[s.playerId];
  if (!p || p.attrPoints <= 0) return;
  const oldHp = p.stats.maxHp;
  const oldMp = p.stats.maxMp;
  p.primaries[key] += 1;
  p.attrPoints -= 1;
  p.stats = deriveStats(p.primaries, p.level, p.combatClass);
  p.hp = Math.min(p.stats.maxHp, p.hp + Math.max(0, p.stats.maxHp - oldHp));
  p.mp = Math.min(p.stats.maxMp, p.mp + Math.max(0, p.stats.maxMp - oldMp));
}

// Spend one skill point raising a skill's level (respecting its cap).
export function levelUpSkill(s: WorldState, index: number): void {
  const p = s.entities[s.playerId];
  if (!p || p.skillPoints <= 0) return;
  const rt = p.skills[index];
  if (!rt || rt.level >= skillCap(rt.skillId)) return;
  rt.level += 1;
  p.skillPoints -= 1;
}
