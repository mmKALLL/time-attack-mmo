import type { Cell, Compass, MapDef, MapExit, MapFeature, ObstacleSize, TileKind, TileMap } from '../types';
import { nextRand, randInt } from './rng';

export type Rect = { x: number; y: number; w: number; h: number };
export type GeneratedMap = { tiles: TileMap; features: MapFeature[]; exits: MapExit[]; entry: Cell; rooms: Rect[] };
const center = (r: Rect): Cell => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });
const OBSTACLE_DIMS: Record<ObstacleSize, [number, number]> = { '1x1': [1, 1], '1x3': [1, 3], '3x1': [3, 1], '3x3': [3, 3] };

// Deterministic, self-contained generator: same (def, seed) -> same map. Uses a
// local RNG so map geometry is stable regardless of the world clock.
export function generateMap(def: MapDef, seed: number): GeneratedMap {
  const g = { rng: seed | 0 };
  const { width: W, height: H } = def.gen;
  const tiles: TileKind[] = new Array(W * H).fill('wall');
  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  const set = (x: number, y: number, t: TileKind) => {
    if (inb(x, y)) tiles[idx(x, y)] = t;
  };
  const carveRect = (x: number, y: number, w: number, h: number) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, 'floor');
  };
  const carveH = (y: number, x0: number, x1: number, cw: number) => {
    const [a, b] = x0 < x1 ? [x0, x1] : [x1, x0];
    for (let i = a; i <= b; i++) for (let k = 0; k < cw; k++) set(i, y + k, 'floor');
  };
  const carveV = (x: number, y0: number, y1: number, cw: number) => {
    const [a, b] = y0 < y1 ? [y0, y1] : [y1, y0];
    for (let j = a; j <= b; j++) for (let k = 0; k < cw; k++) set(x + k, j, 'floor');
  };
  const carveCorridor = (a: Cell, b: Cell, cw: number, twisty: boolean) => {
    if (twisty && nextRand(g) < 0.6) {
      const mx = randInt(g, Math.min(a.x, b.x), Math.max(a.x, b.x));
      carveH(a.y, a.x, mx, cw);
      carveV(mx, a.y, b.y, cw);
      carveH(b.y, mx, b.x, cw);
    } else if (nextRand(g) < 0.5) {
      carveH(a.y, a.x, b.x, cw);
      carveV(b.x, a.y, b.y, cw);
    } else {
      carveV(a.x, a.y, b.y, cw);
      carveH(b.y, a.x, b.x, cw);
    }
  };

  // --- rooms ---
  const roomCount = randInt(g, def.gen.roomCountMin, def.gen.roomCountMax);
  const rooms: Rect[] = [];
  for (let i = 0; i < roomCount; i++) {
    const w = randInt(g, def.gen.roomMin, def.gen.roomMax);
    const h = randInt(g, def.gen.roomMin, def.gen.roomMax);
    const x = randInt(g, 1, Math.max(1, W - 1 - w));
    const y = randInt(g, 1, Math.max(1, H - 1 - h));
    carveRect(x, y, w, h);
    if (def.gen.roomShape === 'natural') {
      // union a second overlapping rect for an organic silhouette
      const w2 = randInt(g, def.gen.roomMin, def.gen.roomMax);
      const h2 = randInt(g, def.gen.roomMin, def.gen.roomMax);
      carveRect(clamp(x + randInt(g, -2, 2), 1, W - 1 - w2), clamp(y + randInt(g, -2, 2), 1, H - 1 - h2), w2, h2);
    }
    rooms.push({ x, y, w, h });
  }
  if (rooms.length === 0) rooms.push({ x: 2, y: 2, w: 4, h: 4 });
  const twisty = def.gen.roomShape === 'natural';
  for (let i = 1; i < rooms.length; i++) carveCorridor(center(rooms[i - 1]), center(rooms[i]), def.gen.corridorWidth, twisty);

  const entry = center(rooms[0]);

  // --- portals (one per connection, carved back to the nearest room) ---
  // No two portals may ever share a tile: if edgeCell's pick is already taken,
  // slide along the same edge to the first free cell (an edge holds far more cells
  // than a map has exits). Deterministic, so seeded maps stay stable.
  const exits: MapExit[] = [];
  const usedExit = new Set<string>();
  const exitKey = (c: Cell) => `${c.x},${c.y}`;
  const xFixedEdge = (d: Compass) => d === 'e' || d === 'w' || d === 'ne' || d === 'nw' || d === 'se' || d === 'sw';
  const freeExitCell = (base: Cell, dir: Compass): Cell => {
    if (!usedExit.has(exitKey(base))) return base;
    if (xFixedEdge(dir)) {
      for (let y = 2; y <= H - 3; y++) if (!usedExit.has(exitKey({ x: base.x, y }))) return { x: base.x, y };
    } else {
      for (let x = 2; x <= W - 3; x++) if (!usedExit.has(exitKey({ x, y: base.y }))) return { x, y: base.y };
    }
    return base; // unreachable in practice: an edge always outnumbers a map's exits
  };
  for (const conn of def.connections) {
    const cell = freeExitCell(edgeCell(conn.dir, W, H, g), conn.dir);
    usedExit.add(exitKey(cell));
    carveCorridor(center(nearestRoom(rooms, cell)), cell, def.gen.corridorWidth, false);
    set(cell.x, cell.y, 'floor');
    exits.push({ cell, toMap: conn.toMap });
  }

  const targets = [entry, ...exits.map((e) => e.cell), ...rooms.map(center)];
  const reachable = () => allReachable(tiles, W, H, entry, targets);

  // Corridor cells = floor outside every room rect. Obstacles must avoid them and
  // their mouths (the 1-tile ring), so a corridor is never blocked or narrowed.
  const inAnyRoom = (x: number, y: number) => rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  const isCorridor = (x: number, y: number) => inb(x, y) && tiles[idx(x, y)] === 'floor' && !inAnyRoom(x, y);
  const touchesCorridor = (x: number, y: number, ow: number, oh: number) => {
    for (let j = y - 1; j <= y + oh; j++) for (let i = x - 1; i <= x + ow; i++) if (isCorridor(i, j)) return true;
    return false;
  };

  // --- obstacles (baked as wall; reverted if they break reachability) ---
  const features: MapFeature[] = [];
  for (let n = 0; n < def.gen.obstacleCount; n++) {
    const size = pickObstacleSize(g);
    const [ow, oh] = OBSTACLE_DIMS[size];
    const room = rooms[randInt(g, 0, rooms.length - 1)];
    if (room.w < ow + 2 || room.h < oh + 2) continue; // keep a walkable ring
    const x = randInt(g, room.x + 1, room.x + room.w - ow - 1);
    const y = randInt(g, room.y + 1, room.y + room.h - oh - 1);
    if (entry.x >= x && entry.x < x + ow && entry.y >= y && entry.y < y + oh) continue; // never bury the spawn
    if (touchesCorridor(x, y, ow, oh)) continue; // keep corridors + their mouths clear
    // Reject overlap with any existing wall/obstacle: a partial overlap that later
    // reverts to floor would punch a walkable hole inside an already-placed prop.
    let clear = true;
    for (let j = y; j < y + oh; j++) for (let i = x; i < x + ow; i++) if (tiles[idx(i, j)] !== 'floor') clear = false;
    if (!clear) continue;
    const saved: [number, number][] = [];
    for (let j = y; j < y + oh; j++) for (let i = x; i < x + ow; i++) {
      saved.push([i, j]);
      set(i, j, 'wall');
    }
    if (reachable()) features.push({ kind: 'obstacle', size, cell: { x, y } });
    else for (const [i, j] of saved) tiles[idx(i, j)] = 'floor';
  }

  // --- torches (on wall cells bordering floor) ---
  const wallEdges: Cell[] = [];
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++)
      if (tiles[idx(x, y)] === 'wall' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tiles[idx(x + dx, y + dy)] === 'floor'))
        wallEdges.push({ x, y });
  const torchCount = Math.round((wallEdges.length * def.gen.torchDensity) / 100);
  for (let n = 0; n < torchCount && wallEdges.length > 0; n++) {
    features.push({ kind: 'torch', cell: wallEdges.splice(randInt(g, 0, wallEdges.length - 1), 1)[0] });
  }

  return { tiles: { width: W, height: H, tiles }, features, exits, entry, rooms };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function nearestRoom(rooms: Rect[], cell: Cell): Rect {
  let best = rooms[0];
  let bd = Infinity;
  for (const r of rooms) {
    const c = center(r);
    const d = Math.abs(c.x - cell.x) + Math.abs(c.y - cell.y);
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best;
}

function edgeCell(dir: Compass, W: number, H: number, g: { rng: number }): Cell {
  const rx = () => randInt(g, 2, W - 3);
  const ry = () => randInt(g, 2, H - 3);
  switch (dir) {
    case 'w': return { x: 1, y: ry() };
    case 'e': return { x: W - 2, y: ry() };
    case 'n': return { x: rx(), y: 1 };
    case 's': return { x: rx(), y: H - 2 };
    case 'nw': return { x: 1, y: 2 };
    case 'ne': return { x: W - 2, y: 2 };
    case 'sw': return { x: 1, y: H - 3 };
    case 'se': return { x: W - 2, y: H - 3 };
  }
}

function pickObstacleSize(g: { rng: number }): ObstacleSize {
  const r = nextRand(g);
  if (r < 0.5) return '1x1';
  if (r < 0.67) return '1x3';
  if (r < 0.84) return '3x1';
  return '3x3';
}

// BFS over floor cells; true if every target is reachable from `from`.
export function allReachable(tiles: TileKind[], W: number, H: number, from: Cell, targets: Cell[]): boolean {
  const seen = new Set<number>();
  const q: Cell[] = [from];
  seen.add(from.y * W + from.x);
  while (q.length) {
    const c = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx;
      const y = c.y + dy;
      const k = y * W + x;
      if (x < 0 || y < 0 || x >= W || y >= H || seen.has(k) || tiles[k] !== 'floor') continue;
      seen.add(k);
      q.push({ x, y });
    }
  }
  return targets.every((t) => seen.has(t.y * W + t.x));
}
