import { describe, it, expect } from 'vitest';
import { deriveStats, allocatePrimaries, ARCHETYPE_WEIGHTS, hitChance, rawDamage, xpToNext, xpReward } from '../config';
import type { Primaries } from '../types';

const sum = (p: Primaries) => p.str + p.dex + p.int + p.vit;

describe('primary allocation', () => {
  it('adds more points at higher level and with growth', () => {
    const w = ARCHETYPE_WEIGHTS.str;
    expect(sum(allocatePrimaries(w, 20))).toBeGreaterThan(sum(allocatePrimaries(w, 1)));
    expect(sum(allocatePrimaries(w, 20, 1.3))).toBeGreaterThan(sum(allocatePrimaries(w, 20, 1)));
  });
  it('leans toward the archetype primary', () => {
    const p = allocatePrimaries(ARCHETYPE_WEIGHTS.str, 30);
    expect(p.str).toBeGreaterThan(p.int);
  });
});

describe('derived stats', () => {
  it('is deterministic and scales with level + primaries', () => {
    const p: Primaries = { str: 20, dex: 10, int: 10, vit: 15 };
    expect(deriveStats(p, 25)).toEqual(deriveStats(p, 25));
    expect(deriveStats(p, 10).maxHp).toBeGreaterThan(deriveStats(p, 1).maxHp);
    const strong: Primaries = { str: 40, dex: 40, int: 40, vit: 40 };
    expect(deriveStats(strong, 10).maxDmg).toBeGreaterThan(deriveStats(p, 10).maxDmg);
  });
  it('every primary feeds at least one derived stat', () => {
    const base: Primaries = { str: 10, dex: 10, int: 10, vit: 10 };
    for (const k of ['str', 'dex', 'int', 'vit'] as const) {
      const a = deriveStats(base, 20);
      const b = deriveStats({ ...base, [k]: base[k] + 20 }, 20);
      const improved = b.maxHp > a.maxHp || b.maxMp > a.maxMp || b.maxDmg > a.maxDmg || b.def > a.def || b.accuracy > a.accuracy || b.crit > a.crit;
      expect(improved, k).toBe(true);
    }
  });
});

describe('combat math', () => {
  it('hit chance is ~0.95 at equal stats and clamps to [0.05,1]', () => {
    expect(hitChance(100, 25)).toBeCloseTo(0.95, 5);
    expect(hitChance(100, 0)).toBe(1);
    expect(hitChance(10, 1000)).toBe(0.05);
  });
  it('rawDamage is rolled*mult minus defense, floored at 1', () => {
    expect(rawDamage(10, 1, 3)).toBe(7);
    expect(rawDamage(2, 1, 100)).toBe(1);
  });
});

describe('progression', () => {
  it('xpToNext rises with level and xpReward is positive', () => {
    expect(xpToNext(10)).toBeGreaterThan(xpToNext(1));
    expect(xpReward(20)).toBeGreaterThan(0);
  });
});
