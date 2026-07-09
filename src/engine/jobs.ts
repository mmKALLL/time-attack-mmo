import type { JobId, Skill } from '../types';
import { JOBS } from '../data';
import { SKILLS } from '../data-skills';

export function canUnlock(jobId: JobId, attained: JobId[]): boolean {
  const job = JOBS[jobId];
  if (!job) return false;
  return job.requires.every((r) => attained.includes(r));
}

export function availableJobs(attained: JobId[]): JobId[] {
  return Object.keys(JOBS).filter((id) => !attained.includes(id) && canUnlock(id, attained));
}

// A job's kit: base/second classes grant their own grouped skills; a fusion
// grants both parents' skills plus its own specialized group (deduped). Falls
// back to any matching SKILLS group (e.g. monster skill lists).
export function kitOf(jobId: JobId): Skill[] {
  const groups = SKILLS as Record<string, Skill[]>;
  const own = groups[jobId] ?? [];
  const job = JOBS[jobId];
  if (job && job.requires.length >= 2) {
    const out: Skill[] = [];
    const seen = new Set<string>();
    const push = (s: Skill) => {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        out.push(s);
      }
    };
    for (const parent of job.requires) (groups[parent] ?? []).forEach(push);
    own.forEach(push);
    return out;
  }
  return own;
}
