import { describe, it, expect } from 'vitest';
import { canUnlock, availableJobs } from '../jobs';

describe('job DAG unlocking', () => {
  it('starter jobs are always unlockable', () => {
    expect(canUnlock('beginner', [])).toBe(true);
  });
  it('requires the parent before a child', () => {
    expect(canUnlock('knight', [])).toBe(false);
    expect(canUnlock('knight', ['swordsman'])).toBe(true);
  });
  it('mixing requires BOTH parents', () => {
    expect(canUnlock('flameRanger', ['fireWizard'])).toBe(false);
    expect(canUnlock('flameRanger', ['fireWizard', 'ranger'])).toBe(true);
  });
  it('lists the four base classes from beginner', () => {
    const avail = availableJobs(['beginner']);
    expect(avail).toEqual(expect.arrayContaining(['swordsman', 'archer', 'magician', 'rogue']));
    expect(avail).not.toContain('beginner');
    expect(avail).not.toContain('knight'); // parent (swordsman) not yet attained
  });
  it('surfaces a fusion only once both second classes are attained', () => {
    expect(availableJobs(['fireWizard', 'ranger'])).toContain('flameRanger');
  });
});
