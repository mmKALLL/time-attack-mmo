import { describe, it, expect } from 'vitest';
import type { Skill } from '../types';
import { JOBS, SKILLS, SKILL_INDEX, MONSTERS, PARTY_SPAWN, ENEMY_SPAWN, demoMap } from '../data';

const groups = SKILLS as Record<string, Skill[]>;

describe('content data', () => {
  it('models class mixing: flameRanger requires two second classes', () => {
    expect(JOBS.flameRanger.requires).toEqual(expect.arrayContaining(['fireWizard', 'ranger']));
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
  it('monsters reference indexed skills and stay out of the player DAG', () => {
    for (const m of Object.values(MONSTERS)) {
      for (const s of m.skills) expect(SKILL_INDEX[s.id]).toBeDefined();
      expect(JOBS[m.id]).toBeUndefined();
    }
  });
  it('demo spawns reference real jobs and monsters', () => {
    for (const p of PARTY_SPAWN) expect(JOBS[p.jobId]).toBeDefined();
    for (const e of ENEMY_SPAWN) expect(MONSTERS[e.monster]).toBeDefined();
  });
  it('demo map is a bordered floor field', () => {
    const m = demoMap();
    expect(m.tiles).toHaveLength(m.width * m.height);
    expect(m.tiles[0]).toBe('wall');
  });
});
