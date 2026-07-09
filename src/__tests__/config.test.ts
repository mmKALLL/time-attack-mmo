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
      const improved = b.maxHp > a.maxHp || b.maxMp > a.maxMp || b.maxDmg > a.maxDmg || b.def > a.def || b.accuracy > a.accuracy || b.crit > a.crit || b.statusResist > a.statusResist;
      expect(improved, k).toBe(true);
    }
  });
  it('statusResist is round(10 + vit/2)', () => {
    expect(deriveStats({ str: 10, dex: 10, int: 10, vit: 0 }, 1).statusResist).toBe(10);
    expect(deriveStats({ str: 10, dex: 10, int: 10, vit: 24 }, 1).statusResist).toBe(22); // 10 + 12
    expect(deriveStats({ str: 10, dex: 10, int: 10, vit: 25 }, 1).statusResist).toBe(23); // round(10 + 12.5)
  });
  it('maxHp derives from VIT + level only, not STR', () => {
    const p: Primaries = { str: 10, dex: 10, int: 10, vit: 10 };
    expect(deriveStats({ ...p, str: 100 }, 5).maxHp).toBe(deriveStats(p, 5).maxHp); // STR does not move maxHp
    expect(deriveStats({ ...p, vit: 20 }, 5).maxHp).toBeGreaterThan(deriveStats(p, 5).maxHp); // VIT does
  });
  it('attackSpeed is 100 + 0.6*dex - 3 (a %; base dex 5 = 100)', () => {
    const at = (dex: number) => deriveStats({ str: 10, dex, int: 10, vit: 10 }, 1).attackSpeed;
    expect(at(5)).toBe(100); // 100 + 3 - 3 → exactly normal speed at the base dex
    expect(at(0)).toBe(97); // 100 + 0 - 3
    expect(at(25)).toBe(112); // 100 + 15 - 3
    expect(at(100)).toBeCloseTo(157, 5); // 100 + 60 - 3
    expect(at(20)).toBeGreaterThan(at(10)); // very gradual, monotonic in dex
  });
  it('DEX no longer feeds magical power: a pure-INT caster damage is unmoved by DEX via magical', () => {
    // Magician power = (0.2*physical + 0.8*magical)*2; magical = int*4 only now.
    // A DEX bump still nudges maxDmg through the 20% physical share, but must move
    // it by strictly less than when DEX also fed the 80% magical share (old model).
    const base: Primaries = { str: 0, dex: 10, int: 30, vit: 10 };
    const cur = deriveStats(base, 1, 'magician').maxDmg;
    const bumped = deriveStats({ ...base, dex: 30 }, 1, 'magician').maxDmg;
    const physOnly = 0.2 * (2 * 20) * 2; // +20 dex → +40 physical → +physical share only
    const withMagical = physOnly + 0.8 * (2 * 20) * 2; // what the old dex-in-magical model added
    expect(bumped - cur).toBeCloseTo(physOnly, 5); // moved by the physical share alone
    expect(bumped - cur).toBeLessThan(withMagical); // strictly less than the old model
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
