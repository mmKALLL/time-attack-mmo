import { describe, it, expect } from 'vitest';
import { advanceCombat, moveOrStick, stick, nearestHero } from '../combat';
import { makeEntity } from '../entities';
import { demoMap } from '../../data-map';
import { ENEMY_APPROACH_MS, COMBAT_TICK_MS } from '../../config';
import type { Cell, CombatClass, Entity, WorldState } from '../../types';

// A 12x12 test arena (demoMap border walls); `walls` sets extra interior walls.
function world(entities: Entity[], walls: Cell[] = []): WorldState {
  const map = demoMap(12, 12);
  for (const w of walls) map.tiles[w.y * map.width + w.x] = 'wall';
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
const hero = (id: string, cell: Cell) => makeEntity({ id, faction: 'player', name: 'Hero', sprite: 'ranger', cell, level: 20, jobId: 'beginner' });
// High dex → high accuracy so an in-range enemy reliably lands its hit; high vit
// so it survives the hero's return fire during a test.
const foe = (id: string, cell: Cell, combatClass: CombatClass = 'fighter') =>
  makeEntity({ id, faction: 'enemy', name: 'Foe', sprite: 'slime', cell, level: 20, jobId: 'beginner', combatClass, primaries: { str: 20, dex: 80, int: 20, vit: 80 } });

describe('enemy combat AI (slice 1: targeting + approach)', () => {
  it('an out-of-range enemy creeps one tile toward its target every ENEMY_APPROACH_MS', () => {
    const s = world([hero('p1', { x: 2, y: 5 }), foe('e1', { x: 8, y: 5 })]);
    stick(s, 'p1', 'e1');
    // Fighter range is 2; it starts 6 tiles away → out of range.
    advanceCombat(s, ENEMY_APPROACH_MS - 50); // timer not yet full
    expect(s.entities.e1.cell).toEqual({ x: 8, y: 5 });
    advanceCombat(s, 50); // fills the approach clock → one step left, toward the hero
    expect(s.entities.e1.cell).toEqual({ x: 7, y: 5 });
  });

  it('skips the approach step when the tile straight ahead is a wall', () => {
    const s = world([hero('p1', { x: 2, y: 5 }), foe('e1', { x: 8, y: 5 })], [{ x: 7, y: 5 }]);
    stick(s, 'p1', 'e1');
    advanceCombat(s, ENEMY_APPROACH_MS);
    expect(s.entities.e1.cell).toEqual({ x: 8, y: 5 }); // wall at (7,5) blocks it — no pathing around
  });

  it('an in-range enemy attacks its target and does not move', () => {
    const s = world([hero('p1', { x: 5, y: 5 }), foe('e1', { x: 6, y: 5 })]);
    stick(s, 'p1', 'e1');
    const maxHp = s.entities.p1.stats.maxHp;
    advanceCombat(s, COMBAT_TICK_MS); // dist 1 ≤ 2 → attacks; < ENEMY_APPROACH_MS → no creep
    expect(s.entities.e1.cell).toEqual({ x: 6, y: 5 });
    expect(s.entities.p1.hp).toBeLessThan(maxHp);
  });

  it('attack range is static by class: a mage hits at dist 4, a fighter does not', () => {
    // Ranged (magician) range 4 → in range at dist 4.
    const sMage = world([hero('p1', { x: 5, y: 5 }), foe('e1', { x: 9, y: 5 }, 'magician')]);
    stick(sMage, 'p1', 'e1');
    const mageMax = sMage.entities.p1.stats.maxHp;
    advanceCombat(sMage, 2000); // mages cast slower (speed 0.8 → 1875ms); in range so it holds position
    expect(sMage.entities.p1.hp).toBeLessThan(mageMax);
    expect(sMage.entities.e1.cell).toEqual({ x: 9, y: 5 }); // in range → no creep

    // Melee (fighter) range 2 → out of range at dist 4, so no damage (and no creep
    // yet, since one cast interval < ENEMY_APPROACH_MS).
    const sFig = world([hero('p1', { x: 5, y: 5 }), foe('e1', { x: 9, y: 5 }, 'fighter')]);
    stick(sFig, 'p1', 'e1');
    const figMax = sFig.entities.p1.stats.maxHp;
    advanceCombat(sFig, COMBAT_TICK_MS);
    expect(sFig.entities.p1.hp).toBe(figMax);
    expect(sFig.entities.e1.cell).toEqual({ x: 9, y: 5 });
  });

  it('targets the nearest hero and retargets when a closer one appears', () => {
    const a = hero('p1', { x: 2, y: 5 }); // dist 3 from the enemy
    const b = hero('p2', { x: 9, y: 5 }); // dist 4 from the enemy
    const e = foe('e1', { x: 5, y: 5 });
    const s = world([a, b, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'p2', 'e1'] } };
    expect(nearestHero(s, s.entities.e1)?.id).toBe('p1');
    s.entities.p2.cell = { x: 6, y: 5 }; // p2 steps adjacent → now closest
    expect(nearestHero(s, s.entities.e1)?.id).toBe('p2');
  });

  it('the player can deform a wall-jammed block to close distance', () => {
    // Block: player (5,5) + enemy (7,5), a gap at (6,5), wall at (8,5).
    const s = world([hero('p1', { x: 5, y: 5 }), foe('e1', { x: 7, y: 5 })], [{ x: 8, y: 5 }]);
    stick(s, 'p1', 'e1');
    moveOrStick(s, 'p1', 'right'); // enemy's leading cell (8,5) is a wall → block can't translate
    expect(s.entities.p1.cell).toEqual({ x: 6, y: 5 }); // player peels off into the gap
    expect(s.entities.e1.cell).toEqual({ x: 7, y: 5 }); // enemy stays

    // If the player's own next cell is also walled, it can't deform.
    const s2 = world([hero('p1', { x: 5, y: 5 }), foe('e1', { x: 7, y: 5 })], [{ x: 8, y: 5 }, { x: 6, y: 5 }]);
    stick(s2, 'p1', 'e1');
    moveOrStick(s2, 'p1', 'right');
    expect(s2.entities.p1.cell).toEqual({ x: 5, y: 5 }); // blocked — no move
  });
});
