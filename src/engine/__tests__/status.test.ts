import { describe, it, expect } from 'vitest';
import { advanceCombat, castInterval } from '../combat';
import { advanceStatuses, applyStatus } from '../status';
import { makeEntity } from '../entities';
import { demoMap } from '../../data-map';
import { STATUS, STUN_IMMUNITY_MS, effectiveStats, harmfulCritMultiplier, harmfulStackCount, totalSlowPercent, hasActiveStun, poisonTickDamage } from '../../config-stats';
import type { Entity, Skill, StatusApplication, StatusKind, WorldState } from '../../types';

// ---------------------------------------------------------------------------
// Harness — mirrors combat.test.ts / arming.test.ts: a seeded WorldState, level-20
// beginner heroes and rat enemies. Status assertions are TUNING-AGNOSTIC: they
// check directions/relationships (more/less, present/gone, N× stacks), never the
// exact tuned magnitudes the user edits live in data-skills.ts / config-stats.ts.
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
const hero = (cell: { x: number; y: number }, id = 'p1') => makeEntity({ id, faction: 'player', name: 'Hero', sprite: 'ranger', cell, level: 20, jobId: 'beginner' });
const rat = (id: string, cell: { x: number; y: number }) => makeEntity({ id, faction: 'enemy', name: 'Rat', sprite: 'slime', cell, level: 20, jobId: 'beginner' });

// A bare-bones caster used to bake status potencies without touching combat.
const caster = () => hero({ x: 1, y: 1 }, 'caster');

// Minimal hand-built skill so tests don't depend on any specific id in
// data-skills.ts (which a human is live-editing). `param` values are per-level
// functions, exactly as sk()/lin() would produce.
function mkSkill(id: string, params: Record<string, (lv: number) => number> = {}): Skill {
  return {
    id,
    name: id,
    description: id,
    kind: 'attack',
    target: 'melee',
    element: 'physical',
    shapeKind: 'point',
    params: params as Skill['params'],
    cooldownMs: 0,
  };
}

// Apply a status to `target` with a chosen pct/param magnitude via a hand-built skill.
function apply(s: WorldState, target: Entity, name: StatusKind, pct: number, extra: Partial<StatusApplication> = {}, from = caster()): void {
  const app: StatusApplication = { name, ...extra };
  const paramName = app.param ?? 'pct';
  applyStatus(s, target, app, from, mkSkill(`sk-${name}`, { [paramName]: () => pct }), 1);
}

// Advance statuses in small steps so DoT tick cadence resolves like the real tick.
function runStatuses(s: WorldState, totalMs: number, step = 250): void {
  for (let t = 0; t < totalMs; t += step) advanceStatuses(s, Math.min(step, totalMs - t));
}

describe('DoT: poison', () => {
  it('drains HP roughly once per second while active, then expires by ~10s', () => {
    const s = world([]);
    const target = rat('t', { x: 5, y: 5 });
    s.entities.t = target;
    apply(s, target, 'poison', 5); // 5% max HP / s
    expect(target.statuses.some((st) => st.kind === 'poison')).toBe(true);

    const start = target.hp;
    runStatuses(s, 1100); // just past one 1s tick
    const afterOne = start - target.hp;
    expect(afterOne).toBeGreaterThan(0);

    runStatuses(s, 3000); // ~3 more ticks
    expect(start - target.hp).toBeGreaterThan(afterOne); // more damage accrued

    runStatuses(s, 7000); // total ~11.1s > 10s duration
    expect(target.statuses.some((st) => st.kind === 'poison')).toBe(false); // gone
  });

  it('per-tick damage scales with maxHp and with potency (via poisonTickDamage)', () => {
    // Direct formula check on sign/direction — no tuned magnitude asserted.
    expect(poisonTickDamage(5, 1000)).toBeGreaterThan(poisonTickDamage(5, 500)); // bigger maxHp -> more
    expect(poisonTickDamage(10, 1000)).toBeGreaterThan(poisonTickDamage(5, 1000)); // bigger potency -> more

    // And end-to-end: a high-maxHp target loses more absolute HP per poison tick.
    const bigHp = makeEntity({ id: 'big', faction: 'enemy', name: 'Big', sprite: 'slime', cell: { x: 5, y: 5 }, level: 20, jobId: 'beginner', primaries: { str: 10, dex: 10, int: 10, vit: 400 } });
    const smallHp = makeEntity({ id: 'small', faction: 'enemy', name: 'Small', sprite: 'slime', cell: { x: 6, y: 5 }, level: 20, jobId: 'beginner', primaries: { str: 10, dex: 10, int: 10, vit: 20 } });
    expect(bigHp.stats.maxHp).toBeGreaterThan(smallHp.stats.maxHp);
    const s = world([bigHp, smallHp]);
    apply(s, bigHp, 'poison', 5);
    apply(s, smallHp, 'poison', 5);
    const bBefore = bigHp.hp;
    const sBefore = smallHp.hp;
    runStatuses(s, 1100); // one tick each
    expect(bBefore - bigHp.hp).toBeGreaterThan(sBefore - smallHp.hp);
  });
});

