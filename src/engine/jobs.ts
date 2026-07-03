import type { JobId } from '../types';
import { JOBS } from '../data';

export function canUnlock(jobId: JobId, attained: JobId[]): boolean {
  const job = JOBS[jobId];
  if (!job) return false;
  return job.requires.every((r) => attained.includes(r));
}

export function availableJobs(attained: JobId[]): JobId[] {
  return Object.keys(JOBS).filter((id) => !attained.includes(id) && canUnlock(id, attained));
}
