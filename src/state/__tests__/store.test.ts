import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../store';
import { makeEntity } from '../../engine';
import { demoMap } from '../../data-map';
import { xpToNext } from '../../config';
import type { Entity, WorldState } from '../../types';

// Minimal known world (mirrors the combat test helper) so a level-up is deterministic.
function world(entities: Entity[]): WorldState {
  return {
    mapId: 'test',
    map: demoMap(10, 10),
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
    telegraphs: [],
  };
}

describe('game store', () => {
  beforeEach(() => useGame.getState().reset());
  it('starts on the dungeon scene with a demo world', () => {
    const st = useGame.getState();
    expect(st.scene).toBe('dungeon');
    expect(Object.keys(st.world.entities).length).toBeGreaterThan(0);
  });
  it('switches scenes', () => {
    useGame.getState().setScene('shop');
    expect(useGame.getState().scene).toBe('shop');
  });
  it('advance() drains the input queue into the engine', () => {
    const start = useGame.getState().world.entities.p1.cell.x;
    useGame.getState().enqueue({ type: 'move', dir: 'right' });
    useGame.getState().advance(50);
    expect(useGame.getState().world.entities.p1.cell.x).toBe(start + 1);
    expect(useGame.getState().inputQueue).toHaveLength(0);
  });
  it('opening a scene clears its highlight', () => {
    useGame.setState({ highlights: { skills: true } });
    useGame.getState().setScene('skills');
    expect(useGame.getState().highlights.skills).toBe(false);
  });
  it('flags the skills highlight when the player levels up during advance()', () => {
    const hero = makeEntity({ id: 'p1', faction: 'player', name: 'Hero', sprite: 'ranger', cell: { x: 3, y: 3 }, level: 20, jobId: 'beginner' });
    const rat = makeEntity({ id: 'e1', faction: 'enemy', name: 'Rat', sprite: 'slime', cell: { x: 4, y: 3 }, level: 20, jobId: 'beginner' });
    hero.xp = xpToNext(hero.level) - 1; // one XP short of leveling
    rat.hp = 1; // dies to the first hit, granting the XP that crosses the threshold
    useGame.setState({ world: world([hero, rat]), highlights: {} });
    useGame.getState().enqueue({ type: 'move', dir: 'right' }); // sticks the rat into a combat group
    useGame.getState().advance(1500); // kill fires -> XP -> level-up -> highlight
    expect(useGame.getState().world.entities.p1.level).toBeGreaterThan(20); // leveled up (xp tuning may grant >1)
    expect(useGame.getState().highlights.skills).toBe(true);
  });
});
