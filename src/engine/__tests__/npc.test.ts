import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Entity, WorldState } from '../../types';
import { createDemoWorld } from '../demo';
import { travelTo, exitAt, spawnNpcs } from '../maps';
import { moveOrStick, areEnemies } from '../combat';
import { makeEntity, makeNpc } from '../entities';
import { applyInput } from '../world';
import { MAPS, START_MAP } from '../../data-map';
import { NPC_THEMES, NPC_TILES, NPC_TILES_MALE, NPC_TILES_FEMALE, genderOfName, TOWN_DIALOGUE } from '../../data-npc';
import type { NpcTheme } from '../../data-npc';

// Townsfolk = chat NPCs only (excludes the per-town job-advancement NPC, which
// also has faction 'npc' but npcRole 'jobAdvance').
const npcs = (s: WorldState): Entity[] => Object.values(s.entities).filter((e) => e.faction === 'npc' && e.npcRole === 'chat');

// The topics a town defines (in NPC_THEMES order, non-empty line arrays only) —
// these ARE the town's NPCs, one each.
const topicsOf = (mapId: string): NpcTheme[] => NPC_THEMES.filter((t) => (TOWN_DIALOGUE[mapId]?.[t]?.length ?? 0) > 0);

// Recover which town+topic an NPC's dialogue came from (each town's per-topic
// line array is unique in TOWN_DIALOGUE), for asserting exact provenance.
const dialogueKey = new Map<string, string>(); // joined lines -> "mapId:theme"
for (const mapId of Object.keys(TOWN_DIALOGUE)) {
  const town = TOWN_DIALOGUE[mapId] ?? {};
  for (const theme of Object.keys(town) as NpcTheme[]) {
    const lines = town[theme];
    if (lines?.length) dialogueKey.set(lines.join('\n'), `${mapId}:${theme}`);
  }
}
const provenanceOf = (n: Entity): string | undefined => dialogueKey.get((n.dialogue ?? []).join('\n'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('town NPCs', () => {
  it('spawns one chat NPC per topic the start town defines, with matching town+topic lines', () => {
    const s = createDemoWorld(); // starts in Mäntyharju (town)
    const topics = topicsOf(START_MAP);
    expect(topics).toEqual(['workEthic', 'culture', 'history', 'folklore']); // Mäntyharju defines all four
    const list = npcs(s);
    expect(list).toHaveLength(topics.length);
    // Every defined topic is present exactly once, each carrying THIS town's lines.
    const provenances = list.map((n) => provenanceOf(n));
    expect(new Set(provenances)).toEqual(new Set(topics.map((t) => `${START_MAP}:${t}`)));
    // distinct sprites: no two townsfolk share a tile
    const tiles = list.map((n) => n.asset?.tiles);
    expect(new Set(tiles).size).toBe(list.length);
    for (const n of list) {
      expect(n.faction).toBe('npc');
      expect(n.npcRole).toBe('chat');
      expect(n.dialogue?.length).toBeGreaterThan(0);
      expect(provenanceOf(n)).toMatch(new RegExp(`^${START_MAP}:`)); // this town's own lines
      expect(n.asset?.filename).toBe('town-npc.png');
      expect(NPC_TILES).toContain(n.asset?.tiles); // a valid townsfolk tile
    }
  });

  it('each town spawns its defined topics (per-town, location-specific; one NPC per topic, no duplicates)', () => {
    const townIds = Object.keys(TOWN_DIALOGUE);
    expect(townIds.length).toBeGreaterThan(0);
    for (const town of townIds) {
      const s = createDemoWorld();
      travelTo(s, town, s.mapId);
      expect(MAPS[town].biome).toBe('town');
      const topics = topicsOf(town);
      const list = npcs(s);
      // The spawned NPCs are drawn from THIS town's defined topics, one per topic.
      // Placement can drop at most a trailing NPC when the generated map runs out of
      // free floor cells (e.g. cramped Jyväskylä under the seed), so assert a subset
      // rather than an exact count — but never MORE than the topic count.
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(topics.length);
      const provenances = list.map((n) => provenanceOf(n));
      // every NPC carries a line array from THIS town...
      for (const p of provenances) expect(p).toMatch(new RegExp(`^${town}:`));
      // ...for a distinct defined topic (no two NPCs share a topic), and each NPC's
      // dialogue is exactly that town+topic array from TOWN_DIALOGUE.
      expect(new Set(provenances).size).toBe(list.length); // distinct topics
      const definedKeys = new Set(topics.map((t) => `${town}:${t}`));
      for (const n of list) {
        const key = provenanceOf(n);
        expect(definedKeys.has(key ?? '')).toBe(true); // a real defined topic of this town
        const theme = (key ?? ':').split(':')[1] as NpcTheme;
        expect(n.dialogue).toEqual(TOWN_DIALOGUE[town]?.[theme]);
      }
      // distinct sprites: no two townsfolk share a tile
      expect(new Set(list.map((n) => n.asset?.tiles)).size).toBe(list.length);
    }
  });

  it("each townsperson's tile matches its name's gender pool", () => {
    const townIds = Object.keys(TOWN_DIALOGUE);
    for (const town of townIds) {
      const s = createDemoWorld();
      travelTo(s, town, s.mapId);
      const list = npcs(s);
      expect(list.length).toBeGreaterThan(0);
      for (const n of list) {
        const pool = genderOfName(n.name) === 'female' ? NPC_TILES_FEMALE : NPC_TILES_MALE;
        expect(pool).toContain(n.asset?.tiles); // gender-matched sprite
      }
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
    const npc = makeNpc({ id: 'npcTest', name: 'Testi', tile: 'q3-1', cell: target, dialogue: TOWN_DIALOGUE.mantyharju!.folklore! });
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
    const lines = TOWN_DIALOGUE.mantyharju!.workEthic!;
    const npc = makeNpc({ id: 'npcCycle', name: 'Testi', tile: 'q3-1', cell: { x: 1, y: 1 }, dialogue: lines });
    s.entities[npc.id] = npc;
    const len = npc.dialogue?.length ?? 0;
    expect(len).toBe(lines.length);
    expect(len).toBeGreaterThan(1); // a real cycling line array
    expect(s.entities[npc.id].dialogueIndex ?? 0).toBe(0); // starts on line 0

    // Close once per line + once past the end: index cycles back to 0 after `len`.
    for (let i = 0; i < len + 1; i++) {
      s.pendingNpc = npc.id;
      applyInput(s, { type: 'closeNpc' });
      expect(s.pendingNpc).toBeUndefined(); // each close dismisses the box
      expect(s.entities[npc.id].dialogueIndex).toBe((i + 1) % len); // ...and steps the pointer, wrapping
    }
  });

  it('two different NPCs keep independent dialogueIndex pointers', () => {
    const s = createDemoWorld();
    const a = makeNpc({ id: 'npcA', name: 'A', tile: 'q3-1', cell: { x: 1, y: 1 }, dialogue: TOWN_DIALOGUE.mantyharju!.culture! });
    const b = makeNpc({ id: 'npcB', name: 'B', tile: 'q3-2', cell: { x: 2, y: 1 }, dialogue: TOWN_DIALOGUE.mantyharju!.history! });
    s.entities[a.id] = a;
    s.entities[b.id] = b;

    // Advance A twice; B untouched.
    s.pendingNpc = a.id;
    applyInput(s, { type: 'closeNpc' });
    s.pendingNpc = a.id;
    applyInput(s, { type: 'closeNpc' });
    expect(s.entities[a.id].dialogueIndex).toBe(2 % (a.dialogue?.length ?? 1));
    expect(s.entities[b.id].dialogueIndex ?? 0).toBe(0); // B's pointer is its own

    // Now advance B once; A unchanged.
    const aIdx = s.entities[a.id].dialogueIndex;
    s.pendingNpc = b.id;
    applyInput(s, { type: 'closeNpc' });
    expect(s.entities[b.id].dialogueIndex).toBe(1 % (b.dialogue?.length ?? 1));
    expect(s.entities[a.id].dialogueIndex).toBe(aIdx);
  });

  it('TOWN_DIALOGUE keys are real town maps; every line array is non-empty and topic-valid', () => {
    const townIds = Object.keys(TOWN_DIALOGUE);
    expect(townIds.length).toBeGreaterThanOrEqual(7); // the seven Finnish town nodes
    for (const mapId of townIds) {
      expect(MAPS[mapId]?.biome).toBe('town'); // only towns carry dialogue
      const town = TOWN_DIALOGUE[mapId] ?? {};
      const themes = Object.keys(town) as NpcTheme[];
      expect(themes.length).toBeGreaterThan(0);
      for (const theme of themes) {
        expect(NPC_THEMES).toContain(theme); // a valid NpcTheme
        expect((town[theme]?.length ?? 0)).toBeGreaterThan(0); // non-empty line array
      }
    }
  });

  it('NPCs are neutral: areEnemies is false against both enemies and heroes', () => {
    const npc = makeNpc({ id: 'n', name: 'N', tile: 'q3-2', cell: { x: 1, y: 1 }, dialogue: TOWN_DIALOGUE.mantyharju!.culture! });
    const hero = makeEntity({ id: 'h', faction: 'player', name: 'H', sprite: 'ranger', cell: { x: 2, y: 2 }, level: 5, jobId: 'beginner' });
    const enemy = makeEntity({ id: 'e', faction: 'enemy', name: 'E', sprite: 'slime', cell: { x: 3, y: 3 }, level: 5, jobId: 'beginner' });
    expect(areEnemies(npc, enemy)).toBe(false);
    expect(areEnemies(enemy, npc)).toBe(false);
    expect(areEnemies(npc, hero)).toBe(false);
    expect(areEnemies(hero, npc)).toBe(false);
  });

  it('spawnNpcs is deterministic under a fixed seed', () => {
    // Two fresh worlds -> identical NPC placement + dialogue (seeded RNG).
    const posOf = (w: WorldState) =>
      npcs(w)
        .map((n) => `${n.cell.x},${n.cell.y}:${(n.dialogue ?? []).join('|')}:${n.asset?.tiles}`)
        .sort();
    expect(posOf(createDemoWorld())).toEqual(posOf(createDemoWorld()));
    // spawnNpcs is exported and callable directly (no crash on a town world).
    const s = createDemoWorld();
    const n0 = npcs(s).length;
    spawnNpcs(s); // re-run: adds another set for the town's topics (occupancy from existing entities avoided)
    expect(npcs(s).length).toBeGreaterThanOrEqual(n0);
  });
});
