import { beforeEach, describe, expect, it } from 'vitest';
import type { WorldState } from '../../types';
import { createDemoWorld } from '../../engine';
import { SAVE_VERSION, deleteSlot, exportSlot, getActiveSlot, hasSave, importJson, listSlots, loadSlotRaw, saveSlot, setActiveSlot } from '../persist';

// A world whose transient fields carry data, so we can assert they're stripped on save.
function dirtyWorld(): WorldState {
  const w = createDemoWorld();
  w.hits = [{ cell: { x: 1, y: 1 }, kind: 'damage', amount: 5 }];
  w.xpGains = [10];
  w.telegraphs = [
    {
      tiles: [{ x: 2, y: 2 }],
      remainingMs: 500,
      totalMs: 800,
      from: { x: 1, y: 1 },
      hitsEnemies: false,
      accuracy: 1,
      minDmg: 1,
      maxDmg: 2,
      power: 1,
      crit: 0,
      critDmg: 0,
      mag: 1,
    },
  ];
  return w;
}

function player(w: WorldState) {
  return w.entities[w.playerId];
}

// Compact, comparable view of a player's persistent identity.
function playerSnapshot(w: WorldState) {
  const p = player(w);
  return {
    name: p.name,
    level: p.level,
    xp: p.xp,
    jobId: p.jobId,
    primaries: p.primaries,
    skills: p.skills.map((s) => ({ skillId: s.skillId, level: s.level })),
  };
}

describe('persist', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips the player identity through save -> loadSlotRaw', () => {
    const w = createDemoWorld();
    // Mutate the player so we're testing real values, not just defaults.
    const p = player(w);
    p.level = 7;
    p.xp = 42;
    p.primaries = { str: 5, dex: 6, int: 7, vit: 8 };
    const before = playerSnapshot(w);

    saveSlot(0, w);
    const loaded = loadSlotRaw(0);
    expect(loaded).not.toBeNull();
    expect(playerSnapshot(loaded as WorldState)).toEqual(before);
  });

  it('strips transient hits/xpGains/telegraphs on save', () => {
    saveSlot(0, dirtyWorld());
    const loaded = loadSlotRaw(0) as WorldState;
    expect(loaded.hits).toEqual([]);
    expect(loaded.xpGains).toEqual([]);
    expect(loaded.telegraphs).toEqual([]);
  });

  it('isolates slots: saving slot 1 leaves slot 0 untouched', () => {
    const w0 = createDemoWorld();
    player(w0).level = 3;
    saveSlot(0, w0);

    const w1 = createDemoWorld();
    player(w1).level = 9;
    saveSlot(1, w1);

    expect(player(loadSlotRaw(0) as WorldState).level).toBe(3);
    expect(player(loadSlotRaw(1) as WorldState).level).toBe(9);
  });

  it('returns null for a version mismatch (no throw)', () => {
    const w = createDemoWorld();
    const wrong = { version: SAVE_VERSION + 1, savedAt: Date.now(), world: w };
    localStorage.setItem('tam:save:0', JSON.stringify(wrong));
    expect(loadSlotRaw(0)).toBeNull();
  });

  it('returns null for malformed JSON (no throw)', () => {
    localStorage.setItem('tam:save:0', '{ not valid json');
    expect(() => loadSlotRaw(0)).not.toThrow();
    expect(loadSlotRaw(0)).toBeNull();
  });

  it('importJson returns null on malformed or shapeless input', () => {
    expect(importJson('not json at all')).toBeNull();
    expect(importJson(JSON.stringify({ version: SAVE_VERSION, savedAt: 1, world: {} }))).toBeNull();
    expect(importJson(JSON.stringify({ hello: 'world' }))).toBeNull();
  });

  it('round-trips through export -> import', () => {
    const w = createDemoWorld();
    player(w).level = 12;
    const before = playerSnapshot(w);

    saveSlot(0, w);
    const json = exportSlot(0);
    expect(json).not.toBeNull();

    const imported = importJson(json as string);
    expect(imported).not.toBeNull();
    expect(playerSnapshot(imported as WorldState)).toEqual(before);
  });

  it('listSlots reflects populated vs empty slots (length MAX_SLOTS)', () => {
    saveSlot(0, createDemoWorld());
    const list = listSlots();
    expect(list).toHaveLength(4);
    expect(list[0]).not.toBeNull();
    expect(list[1]).toBeNull();
    expect(list[2]).toBeNull();
    expect(list[3]).toBeNull();
    expect(list[0]?.slot).toBe(0);
  });

  it('deleteSlot clears a slot', () => {
    saveSlot(2, createDemoWorld());
    expect(hasSave(2)).toBe(true);
    deleteSlot(2);
    expect(hasSave(2)).toBe(false);
    expect(loadSlotRaw(2)).toBeNull();
  });

  it('getActiveSlot defaults to 0 and round-trips setActiveSlot', () => {
    expect(getActiveSlot()).toBe(0);
    setActiveSlot(2);
    expect(getActiveSlot()).toBe(2);
  });
});
