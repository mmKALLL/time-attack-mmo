import { describe, it, expect } from 'vitest';
import type { Entity, WorldState } from '../../types';
import { createDemoWorld } from '../demo';
import { advanceJob, canAdvanceTo, advancementLevelReq, advancementOptions } from '../progression';
import { learnedIndexes, canCast, isLearned } from '../skills';
import { makeEntity, makeJobNpc, makeNpc } from '../entities';
import { tick } from '../world';
import { spawnNpcs, travelTo } from '../maps';
import { combatClassForJob, JOBS } from '../../data';
import { kitOf } from '../jobs';
import { MAPS, START_MAP } from '../../data-map';

// A lone hero at a given job/level with a controllable skill-point pool.
function hero(jobId: string, level: number): Entity {
  return makeEntity({ id: 'h', faction: 'player', name: 'H', sprite: 'ranger', cell: { x: 1, y: 1 }, level, jobId });
}

describe('advancementLevelReq', () => {
  it('1st jobs (parent = beginner) need 10; 2nd jobs need 30', () => {
    expect(advancementLevelReq('fighter')).toBe(10);
    expect(advancementLevelReq('archer')).toBe(10);
    expect(advancementLevelReq('knight')).toBe(30); // requires fighter, not beginner
    expect(advancementLevelReq('sniper')).toBe(30);
  });
});

describe('canAdvanceTo', () => {
  it('blocks a level-1 beginner from a 1st job, citing level 10', () => {
    const p = hero('beginner', 1);
    p.skillPoints = 0;
    const r = canAdvanceTo(p, 'fighter');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('10');
  });
  it('allows a level-10 beginner with 0 SP into any 1st job', () => {
    const p = hero('beginner', 10);
    p.skillPoints = 0;
    for (const target of ['fighter', 'archer', 'magician', 'rogue']) {
      expect(canAdvanceTo(p, target).ok).toBe(true);
    }
  });
  it('blocks advancement while skill points are unspent, citing skill points', () => {
    const p = hero('beginner', 10);
    p.skillPoints = 2;
    const r = canAdvanceTo(p, 'fighter');
    expect(r.ok).toBe(false);
    expect(r.reason?.toLowerCase()).toContain('skill point');
  });
  it('blocks a target that is not a valid next step', () => {
    const p = hero('beginner', 40);
    p.skillPoints = 0;
    expect(canAdvanceTo(p, 'knight').ok).toBe(false); // fighter not yet attained
    expect(canAdvanceTo(p, 'knight').reason).toBe('Not available');
  });
  it('a 2nd job needs level 30 (level 10 is not enough)', () => {
    const p = hero('fighter', 10);
    p.attainedJobs = ['beginner', 'fighter'];
    p.skillPoints = 0;
    const r = canAdvanceTo(p, 'knight');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('30');
    p.level = 30;
    expect(canAdvanceTo(p, 'knight').ok).toBe(true);
  });
});

describe('advancementOptions', () => {
  it('lists every next-step job with name + level req + eligibility', () => {
    const p = hero('beginner', 10);
    p.skillPoints = 0;
    const opts = advancementOptions(p);
    const ids = opts.map((o) => o.jobId).sort();
    expect(ids).toEqual(['archer', 'fighter', 'magician', 'rogue']);
    const fighter = opts.find((o) => o.jobId === 'fighter')!;
    expect(fighter.name).toBe(JOBS.fighter.name);
    expect(fighter.levelReq).toBe(10);
    expect(fighter.ok).toBe(true);
  });
});

describe('advanceJob', () => {
  function readyBeginner(): WorldState {
    const s = createDemoWorld();
    const p = s.entities[s.playerId];
    p.level = 10;
    p.skillPoints = 0;
    return s;
  }

  it('advances a level-10, 0-SP beginner into fighter', () => {
    const s = readyBeginner();
    const p = s.entities[s.playerId];
    const beforeSkills = p.skills.map((rt) => ({ ...rt }));
    const beforeLen = p.skills.length;

    expect(advanceJob(s, 'fighter')).toBe(true);
    expect(p.jobId).toBe('fighter');
    expect(p.attainedJobs).toContain('fighter');
    expect(p.combatClass).toBe(combatClassForJob('fighter'));
    expect(p.skillPoints).toBe(1); // +1 granted

    // Existing beginner skills keep their levels (position + level unchanged).
    for (let i = 0; i < beforeLen; i++) {
      expect(p.skills[i].skillId).toBe(beforeSkills[i].skillId);
      expect(p.skills[i].level).toBe(beforeSkills[i].level);
    }
    // Fighter kit appended at level 0 (unlearnt), only new ids.
    const fighterIds = kitOf('fighter').map((sk) => sk.id);
    for (const id of fighterIds) {
      const rt = p.skills.find((r) => r.skillId === id)!;
      expect(rt).toBeDefined();
    }
    const appended = p.skills.slice(beforeLen);
    expect(appended.length).toBe(fighterIds.length);
    for (const rt of appended) expect(rt.level).toBe(0);
  });

  it('does not add duplicate skills already owned', () => {
    const s = readyBeginner();
    const p = s.entities[s.playerId];
    advanceJob(s, 'fighter');
    const ids = p.skills.map((r) => r.skillId);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
  });

  it('returns false and mutates nothing for an invalid target', () => {
    const s = readyBeginner();
    const p = s.entities[s.playerId];
    const snapshot = JSON.stringify(p);
    expect(advanceJob(s, 'knight')).toBe(false); // fighter not attained
    expect(JSON.stringify(p)).toBe(snapshot);
  });

  it('is driven by the advanceJob input through tick', () => {
    const s0 = readyBeginner();
    const s1 = tick(s0, [{ type: 'advanceJob', jobId: 'fighter' }], 50);
    expect(s1.entities[s1.playerId].jobId).toBe('fighter');
    expect(s0.entities[s0.playerId].jobId).toBe('beginner'); // input untouched
  });
});

