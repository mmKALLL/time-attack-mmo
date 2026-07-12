import { describe, it, expect } from 'vitest';
import { moveOrStick, advanceCombat, castInterval, groupOf, enemyAt, cleanupDead } from '../combat';
import { applyAction, tick } from '../world';
import { getSkill } from '../../data-skills';
import { makeEntity } from '../entities';
import { demoMap } from '../../data-map';
import { xpToNext, xpReward } from '../../config';
import type { Entity, WorldState } from '../../types';

function world(entities: Entity[]): WorldState {
  return {
    mapId: 'test',
    map: demoMap(10, 10),
    features: [],
    exits: [],
    discovered: ['test'],
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    groups: {},
    playerId: 'p1',
    seq: 0,
    rng: 1,
    spawnClockMs: 0,
    tickCount: 0,
    hits: [],
    xpGains: [],
    telegraphs: [],
  };
}
const hero = (cell: { x: number; y: number }) => makeEntity({ id: 'p1', faction: 'player', name: 'Hero', sprite: 'ranger', cell, level: 20, jobId: 'beginner' });
const rat = (id: string, cell: { x: number; y: number }) => makeEntity({ id, faction: 'enemy', name: 'Rat', sprite: 'slime', cell, level: 20, jobId: 'beginner' });

describe('movement & sticking', () => {
  it('walks onto empty floor', () => {
    const s = world([hero({ x: 3, y: 3 })]);
    moveOrStick(s, 'p1', 'right');
    expect(s.entities.p1.cell).toEqual({ x: 4, y: 3 });
  });
  it('is blocked by walls', () => {
    const s = world([hero({ x: 1, y: 1 })]);
    moveOrStick(s, 'p1', 'up'); // into top border wall
    expect(s.entities.p1.cell).toEqual({ x: 1, y: 1 });
  });
  it('sticks an enemy instead of moving into it, forming a 2-member group', () => {
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 4, y: 3 })]);
    moveOrStick(s, 'p1', 'right');
    expect(s.entities.p1.cell).toEqual({ x: 3, y: 3 });
    expect(groupOf(s, 'p1')?.memberIds.sort()).toEqual(['e1', 'p1']);
  });
  it('enemyAt finds a living enemy on a cell', () => {
    const s = world([rat('e1', { x: 5, y: 5 })]);
    expect(enemyAt(s, { x: 5, y: 5 })?.id).toBe('e1');
    expect(enemyAt(s, { x: 6, y: 5 })).toBeUndefined();
  });
});

describe('combat tick resolution', () => {
  it('does not fire until the 1.5s timer elapses, then deals damage', () => {
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 4, y: 3 })]);
    moveOrStick(s, 'p1', 'right');
    const before = s.entities.e1.hp;
    advanceCombat(s, 1000);
    expect(s.entities.e1.hp).toBe(before);
    advanceCombat(s, 600); // crosses 1500ms total
    expect(s.entities.e1.hp).toBeLessThan(before);
  });
  it('attackSpeed (from DEX) shortens the trigger interval: a high-DEX enemy fires before a base-DEX one', () => {
    // Beginner speed 1.0. Base dex 5 → attackSpeed 100 → interval 1500ms.
    // dex 105 → attackSpeed 160 → interval 937.5ms. Advancing 1000ms: the fast
    // one has fired (dealt damage), the base one has not.
    const fast = makeEntity({ id: 'fast', faction: 'enemy', name: 'Fast', sprite: 'slime', cell: { x: 4, y: 3 }, level: 20, jobId: 'beginner', primaries: { str: 20, dex: 105, int: 20, vit: 200 } });
    const sFast = world([hero({ x: 3, y: 3 }), fast]);
    moveOrStick(sFast, 'p1', 'right');
    const hpFastBefore = sFast.entities.p1.hp;
    advanceCombat(sFast, 1000); // 1000 ≥ 937.5 → the fast enemy has fired
    expect(sFast.entities.p1.hp).toBeLessThan(hpFastBefore);

    const slow = makeEntity({ id: 'slow', faction: 'enemy', name: 'Slow', sprite: 'slime', cell: { x: 4, y: 3 }, level: 20, jobId: 'beginner', primaries: { str: 20, dex: 5, int: 20, vit: 200 } });
    const sSlow = world([hero({ x: 3, y: 3 }), slow]);
    moveOrStick(sSlow, 'p1', 'right');
    const hpSlowBefore = sSlow.entities.p1.hp;
    advanceCombat(sSlow, 1000); // 1000 < 1500 → the base-dex enemy has NOT fired yet
    expect(sSlow.entities.p1.hp).toBe(hpSlowBefore);
  });
  it('removes a dead enemy and dissolves a one-sided group', () => {
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 4, y: 3 })]);
    s.entities.e1.hp = 1;
    moveOrStick(s, 'p1', 'right');
    advanceCombat(s, 1500);
    expect(s.entities.e1).toBeUndefined();
    expect(groupOf(s, 'p1')).toBeUndefined();
  });
});

