import { describe, it, expect } from 'vitest';
import { travelTo, exitAt } from '../maps';
import { createDemoWorld } from '../demo';
import { MAPS, START_MAP } from '../../data-map';
import type { WorldState } from '../../types';

const heroIds = (s: WorldState) =>
  Object.values(s.entities)
    .filter((e) => e.faction === 'player' || e.faction === 'ally') // the hero party (excludes enemies AND town NPCs)
    .map((e) => e.id)
    .sort();
const enemyCount = (s: WorldState) => Object.values(s.entities).filter((e) => e.faction === 'enemy').length;

describe('maps & transitions', () => {
  it('starts in START_MAP (a safe town) with the lone player and generated exits', () => {
    const s = createDemoWorld();
    expect(s.mapId).toBe(START_MAP);
    expect(heroIds(s)).toHaveLength(1);
    expect(enemyCount(s)).toBe(0); // the starting town is safe
    expect(s.exits).toHaveLength(MAPS[START_MAP].connections.length);
  });
  it('field maps beyond the town spawn enemies', () => {
    const s = createDemoWorld();
    travelTo(s, s.exits[0].toMap, s.mapId); // step into the first field map
    expect(enemyCount(s)).toBeGreaterThan(0);
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
  it('grows the discovered list (deduped) as new maps are entered', () => {
    const s = createDemoWorld();
    expect(s.discovered).toEqual([START_MAP]);
    const next = s.exits[0].toMap;
    travelTo(s, next, s.mapId);
    expect(s.discovered).toContain(next);
    const before = s.discovered.length;
    travelTo(s, START_MAP, s.mapId); // re-entering an already-discovered map adds nothing
    expect(s.discovered.length).toBe(before);
  });
  it('fully heals MP on entering a town, but not on entering a field map', () => {
    const s = createDemoWorld();
    const p = s.entities[s.playerId];
    const field = s.exits[0].toMap; // first field map out of the start town
    p.mp = 0;
    travelTo(s, field, s.mapId); // into a field → MP untouched
    expect(s.entities[s.playerId].mp).toBe(0);
    travelTo(s, START_MAP, s.mapId); // back into a town → MP full
    const back = s.entities[s.playerId];
    expect(back.mp).toBe(back.stats.maxMp);
    expect(back.stats.maxMp).toBeGreaterThan(0);
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
