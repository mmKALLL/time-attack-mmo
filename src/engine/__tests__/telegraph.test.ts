import { describe, it, expect } from 'vitest';
import { advanceCombat, advanceTelegraphs, castInterval, stick } from '../combat';
import { tick } from '../world';
import { makeEntity } from '../entities';
import { getSkill } from '../../data-skills';
import { demoMap } from '../../data-map';
import { shapeFor } from '../shapes';
import type { Cell, CombatClass, Entity, Skill, WorldState } from '../../types';

// A 12x12 test arena (demoMap border walls). Seed defaults to a fixed value so
// every telegraph resolution roll is deterministic.
function world(entities: Entity[], rng = 1337): WorldState {
  return {
    mapId: 'test',
    map: demoMap(12, 12),
    features: [],
    exits: [],
    discovered: ['test'],
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    groups: {},
    playerId: 'p1',
    seq: 0,
    rng,
    spawnClockMs: 0,
    tickCount: 0,
    hits: [],
    xpGains: [],
    telegraphs: [],
  };
}

const hero = (id: string, cell: Cell) => makeEntity({ id, faction: 'player', name: 'Hero', sprite: 'ranger', cell, level: 20, jobId: 'beginner' });
// An enemy wielding one specific skill (bypassing the beginner kit). High dex →
// reliable hits so a resolving telegraph lands; high vit so it survives return fire.
const foe = (id: string, cell: Cell, skillId: string, combatClass: CombatClass) =>
  makeEntity({ id, faction: 'enemy', name: 'Foe', sprite: 'slime', cell, level: 20, jobId: 'beginner', combatClass, primaries: { str: 20, dex: 80, int: 20, vit: 200 }, skills: [getSkill(skillId)] });

// The absolute cells an AoE skill would mark when centered on `target`, mirroring
// the engine's anchoring (bounding-box centre of the facing-rotated shape on the cell).
function expectedTiles(skill: Skill, level: number, caster: Cell, target: Cell): Cell[] {
  const dx = target.x - caster.x;
  const dy = target.y - caster.y;
  const facing = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
  const offsets = shapeFor(skill, level, facing);
  const xs = offsets.map((o) => o.dx);
  const ys = offsets.map((o) => o.dy);
  const cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
  const cy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
  return offsets.map((o) => ({ x: target.x + o.dx - cx, y: target.y + o.dy - cy }));
}
const hasCell = (tiles: Cell[], c: Cell) => tiles.some((t) => t.x === c.x && t.y === c.y);

// One full cast window that triggers exactly one cast for every class tested here
// (mage interval 1875, leader/fighter/archer 1500 — all fire once inside 2000ms).
const CAST_MS = 2000;

