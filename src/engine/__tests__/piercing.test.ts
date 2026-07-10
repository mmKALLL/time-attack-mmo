import { describe, it, expect } from 'vitest';
import { advanceCombat, advanceArming, groupOf, castInterval } from '../combat';
import { getSkill } from '../../data-skills';
import { makeEntity } from '../entities';
import { demoMap } from '../../data-map';
import type { Entity, WorldState } from '../../types';

function world(entities: Entity[]): WorldState {
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
    rng: 1,
    spawnClockMs: 0,
    tickCount: 0,
    hits: [],
    xpGains: [],
    telegraphs: [],
  };
}

// Magician hero grants magicClaw (arc, pierce:false, no status).
const magician = (cell: { x: number; y: number }) => makeEntity({ id: 'p1', faction: 'player', name: 'Mage', sprite: 'magician', cell, level: 20, jobId: 'magician' });
// Rogue hero grants hamstring (arc, pierce:false, applies 'slow').
const rogueHero = (cell: { x: number; y: number }) => makeEntity({ id: 'p1', faction: 'player', name: 'Rogue', sprite: 'rogue', cell, level: 20, jobId: 'rogue' });
const rat = (id: string, cell: { x: number; y: number }) => makeEntity({ id, faction: 'enemy', name: 'Rat', sprite: 'slime', cell, level: 20, jobId: 'beginner' });

const selectSkill = (p: Entity, skillId: string) => {
  p.activeSkillIndex = p.skills.findIndex((r) => r.skillId === skillId);
  expect(p.activeSkillIndex).toBeGreaterThanOrEqual(0);
};
// The tick pushed a hit event onto this cell (hit/crit/miss all count).
const struck = (s: WorldState, c: { x: number; y: number }) => s.hits.some((h) => h.cell.x === c.x && h.cell.y === c.y);
const isSlowed = (e: Entity) => e.statuses.some((st) => st.kind === 'slow');

