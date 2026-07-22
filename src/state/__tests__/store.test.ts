import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../store';
import { makeEntity } from '../../engine';
import { demoMap } from '../../data-map';
import { xpToNext, COMBAT_TICK_MS } from '../../config';
import { MAX_SLOTS, getActiveSlot } from '../persist';
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
    xpGains: [],
    telegraphs: [],
  };
}

// Runs before reset() is ever called, so it sees the true boot state.
describe('game store boot', () => {
  it('boots to the main menu with a demo world', () => {
    const st = useGame.getState();
    expect(st.scene).toBe('mainMenu');
    expect(Object.keys(st.world.entities).length).toBeGreaterThan(0);
  });
});

describe('game store', () => {
  beforeEach(() => useGame.getState().reset());
  it('reset() returns to the dungeon scene with a demo world', () => {
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
    // COMBAT_TICK_MS (2000) safely exceeds the hero's group-boosted cast interval
    // (base 2000 / 1.05 for one enemy), so exactly one cast fires and lands the kill.
    useGame.getState().advance(COMBAT_TICK_MS); // kill fires -> XP -> level-up -> highlight
    expect(useGame.getState().world.entities.p1.level).toBeGreaterThan(20); // leveled up (xp tuning may grant >1)
    expect(useGame.getState().highlights.skills).toBe(true);
  });
});

describe('game store — save slots', () => {
  beforeEach(() => {
    localStorage.clear(); // start each test with all slots empty and no active-slot key
  });

  it('firstEmptySlot returns the lowest empty slot', () => {
    expect(useGame.getState().firstEmptySlot()).toBe(0); // all empty -> lowest is 0
    useGame.getState().newGame(0); // fill slot 0
    expect(useGame.getState().firstEmptySlot()).toBe(1); // next lowest empty
    useGame.getState().newGame(2); // leave slot 1 empty, fill slot 2
    expect(useGame.getState().firstEmptySlot()).toBe(1); // still the lowest gap
  });

  it('firstEmptySlot returns null when every slot is full', () => {
    for (let slot = 0; slot < MAX_SLOTS; slot++) useGame.getState().newGame(slot);
    expect(useGame.getState().firstEmptySlot()).toBeNull();
  });

  it('newGame(slot) writes to that slot and makes it active', () => {
    useGame.getState().newGame(2);
    expect(getActiveSlot()).toBe(2); // targeted slot became active
    expect(useGame.getState().hasSave(2)).toBe(true); // ...and was saved into
    expect(useGame.getState().hasSave(0)).toBe(false); // other slots untouched
    expect(useGame.getState().listSlots()[2]).not.toBeNull(); // slot 2 populated
  });

  it('newGame() (no arg) defaults to the active slot', () => {
    useGame.getState().newGame(3); // make slot 3 active
    expect(getActiveSlot()).toBe(3);
    useGame.getState().newGame(); // no arg -> active slot (3)
    expect(getActiveSlot()).toBe(3);
    expect(useGame.getState().hasSave(3)).toBe(true);
    expect(useGame.getState().hasSave(0)).toBe(false);
  });
});