describe('xp & level-ups', () => {
  it('awards XP to heroes when an enemy dies', () => {
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 4, y: 3 })]);
    s.entities.e1.hp = 1;
    moveOrStick(s, 'p1', 'right');
    advanceCombat(s, 1500);
    expect(s.entities.p1.xp).toBeGreaterThan(0);
  });
  it('levels up a hero when XP crosses the threshold, regrowing stats but NOT refilling MP', () => {
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 4, y: 3 })]);
    const p = s.entities.p1;
    const beforeLevel = p.level;
    const beforeMaxHp = p.stats.maxHp;
    p.xp = xpToNext(p.level) - 1; // one XP short of leveling
    p.mp = 0; // spent MP — leveling must NOT refill it (card #7: only towns do)
    s.entities.e1.hp = 1;
    moveOrStick(s, 'p1', 'right');
    advanceCombat(s, 1500); // kill grants XP -> crosses the threshold
    expect(p.level).toBeGreaterThan(beforeLevel); // leveled up (xp tuning may grant >1)
    expect(p.stats.maxHp).toBeGreaterThan(beforeMaxHp);
    expect(p.hp).toBe(p.stats.maxHp); // HP still fully heals on level up
    expect(p.mp).toBeLessThan(p.stats.maxMp); // MP does NOT
  });
});

describe('xpGains stream (per-kill HUD floats)', () => {
  it('pushes one entry per killed enemy in a single cleanupDead', () => {
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 6, y: 3 }), rat('e2', { x: 7, y: 3 })]);
    s.xpGains = []; // fresh tick
    s.entities.e1.hp = 0;
    s.entities.e2.hp = 0;
    cleanupDead(s);
    expect(s.xpGains).toHaveLength(2); // two enemies -> two floats
    // Amounts match xpReward(level) for each dead enemy (order-independent).
    expect(s.xpGains.slice().sort((a, b) => a - b)).toEqual([xpReward(20), xpReward(20)].sort((a, b) => a - b));
  });

  it('pushes exactly one entry per enemy even with multiple living heroes sharing the XP', () => {
    const ally = makeEntity({ id: 'a1', faction: 'ally', name: 'Ally', sprite: 'ranger', cell: { x: 2, y: 3 }, level: 20, jobId: 'beginner' });
    const s = world([hero({ x: 3, y: 3 }), ally, rat('e1', { x: 6, y: 3 })]);
    s.xpGains = [];
    s.entities.e1.hp = 0;
    cleanupDead(s);
    expect(s.xpGains).toEqual([xpReward(20)]); // one kill -> one float, not one-per-hero
  });

  it('is reset to empty each tick when no enemy dies', () => {
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 8, y: 8 })]); // far apart: no combat, no kills
    s.xpGains = [999]; // stale value from a prior tick
    const s2 = tick(s, [], 100);
    expect(s2.xpGains).toEqual([]); // reset at tick start, nothing pushed
  });
});

describe('Recover skill (card #8)', () => {
  it('restores a chunk of max HP, then starts its cooldown', () => {
    const p = hero({ x: 3, y: 3 });
    const e = rat('e1', { x: 9, y: 3 }); // out of the rat's reach (range 2) so it never hits back
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } }; // in combat, but at range
    const rec = p.skills.findIndex((r) => r.skillId === 'recover');
    p.activeSkillIndex = rec;
    p.hp = 1;
    advanceCombat(s, 1500); // hero auto-casts its active skill (Recover)
    expect(p.hp).toBeGreaterThan(Math.round(p.stats.maxHp * 0.15)); // heals a meaningful chunk (tuning-agnostic)
    expect(p.skills[rec].cooldownLeftMs).toBeGreaterThan(0); // cooldown started
  });
});

describe('growing the block', () => {
  it('adds a second enemy when the group bumps into it instead of translating', () => {
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 4, y: 3 }), rat('e2', { x: 5, y: 3 })]);
    moveOrStick(s, 'p1', 'right'); // stick e1
    moveOrStick(s, 'p1', 'right'); // leading edge hits e2 -> stick, no translation
    expect(groupOf(s, 'p1')?.memberIds.sort()).toEqual(['e1', 'e2', 'p1']);
    expect(s.entities.p1.cell).toEqual({ x: 3, y: 3 });
  });
});

