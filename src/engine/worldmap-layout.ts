import type { Compass, MapId } from '../types';
import { MAPS, START_MAP } from '../data-map';

// Pure world-map graph layout. Each MapDef.connections carries a compass `dir`;
// we BFS out from START_MAP, offsetting a grid position by each connection's
// direction, then normalize the grid into a 0..1 unit box so the screen can
// scale it into whatever panel it draws in. No React/Pixi here — the engine
// layer stays framework-agnostic and this stays unit-testable.

// Compass -> grid offset (screen coords: +x east, +y south). Diagonals combine.
export const COMPASS_OFFSET: Record<Compass, { dx: number; dy: number }> = {
  n: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  e: { dx: 1, dy: 0 },
  w: { dx: -1, dy: 0 },
  ne: { dx: 1, dy: -1 },
  nw: { dx: -1, dy: -1 },
  se: { dx: 1, dy: 1 },
  sw: { dx: -1, dy: 1 },
};

export type WorldNode = {
  id: MapId;
  name: string;
  isTown: boolean;
  recommended: [number, number];
  gx: number; // raw grid position (integer-ish, pre-normalize)
  gy: number;
  x: number; // normalized 0..1 within the graph's bounding box
  y: number;
};

export type WorldEdge = { a: MapId; b: MapId };

// TODO: quest markers — no quest system exists yet. This typed stub gives the
// layout a place to hang markers (map to pin on, a label) once quests land.
export type QuestMarker = { mapId: MapId; label: string };

export type WorldMapLayout = {
  nodes: WorldNode[];
  edges: WorldEdge[];
  questMarkers: QuestMarker[];
};

// Build the node-link layout for the whole world graph. Positions are BFS-derived
// grid coords normalized to 0..1; every reachable map gets a finite position.
export function computeWorldMapLayout(): WorldMapLayout {
  const grid = new Map<MapId, { gx: number; gy: number }>();
  const queue: MapId[] = [];

  const start = MAPS[START_MAP] ? START_MAP : Object.keys(MAPS)[0];
  if (start) {
    grid.set(start, { gx: 0, gy: 0 });
    queue.push(start);
  }

  // BFS: place each unseen neighbour at this node's position + the compass offset.
  while (queue.length) {
    const id = queue.shift()!;
    const at = grid.get(id)!;
    for (const c of MAPS[id]?.connections ?? []) {
      if (grid.has(c.toMap) || !MAPS[c.toMap]) continue;
      const off = COMPASS_OFFSET[c.dir];
      grid.set(c.toMap, { gx: at.gx + off.dx, gy: at.gy + off.dy });
      queue.push(c.toMap);
    }
  }

  // Catch any map not reachable from START_MAP (shouldn't happen with the current
  // topology, but keep the layout total so no id is ever position-less).
  for (const id of Object.keys(MAPS)) if (!grid.has(id)) grid.set(id, { gx: 0, gy: 0 });

  // Normalize the grid box to 0..1 (guarding the single-column / single-row case).
  const xs = [...grid.values()].map((g) => g.gx);
  const ys = [...grid.values()].map((g) => g.gy);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const nodes: WorldNode[] = [...grid.entries()].map(([id, g]) => {
    const def = MAPS[id];
    return {
      id,
      name: def.name,
      isTown: def.biome === 'town',
      recommended: def.recommended,
      gx: g.gx,
      gy: g.gy,
      x: (g.gx - minX) / spanX,
      y: (g.gy - minY) / spanY,
    };
  });

  // Undirected edges, deduped by an ordered id pair.
  const seen = new Set<string>();
  const edges: WorldEdge[] = [];
  for (const id of Object.keys(MAPS))
    for (const c of MAPS[id].connections) {
      if (!MAPS[c.toMap]) continue;
      const [a, b] = id < c.toMap ? [id, c.toMap] : [c.toMap, id];
      const k = `${a}|${b}`;
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push({ a, b });
    }

  return { nodes, edges, questMarkers: [] };
}
