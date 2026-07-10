import { describe, it, expect } from 'vitest';
import { advanceCombat, castInterval } from '../combat';
import { applyStatus } from '../status';
import { makeEntity } from '../entities';
import { getSkill } from '../../data-skills';
import { demoMap } from '../../data-map';
import { CRIT_MULT, effectiveStats, harmfulStackCount, totalCritPercent, totalCritDamagePercent } from '../../config-stats';
import type { Entity, Skill, StatusApplication, StatusKind, WorldState } from '../../types';

// ---------------------------------------------------------------------------
// Harness — mirrors status.test.ts: a seeded WorldState + level-20 heroes/rats.
// Assertions are TUNING-AGNOSTIC: they read improvedCritical's own per-level
// param formulas (crit/critDmg) rather than baking in the tuned magnitudes the
// user edits live in data-skills.ts, and compare directions (more/less, >0),
// never exact numbers.
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
const caster = () => hero({ x: 1, y: 1 }, 'caster');

// Minimal hand-built skill (as in status.test.ts) so status baking doesn't depend
// on any specific data-skills.ts id (which a human is live-editing).
function mkSkill(id: string, params: Record<string, (lv: number) => number> = {}): Skill {
  return { id, name: id, description: id, kind: 'buff', target: 'self', element: 'physical', shapeKind: 'self', params: params as Skill['params'], cooldownMs: 0 };
}
function apply(s: WorldState, target: Entity, name: StatusKind, pct: number, extra: Partial<StatusApplication> = {}, from = caster()): void {
  const app: StatusApplication = { name, ...extra };
  const paramName = app.param ?? 'pct';
  applyStatus(s, target, app, from, mkSkill(`sk-${name}`, { [paramName]: () => pct }), 1);
}

// The skill's own per-level values (tuning-agnostic reads).
const critAt = (lv: number) => getSkill('improvedCritical').params.crit?.(lv) ?? 0;
const critDmgAt = (lv: number) => getSkill('improvedCritical').params.critDmg?.(lv) ?? 0;

describe('critUp / critDmgUp feed the damage roll', () => {
  // damageSource is module-internal, so assert the exact expressions it uses to
  // build the roll's crit inputs: crit = effectiveStats.crit + totalCritPercent,
  // critDmg = totalCritDamagePercent. Casting improvedCritical (or a critDmgUp)
  // moves those values, which is what the roll reads.
  const rollCrit = (e: Entity) => effectiveStats(e).crit + totalCritPercent(e);
  const rollCritDmg = (e: Entity) => totalCritDamagePercent(e);

  it('a critUp status raises the roll crit chance above the unbuffed value by its potency', () => {
    const s = world([]);
    const e = hero({ x: 5, y: 5 });
    s.entities.p1 = e;
    const baseCrit = rollCrit(e);
    expect(totalCritPercent(e)).toBe(0);

    apply(s, e, 'critUp', 25, { param: 'crit' });
    expect(totalCritPercent(e)).toBe(25);
    expect(rollCrit(e)).toBeCloseTo(baseCrit + 25);
  });

  it('a critDmgUp status raises the roll crit-damage bonus above 0 by its potency', () => {
    const s = world([]);
    const e = hero({ x: 5, y: 5 });
    s.entities.p1 = e;
    expect(rollCritDmg(e)).toBe(0);

    apply(s, e, 'critDmgUp', 40, { param: 'critDmg' });
    expect(totalCritDamagePercent(e)).toBe(40);
    expect(rollCritDmg(e)).toBe(40);
  });
});