describe('telegraphed AoE (slice 2)', () => {
  it('an AoE enemy skill plants a telegraph centered on the target — no instant damage', () => {
    const h = hero('p1', { x: 5, y: 5 });
    const e = foe('e1', { x: 7, y: 5 }, 'enemyHex', 'magician'); // mage AoE, range 4 → in range at dist 2
    const s = world([h, e]);
    stick(s, 'p1', 'e1');
    const hpBefore = s.entities.p1.hp;

    advanceCombat(s, CAST_MS); // one mage cast → should plant a telegraph, not hit
    expect(s.telegraphs).toHaveLength(1);
    expect(s.entities.p1.hp).toBe(hpBefore); // telegraphed, so no damage yet

    // Footprint is snapped to absolute cells centered on the target's cell.
    const tg = s.telegraphs[0];
    const want = expectedTiles(getSkill('enemyHex'), s.entities.e1.skills[0].level, { x: 7, y: 5 }, { x: 5, y: 5 });
    expect([...tg.tiles].sort((a, b) => a.x - b.x || a.y - b.y)).toEqual(want.sort((a, b) => a.x - b.x || a.y - b.y));
    expect(hasCell(tg.tiles, { x: 5, y: 5 })).toBe(true); // marks the ground under the target
    expect(tg.remainingMs).toBe(getSkill('enemyHex').telegraphMs); // per-skill wind-up
  });

  it('the marked tiles stay LOCKED after the caster moves', () => {
    const s = world([hero('p1', { x: 5, y: 5 }), foe('e1', { x: 7, y: 5 }, 'enemyHex', 'magician')]);
    stick(s, 'p1', 'e1');
    advanceCombat(s, CAST_MS);
    const before = s.telegraphs[0].tiles.map((c) => `${c.x},${c.y}`).sort();
    s.entities.e1.cell = { x: 1, y: 1 }; // caster teleports away mid-delay
    advanceCombat(s, CAST_MS); // another clock advance
    const after = s.telegraphs[0].tiles.map((c) => `${c.x},${c.y}`).sort();
    expect(after).toEqual(before); // footprint never moves with the caster
  });

  it('resolves after its telegraph time: hits a hero still on a tile, misses one who stepped off', () => {
    const stayer = hero('p1', { x: 5, y: 5 });
    const e = foe('e1', { x: 7, y: 5 }, 'enemyHex', 'magician');
    const s = world([stayer, e]);
    stick(s, 'p1', 'e1');
    advanceCombat(s, CAST_MS); // plant the telegraph on p1's cell
    const tg = s.telegraphs[0];
    expect(hasCell(tg.tiles, { x: 5, y: 5 })).toBe(true);

    const hpBefore = s.entities.p1.hp;
    advanceTelegraphs(s, tg.remainingMs); // count down to resolution (skill's telegraph time)
    expect(s.telegraphs).toHaveLength(0); // consumed
    expect(s.entities.p1.hp).toBeLessThan(hpBefore); // still standing on a marked tile → hit

    // Now a hero who DODGES: plant again, then step off before it resolves.
    const s2 = world([hero('p1', { x: 5, y: 5 }), foe('e1', { x: 7, y: 5 }, 'enemyHex', 'magician')]);
    stick(s2, 'p1', 'e1');
    advanceCombat(s2, CAST_MS);
    const marked = s2.telegraphs[0].tiles;
    // Move the hero to a cell NOT in the footprint.
    let safe: Cell | undefined;
    for (const c of [{ x: 10, y: 10 }, { x: 9, y: 9 }, { x: 2, y: 2 }]) if (!hasCell(marked, c)) { safe = c; break; }
    s2.entities.p1.cell = safe!;
    const hp2 = s2.entities.p1.hp;
    advanceTelegraphs(s2, s2.telegraphs[0].remainingMs);
    expect(s2.entities.p1.hp).toBe(hp2); // stepped off → dodged, no damage
  });

  it('hits MULTIPLE heroes standing on the marked tiles', () => {
    // enemyRuin (leader) paints a 6-tile area; place two heroes inside it.
    const a = hero('p1', { x: 5, y: 5 });
    const b = hero('p2', { x: 5, y: 6 });
    const e = foe('e1', { x: 7, y: 5 }, 'enemyRuin', 'leader');
    const s = world([a, b, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'p2', 'e1'] } };
    advanceCombat(s, CAST_MS); // leader plants the AoE (aimed at nearest hero p1)
    expect(s.telegraphs).toHaveLength(1);
    const tiles = s.telegraphs[0].tiles;
    // Snap both heroes onto marked tiles so they must both be hit.
    s.entities.p1.cell = { ...tiles[0] };
    s.entities.p2.cell = { ...tiles[1] };
    const hp1 = s.entities.p1.hp;
    const hp2 = s.entities.p2.hp;
    advanceTelegraphs(s, s.telegraphs[0].remainingMs);
    expect(s.entities.p1.hp).toBeLessThan(hp1);
    expect(s.entities.p2.hp).toBeLessThan(hp2);
  });

  it('single-target enemy skills (fighter/archer) still deal instant damage, no telegraph', () => {
    // Fighter (melee, range 2): instant hit at dist 1.
    const sf = world([hero('p1', { x: 5, y: 5 }), foe('e1', { x: 6, y: 5 }, 'enemyStrike', 'fighter')]);
    stick(sf, 'p1', 'e1');
    const fhp = sf.entities.p1.hp;
    advanceCombat(sf, CAST_MS);
    expect(sf.telegraphs).toHaveLength(0);
    expect(sf.entities.p1.hp).toBeLessThan(fhp);

    // Archer (now single-target 'point', range 4): instant hit at dist 3, no telegraph.
    const sa = world([hero('p1', { x: 5, y: 5 }), foe('e1', { x: 8, y: 5 }, 'enemyShot', 'archer')]);
    stick(sa, 'p1', 'e1');
    const ahp = sa.entities.p1.hp;
    advanceCombat(sa, CAST_MS);
    expect(sa.telegraphs).toHaveLength(0);
    expect(sa.entities.p1.hp).toBeLessThan(ahp);
  });

  it('resolution is deterministic for a fixed seed', () => {
    const run = () => {
      const s = world([hero('p1', { x: 5, y: 5 }), foe('e1', { x: 7, y: 5 }, 'enemyHex', 'magician')], 4242);
      stick(s, 'p1', 'e1');
      advanceCombat(s, CAST_MS);
      advanceTelegraphs(s, s.telegraphs[0].remainingMs);
      return s.entities.p1.hp;
    };
    expect(run()).toBe(run()); // same seed → identical damage
  });

  it('a hero who moves via tick() the same round dodges (move applied before resolution)', () => {
    // Plant a telegraph, then run tick() with the remaining lead time while the
    // hero walks off the marked tiles — the move (applyInput) precedes resolution.
    const s = world([hero('p1', { x: 5, y: 5 }), foe('e1', { x: 7, y: 5 }, 'enemyHex', 'magician')]);
    stick(s, 'p1', 'e1');
    advanceCombat(s, CAST_MS); // plant on p1's cell (5,5)
    const marked = s.telegraphs[0].tiles;
    expect(hasCell(marked, { x: 5, y: 5 })).toBe(true);
    s.telegraphs[0].remainingMs = 50; // about to resolve next tick
    // Pick a step direction that actually leaves the (locked) footprint.
    const dir = !hasCell(marked, { x: 5, y: 6 }) ? 'down' : 'right';

    const hpBefore = s.entities.p1.hp;
    const s2 = tick(s, [{ type: 'move', dir }], 50); // move first, then the telegraph resolves
    expect(hasCell(marked, s2.entities.p1.cell)).toBe(false); // stepped off every marked cell
    expect(s2.entities.p1.hp).toBe(hpBefore); // dodged: move applied before the AoE resolved
  });

  it('falls back to a basic Strike when the primary skill is on cooldown', () => {
    const s = world([hero('p1', { x: 5, y: 5 }), foe('e1', { x: 6, y: 5 }, 'enemyRuin', 'leader')]); // AoE primary, melee-range at dist 1
    stick(s, 'p1', 'e1');
    s.entities.e1.skills[0].cooldownLeftMs = 30000; // primary (Ruin) on cooldown
    const hp = s.entities.p1.hp;
    advanceCombat(s, CAST_MS); // primary unavailable → single-target Strike, not an AoE
    expect(s.telegraphs).toHaveLength(0); // fallback plants no telegraph
    expect(s.entities.p1.hp).toBeLessThan(hp); // dealt instant single-target damage
  });
});

