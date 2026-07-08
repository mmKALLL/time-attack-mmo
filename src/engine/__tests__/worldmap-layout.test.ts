import { describe, it, expect } from 'vitest';
import { computeWorldMapLayout, COMPASS_OFFSET } from '../worldmap-layout';
import { MAPS, START_MAP } from '../../data-map';

describe('world-map layout', () => {
  const layout = computeWorldMapLayout();

  it('produces a node for every map', () => {
    expect(layout.nodes).toHaveLength(Object.keys(MAPS).length);
    expect(new Set(layout.nodes.map((n) => n.id)).size).toBe(layout.nodes.length); // unique ids
  });

  it('gives every map a finite, normalized (0..1) position', () => {
    for (const n of layout.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(1);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(1);
    }
  });

  it('flags towns from the map biome', () => {
    const start = layout.nodes.find((n) => n.id === START_MAP)!;
    expect(start.isTown).toBe(true); // Mäntyharju is a town
    expect(start.gx).toBe(0);
    expect(start.gy).toBe(0); // BFS root sits at the grid origin
  });

  it('offsets a neighbour by its connection compass direction', () => {
    const nbr = MAPS[START_MAP].connections[0];
    const off = COMPASS_OFFSET[nbr.dir];
    const startNode = layout.nodes.find((n) => n.id === START_MAP)!;
    const nbrNode = layout.nodes.find((n) => n.id === nbr.toMap)!;
    expect(nbrNode.gx).toBe(startNode.gx + off.dx);
    expect(nbrNode.gy).toBe(startNode.gy + off.dy);
  });

  it('derives undirected, deduped edges from the connections', () => {
    for (const e of layout.edges) expect(e.a < e.b).toBe(true); // ordered pair
    const keys = layout.edges.map((e) => `${e.a}|${e.b}`);
    expect(new Set(keys).size).toBe(keys.length); // no duplicate edge
  });

  it('leaves quest markers as an empty typed stub', () => {
    expect(layout.questMarkers).toEqual([]);
  });
});
