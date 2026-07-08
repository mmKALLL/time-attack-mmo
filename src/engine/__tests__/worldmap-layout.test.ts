import { describe, it, expect } from 'vitest';
import { computeWorldMapLayout, DESIGN_W, DESIGN_H } from '../worldmap-layout';
import { MAPS, START_MAP } from '../../data-map';

// Anchor table from the design handoff (World Map.dc.html): the towns painted on
// the parchment. Field/dungeon chains derive from these, so we only pin towns.
const TOWN_ANCHOR: Record<string, { x: number; y: number }> = {
  mantyharju: { x: 785, y: 1524 },
  savonlinna: { x: 937, y: 1451 },
  varkaus: { x: 860, y: 1380 },
  jyvaskyla: { x: 699, y: 1392 },
  kuopio: { x: 846, y: 1287 },
  kajaani: { x: 849, y: 1073 },
  lieksa: { x: 1023, y: 1218 },
};

describe('world-map layout (design-space)', () => {
  const layout = computeWorldMapLayout();
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));

  it('produces a node for every map', () => {
    expect(layout.nodes).toHaveLength(Object.keys(MAPS).length);
    expect(new Set(layout.nodes.map((n) => n.id)).size).toBe(layout.nodes.length); // unique ids
  });

  it('gives every map a finite coordinate inside the 1440×1860 frame', () => {
    for (const n of layout.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(DESIGN_W);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(DESIGN_H);
    }
  });

  it('pins each town to its design anchor', () => {
    for (const [id, at] of Object.entries(TOWN_ANCHOR)) {
      const n = byId.get(id)!;
      expect(n).toBeDefined();
      expect(n.x).toBe(at.x);
      expect(n.y).toBe(at.y);
    }
  });

  it('flags towns from the map biome', () => {
    const start = byId.get(START_MAP)!;
    expect(start.isTown).toBe(true); // Mäntyharju is a town
    // The start town sits on its painted anchor, not a normalized origin.
    expect(start.x).toBe(TOWN_ANCHOR.mantyharju.x);
    expect(start.y).toBe(TOWN_ANCHOR.mantyharju.y);
  });

  it('steps the Lieksa dungeon chain north (dead-end) from the Lieksa anchor', () => {
    const l1 = byId.get('lieksa')!;
    const l2 = byId.get('lieksa2')!;
    const l3 = byId.get('lieksa3')!;
    const l4 = byId.get('lieksa4')!;
    // Same column as Lieksa, each deeper map strictly further north (smaller y).
    for (const l of [l2, l3, l4]) expect(l.x).toBe(l1.x);
    expect(l2.y).toBeLessThan(l1.y);
    expect(l3.y).toBeLessThan(l2.y);
    expect(l4.y).toBeLessThan(l3.y);
  });

  it('interpolates field-map segments between their two endpoint towns', () => {
    // mantyharju_savonlinna_* has three segments; each should land between the
    // two towns' anchors (with a small perpendicular nudge, so use a bbox with
    // slack rather than exact collinearity).
    const a = TOWN_ANCHOR.mantyharju;
    const b = TOWN_ANCHOR.savonlinna;
    const seg = byId.get('mantyharju_savonlinna_1');
    expect(seg).toBeDefined();
    const loX = Math.min(a.x, b.x) - 20;
    const hiX = Math.max(a.x, b.x) + 20;
    const loY = Math.min(a.y, b.y) - 20;
    const hiY = Math.max(a.y, b.y) + 20;
    expect(seg!.x).toBeGreaterThanOrEqual(loX);
    expect(seg!.x).toBeLessThanOrEqual(hiX);
    expect(seg!.y).toBeGreaterThanOrEqual(loY);
    expect(seg!.y).toBeLessThanOrEqual(hiY);
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
