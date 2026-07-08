import type { MapDef, TileKind, TileMap } from './types';

// ============================================================================
// Map data. Each biome is a set of procedural-generation parameters + topology
// (which compass edges link where) + a spawn table. The generator (engine/
// mapgen.ts) turns params + a seed into tiles/features/portals. Tile data will
// move to JSON later; the full biome set + world-map topology is follow-up work.
// ============================================================================
const W = 30;
const H = 17;

export const MAPS: Record<string, MapDef> = {
  farmland: {
    id: 'farmland', name: 'Sunnybrook Farmlands', biome: 'farmland', recommended: [5, 9],
    gen: { width: W, height: H, roomCountMin: 2, roomCountMax: 3, roomShape: 'rectangular', corridorWidth: 2, roomMin: 5, roomMax: 8, torchDensity: 3, obstacleCount: 3 },
    connections: [{ dir: 'e', toMap: 'plains' }],
    spawns: [{ pool: ['rosvoFighter', 'rosvoArcher'], levelMin: 5, levelMax: 9, maxAmount: 4, spawnInterval: 8, spawnAmount: 1 }],
  },
  plains: {
    id: 'plains', name: 'Windmere Plains', biome: 'plains', recommended: [10, 14],
    gen: { width: W, height: H, roomCountMin: 2, roomCountMax: 3, roomShape: 'natural', corridorWidth: 2, roomMin: 6, roomMax: 9, torchDensity: 2, obstacleCount: 3 },
    connections: [{ dir: 'w', toMap: 'farmland' }, { dir: 'e', toMap: 'forest' }],
    spawns: [{ pool: ['rosvoFighter', 'rosvoRogue', 'varasRogue'], levelMin: 10, levelMax: 14, maxAmount: 5, spawnInterval: 8, spawnAmount: 1 }],
  },
  forest: {
    id: 'forest', name: 'Green Hollow', biome: 'forest', recommended: [15, 19],
    gen: { width: W, height: H, roomCountMin: 3, roomCountMax: 4, roomShape: 'natural', corridorWidth: 1, roomMin: 4, roomMax: 6, torchDensity: 3, obstacleCount: 5 },
    connections: [{ dir: 'w', toMap: 'plains' }, { dir: 'e', toMap: 'mistyForest' }],
    spawns: [{ pool: ['menninkainenFighter', 'menninkainenArcher', 'peikkoFighter'], levelMin: 15, levelMax: 19, maxAmount: 5, spawnInterval: 7, spawnAmount: 1 }],
  },
  mistyForest: {
    id: 'mistyForest', name: 'Mistwood', biome: 'mistyForest', recommended: [20, 24],
    gen: { width: W, height: H, roomCountMin: 3, roomCountMax: 4, roomShape: 'natural', corridorWidth: 1, roomMin: 4, roomMax: 6, torchDensity: 3, obstacleCount: 5 },
    connections: [{ dir: 'w', toMap: 'forest' }, { dir: 'e', toMap: 'deepDungeon' }],
    spawns: [{ pool: ['haltiaArcher', 'haltiaMage', 'metsanpeittoFighter'], levelMin: 20, levelMax: 24, maxAmount: 5, spawnInterval: 7, spawnAmount: 1 }],
  },
  deepDungeon: {
    id: 'deepDungeon', name: 'Whisperstone Caverns', biome: 'deepDungeon', recommended: [25, 29],
    gen: { width: W, height: H, roomCountMin: 3, roomCountMax: 4, roomShape: 'rectangular', corridorWidth: 1, roomMin: 4, roomMax: 6, torchDensity: 8, obstacleCount: 4 },
    connections: [{ dir: 'w', toMap: 'mistyForest' }],
    spawns: [{ pool: ['peikkoFighter2', 'haamuMage', 'metsanpeittoLeader'], levelMin: 25, levelMax: 29, maxAmount: 5, spawnInterval: 6, spawnAmount: 1 }],
  },
};
export const START_MAP = 'mistyForest';

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
  wall(10, 3); wall(10, 4); wall(11, 3);
  wall(22, 12); wall(23, 12); wall(23, 13);
  return { width, height, tiles };
}