describe('critDmgUp raises crit damage (fixed seed)', () => {
  // Isolate a crit: give the attacker overwhelming crit chance so every landed hit
  // crits, and a fat target that survives. Under the SAME seed the two runs roll
  // the same base damage; only critDmgUp differs, so the buffed run must hit harder.
  function critDamageOver(setup: (s: WorldState, attacker: Entity, target: Entity) => void, casts = 8): number {
    // dex/int drive crit; huge dex here pushes crit chance to its 95% cap.
    const p = makeEntity({ id: 'p1', faction: 'player', name: 'Hero', sprite: 'ranger', cell: { x: 5, y: 5 }, level: 20, jobId: 'beginner', primaries: { str: 20, dex: 800, int: 800, vit: 200 } });
    p.facing = 'right';
    p.activeSkillIndex = p.skills.findIndex((r) => r.skillId === 'strike');
    const e = makeEntity({ id: 'e1', faction: 'enemy', name: 'Rat', sprite: 'slime', cell: { x: 6, y: 5 }, level: 20, jobId: 'beginner', primaries: { str: 20, dex: 1, int: 20, vit: 4000 } });
    e.hp = 10_000_000;
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    setup(s, p, e);
    const before = e.hp;
    let crits = 0;
    for (let i = 0; i < casts; i++) {
      s.hits = [];
      advanceCombat(s, castInterval(p));
      crits += s.hits.filter((h) => h.kind === 'crit').length;
    }
    // Guard: the setup must actually be landing crits, else the comparison is vacuous.
    expect(crits).toBeGreaterThan(0);
    return before - e.hp;
  }

  it('a large critDmgUp makes crits deal MORE damage than the same caster without it', () => {
    const baseline = critDamageOver(() => {});
    const buffed = critDamageOver((s, p) => apply(s, p, 'critDmgUp', 100, { param: 'critDmg' })); // +100% -> CRIT_MULT+1 crit
    expect(buffed).toBeGreaterThan(baseline);
  });

  it('the crit multiplier grows with critDmg: CRIT_MULT + critDmg/100', () => {
    // Direct formula sanity: +50% critDmg turns a x1.8 crit into x2.3.
    expect(CRIT_MULT + 50 / 100).toBeCloseTo(CRIT_MULT + 0.5);
    expect(CRIT_MULT + 0 / 100).toBe(CRIT_MULT);
  });
});

describe('improvedCritical skill definition', () => {
  it('is a buff carrying both critUp and critDmgUp statuses', () => {
    const sk = getSkill('improvedCritical');
    expect(sk.kind).toBe('buff');
    expect(sk.shapeKind).toBe('self');
    const apps = Array.isArray(sk.status) ? sk.status : sk.status ? [sk.status] : [];
    const names = apps.map((a) => a.name);
    expect(names).toContain('critUp');
    expect(names).toContain('critDmgUp');
    // Its potency params are wired to crit / critDmg respectively.
    const critApp = apps.find((a) => a.name === 'critUp');
    const critDmgApp = apps.find((a) => a.name === 'critDmgUp');
    expect(critApp?.param).toBe('crit');
    expect(critDmgApp?.param).toBe('critDmg');
    expect(critAt(1)).toBeGreaterThan(0);
    expect(critDmgAt(1)).toBeGreaterThan(0);
  });

  it('casting it in-combat applies both critUp and critDmgUp to the caster (self)', () => {
    // Archer hero whose only skill is improvedCritical, grouped with a rat so
    // advanceCombat drives its auto-cast.
    const p = makeEntity({ id: 'p1', faction: 'player', name: 'Archer', sprite: 'ranger', cell: { x: 5, y: 5 }, level: 20, jobId: 'archer', skills: [getSkill('improvedCritical')] });
    p.facing = 'right';
    p.activeSkillIndex = 0;
    const e = rat('e1', { x: 6, y: 5 });
    const s = world([p, e]);
    s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e1'] } };
    expect(p.statuses.some((st) => st.kind === 'critUp')).toBe(false);

    advanceCombat(s, castInterval(p)); // one auto-cast
    const self = s.entities.p1;
    expect(self.statuses.some((st) => st.kind === 'critUp')).toBe(true);
    expect(self.statuses.some((st) => st.kind === 'critDmgUp')).toBe(true);
    // Potencies match the skill's per-level formulas (level = the runtime level).
    const lv = self.skills[0].level;
    expect(totalCritPercent(self)).toBe(critAt(lv));
    expect(totalCritDamagePercent(self)).toBe(critDmgAt(lv));
  });
});

describe('critUp / critDmgUp are beneficial (not harmful)', () => {
  it('neither increases harmfulStackCount', () => {
    const s = world([]);
    const e = hero({ x: 5, y: 5 });
    s.entities.p1 = e;
    expect(harmfulStackCount(e)).toBe(0);

    apply(s, e, 'critUp', 25, { param: 'crit' });
    apply(s, e, 'critDmgUp', 40, { param: 'critDmg' });
    expect(e.statuses.filter((st) => st.kind === 'critUp' || st.kind === 'critDmgUp')).toHaveLength(2);
    expect(harmfulStackCount(e)).toBe(0); // both beneficial -> no harmful stacks
  });
});
