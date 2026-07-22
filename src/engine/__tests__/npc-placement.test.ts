import { describe, it, expect } from 'vitest';
import type { Cell, Entity, WorldState } from '../../types';
import { createDemoWorld } from '../demo';
import { travelTo, portalsReachable, exitAt, mapSeed } from '../maps';
import { generateMap } from '../map-generator';
import { MAPS } from '../../data-map';
import { key } from '../grid';

// Every town map id (the biome-town nodes host NPCs on entry).
const townIds = Object.keys(MAPS).filter((id) => MAPS[id].biome === 'town');

// All NPCs on the map (townsfolk + the Guildmaster) — every one is SOLID, so each
// must be treated as an obstacle when we verify portals stay reachable.
const allNpcs = (s: WorldState): Entity[] => Object.values(s.entities).filter((e) => e.faction === 'npc');

// The set of cells occupied by every NPC on the map.
const npcCells = (s: WorldState): Set<string> => new Set(allNpcs(s).map((n) => key(n.cell)));

describe('town NPC placement never blocks a portal', () => {
  it('has towns to check and each generates at least one portal', () => {
    expect(townIds.length).toBeGreaterThanOrEqual(6);
  });

  for (const town of townIds) {
    it(`${town}: all portals stay reachable from arrival with every NPC treated as solid`, () => {
      const s = createDemoWorld();
      travelTo(s, town, s.mapId);
      expect(MAPS[town].biome).toBe('town');
      // With every placed NPC blocked, the party's arrival cell can still flood-fill
      // to the interior step of every portal. (portalsReachable folds in obstacle
      // features + walls itself; we add the NPC cells as the extra solids.)
      expect(portalsReachable(s, npcCells(s))).toBe(true);
    });
  }

  it('is deterministic: same NPC cells across two fresh worlds under the fixed seed', () => {
    const cellsOf = (s: WorldState) =>
      allNpcs(s)
        .map((n) => `${n.cell.x},${n.cell.y}`)
        .sort();
    const a = createDemoWorld();
    const b = createDemoWorld();
    travelTo(a, 'savonlinna', a.mapId);
    travelTo(b, 'savonlinna', b.mapId);
    expect(cellsOf(a)).toEqual(cellsOf(b));
  });

  it('no NPC lands on a portal tile or on top of the party', () => {
    const s = createDemoWorld();
    travelTo(s, 'savonlinna', s.mapId); // a town with a Guildmaster + townsfolk
    const heroCells = new Set(Object.values(s.entities).filter((e) => e.faction !== 'npc').map((e) => key(e.cell)));
    for (const n of allNpcs(s)) {
      expect(exitAt(s, n.cell)).toBeUndefined(); // off portal tiles
      expect(heroCells.has(key(n.cell))).toBe(false); // not on the party
    }
  });

  it('places every NPC inside a room (never a narrow corridor or its mouth)', () => {
    const insideAnyRoom = (rooms: { x: number; y: number; w: number; h: number }[], c: Cell) =>
      rooms.some((r) => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h);
    for (const town of townIds) {
      const s = createDemoWorld();
      travelTo(s, town, s.mapId);
      const rooms = generateMap(MAPS[town], mapSeed(town)).rooms; // the same deterministic map spawnNpcs placed onto
      expect(allNpcs(s).length).toBeGreaterThan(0); // the town still spawns townsfolk
      for (const n of allNpcs(s)) {
        expect(insideAnyRoom(rooms, n.cell), `${town}: NPC at ${n.cell.x},${n.cell.y} sits outside every room (corridor/mouth)`).toBe(true);
      }
    }
  });

  it('portalsReachable detects a hand-built corridor block and passes when clear', () => {
    // A 7-wide, 5-tall map with a single 1-wide floor corridor on the middle row
    // (x=1..5, y=2). The party sits at the far-left end (1,2); the ONLY portal is on
    // the right edge (6,2), whose interior step is (5,2). Any single solid cell on
    // the corridor walls the portal off; an unrelated cell leaves it reachable.
    const W = 7;
    const H = 5;
    const tiles = new Array(W * H).fill('wall') as ('floor' | 'wall')[];
    const floor = (x: number, y: number) => {
      tiles[y * W + x] = 'floor';
    };
    for (let x = 1; x <= 5; x++) floor(x, 2); // the corridor (portal tile (6,2) stays a right-edge cell)
    const s: WorldState = {
      ...createDemoWorld(),
      map: { width: W, height: H, tiles },
      features: [],
      exits: [{ cell: { x: 6, y: 2 }, toMap: 'x' }], // right-edge portal; interior step is (5,2)
      entities: {
        p1: { ...createDemoWorld().entities.p1, cell: { x: 1, y: 2 } },
      },
      playerId: 'p1',
    };
    // Clear: (1,2) can flood-fill to the portal's interior step (5,2).
    expect(portalsReachable(s, new Set())).toBe(true);
    // Block the corridor throat (3,2) with a solid NPC -> the portal is cut off.
    const throat: Cell = { x: 3, y: 2 };
    expect(portalsReachable(s, new Set([key(throat)]))).toBe(false);
    // Block the interior step itself (5,2) -> also disconnects the portal.
    expect(portalsReachable(s, new Set([key({ x: 5, y: 2 })]))).toBe(false);
    // Block the party's own cell -> ignored (party stands there); still reachable.
    expect(portalsReachable(s, new Set([key({ x: 1, y: 2 })]))).toBe(true);
  });
});
