import type { Entity, JobId, PrimaryKey, WorldState } from '../types';
import { SKILLS, getSkill } from '../data-skills';
import { SKILL_CAP, SKILL_CAP_BEGINNER, deriveStats } from '../config-stats';
import { JOBS, combatClassForJob } from '../data';
import { availableJobs, kitOf } from './jobs';

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

// ============================================================================
// Job advancement — walk the job DAG one step (beginner -> 1st job -> 2nd job).
// Fusions are gone (redesigned later), so every target has exactly one parent.
// ============================================================================

// Level required to advance INTO a target: a 1st job (parent === beginner) needs
// 10; every other (2nd) job needs 30.
export function advancementLevelReq(targetJobId: JobId): number {
  const job = JOBS[targetJobId];
  const firstJob = job?.requires.length === 1 && job.requires[0] === 'beginner';
  return firstJob ? 10 : 30;
}

// Whether the player may advance into targetJobId right now. Requires: the target
// is a valid next step for the attained jobs, ZERO unspent skill points, and the
// level requirement met. Returns a reason on failure (for the future panel/tooltip).
export function canAdvanceTo(p: Entity, targetJobId: JobId): { ok: boolean; reason?: string } {
  if (!availableJobs(p.attainedJobs).includes(targetJobId)) return { ok: false, reason: 'Not available' };
  if (p.skillPoints !== 0) return { ok: false, reason: 'Spend your skill points first' };
  const req = advancementLevelReq(targetJobId);
  if (p.level < req) return { ok: false, reason: `Reach level ${req} first` };
  return { ok: true };
}

// Every job the player could advance into from here, each with its display name,
// level requirement, and current eligibility (for the advancement panel UI).
export function advancementOptions(p: Entity): { jobId: JobId; name: string; levelReq: number; ok: boolean; reason?: string }[] {
  return availableJobs(p.attainedJobs).map((jobId) => {
    const { ok, reason } = canAdvanceTo(p, jobId);
    return { jobId, name: JOBS[jobId]?.name ?? jobId, levelReq: advancementLevelReq(jobId), ok, reason };
  });
}

// Advance the player into targetJobId. Validates via canAdvanceTo; on success:
// switches job/combatClass, appends to attainedJobs, re-derives stats (carrying the
// HP/MP surplus the way levelUp does), APPENDS the new job's kit at level 0 (only
// skills not already owned), and grants +1 skill point. Returns whether it advanced.
export function advanceJob(s: WorldState, targetJobId: JobId): boolean {
  const p = s.entities[s.playerId];
  if (!p) return false;
  if (!canAdvanceTo(p, targetJobId).ok) return false;

  const oldHp = p.stats.maxHp;
  const oldMp = p.stats.maxMp;
  p.jobId = targetJobId;
  p.attainedJobs.push(targetJobId);
  p.combatClass = combatClassForJob(targetJobId);
  p.stats = deriveStats(p.primaries, p.level, p.combatClass);
  p.hp = Math.min(p.stats.maxHp, p.hp + Math.max(0, p.stats.maxHp - oldHp));
  p.mp = Math.min(p.stats.maxMp, p.mp + Math.max(0, p.stats.maxMp - oldMp));

  // Accumulate: keep existing skills (+levels), append the new job's skills the
  // player doesn't already own, each UNLEARNT (level 0) until a point is spent.
  const owned = new Set(p.skills.map((rt) => rt.skillId));
  for (const skill of kitOf(targetJobId)) {
    if (owned.has(skill.id)) continue;
    owned.add(skill.id);
    p.skills.push({ skillId: skill.id, level: 0, usesLeft: getSkill(skill.id).uses ?? -1, cooldownLeftMs: 0 });
  }
  p.skillPoints += 1;
  return true;
}
