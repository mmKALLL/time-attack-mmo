import { describe, it, expect } from 'vitest';
import type { Skill } from '../types';
import { JOBS, SKILLS, SKILL_INDEX, PARTY_SPAWN } from '../data';
import { MAPS, START_MAP, demoMap } from '../data-map';
import { ENEMIES } from '../data-enemy';

const groups = SKILLS as Record<string, Skill[]>;

describe('content data', () => {
  it('models class mixing: flameRanger requires two second classes', () => {
    expect(JOBS.flameRanger.requires).toEqual(expect.arrayContaining(['wizard', 'ranger']));
  });
  it('names the sword base class Fighter; its seconds require it', () => {
    expect(JOBS.fighter?.name).toBe('Fighter');
    expect(JOBS.knight.requires).toContain('fighter');
  });
  it('indexes every grouped skill by id', () => {
    for (const [job, list] of Object.entries(SKILLS))
      for (const s of list) expect(SKILL_INDEX[s.id], `${job} -> ${s.id}`).toBe(s);
  });
  it('the 12 second classes each define 3 guaranteed skills', () => {
    const seconds = Object.values(JOBS).filter((j) => j.role && j.requires.length === 1);
    expect(seconds).toHaveLength(12);
    for (const j of seconds) expect(groups[j.id]).toHaveLength(3);
  });
  it('enemies reference indexed skills, valid tile refs, and stay out of the player DAG', () => {
    for (const e of Object.values(ENEMIES)) {
      for (const s of e.skills) expect(SKILL_INDEX[s.id]).toBeDefined();
      expect(JOBS[e.id]).toBeUndefined();
      const tiles = Array.isArray(e.asset.tiles) ? e.asset.tiles : [e.asset.tiles];
      for (const t of tiles) expect(t).toMatch(/^q[1-4]-\d{1,2}$/);
    }
  });
  it('has fixed enemy levels that densely fill 1..40', () => {
    const levels = Object.values(ENEMIES).map((e) => e.level);
    for (const l of levels) expect(l).toBeGreaterThanOrEqual(1), expect(l).toBeLessThanOrEqual(40);
    expect(Math.min(...levels)).toBeLessThanOrEqual(2);
    expect(Math.max(...levels)).toBeGreaterThanOrEqual(38);
    const covered = new Set(levels);
    let gaps = 0;
    for (let l = 1; l <= 40; l++) if (!covered.has(l)) gaps++;
    expect(gaps).toBeLessThan(6);
  });
  it('party spawns reference real jobs', () => {
    for (const p of PARTY_SPAWN) expect(JOBS[p.jobId]).toBeDefined();
  });
  it('maps: spawn pools + connection targets are valid; START_MAP exists', () => {
    expect(MAPS[START_MAP]).toBeDefined();
    for (const m of Object.values(MAPS)) {
      expect(m.gen.width).toBeGreaterThan(0);
      for (const rule of m.spawns) for (const mon of rule.pool) expect(ENEMIES[mon]).toBeDefined();
      for (const c of m.connections) expect(MAPS[c.toMap]).toBeDefined();
    }
  });
  it('demo map is a bordered floor field', () => {
    const m = demoMap();
    expect(m.tiles).toHaveLength(m.width * m.height);
    expect(m.tiles[0]).toBe('wall');
  });
});
