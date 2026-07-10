import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Entity, WorldState } from '../../types';
import { createDemoWorld } from '../demo';
import { travelTo, exitAt, spawnNpcs } from '../maps';
import { moveOrStick, areEnemies } from '../combat';
import { makeEntity, makeNpc } from '../entities';
import { applyInput } from '../world';
import { MAPS, START_MAP } from '../../data-map';
import { MAX_TOWN_NPCS, NPC_DIALOGUE } from '../../data-npc';

const npcs = (s: WorldState): Entity[] => Object.values(s.entities).filter((e) => e.faction === 'npc');

// Set of the exact dialogue-line arrays, to recover which theme an NPC carries.
const dialogueSets = Object.values(NPC_DIALOGUE).map((lines) => lines.join('\n'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('town NPCs', () => {
  it('spawns 4 distinct-theme npc entities on entering a town (npcCount: 4)', () => {
    const s = createDemoWorld(); // starts in Mäntyharju (town, npcCount 4)
    expect(MAPS[START_MAP].gen.npcCount).toBe(4);
    const list = npcs(s);
    expect(list).toHaveLength(4);
    // distinct themes: each carries a different one of the 4 dialogue sets
    const themes = new Set(list.map((n) => (n.dialogue ?? []).join('\n')));
    expect(themes.size).toBe(4);
    for (const n of list) {
      expect(n.faction).toBe('npc');
      expect(n.dialogue).toHaveLength(3); // three themed lines
      expect(dialogueSets).toContain((n.dialogue ?? []).join('\n')); // a real theme
      expect(n.asset?.filename).toBe('town-npc.png');
      expect(n.asset?.tiles).toMatch(/^q3-[1-8]$/); // a quadrant-3 tile
    }
  });

  it('respects a per-town npcCount of 2 (deterministic distinct themes under the seed)', () => {
    const orig = MAPS[START_MAP].gen.npcCount;
    MAPS[START_MAP].gen.npcCount = 2;
    try {
      // createDemoWorld() runs travelTo(START_MAP) internally, so both worlds are
      // built entirely under count=2 and share the seed -> identical NPC choices.
      const a = createDemoWorld();
      const b = createDemoWorld();
      const list = npcs(a);
      expect(list).toHaveLength(2);
      const themes = new Set(list.map((n) => (n.dialogue ?? []).join('\n')));
      expect(themes.size).toBe(2); // distinct themes
      const themesOf = (w: WorldState) =>
        npcs(w)
          .map((n) => (n.dialogue ?? []).join('\n'))
          .sort();
      expect(themesOf(a)).toEqual(themesOf(b)); // deterministic under the seed
    } finally {
      MAPS[START_MAP].gen.npcCount = orig;
    }
  });

  it('warns and caps to MAX_TOWN_NPCS when a town is over-configured (npcCount: 6)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = createDemoWorld();
    const orig = MAPS[START_MAP].gen.npcCount;
    MAPS[START_MAP].gen.npcCount = 6;
    try {
      travelTo(s, START_MAP);
      expect(npcs(s).length).toBe(MAX_TOWN_NPCS); // capped to 4
      expect(warn).toHaveBeenCalled();
    } finally {
      MAPS[START_MAP].gen.npcCount = orig;
    }
  });

  it('spawns 0 NPCs on a non-town (field) map', () => {
    const s = createDemoWorld();
    const field = s.exits[0].toMap; // first field map out of the start town
    travelTo(s, field, s.mapId);
    expect(MAPS[field].biome).not.toBe('town');
    expect(npcs(s)).toHaveLength(0);
  });

  it('places NPCs on floor tiles, never on a portal/exit cell', () => {
    const s = createDemoWorld();
    for (const n of npcs(s)) {
      // on floor (not a wall)
      const t = s.map.tiles[n.cell.y * s.map.width + n.cell.x];
      expect(t).toBe('floor');
      // not on any generated portal tile
      expect(exitAt(s, n.cell)).toBeUndefined();
    }
    expect(npcs(s).length).toBeGreaterThan(0);
  });

  it('walking into an NPC opens its dialog (pendingNpc) without moving onto it; closeNpc clears it', () => {
    const s = createDemoWorld();
    const player = s.entities[s.playerId];
    // Place an NPC directly to the player's right and walk into it.
    const target = { x: player.cell.x + 1, y: player.cell.y };
    const npc = makeNpc({ id: 'npcTest', name: 'Testi', tile: 'q3-1', cell: target, dialogue: NPC_DIALOGUE.folklore });
    s.entities[npc.id] = npc;
    const before = { ...player.cell };
    moveOrStick(s, s.playerId, 'right');
    expect(s.pendingNpc).toBe(npc.id);
    expect(s.entities[s.playerId].cell).toEqual(before); // did not step onto the NPC
    expect(s.entities[s.playerId].facing).toBe('right'); // faces the NPC
    applyInput(s, { type: 'closeNpc' });
    expect(s.pendingNpc).toBeUndefined();
  });

  it('NPCs are neutral: areEnemies is false against both enemies and heroes', () => {
    const npc = makeNpc({ id: 'n', name: 'N', tile: 'q3-2', cell: { x: 1, y: 1 }, dialogue: NPC_DIALOGUE.culture });
    const hero = makeEntity({ id: 'h', faction: 'player', name: 'H', sprite: 'ranger', cell: { x: 2, y: 2 }, level: 5, jobId: 'beginner' });
    const enemy = makeEntity({ id: 'e', faction: 'enemy', name: 'E', sprite: 'slime', cell: { x: 3, y: 3 }, level: 5, jobId: 'beginner' });
    expect(areEnemies(npc, enemy)).toBe(false);
    expect(areEnemies(enemy, npc)).toBe(false);
    expect(areEnemies(npc, hero)).toBe(false);
    expect(areEnemies(hero, npc)).toBe(false);
  });

  it('spawnNpcs is a no-op call-count consistent under a fixed seed', () => {
    // Two fresh worlds -> identical NPC placement (seeded RNG).
    const posOf = (w: WorldState) =>
      npcs(w)
        .map((n) => `${n.cell.x},${n.cell.y}:${(n.dialogue ?? []).join('|')}:${n.asset?.tiles}`)
        .sort();
    expect(posOf(createDemoWorld())).toEqual(posOf(createDemoWorld()));
    // spawnNpcs is exported and callable directly (no crash on a town world).
    const s = createDemoWorld();
    const n0 = npcs(s).length;
    spawnNpcs(s); // re-run: adds up to the cap again (occupancy from existing entities avoided)
    expect(npcs(s).length).toBeGreaterThanOrEqual(n0);
  });
});