// A magician hero wielding arcaneArc (arc, telegraphMs 5000, dmg) facing 'right'.
// combatClass forced to magician so castInterval matches a real caster.
const mage = (id: string, cell: Cell, facing: Entity['facing'] = 'right') => {
  const e = makeEntity({ id, faction: 'player', name: 'Mage', sprite: 'mage', cell, level: 20, jobId: 'beginner', combatClass: 'magician', primaries: { str: 20, dex: 80, int: 80, vit: 60 }, skills: [getSkill('arcaneArc')] });
  e.facing = facing;
  return e;
};

// The absolute cells arcaneArc marks from the caster (its footprint IS the AoE —
// projected in the caster's facing, no target centering).
const playerFootprint = (skill: Skill, level: number, caster: Cell, facing: Entity['facing']): Cell[] => shapeFor(skill, level, facing).map((o) => ({ x: caster.x + o.dx, y: caster.y + o.dy }));

describe('player-side AoE telegraph', () => {
  const arcaneArc = getSkill('arcaneArc');

  it('casting arcaneArc plants a player telegraph over its footprint — no instant damage', () => {
    const m = mage('p1', { x: 5, y: 5 });
    const target = foe('e1', { x: 7, y: 5 }, 'enemyStrike', 'fighter');
    const s = world([m, target]);
    stick(s, 'p1', 'e1');
    const hpBefore = s.entities.e1.hp;

    advanceCombat(s, castInterval(m)); // exactly one cast
    expect(s.telegraphs).toHaveLength(1);
    const tg = s.telegraphs[0];
    expect(tg.hitsEnemies).toBe(true);
    expect(tg.remainingMs).toBe(arcaneArc.telegraphMs);
    expect(s.entities.e1.hp).toBe(hpBefore); // telegraphed → no damage this tick

    // Tiles equal the skill's footprint projected from the caster (facing 'right').
    const want = playerFootprint(arcaneArc, s.entities.p1.skills[0].level, { x: 5, y: 5 }, 'right');
    expect([...tg.tiles].sort((a, b) => a.x - b.x || a.y - b.y)).toEqual(want.sort((a, b) => a.x - b.x || a.y - b.y));
    // arcaneArc has offset 2, so the arc is projected 3 cells ahead: nearest tile at x=8, with the two tiles in front (x=6,7) left empty.
    expect(hasCell(tg.tiles, { x: 8, y: 5 })).toBe(true);
    expect(hasCell(tg.tiles, { x: 6, y: 5 })).toBe(false);
    expect(hasCell(tg.tiles, { x: 7, y: 5 })).toBe(false);
  });

  it('resolves after the delay: an enemy on a marked tile is hit; one who stepped off dodges', () => {
    const m = mage('p1', { x: 5, y: 5 });
    const s = world([m, foe('e1', { x: 6, y: 5 }, 'enemyStrike', 'fighter')]);
    stick(s, 'p1', 'e1');
    advanceCombat(s, castInterval(m)); // plant on the footprint (arc ahead)
    const tg = s.telegraphs[0];
    s.entities.e1.cell = { ...tg.tiles[0] }; // stand the enemy on a marked tile
    const hpBefore = s.entities.e1.hp;
    advanceTelegraphs(s, tg.remainingMs);
    expect(s.telegraphs).toHaveLength(0);
    expect(s.entities.e1.hp).toBeLessThan(hpBefore); // stood on a marked tile → hit

    // Dodge: re-plant, then move the enemy OFF every marked tile before it resolves.
    const m2 = mage('p1', { x: 5, y: 5 });
    const s2 = world([m2, foe('e1', { x: 6, y: 5 }, 'enemyStrike', 'fighter')]);
    stick(s2, 'p1', 'e1');
    advanceCombat(s2, castInterval(m2));
    const marked = s2.telegraphs[0].tiles;
    let safe: Cell | undefined;
    for (const c of [{ x: 10, y: 10 }, { x: 9, y: 9 }, { x: 2, y: 2 }]) if (!hasCell(marked, c)) { safe = c; break; }
    s2.entities.e1.cell = safe!;
    const hp2 = s2.entities.e1.hp;
    advanceTelegraphs(s2, s2.telegraphs[0].remainingMs);
    expect(s2.entities.e1.hp).toBe(hp2); // stepped off → no damage
  });

  it('a player telegraph does NOT damage heroes standing on its tiles', () => {
    const m = mage('p1', { x: 5, y: 5 });
    const ally = hero('p2', { x: 6, y: 5 }); // hero standing right where the arc lands
    const s = world([m, ally, foe('e1', { x: 8, y: 5 }, 'enemyStrike', 'fighter')]);
    stick(s, 'p1', 'e1');
    advanceCombat(s, castInterval(m));
    const marked = s.telegraphs[0].tiles;
    // Put both heroes onto marked tiles.
    s.entities.p1.cell = { ...marked[0] };
    s.entities.p2.cell = { ...marked[Math.min(1, marked.length - 1)] };
    const hp1 = s.entities.p1.hp;
    const hp2 = s.entities.p2.hp;
    advanceTelegraphs(s, s.telegraphs[0].remainingMs);
    expect(s.entities.p1.hp).toBe(hp1); // player telegraph spares heroes
    expect(s.entities.p2.hp).toBe(hp2);
  });

  it('regression: an enemy AoE still plants hitsEnemies:false and damages a hero, not the enemy', () => {
    const h = hero('p1', { x: 5, y: 5 });
    const e = foe('e1', { x: 7, y: 5 }, 'enemyHex', 'magician'); // mage AoE
    const s = world([h, e]);
    stick(s, 'p1', 'e1');
    advanceCombat(s, CAST_MS);
    expect(s.telegraphs).toHaveLength(1);
    const tg = s.telegraphs[0];
    expect(tg.hitsEnemies).toBe(false);
    // Snap the enemy onto a marked tile too; only the hero should take damage.
    s.entities.e1.cell = { ...tg.tiles[0] };
    s.entities.p1.cell = { ...tg.tiles[0] };
    const heroHp = s.entities.p1.hp;
    const enemyHp = s.entities.e1.hp;
    advanceTelegraphs(s, tg.remainingMs);
    expect(s.entities.p1.hp).toBeLessThan(heroHp); // enemy telegraph hits the hero
    expect(s.entities.e1.hp).toBe(enemyHp); // and spares the enemy
  });
});