describe('DoT: burn', () => {
  it('ticks ~every 0.5s and expires by ~5s; damage is the baked absolute potency (maxHp-independent)', () => {
    const bigHp = makeEntity({ id: 'big', faction: 'enemy', name: 'Big', sprite: 'slime', cell: { x: 5, y: 5 }, level: 20, jobId: 'beginner', primaries: { str: 10, dex: 10, int: 10, vit: 400 } });
    const smallHp = makeEntity({ id: 'small', faction: 'enemy', name: 'Small', sprite: 'slime', cell: { x: 6, y: 5 }, level: 20, jobId: 'beginner', primaries: { str: 10, dex: 10, int: 10, vit: 20 } });
    const s = world([bigHp, smallHp]);
    const src = caster();
    // Same caster + same pct -> identical baked potency regardless of target maxHp.
    apply(s, bigHp, 'burn', 30, {}, src);
    apply(s, smallHp, 'burn', 30, {}, src);
    const burnPotency = bigHp.statuses.find((st) => st.kind === 'burn')!.potency;
    expect(burnPotency).toBe(Math.round((effectiveStats(src).maxDmg * 30) / 100)); // absolute, from caster maxDmg
    expect(smallHp.statuses.find((st) => st.kind === 'burn')!.potency).toBe(burnPotency); // maxHp-independent

    const bBefore = bigHp.hp;
    const sBefore = smallHp.hp;
    runStatuses(s, 600); // one 0.5s tick
    expect(bBefore - bigHp.hp).toBe(burnPotency);
    expect(sBefore - smallHp.hp).toBe(burnPotency); // identical absolute damage on both

    // Burn ticks twice as often as poison (0.5s vs 1s): >=8 ticks over ~4.5s more.
    runStatuses(s, 4500); // total ~5.1s > 5s duration
    expect(bigHp.statuses.some((st) => st.kind === 'burn')).toBe(false); // expired by ~5s
  });
});

describe('DoT: bleed stacking', () => {
  it('the SAME source stacks up to 5 (5 entries ~= 5x per-tick damage); a 6th refreshes, not adds', () => {
    const s = world([]);
    const t1 = rat('t1', { x: 5, y: 5 });
    const t5 = rat('t5', { x: 6, y: 5 });
    s.entities.t1 = t1;
    s.entities.t5 = t5;
    const src = caster();

    apply(s, t1, 'bleed', 20, {}, src); // 1 stack
    for (let i = 0; i < 5; i++) apply(s, t5, 'bleed', 20, {}, src); // 5 stacks (from the SAME source)
    expect(t1.statuses.filter((st) => st.kind === 'bleed')).toHaveLength(1);
    expect(t5.statuses.filter((st) => st.kind === 'bleed')).toHaveLength(STATUS.bleed.maxStacksPerSource);
    expect(STATUS.bleed.maxStacksPerSource).toBe(5);

    const b1 = t1.hp;
    const b5 = t5.hp;
    runStatuses(s, 1100); // one 1s bleed tick on each
    const dmg1 = b1 - t1.hp;
    const dmg5 = b5 - t5.hp;
    expect(dmg1).toBeGreaterThan(0);
    expect(dmg5).toBe(dmg1 * STATUS.bleed.maxStacksPerSource); // 5 stacks -> 5x the per-tick damage

    // A 6th application from the same source does NOT add a 7th entry (still 5).
    apply(s, t5, 'bleed', 20, {}, src);
    expect(t5.statuses.filter((st) => st.kind === 'bleed')).toHaveLength(5);
  });

  it('two DIFFERENT sources each add their own stack', () => {
    const s = world([]);
    const t = rat('t', { x: 5, y: 5 });
    s.entities.t = t;
    apply(s, t, 'bleed', 20, {}, hero({ x: 1, y: 1 }, 'srcA'));
    apply(s, t, 'bleed', 20, {}, hero({ x: 2, y: 2 }, 'srcB'));
    expect(t.statuses.filter((st) => st.kind === 'bleed')).toHaveLength(2); // separate sources => separate stacks
    const sources = new Set(t.statuses.filter((st) => st.kind === 'bleed').map((st) => st.sourceId));
    expect(sources.size).toBe(2);
  });
});