describe('non-piercing line/arc targeting (pierce:false)', () => {
  it('flags Magic Claw and Hamstring as non-piercing', () => {
    expect(getSkill('magicClaw').pierce).toBe(false);
    expect(getSkill('hamstring').pierce).toBe(false);
  });

  describe('in-combat castSkill path (advanceCombat)', () => {
    it('Magic Claw hits only the nearest arc foe; the other is untouched and not pulled in', () => {
      // Caster faces right; arc covers (4,2),(4,3),(4,4). Two foes on it; the central
      // (4,3) has zero lateral offset -> it is the nearest pick.
      const p = magician({ x: 3, y: 3 });
      p.facing = 'right';
      p.mp = 999;
      selectSkill(p, 'magicClaw');
      const center = rat('e_center', { x: 4, y: 3 });
      const edge = rat('e_edge', { x: 4, y: 4 });
      const s = world([p, center, edge]);
      // Pre-engage the caster with an off-footprint foe so a group already exists.
      const bystander = rat('e_by', { x: 3, y: 8 });
      s.entities[bystander.id] = bystander;
      s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e_by'] } };

      advanceCombat(s, castInterval(p)); // exactly one Magic Claw cast

      expect(struck(s, { x: 4, y: 3 })).toBe(true); // the central (nearest) foe was struck
      expect(struck(s, { x: 4, y: 4 })).toBe(false); // the other arc foe was NOT
      expect(groupOf(s, 'p1')?.memberIds).toContain('e_center'); // nearest engaged
      expect(groupOf(s, 'p1')?.memberIds).not.toContain('e_edge'); // the other not pulled in
    });

    it('Hamstring damages, slows, and engages only the nearest foe', () => {
      const p = rogueHero({ x: 3, y: 3 });
      p.facing = 'right';
      p.mp = 999;
      selectSkill(p, 'hamstring');
      const center = rat('e_center', { x: 4, y: 3 });
      const edge = rat('e_edge', { x: 4, y: 2 });
      const s = world([p, center, edge]);
      const bystander = rat('e_by', { x: 3, y: 8 });
      s.entities[bystander.id] = bystander;
      s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e_by'] } };

      advanceCombat(s, castInterval(p)); // exactly one Hamstring cast

      expect(struck(s, { x: 4, y: 3 })).toBe(true);
      expect(struck(s, { x: 4, y: 2 })).toBe(false);
      expect(isSlowed(s.entities.e_center)).toBe(true); // status applied to nearest
      expect(isSlowed(s.entities.e_edge)).toBe(false); // NOT to the other
      expect(groupOf(s, 'p1')?.memberIds).toContain('e_center');
      expect(groupOf(s, 'p1')?.memberIds).not.toContain('e_edge');
    });
  });

  describe('out-of-combat advanceArming path (armed player)', () => {
    it('an armed Magic Claw fires on only the nearest arc foe, engaging just it', () => {
      const p = magician({ x: 3, y: 3 });
      p.facing = 'right';
      p.armed = true;
      p.mp = 999;
      p.castTimerMs = 0;
      selectSkill(p, 'magicClaw');
      const center = rat('e_center', { x: 4, y: 3 });
      const edge = rat('e_edge', { x: 4, y: 2 });
      const s = world([p, center, edge]);

      advanceArming(s, 5000); // fills the wind-up and fires

      expect(struck(s, { x: 4, y: 3 })).toBe(true);
      expect(struck(s, { x: 4, y: 2 })).toBe(false);
      expect(groupOf(s, 'p1')?.memberIds).toContain('e_center'); // engaged
      expect(groupOf(s, 'p1')?.memberIds ?? []).not.toContain('e_edge'); // other left free
      expect(s.entities.e_edge.hp).toBe(s.entities.e_edge.stats.maxHp); // fully untouched
    });

    it('an armed Hamstring slows and engages only the nearest arc foe', () => {
      const p = rogueHero({ x: 3, y: 3 });
      p.facing = 'right';
      p.armed = true;
      p.mp = 999;
      p.castTimerMs = 0;
      selectSkill(p, 'hamstring');
      const center = rat('e_center', { x: 4, y: 3 });
      const edge = rat('e_edge', { x: 4, y: 4 });
      const s = world([p, center, edge]);

      advanceArming(s, 5000);

      expect(isSlowed(s.entities.e_center)).toBe(true);
      expect(isSlowed(s.entities.e_edge)).toBe(false);
      expect(groupOf(s, 'p1')?.memberIds).toContain('e_center');
      expect(groupOf(s, 'p1')?.memberIds ?? []).not.toContain('e_edge');
    });
  });

  describe('regression: piercing (default) AoE still hits every foe', () => {
    it('a default arc (venomSlash, no pierce flag) hits BOTH foes on its footprint', () => {
      expect(getSkill('venomSlash').pierce).toBeUndefined(); // still piercing by default
      const p = rogueHero({ x: 3, y: 3 });
      p.facing = 'right';
      p.mp = 999;
      selectSkill(p, 'venomSlash');
      const a = rat('e_a', { x: 4, y: 3 });
      const b = rat('e_b', { x: 4, y: 4 });
      const s = world([p, a, b]);
      s.groups = { g0: { id: 'g0', memberIds: ['p1', 'e_a'] } };

      advanceCombat(s, castInterval(p)); // exactly one Venom Slash cast

      expect(struck(s, { x: 4, y: 3 })).toBe(true); // both arc foes struck
      expect(struck(s, { x: 4, y: 4 })).toBe(true);
      expect(groupOf(s, 'p1')?.memberIds).toContain('e_a');
      expect(groupOf(s, 'p1')?.memberIds).toContain('e_b'); // piercing sweep engaged both
    });
  });

  describe('equidistant-arc tiebreak', () => {
    it('picks the central (least-lateral) foe when two arc cells are equidistant', () => {
      // Facing right, arc cells (4,2),(4,3),(4,4) are all Chebyshev 1 away. Foes on the
      // two EDGE cells (both lateral 1) tie on distance+lateral -> stable id tiebreak.
      // A central foe (lateral 0) must always win outright, regardless of the others.
      const p = magician({ x: 3, y: 3 });
      p.facing = 'right';
      p.armed = true;
      p.mp = 999;
      selectSkill(p, 'magicClaw');
      const top = rat('e_top', { x: 4, y: 2 }); // lateral 1
      const center = rat('e_mid', { x: 4, y: 3 }); // lateral 0 -> central
      const bottom = rat('e_bot', { x: 4, y: 4 }); // lateral 1
      const s = world([p, top, center, bottom]);

      advanceArming(s, 5000);

      expect(struck(s, { x: 4, y: 3 })).toBe(true); // central chosen
      expect(struck(s, { x: 4, y: 2 })).toBe(false);
      expect(struck(s, { x: 4, y: 4 })).toBe(false);
    });
  });
});
