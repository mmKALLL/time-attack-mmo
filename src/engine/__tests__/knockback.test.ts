import { describe, it, expect } from 'vitest';
import { advanceCombat, advanceKnockback, groupOf } from '../combat';
import { getSkill } from '../../data-skills';
import { makeEntity } from '../entities';
import { demoMap } from '../../data-map';
import { KNOCKBACK_STEP_MS } from '../../config';
import type { Direction, Entity, TileMap, WorldState } from '../../types';

// A borderless-interior test map (only the outer ring is wall) so we control
// exactly where obstacles sit. demoMap adds a couple of interior walls far from
// the small coordinates these tests use, so it stays clean here.
function world(entities: Entity[], map: TileMap = demoMap(12, 12)): WorldState {
  return {
    mapId: 'test',
    map,
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
const setWall = (map: TileMap, x: number, y: number) => {
  map.tiles[y * map.width + x] = 'wall';
};

// An archer hero whose ONLY skill is Power Knockback (so auto-cast fires it), with
// crushing accuracy vs a zero-dodge foe so the seeded hit lands every time.
function knockbackHero(cell: { x: number; y: number }): Entity {
  const p = makeEntity({ id: 'p1', faction: 'player', name: 'Archer', sprite: 'ranger', cell, level: 20, jobId: 'archer' });
  p.skills = [{ skillId: 'powerKnockback', level: 1, usesLeft: getSkill('powerKnockback').uses ?? -1, cooldownLeftMs: 0 }];
  p.activeSkillIndex = 0;
  p.stats = { ...p.stats, accuracy: 100000 }; // guarantee the hit (hitChance clamps to 1)
  return p;
}
// A defenceless foe: zero dodge/def so it can't evade the knockback trigger, and a
// huge HP pool so a single hit never kills it (a dead foe is cleaned up and its
// knockback vanishes with it — see cleanupDead).
function foe(id: string, cell: { x: number; y: number }): Entity {
  const e = makeEntity({ id, faction: 'enemy', name: 'Dummy', sprite: 'slime', cell, level: 1, jobId: 'beginner' });
  e.stats = { ...e.stats, dodge: 0, def: 0, statusResist: 0, maxHp: 1e9 };
  e.hp = e.stats.maxHp;
  return e;
}
// Manually arm a knockback slide (isolates advanceKnockback from the cast path).
const arm = (e: Entity, dir: Direction, tiles: number) => {
  e.knockback = { dir, tilesLeft: tiles, timerMs: 0 };
};

describe('knockback skill data', () => {
  it("powerKnockback.knockback is a positive number", () => {
    const kb = getSkill('powerKnockback').knockback;
    expect(typeof kb).toBe('number');
    expect(kb as number).toBeGreaterThan(0);
  });
});

describe('applying knockback on a landed hit', () => {
  it('sets foe.knockback with tilesLeft === skill.knockback and a dir pointing away from the caster', () => {
    const skill = getSkill('powerKnockback');
    const p = knockbackHero({ x: 3, y: 3 });
    p.facing = 'right';
    const e = foe('e1', { x: 4, y: 3 }); // foe to the caster's right -> pushed 'right'
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    advanceCombat(s, 5000); // let the hero auto-cast (well past its trigger)
    expect(s.entities.e1.knockback).toBeDefined();
    expect(s.entities.e1.knockback?.tilesLeft).toBe(skill.knockback);
    expect(s.entities.e1.knockback?.dir).toBe('right'); // away from the caster
  });
});

describe('advanceKnockback movement', () => {
  it('moves the foe exactly one tile per KNOCKBACK_STEP_MS and clears when done', () => {
    const tiles = 3;
    const e = foe('e1', { x: 3, y: 3 });
    const s = world([e]);
    arm(e, 'right', tiles);

    for (let i = 1; i <= tiles; i++) {
      advanceKnockback(s, KNOCKBACK_STEP_MS);
      expect(s.entities.e1.cell).toEqual({ x: 3 + i, y: 3 });
    }
    expect(s.entities.e1.knockback).toBeUndefined(); // fully travelled -> cleared
    expect(s.entities.e1.cell).toEqual({ x: 3 + tiles, y: 3 }); // moved exactly `tiles`
  });

  it('a partial tick (dt < KNOCKBACK_STEP_MS) does not move the foe until the interval accumulates', () => {
    const e = foe('e1', { x: 3, y: 3 });
    const s = world([e]);
    arm(e, 'right', 3);

    advanceKnockback(s, KNOCKBACK_STEP_MS - 1); // just short of a step
    expect(s.entities.e1.cell).toEqual({ x: 3, y: 3 }); // no move yet
    expect(s.entities.e1.knockback?.tilesLeft).toBe(3);

    advanceKnockback(s, 1); // accumulates to exactly one interval
    expect(s.entities.e1.cell).toEqual({ x: 4, y: 3 }); // now it steps
  });

  it('resolves multiple tiles in one call when dt spans several intervals', () => {
    const e = foe('e1', { x: 3, y: 3 });
    const s = world([e]);
    arm(e, 'right', 3);
    advanceKnockback(s, KNOCKBACK_STEP_MS * 3); // three intervals at once
    expect(s.entities.e1.cell).toEqual({ x: 6, y: 3 });
    expect(s.entities.e1.knockback).toBeUndefined();
  });
});

describe('advanceKnockback stop conditions', () => {
  it('stops early at a wall and clears the state', () => {
    const map = demoMap(12, 12);
    setWall(map, 5, 3); // wall one tile behind (to the right of) the foe
    const e = foe('e1', { x: 4, y: 3 });
    const s = world([e], map);
    arm(e, 'right', 3);
    advanceKnockback(s, KNOCKBACK_STEP_MS * 3);
    expect(s.entities.e1.cell).toEqual({ x: 4, y: 3 }); // couldn't move into the wall
    expect(s.entities.e1.knockback).toBeUndefined(); // slide aborted
  });

  it('stops early at a cell occupied by another entity', () => {
    const blocker = foe('e2', { x: 5, y: 3 }); // another entity behind the foe
    const e = foe('e1', { x: 4, y: 3 });
    const s = world([e, blocker]);
    arm(e, 'right', 3);
    advanceKnockback(s, KNOCKBACK_STEP_MS * 3);
    expect(s.entities.e1.cell).toEqual({ x: 4, y: 3 }); // stopped before the occupied cell
    expect(s.entities.e2.cell).toEqual({ x: 5, y: 3 }); // the blocker is untouched
    expect(s.entities.e1.knockback).toBeUndefined();
  });

  it('stops at the map edge (out of bounds)', () => {
    const map = demoMap(12, 12); // outer ring is wall; x=11 is the border
    const e = foe('e1', { x: 10, y: 3 }); // one tile in from the right wall
    const s = world([e], map);
    arm(e, 'right', 3);
    advanceKnockback(s, KNOCKBACK_STEP_MS * 3);
    expect(s.entities.e1.cell).toEqual({ x: 10, y: 3 }); // border wall blocks it
    expect(s.entities.e1.knockback).toBeUndefined();
  });
});

describe('knockback keeps the foe in the combat block (behavior "B")', () => {
  it('the knocked-back foe remains in the caster group throughout the slide', () => {
    const p = knockbackHero({ x: 3, y: 3 });
    p.facing = 'right';
    const e = foe('e1', { x: 4, y: 3 });
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    advanceCombat(s, 5000); // hero casts -> arms the knockback
    expect(s.entities.e1.knockback).toBeDefined();
    const membersBefore = groupOf(s, 'p1')?.memberIds.slice().sort();
    expect(membersBefore).toEqual(['e1', 'p1']);

    // Slide it the full distance; membership must never change.
    const tiles = s.entities.e1.knockback?.tilesLeft ?? 0;
    for (let i = 0; i < tiles; i++) {
      advanceKnockback(s, KNOCKBACK_STEP_MS);
      expect(groupOf(s, 'p1')?.memberIds.slice().sort()).toEqual(['e1', 'p1']);
    }
    expect(s.entities.e1.knockback).toBeUndefined(); // done sliding
    expect(groupOf(s, 'p1')?.memberIds.slice().sort()).toEqual(['e1', 'p1']); // still stuck together
  });
});