describe('per-skill cast trigger + switch (card #28)', () => {
  const twoTriggerSkills = (p: Entity, longFirst: boolean) => {
    const longS = { skillId: 'heavenPierce', level: 1, usesLeft: -1, cooldownLeftMs: 0 }; // triggerMs 2250
    const shortS = { skillId: 'strafe', level: 1, usesLeft: -1, cooldownLeftMs: 0 }; // triggerMs 1000
    p.skills = longFirst ? [longS, shortS] : [shortS, longS];
    p.activeSkillIndex = 0;
  };
  it('castInterval reflects the active skill trigger (per-skill)', () => {
    const p = hero({ x: 3, y: 3 });
    twoTriggerSkills(p, false); // slot0 = short (1000), slot1 = long (2250)
    const fast = castInterval(p);
    p.activeSkillIndex = 1;
    expect(castInterval(p)).toBeGreaterThan(fast); // longer trigger -> longer interval
  });
  it('caps carried charge to the new (shorter) trigger on switch — extra time lost', () => {
    const p = hero({ x: 5, y: 5 });
    twoTriggerSkills(p, true); // slot0 = long, slot1 = short
    p.armed = true;
    p.castTimerMs = 2000; // charged the long skill a long time
    const q = applyAction(world([p]), { type: 'selectSkill', slot: 1 }).entities.p1; // switch to short
    expect(q.activeSkillIndex).toBe(1);
    expect(q.castTimerMs).toBe(castInterval(q)); // capped to the short interval; extra discarded
    expect(q.castTimerMs).toBeLessThan(2000);
  });
  it('keeps the built charge when switching short -> long trigger', () => {
    const p = hero({ x: 5, y: 5 });
    twoTriggerSkills(p, false); // slot0 = short, slot1 = long
    p.armed = true;
    p.castTimerMs = 500; // partway through the short skill's wind-up
    const q = applyAction(world([p]), { type: 'selectSkill', slot: 1 }).entities.p1; // switch to long
    expect(q.castTimerMs).toBe(500); // under the long interval -> progress preserved
  });
});

describe('MP cost (card #22)', () => {
  it('spends the skill MP cost on cast', () => {
    const p = hero({ x: 3, y: 3 });
    p.facing = 'right';
    p.activeSkillIndex = p.skills.findIndex((r) => r.skillId === 'cleave');
    const e = rat('e1', { x: 4, y: 3 });
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    p.mp = 10;
    advanceCombat(s, castInterval(p)); // exactly one Cleave cast
    expect(s.entities.p1.mp).toBe(10 - (getSkill('cleave').mpCost ?? 0));
  });
  it('gates the cast (no MP spent) and jumps off the unaffordable skill', () => {
    const p = hero({ x: 3, y: 3 });
    p.facing = 'right';
    const cleaveIdx = p.skills.findIndex((r) => r.skillId === 'cleave');
    p.activeSkillIndex = cleaveIdx;
    const e = rat('e1', { x: 4, y: 3 });
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    p.mp = 0; // can't afford Cleave
    advanceCombat(s, 1500);
    expect(s.entities.p1.mp).toBe(0); // nothing spent
    expect(s.entities.p1.activeSkillIndex).not.toBe(cleaveIdx); // auto-selected a usable (free) skill
  });
});

describe('AoE engagement during combat', () => {
  it('a damaging AoE sweeps its whole footprint, hitting + sticking an un-blocked foe', () => {
    const p = hero({ x: 3, y: 3 });
    p.facing = 'right';
    p.activeSkillIndex = p.skills.findIndex((r) => r.skillId === 'cleave'); // Cleave: 3-tile arc (AoE)
    const e1 = rat('e1', { x: 4, y: 3 }); // arc centre (1,0) — already engaged
    const e2 = rat('e2', { x: 4, y: 4 }); // arc flank (1,1), NOT yet in the block
    const s = world([p, e1, e2]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    const before = e2.hp;
    advanceCombat(s, 1500); // player auto-casts Cleave
    expect(groupOf(s, 'p1')?.memberIds).toContain('e2'); // the sweep engaged the un-blocked foe
    expect(s.entities.e2.hp).toBeLessThanOrEqual(before); // resolved against it (hit or seeded miss)
    expect(s.hits.some((h) => h.cell.x === 4 && h.cell.y === 4)).toBe(true); // reached e2's tile
  });
});