describe('dedup / re-apply of single-stack statuses', () => {
  it('the same source applied twice while active yields ONE stack; after expiry it re-adds', () => {
    const s = world([]);
    const t = rat('t', { x: 5, y: 5 });
    s.entities.t = t;
    const src = caster();
    apply(s, t, 'poison', 5, {}, src);
    apply(s, t, 'poison', 5, {}, src); // same ${casterId}:${skillId} source, still active
    expect(t.statuses.filter((st) => st.kind === 'poison')).toHaveLength(1); // deduped

    runStatuses(s, 10100); // let it fully expire (10s duration)
    expect(t.statuses.some((st) => st.kind === 'poison')).toBe(false);

    apply(s, t, 'poison', 5, {}, src); // re-apply after expiry
    expect(t.statuses.filter((st) => st.kind === 'poison')).toHaveLength(1); // re-added
  });
});

describe('slow: lengthens the cast interval', () => {
  it('a slowed entity has a larger castInterval, and more slow % is larger still', () => {
    const s = world([]);
    const e = hero({ x: 5, y: 5 });
    s.entities.p1 = e;
    const base = castInterval(e);
    expect(totalSlowPercent(e)).toBe(0);

    apply(s, e, 'slow', 20);
    const slowed = castInterval(e);
    expect(slowed).toBeGreaterThan(base); // slow lengthens the interval

    apply(s, e, 'slow', 30, {}, hero({ x: 2, y: 2 }, 'src2')); // second, stronger slow from another source
    const moreSlowed = castInterval(e);
    expect(totalSlowPercent(e)).toBeGreaterThan(20);
    expect(moreSlowed).toBeGreaterThan(slowed); // more slow % -> larger interval
  });
});

describe('stun: blocks casting, then grants immunity', () => {
  it('a stunned combatant does not act (its cast timer does not advance toward a cast)', () => {
    const p = hero({ x: 5, y: 5 });
    const e = rat('e1', { x: 6, y: 5 });
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    p.facing = 'right';
    // Stun the hero. hasActiveStun -> advanceCombat skips it entirely.
    apply(s, p, 'stun', 0);
    expect(hasActiveStun(p)).toBe(true);
    const enemyHpBefore = e.hp;
    const timerBefore = p.castTimerMs;
    advanceCombat(s, castInterval(p) * 3); // plenty of time for several casts if it could act
    expect(p.castTimerMs).toBe(timerBefore); // timer held: it never advanced toward a cast
    expect(e.hp).toBe(enemyHpBefore); // stunned hero dealt no damage
  });

  it('when a stun expires it sets stunImmuneMs > 0, and a fresh stun during immunity is a no-op', () => {
    const s = world([]);
    const t = rat('t', { x: 5, y: 5 });
    s.entities.t = t;
    apply(s, t, 'stun', 0);
    expect(t.stunImmuneMs ?? 0).toBe(0);

    // Advance exactly to the moment the 2s stun expires: immunity is freshly set.
    runStatuses(s, STATUS.stun.durationMs);
    expect(t.statuses.some((st) => st.kind === 'stun')).toBe(false);
    expect(t.stunImmuneMs ?? 0).toBe(STUN_IMMUNITY_MS); // full immunity window granted on expiry
    // ...and it counts down as more time passes (still > 0 within the window).
    runStatuses(s, 250);
    expect(t.stunImmuneMs ?? 0).toBeGreaterThan(0);
    expect(t.stunImmuneMs ?? 0).toBeLessThan(STUN_IMMUNITY_MS);

    apply(s, t, 'stun', 0); // during immunity
    expect(t.statuses.some((st) => st.kind === 'stun')).toBe(false); // no-op: no new stun added
  });
});

