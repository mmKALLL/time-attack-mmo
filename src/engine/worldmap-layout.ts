import type { MapId } from '../types';
import { MAPS } from '../data-map';

// Pure world-map layout, pinned to the Claude Design illustrated parchment map of
// Finland (docs/design_handoff_world_map/World Map.svg). Every game map id gets a
// coordinate in the art's DESIGN SPACE — the 1440×1860 portrait viewBox — so the
// screen's overlay <svg viewBox="0 0 1440 1860"> lines up 1:1 with the painted
// coastline/lakes/roads. No React/Pixi here: the engine layer stays framework-
// agnostic and this stays unit-testable.

// The background art's viewBox. Overlay markers are drawn in this same frame.
export const DESIGN_W = 1440;
export const DESIGN_H = 1860;

// Design coordinates for the towns that HAVE a painted landmark on the map (mined
// from World Map.dc.html, the source of truth). Field-map chains and the Lieksa
// dungeon chain are derived from these anchors below.
const TOWN_ANCHOR: Record<string, { x: number; y: number }> = {
  mantyharju: { x: 785, y: 1520 }, // nudged 4px up to sit on the painted icon
  savonlinna: { x: 937, y: 1451 },
  varkaus: { x: 860, y: 1380 },
  jyvaskyla: { x: 699, y: 1392 },
  kuopio: { x: 846, y: 1287 },
  kajaani: { x: 849, y: 1073 },
  lieksa: { x: 1023, y: 1218 },
};

// How far to step each deeper Lieksa dungeon map north (smaller y) from the
// previous one — it's a dead-end chain climbing into the wilderness.
const LIEKSA_STEP_Y = 70;

export type WorldNode = {
  id: MapId;
  name: string;
  isTown: boolean;
  recommended: [number, number];
  x: number; // design-space x within the 1440×1860 art frame
  y: number; // design-space y
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

// Field maps are ided "{townA}_{townB}_{i}" (town ids carry no underscores), so a
// 2-part-underscore id is a chain segment; anything else is a town or a Lieksa
// dungeon map. Returns the chain descriptor or null.
function parseChain(id: MapId): { a: string; b: string; i: number } | null {
  const parts = id.split('_');
  if (parts.length !== 3) return null;
  const i = Number(parts[2]);
  if (!Number.isInteger(i)) return null;
  return { a: parts[0], b: parts[1], i };
}

// The Lieksa dungeon chain (lieksa2..lieksa4) is a dead-end going north; depth is
// the trailing number (lieksa=0, lieksa2=1, ...). Returns null for non-Lieksa ids.
function lieksaDepth(id: MapId): number | null {
  const m = /^lieksa(\d*)$/.exec(id);
  if (!m) return null;
  return m[1] === '' ? 0 : Number(m[1]) - 1; // "lieksa2" -> depth 1
}

// Resolve a design-space coordinate for one map id. Towns come straight from the
// anchor table; Lieksa dungeon maps step north from the Lieksa anchor; field-map
// segments interpolate between their two endpoint towns, evenly spaced by index
// over the chain length, nudged perpendicular so parallel chains don't overlap.
function coordFor(id: MapId, chainLen: Map<string, number>): { x: number; y: number } {
  const anchor = TOWN_ANCHOR[id];
  if (anchor) return anchor;

  // Lieksa deep-forest dungeon chain (dead-end north of the Lieksa anchor).
  const depth = lieksaDepth(id);
  if (depth !== null) return { x: TOWN_ANCHOR.lieksa.x, y: TOWN_ANCHOR.lieksa.y - depth * LIEKSA_STEP_Y };

  // Field-map chain segment between two towns.
  const chain = parseChain(id);
  if (chain) {
    const a = TOWN_ANCHOR[chain.a];
    const b = TOWN_ANCHOR[chain.b];
    if (a && b) {
      const segments = chainLen.get(`${chain.a}_${chain.b}`) ?? 1;
      // Space segment i evenly on (a..b): t in (0,1), never landing on a town.
      const t = (chain.i + 1) / (segments + 1);
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      // Perpendicular unit vector, to bow alternate segments off the straight
      // line so overlapping chains (and the road art) stay readable.
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nudge = chain.i % 2 === 0 ? 10 : -10;
      return { x: x + (-dy / len) * nudge, y: y + (dx / len) * nudge };
    }
  }

  // Fallback (should never hit with the current topology): centre of the frame,
  // so the layout stays total and every id gets a finite coordinate.
  return { x: DESIGN_W / 2, y: DESIGN_H / 2 };
}

// Build the design-space layout for every map in MAPS. Coordinates are anchored
// to the parchment art (towns), stepped (Lieksa chain) or interpolated (field
// chains); every id gets a finite point inside the 1440×1860 frame.
export function computeWorldMapLayout(): WorldMapLayout {
  // Count segments per field-map chain ("{a}_{b}_" prefix) so interpolation knows
  // how many stops to space over.
  const chainLen = new Map<string, number>();
  for (const id of Object.keys(MAPS)) {
    const chain = parseChain(id);
    if (chain) {
      const key = `${chain.a}_${chain.b}`;
      chainLen.set(key, Math.max(chainLen.get(key) ?? 0, chain.i + 1));
    }
  }

  const nodes: WorldNode[] = Object.keys(MAPS).map((id) => {
    const def = MAPS[id];
    const { x, y } = coordFor(id, chainLen);
    return {
      id,
      name: def.name,
      isTown: def.biome === 'town',
      recommended: def.recommended,
      x,
      y,
    };
  });

  // Undirected edges (roads between maps), deduped by an ordered id pair. Kept for
  // context; the parchment already paints roads, so the screen may not draw these.
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
