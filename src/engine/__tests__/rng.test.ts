import { describe, it, expect } from 'vitest';
import { nextRand, randInt, pick } from '../rng';

describe('seeded PRNG', () => {
  it('is deterministic for a given seed', () => {
    const a = { rng: 42 };
    const b = { rng: 42 };
    expect([nextRand(a), nextRand(a), nextRand(a)]).toEqual([nextRand(b), nextRand(b), nextRand(b)]);
  });
  it('advances state between draws', () => {
    const s = { rng: 7 };
    expect(nextRand(s)).not.toBe(nextRand(s));
  });
  it('randInt stays within [min, max]', () => {
    const s = { rng: 99 };
    for (let i = 0; i < 200; i++) {
      const v = randInt(s, 3, 8);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(8);
    }
  });
  it('pick returns a member of the array', () => {
    const s = { rng: 5 };
    const arr = ['a', 'b', 'c'] as const;
    expect(arr).toContain(pick(s, arr));
  });
});
