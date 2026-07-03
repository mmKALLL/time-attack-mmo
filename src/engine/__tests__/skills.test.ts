import { describe, it, expect } from 'vitest';
import { skillTargets, canCast, afterCast, tickCooldowns } from '../skills';
import { makeEntity } from '../entities';
import { SKILLS } from '../../data';
import type { Entity, Faction } from '../../types';

function at(id: string, faction: Faction, cell: { x: number; y: number }): Entity {
  return makeEntity({ id, faction, name: id, sprite: 'slime', cell, level: 10, jobId: 'beginner' });
}

describe('skill targeting by shape', () => {
  it('hits only opposing members whose offset matches the shape', () => {
    const caster = at('p', 'player', { x: 5, y: 5 });
    const right = at('e1', 'enemy', { x: 6, y: 5 }); // (1,0) — in strike (adj4)
    const far = at('e2', 'enemy', { x: 8, y: 5 }); // (3,0) — not in strike
    const targets = skillTargets(caster, SKILLS.strike, [caster, right, far]);
    expect(targets.map((t) => t.id)).toEqual(['e1']);
  });
  it('never targets allies with a damage skill', () => {
    const caster = at('p', 'player', { x: 5, y: 5 });
    const friend = at('p2', 'player', { x: 6, y: 5 });
    expect(skillTargets(caster, SKILLS.strike, [caster, friend])).toEqual([]);
  });
  it('healing skills hit adjacent allies, not enemies', () => {
    const healer = at('h', 'player', { x: 5, y: 5 });
    const ally = at('a', 'ally', { x: 6, y: 5 });
    const foe = at('e', 'enemy', { x: 4, y: 5 });
    const ids = skillTargets(healer, SKILLS.hallowedGround, [healer, ally, foe]).map((t) => t.id);
    expect(ids).toContain('a');
    expect(ids).not.toContain('e');
  });
});

describe('uses and cooldown bookkeeping', () => {
  it('unlimited skills (usesLeft -1) are always castable and never deplete', () => {
    const rt = { skillId: 'strike', usesLeft: -1, cooldownLeftMs: 0 };
    expect(canCast(rt)).toBe(true);
    expect(afterCast(rt, SKILLS.strike)).toEqual(rt);
  });
  it('depleting the last use starts the cooldown and refills uses', () => {
    let rt = { skillId: 'killshot', usesLeft: 1, cooldownLeftMs: 0 };
    rt = afterCast(rt, SKILLS.killshot);
    expect(rt.cooldownLeftMs).toBe(SKILLS.killshot.cooldownMs);
    expect(rt.usesLeft).toBe(SKILLS.killshot.uses);
    expect(canCast(rt)).toBe(false);
  });
  it('passive cooldowns tick regardless of selection; active only while selected', () => {
    const e = makeEntity({ id: 'm', faction: 'player', name: 'm', sprite: 'wizard', cell: { x: 0, y: 0 }, level: 10, jobId: 'cinderSage' });
    e.skills = [
      { skillId: 'cinderstorm', usesLeft: -1, cooldownLeftMs: 1000 }, // passive
      { skillId: 'aegisBastion', usesLeft: -1, cooldownLeftMs: 1000 }, // active
    ];
    e.activeSkillIndex = 0; // cinderstorm selected
    const ticked = tickCooldowns(e, 400);
    expect(ticked[0].cooldownLeftMs).toBe(600); // passive always ticks
    expect(ticked[1].cooldownLeftMs).toBe(1000); // active, not selected => frozen
  });
});
