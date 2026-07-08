import { describe, it, expect } from 'vitest';
import { tick } from '../world';
import { createDemoWorld } from '../demo';

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
  it('demo world has a lone player (no allies) and enemies', () => {
    const s = createDemoWorld();
    const facts = Object.values(s.entities).map((e) => e.faction);
    expect(facts.filter((f) => f === 'player').length).toBe(1);
    expect(facts.filter((f) => f === 'ally').length).toBe(0);
    expect(facts.filter((f) => f === 'enemy').length).toBeGreaterThan(0);
  });
});
