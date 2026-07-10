import { describe, it, expect } from 'vitest';
import { applyStatus } from '../status';
import { makeEntity } from '../entities';
import { demoMap } from '../../data-map';
import { CLASS_STATUS_RESIST, STATUS, effectiveStats, statusResistPercent } from '../../config-stats';
import type { CombatClass, Entity, Skill, StatusApplication, StatusKind, WorldState } from '../../types';

// ---------------------------------------------------------------------------
// Status-resist mechanic. Harmful statuses still land, but the target's resist %
// scales their effect param down (stun scales its DURATION instead). Assertions
// read CLASS_STATUS_RESIST rather than hard-coding 25/75, so they survive tuning.
// ---------------------------------------------------------------------------
function world(entities: Entity[]): WorldState {
  return {
    mapId: 'test',
    map: demoMap(20, 20),
    features: [],
    exits: [],
    discovered: ['test'],
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    groups: {},
    playerId: 'p1',
    seq: 0,
    rng: 1,
    spawnClockMs: 0,
    tickCount: 0,
    hits: [],
    xpGains: [],
    telegraphs: [],
  };
}

const hero = (id = 'p1') => makeEntity({ id, faction: 'player', name: 'Hero', sprite: 'ranger', cell: { x: 1, y: 1 }, level: 20, jobId: 'beginner' });
// An enemy of a chosen combat class (drives its resist %). statMult:1 so no penalty.
const enemy = (id: string, combatClass: CombatClass) =>
  makeEntity({ id, faction: 'enemy', name: id, sprite: 'slime', cell: { x: 5, y: 5 }, level: 20, jobId: 'beginner', combatClass, primaries: { str: 20, dex: 20, int: 20, vit: 200 } });

const caster = () => hero('caster');

function mkSkill(id: string, params: Record<string, (lv: number) => number> = {}): Skill {
  return { id, name: id, description: id, kind: 'attack', target: 'melee', element: 'physical', shapeKind: 'point', params: params as Skill['params'], cooldownMs: 0 };
}

function apply(s: WorldState, target: Entity, name: StatusKind, pct: number, extra: Partial<StatusApplication> = {}, from = caster()): void {
  const app: StatusApplication = { name, ...extra };
  const paramName = app.param ?? 'pct';
  applyStatus(s, target, app, from, mkSkill(`sk-${name}`, { [paramName]: () => pct }), 1);
}

const potencyOf = (e: Entity, kind: StatusKind) => e.statuses.find((st) => st.kind === kind)!.potency;

describe('statusResistPercent: source of the resist %', () => {
  it('returns the per-class table value for enemy fighter / rogue / leader / archer', () => {
    expect(statusResistPercent(enemy('f', 'fighter'))).toBe(CLASS_STATUS_RESIST.fighter);
    expect(statusResistPercent(enemy('r', 'rogue'))).toBe(CLASS_STATUS_RESIST.rogue);
    expect(statusResistPercent(enemy('l', 'leader'))).toBe(CLASS_STATUS_RESIST.leader);
    expect(statusResistPercent(enemy('a', 'archer'))).toBe(CLASS_STATUS_RESIST.archer); // 0
    // Ordering the mechanic depends on: leader resists more than fighter, archer none.
    expect(CLASS_STATUS_RESIST.leader).toBeGreaterThan(CLASS_STATUS_RESIST.fighter);
    expect(CLASS_STATUS_RESIST.archer).toBe(0);
  });

  it('a hero uses the derived statusResist stat', () => {
    const h = hero();
    expect(statusResistPercent(h)).toBe(effectiveStats(h).statusResist);
  });

  it('is always clamped into [0, 95] (never fully immune)', () => {
    for (const cls of Object.keys(CLASS_STATUS_RESIST) as CombatClass[]) {
      const r = statusResistPercent(enemy(`e-${cls}`, cls));
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(95);
    }
  });
});

