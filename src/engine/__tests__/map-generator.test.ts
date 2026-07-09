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
  it('never overlaps obstacle footprints, so no prop has a walkable hole', () => {
    const DIMS: Record<string, [number, number]> = { '1x1': [1, 1], '1x3': [1, 3], '3x1': [3, 1], '3x3': [3, 3] };
    for (const seed of [1, 2, 3, 42, 99, 12345, 55555, 8, 17]) {
      const g = generateMap(def, seed);
      const claimed = new Set<string>();
      for (const f of g.features) {
        if (f.kind !== 'obstacle') continue;
        const [ow, oh] = DIMS[f.size];
        for (let dy = 0; dy < oh; dy++)
          for (let dx = 0; dx < ow; dx++) {
            const cx = f.cell.x + dx;
            const cy = f.cell.y + dy;
            expect(claimed.has(`${cx},${cy}`), `overlap at ${cx},${cy} seed ${seed}`).toBe(false);
            claimed.add(`${cx},${cy}`);
            expect(g.tiles.tiles[cy * g.tiles.width + cx]).toBe('wall'); // whole footprint is solid
          }
      }
    }
  });
});
