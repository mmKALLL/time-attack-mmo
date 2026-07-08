import type { Biome, Compass, MapDef, TileKind, TileMap } from './types';
import { ENEMIES } from './data-enemy';

// ============================================================================
// World topology (design-doc part 1, Finnish overworld). Towns are safe NPC maps
// linked by chains of field maps ("exits"), like a doubly linked list: A -> segs
// -> B, and B -> reversed segs -> A. Biomes are normalized to the tileset set
// (forest / deepForest / lake / town); the doc's "plains" render as forest.
// The generator (engine/map-generator) turns each MapDef into tiles/portals.
// ============================================================================
const W = 30;
const H = 17;
// Towns are smaller than field maps so portals sit near a room edge rather than
// down a long corridor to a far corner. Still large enough to fill the viewport.
const TOWN_W = 20;
const TOWN_H = 13;
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
function town(id: string, name: string): MapDef {
  return {
    id,
    name,
    biome: 'town',
    recommended: [1, 1],
    gen: { width: TOWN_W, height: TOWN_H, tileset: 'town', roomCountMin: 1, roomCountMax: 1, roomShape: 'rectangular', corridorWidth: 2, roomMin: 5, roomMax: 8, torchDensity: 4, obstacleCount: 2 },
    connections: [],
    spawns: [{ pool: [], maxAmount: 0, spawnInterval: 999, spawnAmount: 0 }],
  };
}

// A field/dungeon map for a level band. `rooms` = base room count.
function field(id: string, biome: Biome, lo: number, hi: number, rooms: number): MapDef {
  const deep = biome === 'deepForest';
  return {
    id,
    name: `${cap(biome === 'deepForest' ? 'deep forest' : biome)} · Lv ${lo}–${hi}`,
    biome,
    recommended: [lo, hi],
    gen: { width: W, height: H, tileset: biome, roomCountMin: rooms, roomCountMax: rooms + 1, roomShape: 'natural', corridorWidth: deep ? 1 : 2, roomMin: 5, roomMax: 8, torchDensity: deep ? 6 : 3, obstacleCount: 4 },
    connections: [],
    spawns: [{ pool: poolFor(lo, hi), maxAmount: 5, spawnInterval: 7, spawnAmount: 1 }],
  };
}

// ---------- Towns ----------
add(town('mantyharju', 'Mäntyharju')); // starting town (beginners, lv 1)
add(town('savonlinna', 'Savonlinna')); // fighter 1st job
add(town('varkaus', 'Varkaus')); // rogue 1st job
add(town('jyvaskyla', 'Jyväskylä')); // magician 1st job
add(town('kuopio', 'Kuopio')); // archer 1st job
add(town('kajaani', 'Kajaani')); // 2nd job

// ---------- Lieksa deep-forest dungeon (entrance + 3 deeper maps, dead-end chain) ----------
add(field('lieksa', 'deepForest', 20, 24, 2));
maps.lieksa.name = 'Lieksa Deepwood';
add(field('lieksa2', 'deepForest', 25, 29, 3));
add(field('lieksa3', 'deepForest', 30, 34, 5));
add(field('lieksa4', 'deepForest', 35, 40, 2));
link('lieksa', 'n', 'lieksa2');
link('lieksa2', 'n', 'lieksa3');
link('lieksa3', 'n', 'lieksa4');

// ---------- Field-map chains between nodes (design-doc part 1) ----------
type Seg = [Biome, number, number, number]; // biome, lo, hi, rooms  ("plains" -> forest)
type Edge = { a: string; b: string; dir: Compass; seg: Seg[] };
const EDGES: Edge[] = [
  {
    a: 'mantyharju',
    b: 'savonlinna',
    dir: 'e',
    seg: [
      ['forest', 1, 2, 2],
      ['forest', 3, 5, 2],
      ['forest', 4, 7, 3],
    ],
  }, // gentle ramp out of the start town
  { a: 'savonlinna', b: 'varkaus', dir: 'nw', seg: [['forest', 7, 9, 4]] }, // plains
  {
    a: 'savonlinna',
    b: 'lieksa',
    dir: 'ne',
    seg: [
      ['lake', 10, 12, 2],
      ['forest', 12, 16, 2],
      ['deepForest', 16, 21, 2],
    ],
  },
  { a: 'varkaus', b: 'kuopio', dir: 'n', seg: [['lake', 9, 12, 2]] },
  {
    a: 'varkaus',
    b: 'jyvaskyla',
    dir: 'w',
    seg: [
      ['forest', 8, 10, 2],
      ['forest', 10, 14, 2],
    ],
  }, // plains
  { a: 'jyvaskyla', b: 'kuopio', dir: 'ne', seg: [['forest', 12, 16, 2]] },
  {
    a: 'kuopio',
    b: 'kajaani',
    dir: 'n',
    seg: [
      ['lake', 12, 16, 2],
      ['forest', 17, 21, 2],
      ['forest', 22, 26, 2],
    ],
  }, // plains
  {
    a: 'kajaani',
    b: 'lieksa',
    dir: 'e',
    seg: [
      ['forest', 18, 22, 2],
      ['deepForest', 23, 27, 2],
    ],
  },
];
for (const e of EDGES) {
  const nodes = [e.a];
  e.seg.forEach((s, i) => {
    const id = `${e.a}_${e.b}_${i}`;
    add(field(id, s[0], s[1], s[2], s[3]));
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
