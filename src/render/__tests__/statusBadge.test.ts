import { describe, it, expect } from 'vitest';
import { groupStatuses, STATUS_VISUALS } from '../statusBadge';
import type { StatusEffect, StatusKind } from '../../types';

const st = (kind: StatusKind, over: Partial<StatusEffect> = {}): StatusEffect => ({ kind, potency: 1, msLeft: 1000, sourceId: 'a:b', ...over });

describe('groupStatuses', () => {
  it('collapses same-kind stacks into one group and sums the count', () => {
    const groups = groupStatuses([st('bleed'), st('bleed'), st('bleed')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: 'bleed', count: 3, harmful: true });
  });

  it('preserves first-seen order across distinct kinds', () => {
    const groups = groupStatuses([st('atkUp'), st('poison'), st('atkUp'), st('slow')]);
    expect(groups.map((g) => g.kind)).toEqual(['atkUp', 'poison', 'slow']);
    expect(groups[0].count).toBe(2); // the two atkUp collapsed
  });

  it('reads harmful from the STATUS table for non-stat kinds', () => {
    const groups = groupStatuses([st('poison'), st('atkUp'), st('defUp'), st('atkDown')]);
    const by = Object.fromEntries(groups.map((g) => [g.kind, g.harmful]));
    expect(by.poison).toBe(true);
    expect(by.atkUp).toBe(false);
    expect(by.defUp).toBe(false);
    expect(by.atkDown).toBe(true);
  });

  it('splits stat kinds per-stat and marks buff vs debuff by net potency', () => {
    const groups = groupStatuses([
      st('statPercent', { stat: 'str', potency: 20 }),
      st('statPercent', { stat: 'str', potency: -5 }), // net +15 -> buff
      st('statPercent', { stat: 'dex', potency: -30 }), // net -30 -> debuff
    ]);
    expect(groups).toHaveLength(2);
    const str = groups.find((g) => g.stat === 'str')!;
    const dex = groups.find((g) => g.stat === 'dex')!;
    expect(str).toMatchObject({ count: 2, up: true, harmful: false });
    expect(dex).toMatchObject({ count: 1, up: false, harmful: true });
  });

  it('treats a net-zero stat group as a buff (up)', () => {
    const groups = groupStatuses([st('statFlat', { stat: 'vit', potency: 3 }), st('statFlat', { stat: 'vit', potency: -3 })]);
    expect(groups[0]).toMatchObject({ stat: 'vit', up: true, harmful: false });
  });

  it('keeps statPercent and statFlat as separate groups even for the same stat', () => {
    const groups = groupStatuses([st('statPercent', { stat: 'int', potency: 10 }), st('statFlat', { stat: 'int', potency: 4 })]);
    expect(groups.map((g) => g.kind)).toEqual(['statPercent', 'statFlat']);
  });

  it('returns an empty list for no statuses', () => {
    expect(groupStatuses([])).toEqual([]);
  });
});

describe('STATUS_VISUALS', () => {
  it('defines a colour for every status kind', () => {
    const kinds: StatusKind[] = ['poison', 'bleed', 'burn', 'slow', 'stun', 'atkUp', 'atkDown', 'defUp', 'defDown', 'dodge', 'blind', 'statPercent', 'statFlat'];
    for (const k of kinds) expect(STATUS_VISUALS[k].color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
