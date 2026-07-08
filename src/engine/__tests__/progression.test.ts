import { describe, it, expect } from 'vitest';
import type { WorldState } from '../../types';
import { createDemoWorld } from '../demo';
import { spendAttribute, levelUpSkill, skillCap } from '../progression';

// A fresh level-1 player has no points; grant some (as leveling would) to test.
function withPoints(): WorldState {
  const s = createDemoWorld();
  s.entities.p1.attrPoints = 12;
  s.entities.p1.skillPoints = 4;
  return s;
}

describe('progression: spending points', () => {
  it('a fresh level-1 player has no points to spend', () => {
    const s = createDemoWorld();
    expect(s.entities.p1.attrPoints).toBe(0);
    expect(s.entities.p1.skillPoints).toBe(0);
  });
  it('spends an attribute point, raising the primary + re-deriving stats', () => {
    const s = withPoints();
    const p = s.entities.p1;
    const before = { vit: p.primaries.vit, pts: p.attrPoints, maxHp: p.stats.maxHp };
    spendAttribute(s, 'vit');
    expect(p.primaries.vit).toBe(before.vit + 1);
    expect(p.attrPoints).toBe(before.pts - 1);
    expect(p.stats.maxHp).toBeGreaterThan(before.maxHp); // VIT raises maxHp
  });
  it('does nothing when the attribute pool is empty', () => {
    const s = createDemoWorld();
    const p = s.entities.p1;
    p.attrPoints = 0;
    const str = p.primaries.str;
    spendAttribute(s, 'str');
    expect(p.primaries.str).toBe(str);
  });
  it('raises a skill level and spends a skill point, capped by the skill', () => {
    const s = withPoints();
    const p = s.entities.p1;
    const rt = p.skills[0];
    const lvl = rt.level;
    levelUpSkill(s, 0);
    expect(p.skills[0].level).toBe(lvl + 1);
    expect(p.skillPoints).toBe(4 - 1);
  });
  it('will not raise a skill past its cap', () => {
    const s = createDemoWorld();
    const p = s.entities.p1;
    const rt = p.skills[0];
    rt.level = skillCap(rt.skillId);
    p.skillPoints = 5;
    levelUpSkill(s, 0);
    expect(p.skills[0].level).toBe(skillCap(rt.skillId)); // unchanged
    expect(p.skillPoints).toBe(5); // not spent
  });
  it('caps beginner skills at 5', () => {
    expect(skillCap('strike')).toBe(5);
  });
});
