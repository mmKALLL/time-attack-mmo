import { describe, it, expect } from 'vitest';
import { canUnlock, availableJobs, kitOf } from '../jobs';

describe('job DAG unlocking', () => {
  it('starter jobs are always unlockable', () => {
    expect(canUnlock('beginner', [])).toBe(true);
  });
  it('requires the parent before a child', () => {
    expect(canUnlock('knight', [])).toBe(false);
    expect(canUnlock('knight', ['fighter'])).toBe(true);
  });
  it('mixing requires BOTH parents', () => {
    expect(canUnlock('flameRanger', ['fireWizard'])).toBe(false);
    expect(canUnlock('flameRanger', ['fireWizard', 'ranger'])).toBe(true);
  });
  it('lists the four base classes from beginner', () => {
    const avail = availableJobs(['beginner']);
    expect(avail).toEqual(expect.arrayContaining(['fighter', 'archer', 'magician', 'rogue']));
    expect(avail).not.toContain('beginner');
    expect(avail).not.toContain('knight'); // parent (fighter) not yet attained
  });
  it('surfaces a fusion only once both second classes are attained', () => {
    expect(availableJobs(['fireWizard', 'ranger'])).toContain('flameRanger');
  });
});

describe('kitOf', () => {
  it('grants a base/second class its own grouped skills', () => {
    expect(kitOf('knight').map((s) => s.id)).toEqual(['aegisBastion', 'undyingProvocation', 'earthshatterBash']);
  });
  it('derives a fusion kit from both parents plus its specialized skills', () => {
    const kit = kitOf('flameRanger').map((s) => s.id);
    expect(kit).toHaveLength(9); // fireWizard 3 + ranger 3 + specialized 3
    expect(kit).toEqual(expect.arrayContaining(['cinderstorm', 'graspingThorns', 'phoenixFusillade']));
  });
});