describe('atk / def multipliers vs a same-seed baseline', () => {
  // Drive N hero casts against a rat and sum the damage dealt, under a fixed seed.
  // Only the caster's/target's statuses differ between runs, so the comparison is
  // apples-to-apples and tuning-agnostic (relative, not absolute).
  function damageOver(setup: (s: WorldState, attacker: Entity, target: Entity) => void, casts = 6): number {
    const p = hero({ x: 5, y: 5 });
    p.facing = 'right';
    p.activeSkillIndex = p.skills.findIndex((r) => r.skillId === 'strike'); // simple single-target attack
    const e = rat('e1', { x: 6, y: 5 });
    e.hp = 10_000_000; // never dies, so every cast lands its full roll
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    setup(s, p, e);
    const before = e.hp;
    for (let i = 0; i < casts; i++) advanceCombat(s, castInterval(p));
    return before - e.hp;
  }

  it('atkUp raises outgoing damage; atkDown lowers it (vs no-status baseline)', () => {
    const baseline = damageOver(() => {});
    const withAtkUp = damageOver((s, p) => apply(s, p, 'atkUp', 50));
    const withAtkDown = damageOver((s, p) => apply(s, p, 'atkDown', 50));
    expect(withAtkUp).toBeGreaterThan(baseline);
    expect(withAtkDown).toBeLessThan(baseline);
  });

  it('defDown raises damage taken; defUp lowers it (vs no-status baseline)', () => {
    const baseline = damageOver(() => {});
    const withDefDown = damageOver((s, _p, e) => apply(s, e, 'defDown', 50));
    const withDefUp = damageOver((s, _p, e) => apply(s, e, 'defUp', 50));
    expect(withDefDown).toBeGreaterThan(baseline);
    expect(withDefUp).toBeLessThan(baseline);
  });
});

describe('crit scaling from harmful stacks', () => {
  it('harmfulCritMultiplier rises with the number of harmful stacks', () => {
    expect(harmfulCritMultiplier(0)).toBe(1);
    expect(harmfulCritMultiplier(1)).toBeGreaterThan(harmfulCritMultiplier(0));
    expect(harmfulCritMultiplier(3)).toBeGreaterThan(harmfulCritMultiplier(1));
  });

  it('each harmful status raises harmfulStackCount; a purely beneficial status does not', () => {
    const s = world([]);
    const t = rat('t', { x: 5, y: 5 });
    s.entities.t = t;
    expect(harmfulStackCount(t)).toBe(0);

    apply(s, t, 'poison', 5); // harmful
    const afterHarmful = harmfulStackCount(t);
    expect(afterHarmful).toBeGreaterThan(0);
    expect(harmfulCritMultiplier(afterHarmful)).toBeGreaterThan(harmfulCritMultiplier(0));

    // Bleed adds per-STACK harmful count (multi-stack): 3 stacks -> +3.
    const src = caster();
    for (let i = 0; i < 3; i++) apply(s, t, 'bleed', 20, {}, src);
    expect(harmfulStackCount(t)).toBe(afterHarmful + 3);

    // A beneficial buff (atkUp) does NOT raise the harmful count.
    const beforeBenef = harmfulStackCount(t);
    apply(s, t, 'atkUp', 50);
    apply(s, t, 'dodge', 20);
    expect(harmfulStackCount(t)).toBe(beforeBenef); // benefit statuses don't count
  });
});

