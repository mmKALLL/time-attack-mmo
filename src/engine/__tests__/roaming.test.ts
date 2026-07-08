import { describe, it, expect } from 'vitest';
import { advanceRoaming } from '../roaming';
import { stick, groupOf } from '../combat';
import { makeEntity } from '../entities';
import { demoMap } from '../../data-map';
import { ENEMY_ROAM } from '../../config';
import { isWall, equals, key } from '../grid';
import type { Cell, Entity, MapExit, WorldState } from '../../types';

function world(entities: Entity[], opts: { exits?: MapExit[]; rng?: number } = {}): WorldState {
  return {
    mapId: 'test',
    map: demoMap(12, 12),
    features: [],
    exits: opts.exits ?? [],
    discovered: ['test'],
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    groups: {},
    playerId: 'p1',
    seq: 0,
    rng: opts.rng ?? 1,
    spawnClockMs: 0,
    tickCount: 0,
    hits: [],
  };
}
const hero = (cell: Cell) => makeEntity({ id: 'p1', faction: 'player', name: 'Hero', sprite: 'ranger', cell, level: 20, jobId: 'beginner' });
const rat = (id: string, cell: Cell) => makeEntity({ id, faction: 'enemy', name: 'Rat', sprite: 'slime', cell, level: 20, jobId: 'beginner' });

// Run the roam system for `steps` sim ticks of `dt` ms each.
function run(s: WorldState, steps: number, dt = 50): void {
  for (let i = 0; i < steps; i++) advanceRoaming(s, dt);
}

describe('idle-enemy roaming', () => {
  it('an idle enemy actually moves over simulated ticks', () => {
    const s = world([rat('e1', { x: 6, y: 6 })]);
    const start = { ...s.entities.e1.cell };
    run(s, 400); // 400 * 50ms = 20s: covers the longest wait + a full sequence
    expect(equals(s.entities.e1.cell, start)).toBe(false);
  });

  it('only ever lands on floor — never a wall, portal, or another entity', () => {
    // Two roamers + a portal cell; simulate a long run and assert every frame.
    const exit: MapExit = { cell: { x: 3, y: 3 }, toMap: 'other' };
    const s = world([rat('e1', { x: 6, y: 6 }), rat('e2', { x: 8, y: 8 })], { exits: [exit], rng: 7 });
    for (let i = 0; i < 600; i++) {
      advanceRoaming(s, 50);
      const cells = Object.values(s.entities).map((e) => e.cell);
      for (const c of cells) {
        expect(isWall(s.map, c)).toBe(false);
        expect(equals(c, exit.cell)).toBe(false); // never wandered onto the portal
      }
      // no two entities share a cell
      const keys = cells.map(key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('stays within maxTiles of a sequence start', () => {
    // Give the enemy lots of room and watch it across many sequences; the
    // distance moved between two consecutive rests never exceeds maxTiles.
    const s = world([rat('e1', { x: 6, y: 6 })], { rng: 3 });
    let seqStart = { ...s.entities.e1.cell };
    let prevPhase: string | undefined = s.entities.e1.roam?.phase;
    for (let i = 0; i < 2000; i++) {
      advanceRoaming(s, 50);
      const roam = s.entities.e1.roam;
      const phase = roam?.phase;
      // A move sequence begins on the wait->move transition: reset the anchor.
      if (phase === 'move' && prevPhase !== 'move') seqStart = { ...s.entities.e1.cell };
      const c = s.entities.e1.cell;
      const dist = Math.abs(c.x - seqStart.x) + Math.abs(c.y - seqStart.y);
      expect(dist).toBeLessThanOrEqual(ENEMY_ROAM.maxTiles);
      prevPhase = phase;
    }
  });

  it('bumping into the player forms a combat group (via stick) instead of co-occupying', () => {
    // Enemy directly left of the player; force it to walk right into the player.
    const e = rat('e1', { x: 5, y: 6 });
    e.roam = { phase: 'move', timerMs: 1, dir: 'right', tilesLeft: 3 };
    const s = world([hero({ x: 6, y: 6 }), e]);
    advanceRoaming(s, 50); // timer (1ms) elapses -> attempts the step into the player
    expect(s.entities.e1.cell).toEqual({ x: 5, y: 6 }); // did NOT move onto the player
    expect(s.entities.p1.cell).toEqual({ x: 6, y: 6 });
    expect(groupOf(s, 'p1')?.memberIds.sort()).toEqual(['e1', 'p1']);
  });

  it('never enters a cell the player just moved into (same-frame avoidance)', () => {
    // Player at the enemy's move target: the enemy must bump into combat, not co-occupy.
    const e = rat('e1', { x: 5, y: 6 });
    e.roam = { phase: 'move', timerMs: 1, dir: 'right', tilesLeft: 2 };
    const s = world([hero({ x: 6, y: 6 }), e]);
    advanceRoaming(s, 50);
    expect(s.entities.e1.cell).not.toEqual(s.entities.p1.cell); // no co-occupation
    expect(groupOf(s, 'p1')).toBeDefined();
  });

  it('a grouped enemy does not roam and drops its roam state', () => {
    const e = rat('e1', { x: 4, y: 4 });
    e.roam = { phase: 'move', timerMs: 1, dir: 'right', tilesLeft: 3 };
    const s = world([hero({ x: 8, y: 8 }), e]);
    stick(s, 'p1', 'e1'); // put the enemy in a group
    const start = { ...s.entities.e1.cell };
    run(s, 500);
    expect(s.entities.e1.cell).toEqual(start); // never moved
    expect(s.entities.e1.roam).toBeUndefined(); // roam state cleared under combat
  });

  it('is deterministic: same seed -> same roam path', () => {
    const path = (rng: number): string[] => {
      const s = world([rat('e1', { x: 6, y: 6 })], { rng });
      const trail: string[] = [];
      for (let i = 0; i < 600; i++) {
        advanceRoaming(s, 50);
        trail.push(key(s.entities.e1.cell));
      }
      return trail;
    };
    expect(path(42)).toEqual(path(42)); // identical seed -> identical trail
  });

  it('a blocked path (wall ahead) ends the sequence without moving through it', () => {
    // Place the enemy one tile inside the west border wall, forced to walk left.
    const e = rat('e1', { x: 1, y: 6 });
    e.roam = { phase: 'move', timerMs: 1, dir: 'left', tilesLeft: 3 };
    const s = world([hero({ x: 10, y: 10 }), e]);
    advanceRoaming(s, 50); // tries to step into the border wall at x=0
    expect(s.entities.e1.cell).toEqual({ x: 1, y: 6 }); // stayed put
    expect(s.entities.e1.roam?.phase).toBe('wait'); // sequence ended -> resting
  });
});
