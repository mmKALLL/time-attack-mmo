import { describe, it, expect } from 'vitest';
import { tick } from '../world';
import { advanceCombat, advanceArming, groupOf } from '../combat';
import { canCast } from '../skills';
import { makeEntity } from '../entities';
import { demoMap } from '../../data-map';
import type { Entity, WorldState } from '../../types';

function world(entities: Entity[]): WorldState {
  return {
    mapId: 'test',
    map: demoMap(20, 20),
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
// Beginner kit: slot 0 = Strike (shapeKind 'point', single-target, faced tile),
// slot 1 = Cleave (shapeKind 'arc', 3 tiles → AoE fan one cell ahead), slot 2 = Recover.
const hero = (cell: { x: number; y: number }) => makeEntity({ id: 'p1', faction: 'player', name: 'Hero', sprite: 'ranger', cell, level: 20, jobId: 'beginner' });
const rat = (id: string, cell: { x: number; y: number }) => makeEntity({ id, faction: 'enemy', name: 'Rat', sprite: 'slime', cell, level: 20, jobId: 'beginner' });
const BIG = 100000; // dt comfortably past any class's cast interval → fires exactly once

describe('arming (out-of-combat ranged fire, card #9)', () => {
  it('(a) arming a skill then advancing past the wind-up hits + engages a covered enemy', () => {
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    const e = rat('e1', { x: 6, y: 5 }); // the faced tile — inside Strike's point shape
    const s = world([p, e]);
    // Arm slot 0 (Strike) via the input path while ungrouped.
    const s1 = tick(s, [{ type: 'selectSkill', slot: 0 }], 0);
    expect(s1.entities.p1.armed).toBe(true);
    expect(groupOf(s1, 'p1')).toBeUndefined();
    const before = s1.entities.e1.hp;
    advanceArming(s1, BIG);
    expect(s1.entities.e1.hp).toBeLessThan(before); // took damage
    expect(groupOf(s1, 'p1')?.memberIds.sort()).toEqual(['e1', 'p1']); // now engaged
    expect(s1.entities.p1.armed).toBe(false);
  });

  it('(b) arming with NO enemy in the shape un-arms after the wind-up, forms no group, harms nothing', () => {
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    const e = rat('e1', { x: 5, y: 10 }); // far off the faced tile
    const s = world([p, e]);
    s.entities.p1.armed = true; // armed, ungrouped
    const before = s.entities.e1.hp;
    advanceArming(s, BIG);
    expect(s.entities.p1.armed).toBe(false); // whiff un-arms
    expect(groupOf(s, 'p1')).toBeUndefined(); // no group
    expect(s.entities.e1.hp).toBe(before); // unharmed
  });

  it('(c-aoe) an AoE-shaped skill (arc/Cleave) targets + engages ALL covered enemies', () => {
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    const e1 = rat('e1', { x: 6, y: 5 }); // Cleave arc covers (1,0)
    const e2 = rat('e2', { x: 6, y: 6 }); // ...and the flank (1,1)
    const s = world([p, e1, e2]);
    s.entities.p1.activeSkillIndex = 1; // Cleave (arc, 3 tiles)
    s.entities.p1.armed = true;
    advanceArming(s, BIG);
    // Both covered foes are RESOLVED against (a hit event lands on each cell — the
    // amount may be a miss=0 depending on the seeded roll) and both are ENGAGED. This
    // is the deterministic "hit all" invariant; per-foe damage is RNG-dependent.
    expect(s.hits.some((h) => h.cell.x === 6 && h.cell.y === 5)).toBe(true);
    expect(s.hits.some((h) => h.cell.x === 6 && h.cell.y === 6)).toBe(true);
    expect(groupOf(s, 'p1')?.memberIds.sort()).toEqual(['e1', 'e2', 'p1']); // both engaged
  });

  it('(c-single) a single-target skill (point/Power Strike) hits only the nearest covered enemy', () => {
    // Power Strike is a point (single-target): only the faced foe is struck.
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    // Power Strike's point shape is just the faced tile (1,0). Put an enemy there and another
    // beyond it; only the faced one is covered anyway — assert the beyond one is untouched.
    p.skills = [{ skillId: 'powerStrike', level: 1, usesLeft: -1, cooldownLeftMs: 0 }];
    const near = rat('near', { x: 6, y: 5 });
    const far = rat('far', { x: 7, y: 5 });
    const s = world([p, near, far]);
    s.entities.p1.activeSkillIndex = 0; // Power Strike (point)
    s.entities.p1.armed = true;
    const bNear = s.entities.near.hp;
    const bFar = s.entities.far.hp;
    advanceArming(s, BIG);
    expect(s.entities.near.hp).toBeLessThan(bNear); // faced foe struck
    expect(s.entities.far.hp).toBe(bFar); // the one behind is untouched
    expect(groupOf(s, 'p1')?.memberIds.sort()).toEqual(['near', 'p1']);
  });

  it('(c-nearest) a single-target skill strikes only the NEAREST when several share its footprint', () => {
    // A point/melee shape covers one cell, so the only way multiple enemies fall under a
    // single-target footprint is if they occupy the same cell. Stack two rats on the faced
    // tile: Strike (single-target) must hit exactly one (the nearest — here both at equal
    // Chebyshev distance, so the classifier picks the first) and engage only that one.
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    p.skills = [{ skillId: 'powerStrike', level: 1, usesLeft: -1, cooldownLeftMs: 0 }];
    const a = rat('a', { x: 6, y: 5 }); // both on the faced tile (1,0)
    const b = rat('b', { x: 6, y: 5 });
    const s = world([p, a, b]);
    s.entities.p1.activeSkillIndex = 0; // Power Strike (point → single-target)
    s.entities.p1.armed = true;
    advanceArming(s, BIG);
    // Exactly ONE foe is resolved against (one hit event on the shared cell — a
    // single-target skill never double-taps a stack) and only that one is engaged.
    expect(s.hits.filter((h) => h.cell.x === 6 && h.cell.y === 5).length).toBe(1);
    expect(groupOf(s, 'p1')?.memberIds.length).toBe(2); // player + the one struck foe
  });

  it('(d) IN combat, selectSkill only changes activeSkillIndex and does NOT arm', () => {
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    const e = rat('e1', { x: 6, y: 5 });
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } }; // already grouped
    const s1 = tick(s, [{ type: 'selectSkill', slot: 1 }], 0);
    expect(s1.entities.p1.activeSkillIndex).toBe(1);
    expect(s1.entities.p1.armed).toBeFalsy(); // never armed while grouped
  });

  it('(e) re-pressing while armed swaps the skill without resetting a completed wind-up', () => {
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    const s = world([p]);
    // First press: arms fresh, resets the wind-up to 0.
    const s1 = tick(s, [{ type: 'selectSkill', slot: 0 }], 0);
    expect(s1.entities.p1.armed).toBe(true);
    expect(s1.entities.p1.activeSkillIndex).toBe(0);
    // Bank some wind-up progress (no enemy → no fire; timer accumulates but no interval crossed
    // if dt < interval — advance a small amount so the timer is non-zero and non-firing).
    s1.entities.p1.castTimerMs = 500; // simulate mid-wind-up
    // Re-press a different slot while still armed: swaps skill, KEEPS the timer.
    const s2 = tick(s1, [{ type: 'selectSkill', slot: 1 }], 0);
    expect(s2.entities.p1.armed).toBe(true);
    expect(s2.entities.p1.activeSkillIndex).toBe(1);
    expect(s2.entities.p1.castTimerMs).toBe(500); // wind-up NOT reset
  });

  it('un-arms automatically once combat ends (armed already false on engage)', () => {
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    const e = rat('e1', { x: 6, y: 5 });
    e.hp = 1; // dies in one hit
    const s = world([p, e]);
    s.entities.p1.armed = true;
    advanceArming(s, BIG); // fires, engages, un-arms
    expect(s.entities.p1.armed).toBe(false);
    advanceCombat(s, BIG); // the enemy (already engaged) dies; group disbands via cleanupDead
    expect(groupOf(s, 'p1')).toBeUndefined();
    expect(s.entities.p1.armed).toBe(false); // still un-armed → no out-of-combat retrigger
  });

  it('(f-heal) arming Recover out of combat heals the player and starts its cooldown, forms no group', () => {
    const p = hero({ x: 5, y: 5 });
    const rec = p.skills.findIndex((r) => r.skillId === 'recover');
    p.activeSkillIndex = rec;
    p.hp = 1; // hurt
    const s = world([p]); // no enemies at all
    s.entities.p1.armed = true;
    advanceArming(s, BIG);
    expect(s.entities.p1.hp).toBeGreaterThan(Math.round(s.entities.p1.stats.maxHp * 0.15)); // healed a real chunk
    expect(s.entities.p1.skills[rec].cooldownLeftMs).toBeGreaterThan(0); // cooldown started
    expect(s.entities.p1.armed).toBe(false); // fired once, un-armed
    expect(groupOf(s, 'p1')).toBeUndefined(); // self-heal never forms a group
  });

  it('(g) auto-selects the first usable skill after the active one goes to cooldown (card #19)', () => {
    const p = hero({ x: 5, y: 5 });
    const rec = p.skills.findIndex((r) => r.skillId === 'recover');
    p.activeSkillIndex = rec; // Recover: 1 use -> cooldown after firing
    const s = world([p]);
    s.entities.p1.armed = true;
    advanceArming(s, BIG); // Recover fires, depletes its use, goes to cooldown
    expect(s.entities.p1.skills[rec].cooldownLeftMs).toBeGreaterThan(0);
    expect(s.entities.p1.activeSkillIndex).not.toBe(rec); // jumped off the cooling skill
    expect(canCast(s.entities.p1.skills[s.entities.p1.activeSkillIndex])).toBe(true); // ...to a usable one
  });
});
