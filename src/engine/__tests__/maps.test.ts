import { describe, it, expect } from 'vitest';
import { travelTo, exitAt } from '../maps';
import { createDemoWorld } from '../demo';
import { MAPS, START_MAP } from '../../data-map';
import type { WorldState } from '../../types';

const heroIds = (s: WorldState) =>
  Object.values(s.entities)
    .filter((e) => e.faction !== 'enemy')
    .map((e) => e.id)
    .sort();
const enemyCount = (s: WorldState) => Object.values(s.entities).filter((e) => e.faction === 'enemy').length;

describe('maps & transitions', () => {
  it('starts in START_MAP with a 3-hero party, spawned enemies, and generated exits', () => {
    const s = createDemoWorld();
    expect(s.mapId).toBe(START_MAP);
    expect(heroIds(s)).toHaveLength(3);
    expect(enemyCount(s)).toBeGreaterThan(0);
    expect(s.exits).toHaveLength(MAPS[START_MAP].connections.length);
  });
  it('exitAt matches a generated portal cell', () => {
    const s = createDemoWorld();
    const ex = s.exits[0];
    expect(exitAt(s, ex.cell)).toBe(ex);
    expect(exitAt(s, { x: -1, y: -1 })).toBeUndefined();
  });
  it('travelTo switches map, carries the party, clears groups, spawns enemies', () => {
    const s = createDemoWorld();
    const before = heroIds(s);
    const to = s.exits[0].toMap;
    travelTo(s, to, s.mapId);
    expect(s.mapId).toBe(to);
    expect(heroIds(s)).toEqual(before); // same party carried over
    expect(Object.keys(s.groups)).toHaveLength(0);
    expect(enemyCount(s)).toBeGreaterThan(0);
  });
  it('never exceeds a spawn rule’s maxAmount', () => {
    const s = createDemoWorld();
    expect(enemyCount(s)).toBeLessThanOrEqual(MAPS[s.mapId].spawns[0].maxAmount);
  });
  it('is deterministic for a fixed seed (same enemy layout)', () => {
    const pos = (s: WorldState) =>
      Object.values(s.entities)
        .map((e) => `${e.id}@${e.cell.x},${e.cell.y}:${e.level}`)
        .sort();
    expect(pos(createDemoWorld())).toEqual(pos(createDemoWorld()));
  });
});
