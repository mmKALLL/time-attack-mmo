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
  it('lists the four base classes from beginner', () => {
    const avail = availableJobs(['beginner']);
    expect(avail).toEqual(expect.arrayContaining(['fighter', 'archer', 'magician', 'rogue']));
    expect(avail).not.toContain('beginner');
    expect(avail).not.toContain('knight'); // parent (fighter) not yet attained
  });
  it('surfaces a second class once its base is attained', () => {
    expect(availableJobs(['beginner', 'fighter'])).toContain('knight');
    expect(availableJobs(['beginner', 'fighter'])).not.toContain('sniper'); // needs archer, not fighter
  });
});

describe('kitOf', () => {
  it('grants a base/second class its own grouped skills', () => {
    expect(kitOf('knight').map((s) => s.id)).toEqual(['aegisBastion', 'provocation', 'earthsmash']);
  });
});
