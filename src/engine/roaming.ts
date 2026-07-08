import type { Cell, Direction, Entity, WorldState } from '../types';
import { DIRECTIONS, isWall, equals } from './grid';
import { groupOf, stick } from './combat';
import { exitAt } from './maps';
import { isAlive } from './entities';
import { randInt, pick, chance } from './rng';
import { ENEMY_ROAM } from '../config';

const ALL_DIRS: Direction[] = ['up', 'down', 'left', 'right'];

type RoamState = NonNullable<Entity['roam']>;

// A fresh "wait" phase: idle for a random delay, then a move sequence begins.
function startWait(s: WorldState): RoamState {
  return { phase: 'wait', timerMs: randInt(s, ENEMY_ROAM.minDelayMs, ENEMY_ROAM.maxDelayMs), dir: 'down', tilesLeft: 0 };
}

// Pick a sequence direction: uniform random, but with a small `homeBias` chance
// to instead steer back toward the enemy's spawn cell — a soft leash so it drifts
// home rather than wandering off forever. The bias roll is only spent when the
// enemy is actually away from home (otherwise there's no homeward direction).
function pickRoamDir(s: WorldState, e: Entity): Direction {
  const home = e.home;
  const homeward: Direction[] = [];
  if (home) {
    if (home.x < e.cell.x) homeward.push('left');
    else if (home.x > e.cell.x) homeward.push('right');
    if (home.y < e.cell.y) homeward.push('up');
    else if (home.y > e.cell.y) homeward.push('down');
  }
  if (homeward.length && chance(s, ENEMY_ROAM.homeBias)) return pick(s, homeward);
  return pick(s, ALL_DIRS);
}

// Begin a move sequence: a direction (homeward-biased) + a random length in tiles.
// The first tile fires after tileDelayMs (timer set below).
function startMove(s: WorldState, e: Entity, roam: RoamState): void {
  roam.phase = 'move';
  roam.dir = pickRoamDir(s, e);
  roam.tilesLeft = randInt(s, ENEMY_ROAM.minTiles, ENEMY_ROAM.maxTiles);
  roam.timerMs = ENEMY_ROAM.tileDelayMs;
}

// True if any entity (hero or enemy) other than `self` currently sits on `c`.
function occupiedBy(s: WorldState, c: Cell, selfId: string): Entity | undefined {
  return Object.values(s.entities).find((e) => e.id !== selfId && isAlive(e) && equals(e.cell, c));
}

// Outcome of a single roam step:
//   'continue' — moved and more tiles remain
//   'rest'     — sequence ended (last tile taken, or blocked) -> back to wait
//   'grouped'  — bumped a hero into combat; the enemy is now grouped, stop roaming
type StepResult = 'continue' | 'rest' | 'grouped';

// Attempt one roam step for `e`.
function stepOnce(s: WorldState, e: Entity, roam: RoamState): StepResult {
  const off = DIRECTIONS[roam.dir];
  const target: Cell = { x: e.cell.x + off.dx, y: e.cell.y + off.dy };

  // Walls and portal/exit cells are hard blocks — enemies never wander onto a
  // portal (which would trigger travel) or through geometry.
  if (isWall(s.map, target) || exitAt(s, target)) return 'rest';

  const occupant = occupiedBy(s, target, e.id);
  if (occupant) {
    // Bumping a hero starts combat, anchored on the player, exactly like the
    // player's own moveOrStick does when it walks into an enemy. The enemy is
    // then in a group and stops roaming. We never step onto the hero's cell.
    if (occupant.faction !== 'enemy') {
      e.facing = roam.dir;
      stick(s, s.playerId, e.id);
      return 'grouped';
    }
    // Another enemy blocks the path — end the sequence (never stack enemies).
    return 'rest';
  }

  e.facing = roam.dir;
  e.cell = target;
  roam.tilesLeft -= 1;
  return roam.tilesLeft > 0 ? 'continue' : 'rest';
}

// Advance idle-enemy roaming by `dt` ms. Ungrouped, alive enemies alternate
// wait -> move phases on the sim clock. Uses the world's seeded RNG so replays
// stay deterministic. Called from tick() AFTER applyInput so the enemy sees the
// player's already-updated position (never co-occupies a cell the player moved
// into on the same frame — it avoids it or bumps into combat).
export function advanceRoaming(s: WorldState, dt: number): void {
  for (const e of Object.values(s.entities)) {
    if (e.faction !== 'enemy' || !isAlive(e)) continue;
    if (groupOf(s, e.id)) {
      e.roam = undefined; // combat took over; drop stale roam state
      continue;
    }
    const roam: RoamState = e.roam ?? startWait(s);
    e.roam = roam;

    roam.timerMs -= dt;
    // Guard against a single huge dt collapsing many phases in one call.
    let guard = 0;
    while (roam.timerMs <= 0 && guard++ < 32) {
      if (roam.phase === 'wait') {
        startMove(s, e, roam);
        continue;
      }
      // 'move' phase: a tile's timer elapsed, so take one step.
      const result = stepOnce(s, e, roam);
      if (result === 'continue') {
        roam.timerMs += ENEMY_ROAM.tileDelayMs;
      } else if (result === 'rest') {
        e.roam = startWait(s); // sequence ended -> rest, then a fresh sequence
        break;
      } else {
        e.roam = undefined; // grouped: combat takes over, no roam state
        break;
      }
    }
  }
}
