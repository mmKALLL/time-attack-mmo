import { describe, it, expect } from 'vitest';
import { JOBS, SKILLS, MONSTERS, PARTY_SPAWN, ENEMY_SPAWN, demoMap } from '../data';

describe('content data', () => {
  it('models class mixing: flameRanger requires two second classes', () => {
    expect(JOBS.flameRanger.requires).toEqual(expect.arrayContaining(['fireWizard', 'ranger']));
  });
  it('every job grants only skills that exist', () => {
    for (const job of Object.values(JOBS))
      for (const s of job.grantsSkills) expect(SKILLS[s], `${job.id} -> ${s}`).toBeDefined();
  });
  it('flame ranger carries a 9-skill core', () => {
    expect(JOBS.flameRanger.grantsSkills).toHaveLength(9);
  });
  it('the 12 second classes each grant 3 guaranteed skills', () => {
    const seconds = Object.values(JOBS).filter((j) => j.role && j.requires.length === 1);
    expect(seconds).toHaveLength(12);
    for (const j of seconds) expect(j.grantsSkills.length).toBeGreaterThanOrEqual(3);
  });
  it('monsters reference existing skills and stay out of the player DAG', () => {
    for (const m of Object.values(MONSTERS)) {
      for (const s of m.skills) expect(SKILLS[s]).toBeDefined();
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
