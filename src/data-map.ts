import type { Biome, Compass, MapDef, TileKind, TileMap } from './types';
import { ENEMIES } from './data-enemy';
import { MAP_SIZE } from './config';

// ============================================================================
// World topology (design-doc part 1, Finnish overworld). Towns are safe NPC maps
// linked by chains of field maps ("exits"), like a doubly linked list: A -> segs
// -> B, and B -> reversed segs -> A. Biomes are normalized to the tileset set
// (forest / deepForest / lake / town); the doc's "plains" render as forest.
// The generator (engine/map-generator) turns each MapDef into tiles/portals.
// ============================================================================
const opp: Record<Compass, Compass> = { n: 's', s: 'n', e: 'w', w: 'e', ne: 'sw', sw: 'ne', nw: 'se', se: 'nw' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Level-appropriate spawn pool: enemies in [lo-1, hi]. The band never reaches
// above `hi`, so a "Lv 1-2" map never spawns a Lv 3 enemy; the -1 slack only lets
// in slightly-weaker foes for variety.
function poolFor(lo: number, hi: number): string[] {
  const inBand = Object.values(ENEMIES).filter((e) => e.level >= lo - 1 && e.level <= hi);
  const pool = (inBand.length ? inBand : Object.values(ENEMIES).filter((e) => e.level <= hi + 3)).map((e) => e.id);
  return pool.slice(0, 8);
}

const maps: Record<string, MapDef> = {};
const add = (m: MapDef) => {
  maps[m.id] = m;
};
// Link a -> b (portal on a's `dir` edge) and the reverse b -> a.
const link = (a: string, dir: Compass, b: string) => {
  maps[a].connections.push({ dir, toMap: b });
  maps[b].connections.push({ dir: opp[dir], toMap: a });
};

// A safe town: town tileset, no spawns.
function town(id: string, name: string, description: string): MapDef {
  return {
    id,
    name,
    biome: 'town',
    recommended: [1, 1],
    description,
    gen: { width: MAP_SIZE.town.width, height: MAP_SIZE.town.height, tileset: 'town', roomCountMin: 1, roomCountMax: 1, roomShape: 'rectangular', corridorWidth: 2, roomMin: 5, roomMax: 8, torchDensity: 4, obstacleCount: 2 },
    connections: [],
    spawns: [{ pool: [], maxAmount: 0, spawnInterval: 999, spawnAmount: 0 }],
  };
}

// A field/dungeon map for a level band. `rooms` = base room count; `width`/
// `height` default to the biome's MAP_SIZE but can be overridden per segment.
function field(id: string, name: string, biome: Biome, lo: number, hi: number, rooms: number, width = MAP_SIZE[biome].width, height = MAP_SIZE[biome].height): MapDef {
  const deep = biome === 'deepForest';
  return {
    id,
    name: name || biomeName(biome),
    biome,
    recommended: [lo, hi],
    gen: { width, height, tileset: biome, roomCountMin: rooms, roomCountMax: rooms + 1, roomShape: 'natural', corridorWidth: deep ? 1 : 2, roomMin: 5, roomMax: 8, torchDensity: deep ? 6 : 3, obstacleCount: 4 },
    connections: [],
    spawns: [{ pool: poolFor(lo, hi), maxAmount: 5, spawnInterval: 7, spawnAmount: 1 }],
  };
}

// ---------- Towns ----------
add(town('mantyharju', 'Mäntyharju', "Where the old pines hush and every wanderer's tale first draws breath.")); // starting town (beginners, lv 1)
add(town('savonlinna', 'Savonlinna', 'A black-water fortress isle where oaths are sworn in steel and stone.')); // fighter 1st job
add(town('varkaus', 'Varkaus', 'A town of shifting locks and whispered bargains, where the current keeps its secrets.')); // rogue 1st job
add(town('jyvaskyla', 'Jyväskylä', 'A ridge of scholars where the very air crackles with half-spoken spells.')); // magician 1st job
add(town('kuopio', 'Kuopio', 'A mirror-lake town beneath a lonely tower, watched by the keenest eyes in the north.')); // archer 1st job
add(town('kajaani', 'Kajaani', 'The last warm hearth before the deep north swallows the road whole.')); // 2nd job

// ---------- Lieksa deep-forest dungeon (entrance + 3 deeper maps, dead-end chain) ----------
add(town('lieksa', 'Lieksa', "A moss-drowned waystation at the deepwood's edge, where the road ends and the old dark begins."));
add(field('lieksa2', 'Lieksa Dungeon 1', 'deepForest', 25, 29, 3));
add(field('lieksa3', 'Lieksa Dungeon 2', 'deepForest', 30, 34, 5));
add(field('lieksa4', 'Lieksa Dungeon 3', 'deepForest', 35, 40, 2));
link('lieksa', 'e', 'lieksa2');
link('lieksa2', 'ne', 'lieksa3');
link('lieksa3', 'nw', 'lieksa4');

// ---------- Field-map chains between nodes (design-doc part 1) ----------
// One field map in a chain. `width`/`height` optionally override the standard
// field size for that map. ("plains" from the design doc render as forest.)
type Seg = { biome: Biome; lo: number; hi: number; rooms: number; width?: number; height?: number };
type Edge = { a: string; b: string; dir: Compass; seg: Seg[] };
// Name an in-between field map after the nearer town, with an index counting
// outward from that town (1 = adjacent to it, no suffix). For map `i` of `n` on
// edge a -> b: the closer town owns it, ties (<=) go to `a` (the earlier one).
const biomeName = (biome: Biome) => cap(biome === 'deepForest' ? 'deep forest' : biome);
function fieldName(aName: string, bName: string, i: number, n: number, biome: Biome): string {
  const distFromA = i;
  const distFromB = n - 1 - i;
  const ownerIsA = distFromA <= distFromB;
  const townName = ownerIsA ? aName : bName;
  const index = ownerIsA ? i + 1 : n - i;
  const label = biomeName(biome);
  return index === 1 ? `${townName} ${label}` : `${townName} ${label} ${index}`;
}
const EDGES: Edge[] = [
  {
    a: 'mantyharju',
    b: 'savonlinna',
    dir: 'e',
    seg: [
      { biome: 'forest', lo: 1, hi: 2, rooms: 2, width: 13, height: 11 }, // small starter map
      { biome: 'forest', lo: 3, hi: 5, rooms: 2, width: 15, height: 13 },
      { biome: 'forest', lo: 4, hi: 7, rooms: 3 },
    ],
  }, // gentle ramp out of the start town
  { a: 'savonlinna', b: 'varkaus', dir: 'nw', seg: [{ biome: 'forest', lo: 7, hi: 9, rooms: 4 }] }, // plains
  {
    a: 'savonlinna',
    b: 'lieksa',
    dir: 'ne',
    seg: [
      { biome: 'lake', lo: 10, hi: 12, rooms: 2 },
      { biome: 'forest', lo: 12, hi: 16, rooms: 2 },
      { biome: 'deepForest', lo: 16, hi: 21, rooms: 3 },
    ],
  },
  { a: 'varkaus', b: 'kuopio', dir: 'n', seg: [{ biome: 'lake', lo: 9, hi: 12, rooms: 2 }] },
  {
    a: 'varkaus',
    b: 'jyvaskyla',
    dir: 'w',
    seg: [
      { biome: 'forest', lo: 8, hi: 10, rooms: 2 },
      { biome: 'forest', lo: 10, hi: 14, rooms: 2 },
    ],
  }, // plains
  { a: 'jyvaskyla', b: 'kuopio', dir: 'ne', seg: [{ biome: 'forest', lo: 12, hi: 16, rooms: 2 }] },
  {
    a: 'kuopio',
    b: 'kajaani',
    dir: 'n',
    seg: [
      { biome: 'lake', lo: 12, hi: 16, rooms: 2 },
      { biome: 'forest', lo: 16, hi: 20, rooms: 3 },
      { biome: 'forest', lo: 20, hi: 25, rooms: 3 },
    ],
  }, // plains
  {
    a: 'kajaani',
    b: 'lieksa',
    dir: 'e',
    seg: [
      { biome: 'forest', lo: 26, hi: 30, rooms: 3 },
      { biome: 'deepForest', lo: 23, hi: 27, rooms: 3 },
      { biome: 'deepForest', lo: 20, hi: 24, rooms: 3 },
    ],
  },
];
for (const e of EDGES) {
  const nodes = [e.a];
  e.seg.forEach((s, i) => {
    const id = `${e.a}_${e.b}_${i}`;
    const name = fieldName(maps[e.a].name, maps[e.b].name, i, e.seg.length, s.biome);
    add(field(id, name, s.biome, s.lo, s.hi, s.rooms, s.width, s.height));
    nodes.push(id);
  });
  nodes.push(e.b);
  for (let i = 0; i < nodes.length - 1; i++) link(nodes[i], e.dir, nodes[i + 1]);
}

export const MAPS = maps;
export const START_MAP = 'mantyharju';

// Simple test/util map (border walls + a couple props).
export function demoMap(width = 30, height = 17): TileMap {
  const tiles: TileKind[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      tiles.push(border ? 'wall' : 'floor');
    }
  }
  const wall = (x: number, y: number) => {
    tiles[y * width + x] = 'wall';
  };
  wall(10, 3);
  wall(10, 4);
  wall(11, 3);
  wall(22, 12);
  wall(23, 12);
  wall(23, 13);
  return { width, height, tiles };
}
