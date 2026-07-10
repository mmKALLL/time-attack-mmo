import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Entity, WorldState } from '../../types';
import { createDemoWorld } from '../demo';
import { travelTo, exitAt, spawnNpcs } from '../maps';
import { moveOrStick, areEnemies } from '../combat';
import { makeEntity, makeNpc } from '../entities';
import { applyInput } from '../world';
import { MAPS, START_MAP } from '../../data-map';
import { MAX_TOWN_NPCS, NPC_DIALOGUE, NPC_TILES } from '../../data-npc';
import type { NpcTheme } from '../../data-npc';

// Townsfolk = chat NPCs only (excludes the per-town job-advancement NPC, which
// also has faction 'npc' but npcRole 'jobAdvance').
const npcs = (s: WorldState): Entity[] => Object.values(s.entities).filter((e) => e.faction === 'npc' && e.npcRole === 'chat');

// Each NPC now carries ONE triplet drawn from its theme's pool. Map a joined
// triplet back to the theme it came from (each triplet is unique to one theme).
const tripletToTheme = new Map<string, NpcTheme>();
for (const theme of Object.keys(NPC_DIALOGUE) as NpcTheme[]) {
  for (const triplet of NPC_DIALOGUE[theme]) tripletToTheme.set(triplet.join('\n'), theme);
}
// The theme an NPC belongs to, recovered from its assigned triplet.
const themeOf = (n: Entity): NpcTheme | undefined => tripletToTheme.get((n.dialogue ?? []).join('\n'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('town NPCs', () => {
  it('spawns 4 distinct-theme npc entities on entering a town (npcCount: 4)', () => {
    const s = createDemoWorld(); // starts in Mäntyharju (town, npcCount 4)
    expect(MAPS[START_MAP].gen.npcCount).toBe(4);
    const list = npcs(s);
    expect(list).toHaveLength(4);
    // distinct themes: each NPC's triplet resolves to a different one of the 4 themes
    const themes = new Set(list.map((n) => themeOf(n)));
    expect(themes.size).toBe(4);
    // distinct sprites: no two townsfolk share a tile
    const tiles = list.map((n) => n.asset?.tiles);
    expect(new Set(tiles).size).toBe(list.length);
    for (const n of list) {
      expect(n.faction).toBe('npc');
      expect(n.dialogue).toHaveLength(3); // one triplet = three related lines
      expect(themeOf(n)).toBeDefined(); // a real triplet from a real theme
      expect(n.asset?.filename).toBe('town-npc.png');
      expect(NPC_TILES).toContain(n.asset?.tiles); // a valid townsfolk tile
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
      const themes = new Set(list.map((n) => themeOf(n)));
      expect(themes.size).toBe(2); // distinct themes
      // deterministic under the seed: same triplets picked in both worlds
      const dialoguesOf = (w: WorldState) =>
        npcs(w)
          .map((n) => (n.dialogue ?? []).join('\n'))
          .sort();
      expect(dialoguesOf(a)).toEqual(dialoguesOf(b)); // deterministic under the seed
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
    const npc = makeNpc({ id: 'npcTest', name: 'Testi', tile: 'q3-1', cell: target, dialogue: NPC_DIALOGUE.folklore[0] });
    s.entities[npc.id] = npc;
    const before = { ...player.cell };
    moveOrStick(s, s.playerId, 'right');
    expect(s.pendingNpc).toBe(npc.id);
    expect(s.entities[s.playerId].cell).toEqual(before); // did not step onto the NPC
    expect(s.entities[s.playerId].facing).toBe('right'); // faces the NPC
    applyInput(s, { type: 'closeNpc' });
    expect(s.pendingNpc).toBeUndefined();
  });

  it('closeNpc advances the bumped NPC dialogueIndex (mod length) and clears pendingNpc', () => {
    const s = createDemoWorld();
    const npc = makeNpc({ id: 'npcCycle', name: 'Testi', tile: 'q3-1', cell: { x: 1, y: 1 }, dialogue: NPC_DIALOGUE.folklore[0] });
    s.entities[npc.id] = npc;
    const len = npc.dialogue?.length ?? 0;
    expect(len).toBe(3);
    expect(s.entities[npc.id].dialogueIndex ?? 0).toBe(0); // starts on line 0

    // Close once per line + once past the end: index cycles 0->1->2->0.
    for (let i = 0; i < len + 1; i++) {
      s.pendingNpc = npc.id;
      applyInput(s, { type: 'closeNpc' });
      expect(s.pendingNpc).toBeUndefined(); // each close dismisses the box
      expect(s.entities[npc.id].dialogueIndex).toBe((i + 1) % len); // ...and steps the pointer, wrapping
    }
  });

  it('two different NPCs keep independent dialogueIndex pointers', () => {
    const s = createDemoWorld();
    const a = makeNpc({ id: 'npcA', name: 'A', tile: 'q3-1', cell: { x: 1, y: 1 }, dialogue: NPC_DIALOGUE.culture[0] });
    const b = makeNpc({ id: 'npcB', name: 'B', tile: 'q3-2', cell: { x: 2, y: 1 }, dialogue: NPC_DIALOGUE.history[0] });
    s.entities[a.id] = a;
    s.entities[b.id] = b;

    // Advance A twice; B untouched.
    s.pendingNpc = a.id;
    applyInput(s, { type: 'closeNpc' });
    s.pendingNpc = a.id;
    applyInput(s, { type: 'closeNpc' });
    expect(s.entities[a.id].dialogueIndex).toBe(2);
    expect(s.entities[b.id].dialogueIndex ?? 0).toBe(0); // B's pointer is its own

    // Now advance B once; A unchanged.
    s.pendingNpc = b.id;
    applyInput(s, { type: 'closeNpc' });
    expect(s.entities[b.id].dialogueIndex).toBe(1);
    expect(s.entities[a.id].dialogueIndex).toBe(2);
  });

  it('NPC_DIALOGUE holds several triplets per theme, each exactly 3 lines', () => {
    for (const theme of Object.keys(NPC_DIALOGUE) as (keyof typeof NPC_DIALOGUE)[]) {
      const triplets = NPC_DIALOGUE[theme];
      expect(triplets.length).toBeGreaterThanOrEqual(5); // "several" triplets to draw from
      for (const triplet of triplets) expect(triplet).toHaveLength(3); // each is exactly 3 lines
    }
  });

  it('NPCs are neutral: areEnemies is false against both enemies and heroes', () => {
    const npc = makeNpc({ id: 'n', name: 'N', tile: 'q3-2', cell: { x: 1, y: 1 }, dialogue: NPC_DIALOGUE.culture[0] });
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
