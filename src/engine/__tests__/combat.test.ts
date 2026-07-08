import { describe, it, expect } from 'vitest';
import { moveOrStick, advanceCombat, groupOf, enemyAt } from '../combat';
import { makeEntity } from '../entities';
import { demoMap } from '../../data-map';
import { xpToNext } from '../../config';
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
  it('levels up a hero when XP crosses the threshold, regrowing stats', () => {
    const s = world([hero({ x: 3, y: 3 }), rat('e1', { x: 4, y: 3 })]);
    const p = s.entities.p1;
    const beforeLevel = p.level;
    const beforeMaxHp = p.stats.maxHp;
    p.xp = xpToNext(p.level) - 1; // one XP short of leveling
    s.entities.e1.hp = 1;
    moveOrStick(s, 'p1', 'right');
    advanceCombat(s, 1500); // kill grants XP -> crosses the threshold
    expect(p.level).toBe(beforeLevel + 1);
    expect(p.stats.maxHp).toBeGreaterThan(beforeMaxHp);
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
