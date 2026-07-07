import { describe, it, expect } from 'vitest';
import { statsFor, damage, xpToNext, xpReward } from '../config';

describe('symmetric stat model', () => {
  it('gives identical stats for the same level and growth', () => {
    expect(statsFor(25, 1)).toEqual(statsFor(25, 1));
  });
  it('scales up with level', () => {
    expect(statsFor(10, 1).atk).toBeGreaterThan(statsFor(1, 1).atk);
    expect(statsFor(10, 1).maxHp).toBeGreaterThan(statsFor(1, 1).maxHp);
  });
  it('applies growth as a multiplier', () => {
    expect(statsFor(20, 1.2).maxHp).toBeGreaterThan(statsFor(20, 1).maxHp);
  });
});

describe('damage', () => {
  it('is attack*power minus defense, floored at 1', () => {
    expect(damage(10, 1, 3)).toBe(7);
    expect(damage(2, 1, 100)).toBe(1);
  });
});

describe('progression', () => {
  it('xpToNext rises with level and xpReward is positive', () => {
    expect(xpToNext(10)).toBeGreaterThan(xpToNext(1));
    expect(xpReward(20)).toBeGreaterThan(0);
  });
});