describe('harmful potency is reduced by the target resist %', () => {
  it('a fighter stores less slow potency than a 0-resist archer, matching the table ratio', () => {
    const s = world([]);
    const fighter = enemy('f', 'fighter');
    const archer = enemy('a', 'archer'); // 0% resist -> full potency
    s.entities.f = fighter;
    s.entities.a = archer;
    const X = 40;
    apply(s, fighter, 'slow', X);
    apply(s, archer, 'slow', X);

    const pf = potencyOf(fighter, 'slow');
    const pa = potencyOf(archer, 'slow');
    expect(pa).toBe(X); // archer: full (0 resist)
    expect(pf).toBeLessThan(pa); // fighter: reduced
    expect(pf).toBeCloseTo(X * (1 - CLASS_STATUS_RESIST.fighter / 100)); // matches the table
  });

  it('a leader stores less potency than a fighter for the same applied status', () => {
    const s = world([]);
    const fighter = enemy('f', 'fighter');
    const leader = enemy('l', 'leader');
    s.entities.f = fighter;
    s.entities.l = leader;
    const X = 40;
    apply(s, fighter, 'slow', X);
    apply(s, leader, 'slow', X);

    expect(potencyOf(leader, 'slow')).toBeLessThan(potencyOf(fighter, 'slow'));
    expect(potencyOf(leader, 'slow')).toBeCloseTo(X * (1 - CLASS_STATUS_RESIST.leader / 100));
  });

  it('poison (%/sec), burn (absolute), and negative statFlat all scale down with resist', () => {
    const s = world([]);
    const fighter = enemy('f', 'fighter');
    const archer = enemy('a', 'archer');
    s.entities.f = fighter;
    s.entities.a = archer;
    const src = caster();
    apply(s, fighter, 'poison', 10, {}, src);
    apply(s, archer, 'poison', 10, {}, src);
    expect(potencyOf(fighter, 'poison')).toBeLessThan(potencyOf(archer, 'poison'));

    apply(s, fighter, 'burn', 50, {}, src);
    apply(s, archer, 'burn', 50, {}, src);
    expect(potencyOf(fighter, 'burn')).toBeLessThan(potencyOf(archer, 'burn'));

    // A negative statFlat is harmful (net penalty) -> scaled toward 0 (less negative).
    apply(s, fighter, 'statFlat', -100, { param: 'pct', stat: 'dex' }, src);
    apply(s, archer, 'statFlat', -100, { param: 'pct', stat: 'dex' }, src);
    expect(potencyOf(fighter, 'statFlat')).toBeGreaterThan(potencyOf(archer, 'statFlat')); // closer to 0
  });
});

describe('stun: DURATION is reduced (not potency)', () => {
  it('a resistant enemy gets a shorter stun msLeft than a 0-resist enemy', () => {
    const s = world([]);
    const leader = enemy('l', 'leader'); // high resist
    const archer = enemy('a', 'archer'); // 0 resist -> full duration
    s.entities.l = leader;
    s.entities.a = archer;
    apply(s, leader, 'stun', 0);
    apply(s, archer, 'stun', 0);

    const stunL = leader.statuses.find((st) => st.kind === 'stun')!;
    const stunA = archer.statuses.find((st) => st.kind === 'stun')!;
    expect(stunA.msLeft).toBe(STATUS.stun.durationMs); // full
    expect(stunL.msLeft).toBeLessThan(stunA.msLeft); // shorter
    expect(stunL.msLeft).toBe(Math.round(STATUS.stun.durationMs * (1 - CLASS_STATUS_RESIST.leader / 100)));
    expect(stunL.potency).toBe(0); // potency untouched (stun scales duration)
  });
});

describe('beneficial statuses are never reduced', () => {
  it('a self-cast atkUp / critUp on a resistant enemy keeps full potency', () => {
    const s = world([]);
    const leader = enemy('l', 'leader'); // 75% resist would gut a debuff
    s.entities.l = leader;
    const self = leader; // self-buff
    apply(s, leader, 'atkUp', 50, {}, self);
    apply(s, leader, 'critUp', 30, {}, self);
    expect(potencyOf(leader, 'atkUp')).toBe(50); // full, not reduced
    expect(potencyOf(leader, 'critUp')).toBe(30);
  });

  it('a positive statPercent (a buff) is not reduced either', () => {
    const s = world([]);
    const leader = enemy('l', 'leader');
    s.entities.l = leader;
    apply(s, leader, 'statPercent', 50, { param: 'pct', stat: 'dex' });
    expect(potencyOf(leader, 'statPercent')).toBe(50); // positive statPercent = buff -> full
  });
});
