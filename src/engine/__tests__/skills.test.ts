import { describe, it, expect } from 'vitest';
import { skillTargets, canCast, afterCast, tickCooldowns, magnitude, targetsAllies } from '../skills';
import { makeEntity } from '../entities';
import { getSkill } from '../../data-skills';
import type { Entity, Faction } from '../../types';

function at(id: string, faction: Faction, cell: { x: number; y: number }): Entity {
  return makeEntity({ id, faction, name: id, sprite: 'slime', cell, level: 10, jobId: 'beginner' });
}

describe('skill targeting by shape', () => {
  it('hits only the opposing member on the faced (melee) tile', () => {
    const caster = at('p', 'player', { x: 5, y: 5 });
    caster.facing = 'right';
    const ahead = at('e1', 'enemy', { x: 6, y: 5 }); // (1,0) — the faced tile
    const beside = at('e2', 'enemy', { x: 5, y: 6 }); // (0,1) — adjacent but not faced
    const targets = skillTargets(caster, getSkill('strike'), [caster, ahead, beside], 1);
    expect(targets.map((t) => t.id)).toEqual(['e1']);
  });
  it('never targets allies with a damage skill', () => {
    const caster = at('p', 'player', { x: 5, y: 5 });
    const friend = at('p2', 'player', { x: 6, y: 5 });
    expect(skillTargets(caster, getSkill('strike'), [caster, friend], 1)).toEqual([]);
  });
  it('heal skills hit adjacent allies (and self), not enemies', () => {
    const healer = at('h', 'player', { x: 5, y: 5 });
    const ally = at('a', 'ally', { x: 6, y: 5 });
    const foe = at('e', 'enemy', { x: 4, y: 5 });
    const ids = skillTargets(healer, getSkill('verdantWellspring'), [healer, ally, foe], 1).map((t) => t.id);
    expect(ids).toContain('a');
    expect(ids).toContain('h');
    expect(ids).not.toContain('e');
  });
  it('directional skills hit foes in the facing direction only', () => {
    const caster = at('p', 'player', { x: 5, y: 5 });
    caster.facing = 'right';
    const ahead = at('e1', 'enemy', { x: 6, y: 5 }); // (1,0) — ahead
    const beside = at('e2', 'enemy', { x: 5, y: 6 }); // (0,1) — not ahead
    const ids = skillTargets(caster, getSkill('emberLance'), [caster, ahead, beside], 1).map((t) => t.id);
    expect(ids).toContain('e1');
    expect(ids).not.toContain('e2');
  });
  it('classifies ally- vs enemy-targeting by kind', () => {
    expect(targetsAllies(getSkill('recover'))).toBe(true); // heal
    expect(targetsAllies(getSkill('bracingGuard'))).toBe(true); // buff
    expect(targetsAllies(getSkill('strike'))).toBe(false); // attack
    expect(targetsAllies(getSkill('frostbite'))).toBe(false); // debuff
  });
});

describe('leveled magnitude', () => {
  it('is the per-level dmg multiplier that scales up with level', () => {
    const strike = getSkill('strike');
    expect(magnitude(strike, 1)).toBeGreaterThan(0); // an attack skill has a dmg multiplier
    expect(magnitude(strike, 3)).toBeGreaterThan(magnitude(strike, 1)); // grows with level (tuning-agnostic)
  });
});

describe('uses and cooldown bookkeeping', () => {
  it('unlimited skills (usesLeft -1) are always castable and never deplete', () => {
    const rt = { skillId: 'strike', level: 1, usesLeft: -1, cooldownLeftMs: 0 };
    expect(canCast(rt)).toBe(true);
    expect(afterCast(rt, getSkill('strike'))).toEqual(rt);
  });
  it('depleting the last use starts the cooldown and refills uses', () => {
    let rt = { skillId: 'finishingBlow', level: 1, usesLeft: 1, cooldownLeftMs: 0 };
    rt = afterCast(rt, getSkill('finishingBlow'));
    expect(rt.cooldownLeftMs).toBe(getSkill('finishingBlow').cooldownMs);
    expect(rt.usesLeft).toBe(getSkill('finishingBlow').uses);
    expect(canCast(rt)).toBe(false);
  });
  it('a per-level cooldownFn (e.g. Recover) shortens the cooldown as the skill levels up', () => {
    const recover = getSkill('recover');
    expect(recover.cooldownFn).toBeDefined(); // authored via cooldown: lin(18, -2)
    const cdAt = (level: number) => afterCast({ skillId: 'recover', level, usesLeft: 1, cooldownLeftMs: 0 }, recover).cooldownLeftMs;
    expect(cdAt(1)).toBeGreaterThan(0);
    expect(cdAt(5)).toBeLessThan(cdAt(1)); // higher level -> shorter cooldown (tuning-agnostic)
  });
  it('passive cooldowns tick regardless of selection; active only while selected', () => {
    const e = makeEntity({ id: 'm', faction: 'player', name: 'm', sprite: 'wizard', cell: { x: 0, y: 0 }, level: 10, jobId: 'cinderSage' });
    e.skills = [
      { skillId: 'cinderstorm', level: 1, usesLeft: -1, cooldownLeftMs: 1000 }, // passive
      { skillId: 'finishingBlow', level: 1, usesLeft: 1, cooldownLeftMs: 1000 }, // active
    ];
    e.activeSkillIndex = 0; // cinderstorm selected
    const ticked = tickCooldowns(e, 400);
    expect(ticked[0].cooldownLeftMs).toBe(600); // passive always ticks
    expect(ticked[1].cooldownLeftMs).toBe(1000); // active, not selected => frozen
  });
});
