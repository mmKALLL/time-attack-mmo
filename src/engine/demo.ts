import type { TileMap, WorldState } from '../types';
import { makeEntity } from './entities';
import { PARTY_SPAWN } from '../data';
import { START_MAP } from '../data-map';
import { DEFAULT_SEED } from '../config';
import { travelTo } from './maps';

const EMPTY_MAP: TileMap = { width: 1, height: 1, tiles: ['floor'] };

export function createDemoWorld(): WorldState {
  const heroes = PARTY_SPAWN.map((p) =>
    makeEntity({
      id: p.id,
      faction: p.faction,
      name: p.name,
      sprite: p.sprite,
      cell: { ...p.cell },
      level: p.level,
      jobId: p.jobId,
    }),
  );

  const s: WorldState = {
    mapId: START_MAP,
    map: EMPTY_MAP,
    features: [],
    exits: [],
    entities: Object.fromEntries(heroes.map((e) => [e.id, e])),
    groups: {},
    playerId: 'p1',
    seq: heroes.length,
    rng: DEFAULT_SEED,
    spawnClockMs: 0,
    tickCount: 0,
  };
  // Generate the start map, place the party, and spawn its enemies.
  travelTo(s, START_MAP);
  return s;
}
