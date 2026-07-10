// ============================================================================
// Town NPCs — non-combatant townsfolk that spawn in towns and can be talked to.
// On town entry spawnNpcs (engine/maps.ts) places up to MAX_TOWN_NPCS of them,
// one per distinct theme, each carrying that theme's Finnish dialogue lines.
// Art comes from town-npc.png quadrant 3 (tiles q3-1..q3-8). All data is plain
// + serializable so it threads through the pure engine.
// ============================================================================

export type NpcTheme = 'workEthic' | 'culture' | 'history' | 'folklore';
export const NPC_THEMES: NpcTheme[] = ['workEthic', 'culture', 'history', 'folklore'];

export const MAX_TOWN_NPCS = 4; // hard cap on townsfolk per town (one per theme)
export const NPC_ASSET_FILE = 'town-npc.png'; // shared townsfolk spritesheet
export const NPC_TILES = ['q3-1', 'q3-2', 'q3-3', 'q3-4', 'q3-5', 'q3-6', 'q3-7', 'q3-8']; // quadrant-3 single-tile portraits

// Finnish townsfolk name pool (seeded pick per NPC).
export const NPC_NAMES: string[] = [
  'Aatos',
  'Onni',
  'Helmi',
  'Väinö',
  'Sisko',
  'Urho',
  'Kerttu',
  'Toivo',
  'Elias',
  'Saima',
  'Reijo',
  'Impi',
  'Eino',
  'Aili',
  'Veikko',
  'Hilja',
];

// Three lines per theme (user tunes later); shown one at a time in the dialog box.
export const NPC_DIALOGUE: Record<NpcTheme, string[]> = {
  workEthic: [
    "Work first, talk later — that's how it's always been here. Sisu carries the rest.",
    'My grandfather cleared this land stump by stump. Complaining never felled a single tree.',
    'A job half-done sits heavier than a full sack of rye. Best finish what you start.',
  ],
  culture: [
    'Fix the sauna before you fix your words — a good löyly settles most quarrels.',
    "We don't say much, and we mean all of it. Silence between friends is comfortable here.",
    "There's always room for more coffee. Sit, drink, and don't rush your leaving.",
  ],
  history: [
    "You should've seen the spring flood last month — took the old mill wheel clean down the river.",
    'The market square was rebuilt only this summer, after the great storm cracked the old well.',
    "New folk keep arriving since the road opened. The town's near twice the size it was a year ago.",
  ],
  folklore: [
    "Don't whistle in the forest after dark — the Hiisi hear it, and they answer.",
    'Leave a coin at the old spruce for the haltija, and your cellar will never run dry.',
    "They say Väinämöinen's song still hums in the deep woods, if the wind sits right.",
  ],
};
