import { describe, it, expect } from 'vitest';
import { tick } from '../world';
import { createDemoWorld } from '../demo';
import { MAPS, START_MAP } from '../../data-map';
import { getSkill } from '../../data-skills';
import { CHARACTER_NAMES } from '../../data';
import { xpToNext } from '../../config';

describe('world reducer', () => {
  it('does not mutate the input state (immutability boundary)', () => {
    const s0 = createDemoWorld();
    const p0 = s0.entities[s0.playerId].cell;
    const s1 = tick(s0, [{ type: 'move', dir: 'right' }], 50);
    expect(s0.entities[s0.playerId].cell).toBe(p0);
    expect(s1).not.toBe(s0);
    expect(s1.tickCount).toBe(1);
  });
  it('applies a queued move', () => {
    const s0 = createDemoWorld();
    const start = s0.entities[s0.playerId].cell;
    const s1 = tick(s0, [{ type: 'move', dir: 'right' }], 50);
    expect(s1.entities[s1.playerId].cell.x).toBe(start.x + 1);
  });
  it('selectSkill switches the active slot and clamps to owned skills', () => {
    const s0 = createDemoWorld();
    s0.entities.p1.skills = [0, 1, 2].map(() => ({ ...s0.entities.p1.skills[0] })); // give the lone player a few slots
    expect(tick(s0, [{ type: 'selectSkill', slot: 2 }], 50).entities.p1.activeSkillIndex).toBe(2);
    expect(tick(s0, [{ type: 'selectSkill', slot: 20 }], 50).entities.p1.activeSkillIndex).toBe(0);
  });
  it('ignores player actions while dead (until respawn)', () => {
    const s0 = createDemoWorld();
    s0.entities[s0.playerId].hp = 0;
    const start = s0.entities[s0.playerId].cell;
    const s1 = tick(s0, [{ type: 'move', dir: 'right' }, { type: 'selectSkill', slot: 2 }], 50);
    expect(s1.entities[s1.playerId].cell).toEqual(start);
    expect(s1.entities[s1.playerId].activeSkillIndex).toBe(0);
  });
  it('stepping onto a portal tile travels to the linked map', () => {
    const s0 = createDemoWorld();
    const ex = s0.exits[0];
    const fromLeft = ex.cell.x <= 2; // portal near the west edge
    s0.entities[s0.playerId].cell = { x: ex.cell.x + (fromLeft ? 1 : -1), y: ex.cell.y };
    const s1 = tick(s0, [{ type: 'move', dir: fromLeft ? 'left' : 'right' }], 50);
    expect(s1.mapId).toBe(ex.toMap);
  });
  it('travelToMap quick-travels to a town and records discovery', () => {
    const s0 = createDemoWorld();
    const town = Object.values(MAPS).find((m) => m.biome === 'town' && m.id !== s0.mapId)!;
    const s1 = tick(s0, [{ type: 'travelToMap', mapId: town.id }], 50);
    expect(s1.mapId).toBe(town.id);
    expect(s1.discovered).toContain(town.id);
    expect(s0.discovered).not.toContain(town.id); // input state untouched (immutability boundary)
  });
  it('starts with only the start map discovered', () => {
    const s = createDemoWorld();
    expect(s.discovered).toEqual([START_MAP]);
  });
  it('respawn refreshes hp/mp and every skill (cooldowns cleared, uses topped up)', () => {
    const s0 = createDemoWorld();
    const p0 = s0.entities[s0.playerId];
    // Damage the player and put every skill into a "spent" runtime state.
    p0.hp = 1;
    p0.mp = 0;
    p0.skills = p0.skills.map((rt) => ({ ...rt, cooldownLeftMs: 5000, usesLeft: rt.usesLeft > 0 ? 0 : rt.usesLeft }));
    const s1 = tick(s0, [{ type: 'respawn' }], 50);
    const p1 = s1.entities[s1.playerId];
    expect(p1.hp).toBe(p1.stats.maxHp);
    expect(p1.mp).toBe(p1.stats.maxMp);
    for (const rt of p1.skills) {
      expect(rt.cooldownLeftMs).toBe(0);
      expect(rt.usesLeft).toBe(getSkill(rt.skillId).uses ?? -1); // full uses (or -1 = unlimited)
    }
  });
  it('death XP penalty: a level-12 player loses 20% of its level XP on respawn (clamped >=0)', () => {
    const s0 = createDemoWorld();
    const p0 = s0.entities[s0.playerId];
    p0.hp = 0;
    p0.level = 12;
    p0.xp = 1000;
    const s1 = tick(s0, [{ type: 'respawn' }], 50);
    expect(s1.entities[s1.playerId].xp).toBe(1000 - Math.round(0.2 * xpToNext(12)));
    // Clamped at 0: a small xp balance can't go negative.
    const s2 = createDemoWorld();
    const q = s2.entities[s2.playerId];
    q.hp = 0;
    q.level = 12;
    q.xp = 1;
    expect(tick(s2, [{ type: 'respawn' }], 50).entities[s2.playerId].xp).toBe(0);
  });
  it('death XP penalty: a level-<=10 player loses NO XP on respawn', () => {
    const s0 = createDemoWorld();
    const p0 = s0.entities[s0.playerId];
    p0.hp = 0;
    p0.level = 5;
    p0.xp = 300;
    expect(tick(s0, [{ type: 'respawn' }], 50).entities[s0.playerId].xp).toBe(300);
  });
  it('entering a portal while stuck in a combat group flees the fight (travels + drops the group)', () => {
    const s0 = createDemoWorld();
    const ex = s0.exits[0];
    const fromLeft = ex.cell.x <= 2; // portal near the west edge
    const dir = fromLeft ? 'left' : 'right';
    const player = s0.entities[s0.playerId];
    player.cell = { x: ex.cell.x + (fromLeft ? 1 : -1), y: ex.cell.y };
    // Force the player into a combat group with an enemy right next to the portal.
    const enemy = { ...player, id: 'e1', faction: 'enemy' as const, cell: { x: player.cell.x, y: player.cell.y + 1 } };
    s0.entities.e1 = enemy;
    s0.groups.g0 = { id: 'g0', memberIds: [player.id, 'e1'] };
    const s1 = tick(s0, [{ type: 'move', dir }], 50);
    expect(s1.mapId).toBe(ex.toMap); // traveled despite being grouped
    expect(Object.keys(s1.groups)).toHaveLength(0); // combat dropped (travelTo wipes groups)
  });
  it('createDemoWorld(name) names the player; no arg falls back to a random default name', () => {
    const named = createDemoWorld('Tessa');
    expect(named.entities[named.playerId].name).toBe('Tessa');
    const dflt = createDemoWorld();
    expect(CHARACTER_NAMES).toContain(dflt.entities[dflt.playerId].name);
  });
  it('demo world starts with a lone player (no allies) in the safe town', () => {
    const s = createDemoWorld();
    const facts = Object.values(s.entities).map((e) => e.faction);
    expect(facts.filter((f) => f === 'player').length).toBe(1);
    expect(facts.filter((f) => f === 'ally').length).toBe(0);
    expect(facts.filter((f) => f === 'enemy').length).toBe(0); // starting town is safe
  });
});