describe('level-0 (unlearnt) skill model', () => {
  it('canCast is false for a level-0 skill and true for a learned one', () => {
    expect(canCast({ skillId: 'strike', level: 0, usesLeft: -1, cooldownLeftMs: 0 })).toBe(false);
    expect(canCast({ skillId: 'strike', level: 1, usesLeft: -1, cooldownLeftMs: 0 })).toBe(true);
    expect(isLearned({ skillId: 'strike', level: 0, usesLeft: -1, cooldownLeftMs: 0 })).toBe(false);
  });

  it('learnedIndexes returns only level>=1 slots, in order', () => {
    const e = hero('beginner', 10);
    e.skills = [
      { skillId: 'strike', level: 1, usesLeft: -1, cooldownLeftMs: 0 },
      { skillId: 'stab', level: 0, usesLeft: -1, cooldownLeftMs: 0 }, // unlearnt
      { skillId: 'recover', level: 2, usesLeft: -1, cooldownLeftMs: 0 },
    ];
    expect(learnedIndexes(e)).toEqual([0, 2]);
  });

  it('selectSkill maps a hotkey slot to the Nth LEARNED skill', () => {
    const s = createDemoWorld();
    const p = s.entities[s.playerId];
    // slot0 -> learned index 0, slot1 -> the SECOND learned skill (skipping unlearnt).
    p.skills = [
      { skillId: 'strike', level: 1, usesLeft: -1, cooldownLeftMs: 0 }, // learned index 0 (slot 0)
      { skillId: 'stab', level: 0, usesLeft: -1, cooldownLeftMs: 0 }, // unlearnt, skipped
      { skillId: 'recover', level: 1, usesLeft: -1, cooldownLeftMs: 0 }, // learned index 2 (slot 1)
    ];
    p.activeSkillIndex = 0;
    const s1 = tick(s, [{ type: 'selectSkill', slot: 1 }], 50);
    expect(s1.entities[s1.playerId].activeSkillIndex).toBe(2); // 2nd learned skill lives at slot index 2
    // Out-of-range slot (only 2 learned) is ignored.
    const s2 = tick(s, [{ type: 'selectSkill', slot: 2 }], 50);
    expect(s2.entities[s2.playerId].activeSkillIndex).toBe(0);
  });
});

describe('fusions removed', () => {
  it('the three fusion jobs are undefined', () => {
    expect(JOBS.flameRanger).toBeUndefined();
    expect(JOBS.nimbleKnight).toBeUndefined();
    expect(JOBS.cinderSage).toBeUndefined();
  });
});

describe('job-advancement NPC spawning', () => {
  const jobNpcs = (s: WorldState) => Object.values(s.entities).filter((e) => e.npcRole === 'jobAdvance');

  it('a town spawns exactly one jobAdvance NPC plus the townsfolk', () => {
    const s = createDemoWorld(); // starts in the START_MAP town
    expect(MAPS[START_MAP].biome).toBe('town');
    const job = jobNpcs(s);
    expect(job).toHaveLength(1);
    expect(job[0].name).toBeTruthy();
    expect(job[0].faction).toBe('npc');
    expect(Array.isArray(job[0].asset?.tiles)).toBe(true); // 2x2 tile array
    // townsfolk (chat) NPCs are present alongside it
    const chat = Object.values(s.entities).filter((e) => e.npcRole === 'chat');
    expect(chat.length).toBeGreaterThan(0);
  });

  it('non-town (field) maps spawn no jobAdvance NPC', () => {
    const s = createDemoWorld();
    const field = s.exits[0].toMap;
    travelTo(s, field, s.mapId); // step into the first field map
    expect(MAPS[field].biome).not.toBe('town');
    expect(jobNpcs(s)).toHaveLength(0); // no advancement NPC outside towns
  });

  it('spawnNpcs places the job NPC off portals and off other entities', () => {
    const s = createDemoWorld();
    const job = jobNpcs(s)[0];
    const t = s.map.tiles[job.cell.y * s.map.width + job.cell.x];
    expect(t).toBe('floor');
    // not sharing a cell with any other entity
    const others = Object.values(s.entities).filter((e) => e.id !== job.id);
    for (const o of others) expect(`${o.cell.x},${o.cell.y}`).not.toBe(`${job.cell.x},${job.cell.y}`);
  });

  it('makeJobNpc / makeNpc set the right npcRole', () => {
    expect(makeJobNpc({ id: 'j', cell: { x: 1, y: 1 } }).npcRole).toBe('jobAdvance');
    expect(makeNpc({ id: 'n', name: 'N', tile: 'q3-1', cell: { x: 1, y: 1 }, dialogue: ['hi'] }).npcRole).toBe('chat');
  });

  it('spawnNpcs is deterministic under the seed (same job-NPC placement)', () => {
    const posOf = (w: WorldState) => {
      const j = Object.values(w.entities).find((e) => e.npcRole === 'jobAdvance')!;
      return `${j.cell.x},${j.cell.y}`;
    };
    expect(posOf(createDemoWorld())).toBe(posOf(createDemoWorld()));
    // spawnNpcs is callable directly without crashing
    const s = createDemoWorld();
    spawnNpcs(s);
    expect(Object.values(s.entities).filter((e) => e.npcRole === 'jobAdvance').length).toBeGreaterThanOrEqual(1);
  });
});