describe('dodge / blind avoidance rolls (fixed seed)', () => {
  // Count miss events over many hero casts under a fixed seed. Accuracy is made
  // overwhelming so the base hit check never misses — isolating the dodge/blind
  // avoidance rolls (which read the status potency).
  function missesOver(setup: (s: WorldState, attacker: Entity, target: Entity) => void, casts = 12): number {
    const p = makeEntity({ id: 'p1', faction: 'player', name: 'Hero', sprite: 'ranger', cell: { x: 5, y: 5 }, level: 20, jobId: 'beginner', primaries: { str: 20, dex: 400, int: 20, vit: 200 } });
    p.facing = 'right';
    p.activeSkillIndex = p.skills.findIndex((r) => r.skillId === 'strike');
    const e = makeEntity({ id: 'e1', faction: 'enemy', name: 'Rat', sprite: 'slime', cell: { x: 6, y: 5 }, level: 20, jobId: 'beginner', primaries: { str: 20, dex: 1, int: 20, vit: 400 } });
    e.hp = 10_000_000; // survives every cast
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    setup(s, p, e);
    let misses = 0;
    for (let i = 0; i < casts; i++) {
      s.hits = [];
      advanceCombat(s, castInterval(p));
      misses += s.hits.filter((h) => h.kind === 'miss' && h.cell.x === 6 && h.cell.y === 5).length;
    }
    return misses;
  }

  it('0% dodge never adds dodge misses; a high dodge status causes strictly more', () => {
    const noDodge = missesOver(() => {});
    expect(noDodge).toBe(0); // overwhelming accuracy + 0 dodge status => no misses at all
    const highDodge = missesOver((s, _p, e) => apply(s, e, 'dodge', 100)); // clamped high avoid chance
    expect(highDodge).toBeGreaterThan(noDodge);
  });

  it('0% blind never whiffs; a high blind status makes the attacker whiff more', () => {
    const noBlind = missesOver(() => {});
    expect(noBlind).toBe(0);
    const highBlind = missesOver((s, p) => apply(s, p, 'blind', 100)); // attacker blinded
    expect(highBlind).toBeGreaterThan(noBlind);
  });
});

describe('statPercent / statFlat: buff effective primaries & derived stats', () => {
  it('a statPercent dex buff raises effective accuracy (and other dex-derived stats) above base', () => {
    const s = world([]);
    const e = hero({ x: 5, y: 5 });
    s.entities.p1 = e;
    const baseAccuracy = e.stats.accuracy;
    expect(effectiveStats(e).accuracy).toBe(baseAccuracy); // no buff yet

    apply(s, e, 'statPercent', 50, { param: 'pct', stat: 'dex' }); // +50% dex
    expect(effectiveStats(e).accuracy).toBeGreaterThan(baseAccuracy); // accuracy = dex*2 -> rises
    // e.stats (base) is untouched; only effectiveStats reflects the buff.
    expect(e.stats.accuracy).toBe(baseAccuracy);

    // Removing the buff (expiry) returns effective stats to base.
    runStatuses(s, STATUS.statPercent.durationMs + 250);
    expect(e.statuses.some((st) => st.kind === 'statPercent')).toBe(false);
    expect(effectiveStats(e).accuracy).toBe(baseAccuracy);
  });

  it('statFlat adds flat primary points (raising derived stats); a negative statPercent lowers them', () => {
    const s = world([]);
    const e = hero({ x: 5, y: 5 });
    s.entities.p1 = e;
    const baseAccuracy = e.stats.accuracy;

    apply(s, e, 'statFlat', 100, { param: 'pct', stat: 'dex' }); // +100 flat dex
    expect(effectiveStats(e).accuracy).toBeGreaterThan(baseAccuracy);

    // A negative statPercent is treated as harmful and lowers the stat.
    const s2 = world([]);
    const e2 = hero({ x: 5, y: 5 });
    s2.entities.p1 = e2;
    apply(s2, e2, 'statPercent', -50, { param: 'pct', stat: 'dex' });
    expect(effectiveStats(e2).accuracy).toBeLessThan(e2.stats.accuracy);
    expect(harmfulStackCount(e2)).toBeGreaterThan(0); // net-penalty stat mod counts as harmful
  });
});
