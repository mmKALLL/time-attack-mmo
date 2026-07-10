import { describe, it, expect } from 'vitest';
import { advanceCombat, advanceArming, castInterval, groupOf } from '../combat';
import { getSkill } from '../../data-skills';
import { makeEntity } from '../entities';
import { demoMap } from '../../data-map';
import type { Entity, SkillRuntime, WorldState } from '../../types';

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
    telegraphs: [],
  };
}
const hero = (cell: { x: number; y: number }) => makeEntity({ id: 'p1', faction: 'player', name: 'Hero', sprite: 'ranger', cell, level: 20, jobId: 'beginner' });
const rat = (id: string, cell: { x: number; y: number }) => makeEntity({ id, faction: 'enemy', name: 'Rat', sprite: 'slime', cell, level: 20, jobId: 'beginner' });
const BIG = 100000; // dt comfortably past any class's cast interval → fires exactly once

// Force a single active skill (unlimited use, no cooldown) so a cast is guaranteed.
function useSkill(p: Entity, skillId: string): void {
  const rt: SkillRuntime = { skillId, level: 1, usesLeft: -1, cooldownLeftMs: 0 };
  p.skills = [rt];
  p.activeSkillIndex = 0;
  p.mp = p.stats.maxMp; // ensure the skill is affordable
}
// The (tuning-agnostic) hit count for a skill at level 1.
const N = (skillId: string): number => Math.max(1, Math.round(getSkill(skillId).params.hits?.(1) ?? 1));
// HitEvents landed on a specific cell.
const eventsOn = (s: WorldState, x: number, y: number) => s.hits.filter((h) => h.cell.x === x && h.cell.y === y);

describe('multi-hit skill mechanic', () => {
  it('doubleStrike lands N damage HitEvents on a lone foe in a single cast (via advanceCombat)', () => {
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    useSkill(p, 'doubleStrike');
    const e = rat('e1', { x: 6, y: 5 }); // the faced tile — inside the point shape
    e.hp = e.stats.maxHp * 100; // huge HP so it survives all hits (no early death)
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    const n = N('doubleStrike');
    const before = s.entities.e1.hp;
    advanceCombat(s, castInterval(p)); // exactly one cast
    // N seeded rolls → N HitEvents on the foe's cell, and hp dropped (damage applied N× — some may be seeded misses=0, but at least one lands with seed 1).
    expect(eventsOn(s, 6, 5).length).toBe(n);
    expect(s.entities.e1.hp).toBeLessThan(before);
  });

  it('doubleStrike lands N HitEvents on a lone foe via the armed advanceArming path', () => {
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    useSkill(p, 'doubleStrike');
    const e = rat('e1', { x: 6, y: 5 });
    e.hp = e.stats.maxHp * 100;
    const s = world([p, e]);
    s.entities.p1.armed = true; // out-of-combat armed fire
    const n = N('doubleStrike');
    advanceArming(s, BIG);
    expect(eventsOn(s, 6, 5).length).toBe(n);
    expect(groupOf(s, 'p1')?.memberIds.sort()).toEqual(['e1', 'p1']); // engaged once
  });

  it('a skill with no hits param strikes exactly once (regression)', () => {
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    useSkill(p, 'strike'); // Strike: point, no hits param
    expect(getSkill('strike').params.hits).toBeUndefined();
    const e = rat('e1', { x: 6, y: 5 });
    e.hp = e.stats.maxHp * 100;
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    advanceCombat(s, castInterval(p)); // exactly one cast
    expect(eventsOn(s, 6, 5).length).toBe(1);
  });

  it('magicClaw (pierce:false + hits) strikes the SAME single nearest foe N times, not N different foes', () => {
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    useSkill(p, 'magicClaw'); // arc (3 tiles), pierce:false, hits:2
    // Three foes across the arc column (dx=1): dy = -1, 0, +1. pierce:false collapses to the nearest (central).
    const top = rat('top', { x: 6, y: 4 });
    const mid = rat('mid', { x: 6, y: 5 });
    const bot = rat('bot', { x: 6, y: 6 });
    for (const e of [top, mid, bot]) e.hp = e.stats.maxHp * 100;
    const s = world([p, top, mid, bot]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'top', 'mid', 'bot'] } };
    const n = N('magicClaw');
    advanceCombat(s, castInterval(p)); // exactly one cast
    // All N HitEvents land on ONE cell (the collapsed nearest foe); the others take zero.
    const central = eventsOn(s, 6, 5).length;
    const others = eventsOn(s, 6, 4).length + eventsOn(s, 6, 6).length;
    expect(central).toBe(n); // struck the same foe N times
    expect(others).toBe(0); // the other arc foes were never hit (collapse-to-nearest held)
  });

  it('a foe that dies partway through accrues no post-mortem HitEvents', () => {
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    useSkill(p, 'umbralFlurry'); // hits ≥ 3 at level 1
    const e = rat('e1', { x: 6, y: 5 });
    e.hp = 1; // dies on the first landing hit
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    const n = N('umbralFlurry');
    expect(n).toBeGreaterThan(1); // the test is only meaningful for a multi-hit skill
    advanceCombat(s, castInterval(p)); // exactly one cast
    // The loop breaks once the foe is dead: strictly fewer HitEvents than the full hit count.
    // (At most the hits up to and including the killing blow — never all N, and never any after death.)
    const events = eventsOn(s, 6, 5).length;
    expect(events).toBeGreaterThanOrEqual(1);
    expect(events).toBeLessThan(n);
    expect(s.entities.e1).toBeUndefined(); // dead + cleaned up
  });

  it('doubleStrike / magicClaw / umbralFlurry each declare a hits param ≥ 1', () => {
    for (const id of ['doubleStrike', 'magicClaw', 'umbralFlurry']) {
      const fn = getSkill(id).params.hits;
      expect(fn, `${id} should have a hits param`).toBeDefined();
      expect(Math.round(fn!(1))).toBeGreaterThanOrEqual(1);
    }
  });
});
