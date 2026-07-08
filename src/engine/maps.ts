import type { Cell, Direction, MapExit, MapId, WorldState } from '../types';
import { MAPS } from '../data-map';
import { ENEMIES, enemyPrimaries } from '../data-enemy';
import { ENEMY_CLASS_COMBAT, enemyStatMult } from '../config';
import { makeEntity } from './entities';
import { DIRECTIONS, isWall, equals, key } from './grid';
import { randInt, pick } from './rng';
import { generateMap } from './map-generator';
import { DEFAULT_SEED } from '../config';

// Stable geometry seed per map id (derived from the fixed base seed) so a map
// keeps the same layout across visits; only its enemies re-roll.
function mapSeed(mapId: MapId): number {
  let h = (DEFAULT_SEED ^ 0x9e3779b9) | 0;
  for (let i = 0; i < mapId.length; i++) h = (Math.imul(h, 31) + mapId.charCodeAt(i)) | 0;
  return h;
}

export function exitAt(s: WorldState, cell: Cell): MapExit | undefined {
  return s.exits.find((x) => equals(x.cell, cell));
}

// One step from a portal toward the map interior (where you arrive after travel).
function inward(cell: Cell, w: number, h: number): Cell {
  const dx = cell.x <= 1 ? 1 : cell.x >= w - 2 ? -1 : 0;
  const dy = cell.y <= 1 ? 1 : cell.y >= h - 2 ? -1 : 0;
  return { x: cell.x + dx, y: cell.y + dy };
}

// Nearest non-wall cell (spiral out) — a safety net so a spawn point is never
// inside an obstacle/wall.
function nearestFloor(s: WorldState, c: Cell): Cell {
  if (!isWall(s.map, c)) return c;
  const rmax = Math.max(s.map.width, s.map.height);
  for (let r = 1; r < rmax; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // ring perimeter only
        const n = { x: c.x + dx, y: c.y + dy };
        if (!isWall(s.map, n)) return n;
      }
  return c;
}

function randomFreeCell(s: WorldState, occupied: Set<string>, avoid: Cell): Cell | undefined {
  const { width, height } = s.map;
  for (let tries = 0; tries < 80; tries++) {
    const cell = { x: randInt(s, 1, width - 2), y: randInt(s, 1, height - 2) };
    if (isWall(s.map, cell) || occupied.has(key(cell))) continue;
    if (exitAt(s, cell)) continue; // keep spawns off portal tiles
    if (Math.abs(cell.x - avoid.x) + Math.abs(cell.y - avoid.y) < 4) continue; // buffer from the party
    return cell;
  }
  return undefined;
}

// Spawn up to `amount` enemies for the current map, never exceeding maxAmount.
export function spawnEnemies(s: WorldState, amount: number): void {
  const rule = MAPS[s.mapId]?.spawns[0];
  if (!rule) return;
  const current = Object.values(s.entities).filter((e) => e.faction === 'enemy').length;
  const room = Math.max(0, Math.min(amount, rule.maxAmount - current));
  const occupied = new Set(Object.values(s.entities).map((e) => key(e.cell)));
  const player = s.entities[s.playerId];
  const avoid = player ? player.cell : { x: Math.floor(s.map.width / 2), y: Math.floor(s.map.height / 2) };
  for (let n = 0; n < room; n++) {
    const cell = randomFreeCell(s, occupied, avoid);
    if (!cell) break;
    occupied.add(key(cell));
    const def = ENEMIES[pick(s, rule.pool)];
    const id = 'e' + s.seq++;
    s.entities[id] = makeEntity({
      id,
      faction: 'enemy',
      name: def.name,
      asset: def.asset,
      cell,
      level: def.level,
      jobId: def.id,
      primaries: enemyPrimaries(def),
      combatClass: ENEMY_CLASS_COMBAT[def.cls],
      statMult: enemyStatMult(def.level),
      growth: def.growth,
      skills: def.skills,
      elite: def.elite,
    });
  }
}

// Enter `toMap`: generate its geometry, keep the party (carrying their state),
// place them at the portal back to `fromMap` (or the map's entry), fill enemies.
export function travelTo(s: WorldState, toMap: MapId, fromMap?: MapId, arrivalDir?: Direction): void {
  const def = MAPS[toMap];
  if (!def) return;
  if (!s.discovered.includes(toMap)) s.discovered.push(toMap); // "discovered zones" for the world map
  const gen = generateMap(def, mapSeed(toMap));
  s.mapId = toMap;
  s.map = gen.tiles;
  s.features = gen.features;
  s.exits = gen.exits;
  s.groups = {};
  s.spawnClockMs = 0;

  let arrival = gen.entry;
  if (fromMap) {
    const back = gen.exits.find((e) => e.toMap === fromMap);
    if (back) {
      // Step one tile off the portal, preferably continuing the way we walked in.
      const forward = arrivalDir ? { x: back.cell.x + DIRECTIONS[arrivalDir].dx, y: back.cell.y + DIRECTIONS[arrivalDir].dy } : undefined;
      const inw = inward(back.cell, s.map.width, s.map.height);
      arrival = forward && !isWall(s.map, forward) ? forward : !isWall(s.map, inw) ? inw : back.cell;
    }
  }
  arrival = nearestFloor(s, arrival); // never land inside an obstacle/wall

  const heroes = Object.values(s.entities).filter((e) => e.faction !== 'enemy');
  const occupied = new Set<string>();
  const player = heroes.find((h) => h.id === s.playerId);
  const ordered = player ? [player, ...heroes.filter((h) => h.id !== s.playerId)] : heroes;
  const deltas: Cell[] = [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
  ];
  ordered.forEach((h, i) => {
    const d = deltas[Math.min(i, deltas.length - 1)];
    let cell = { x: arrival.x + d.x, y: arrival.y + d.y };
    if (isWall(s.map, cell) || occupied.has(key(cell))) cell = { ...arrival };
    h.cell = cell;
    occupied.add(key(cell));
  });
  s.entities = Object.fromEntries(heroes.map((e) => [e.id, e]));

  spawnEnemies(s, def.spawns[0]?.maxAmount ?? 0);
}

// Respawn wave: every spawnInterval seconds, top up by spawnAmount (up to the cap).
export function advanceRespawns(s: WorldState, dt: number): void {
  const rule = MAPS[s.mapId]?.spawns[0];
  if (!rule) return;
  const intervalMs = rule.spawnInterval * 1000;
  s.spawnClockMs += dt;
  while (s.spawnClockMs >= intervalMs) {
    s.spawnClockMs -= intervalMs;
    spawnEnemies(s, rule.spawnAmount);
  }
}
