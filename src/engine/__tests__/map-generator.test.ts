import { describe, it, expect } from 'vitest';
import { generateMap, allReachable } from '../map-generator';
import { MAPS } from '../../data-map';

describe('map generator', () => {
  const def = MAPS.lieksa; // a deep-forest dungeon map with obstacles + connections

  it('is deterministic for a given seed', () => {
    const a = generateMap(def, 123);
    const b = generateMap(def, 123);
    expect(a.tiles.tiles).toEqual(b.tiles.tiles);
    expect(a.exits).toEqual(b.exits);
    expect(a.features).toEqual(b.features);
  });
  it('produces one portal per connection, each sitting on floor', () => {
    const g = generateMap(def, 7);
    expect(g.exits).toHaveLength(def.connections.length);
    for (const ex of g.exits) {
      expect(g.tiles.tiles[ex.cell.y * g.tiles.width + ex.cell.x]).toBe('floor');
    }
  });
  it('keeps the entry and all portals reachable across many seeds', () => {
    for (const seed of [1, 2, 3, 99, 12345, 55555]) {
      const g = generateMap(def, seed);
      const targets = [g.entry, ...g.exits.map((e) => e.cell)];
      expect(allReachable(g.tiles.tiles, g.tiles.width, g.tiles.height, g.entry, targets)).toBe(true);
    }
  });
  it('bakes obstacles into the grid as walls', () => {
    const g = generateMap(def, 42);
    for (const f of g.features) {
      if (f.kind === 'obstacle') {
        expect(g.tiles.tiles[f.cell.y * g.tiles.width + f.cell.x]).toBe('wall');
      }
    }
  });
});
