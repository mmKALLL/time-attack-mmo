import type { JobNode, Skill, TileKind, TileMap } from './types';

// ============================================================================
// Shape presets — cells hit relative to the caster (see design §4b conventions)
// ============================================================================
const P = {
  point: [{ dx: 1, dy: 0 }],
  adj4: [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }],
  adj8: [
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
    { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
  ],
  row3: [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }], // straight line (archer)
  line4: [{ dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 3, dy: 0 }, { dx: 4, dy: 0 }],
  block2x2: [{ dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }],
  cone: [
    { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 1, dy: -1 }, { dx: 1, dy: 1 },
    { dx: 2, dy: -1 }, { dx: 2, dy: 1 }, { dx: 3, dy: 0 },
  ],
} as const;

// ============================================================================
// Skills — names & roles from the handoff; mechanics are tunable placeholders.
// ============================================================================
type SkillOpts = Partial<Omit<Skill, 'id' | 'name' | 'shape' | 'power'>>;
function mk(id: string, name: string, shape: readonly { dx: number; dy: number }[], power: number, opts: SkillOpts = {}): Skill {
  return {
    id,
    name,
    shape: shape.map((o) => ({ ...o })),
    power,
    cooldownMs: 0,
    cooldownType: 'passive',
    ...opts,
  };
}

export const SKILLS: Record<string, Skill> = {
  // Beginner / generic
  strike: mk('strike', 'Strike', P.adj4, 1.0, { category: 'adjacent' }),

  // --- Swordsman → Knight (Tank) ---
  aegisBastion: mk('aegisBastion', 'Aegis Bastion', P.adj4, 0.6, { category: 'adjacent', cooldownMs: 6000, cooldownType: 'active' }),
  undyingProvocation: mk('undyingProvocation', 'Undying Provocation', P.adj8, 0.5, { category: 'area', uses: 2, cooldownMs: 5000 }),
  earthshatterBash: mk('earthshatterBash', 'Earthshatter Bash', P.adj4, 1.3, { category: 'adjacent', appliesStatus: { kind: 'stun', potency: 1, rounds: 1 }, cooldownMs: 4000 }),
  // --- Swordsman → Paladin (Healer) ---
  radiantSmite: mk('radiantSmite', 'Radiant Smite', P.point, 1.2, { category: 'point' }),
  handOfDawn: mk('handOfDawn', 'Hand of Dawn', [{ dx: 0, dy: 0 }], 0, { healing: 220, targetsAllies: true, category: 'point', triggerMs: 2000 }),
  hallowedGround: mk('hallowedGround', 'Hallowed Ground', P.adj8, 0, { healing: 90, targetsAllies: true, category: 'area', cooldownMs: 8000, cooldownType: 'active' }),
  // --- Swordsman → Duelist (DPS) ---
  mirrorRiposte: mk('mirrorRiposte', 'Mirror Riposte', P.point, 1.5, { category: 'point' }),
  vipersLunge: mk('vipersLunge', "Viper's Lunge", P.line4, 1.1, { category: 'line', appliesStatus: { kind: 'poison', potency: 0.06, rounds: 3 } }),
  crimsonDisarm: mk('crimsonDisarm', 'Crimson Disarm', P.point, 0.9, { category: 'point', appliesStatus: { kind: 'atkDown', potency: 0.2, rounds: 2 }, cooldownMs: 3000 }),

  // --- Archer → Hunter (DPS, fast/high-miss) ---
  tempestVolley: mk('tempestVolley', 'Tempest Volley', P.row3, 0.8, { category: 'line', triggerMs: 1000, accuracy: 0.75 }),
  hobblingShot: mk('hobblingShot', 'Hobbling Shot', P.line4, 0.7, { category: 'line', appliesStatus: { kind: 'slow', potency: 1, rounds: 2 }, accuracy: 0.8 }),
  relentlessBarrage: mk('relentlessBarrage', 'Relentless Barrage', P.line4, 0.6, { category: 'line', uses: 4, cooldownMs: 3000, triggerMs: 750, accuracy: 0.7 }),
  // --- Archer → Sniper (DPS, slow/accurate crit) ---
  deadeyeMark: mk('deadeyeMark', 'Deadeye Mark', P.line4, 1.0, { category: 'line', triggerMs: 2000, accuracy: 1, critChance: 0.4 }),
  heavenPiercer: mk('heavenPiercer', 'Heaven-Piercer', P.line4, 1.8, { category: 'line', triggerMs: 2250, accuracy: 1, critChance: 0.5, cooldownMs: 3000 }),
  killshot: mk('killshot', 'Killshot', P.point, 2.6, { category: 'point', uses: 1, cooldownMs: 7000, cooldownType: 'active', accuracy: 1, critChance: 0.6 }),
  // --- Archer → Ranger (Support) ---
  wardOfTheWild: mk('wardOfTheWild', 'Ward of the Wild', [{ dx: 0, dy: 0 }], 0, { healing: 60, targetsAllies: true, appliesStatus: { kind: 'atkUp', potency: 0.15, rounds: 3 }, cooldownMs: 6000, cooldownType: 'active' }),
  quarrysMark: mk('quarrysMark', "Quarry's Mark", P.point, 0.5, { category: 'point', appliesStatus: { kind: 'defDown', potency: 0.25, rounds: 3 } }),
  graspingThorns: mk('graspingThorns', 'Grasping Thorns', P.row3, 0.6, { category: 'line', appliesStatus: { kind: 'slow', potency: 1, rounds: 2 } }),

  // --- Magician → Arcane Mage (Control) ---
  arcaneCataclysm: mk('arcaneCataclysm', 'Arcane Cataclysm', P.block2x2, 1.4, { category: 'area', triggerMs: 2000, cooldownMs: 5000 }),
  sunderingSilence: mk('sunderingSilence', 'Sundering Silence', P.cone, 0.7, { category: 'area', appliesStatus: { kind: 'stun', potency: 1, rounds: 1 }, cooldownMs: 6000 }),
  chronostasis: mk('chronostasis', 'Chronostasis', P.adj8, 0.4, { category: 'area', appliesStatus: { kind: 'slow', potency: 1, rounds: 3 }, cooldownMs: 8000, cooldownType: 'active' }),
  // --- Magician → Fire Wizard (DPS) ---
  cinderstorm: mk('cinderstorm', 'Cinderstorm', P.block2x2, 1.3, { category: 'area', triggerMs: 1750 }),
  emberLance: mk('emberLance', 'Ember Lance', P.row3, 1.2, { category: 'line' }),
  immolation: mk('immolation', 'Immolation', P.adj8, 0.5, { category: 'area', appliesStatus: { kind: 'poison', potency: 0.1, rounds: 3 } }),
  // --- Magician → Druid (Healer) ---
  verdantWellspring: mk('verdantWellspring', 'Verdant Wellspring', P.adj8, 0, { healing: 140, targetsAllies: true, category: 'area', triggerMs: 2000 }),
  avalanche: mk('avalanche', 'Avalanche', P.cone, 1.5, { category: 'area', triggerMs: 2250, cooldownMs: 4000 }),
  ironbarkAegis: mk('ironbarkAegis', 'Ironbark Aegis', [{ dx: 0, dy: 0 }], 0, { healing: 40, targetsAllies: true, appliesStatus: { kind: 'defDown', potency: -0.3, rounds: 3 }, cooldownMs: 7000, cooldownType: 'active' }),

  // --- Rogue → Assassin (DPS) ---
  venomKiss: mk('venomKiss', 'Venom Kiss', P.point, 1.1, { category: 'point', appliesStatus: { kind: 'poison', potency: 0.1, rounds: 4 } }),
  mortalAmbush: mk('mortalAmbush', 'Mortal Ambush', P.point, 2.0, { category: 'point', critChance: 0.5, uses: 2, cooldownMs: 4000 }),
  exposingRupture: mk('exposingRupture', 'Exposing Rupture', P.point, 0.9, { category: 'point', appliesStatus: { kind: 'defDown', potency: 0.3, rounds: 2 } }),
  // --- Rogue → Shadower (Bruiser) ---
  nightshroud: mk('nightshroud', 'Nightshroud', [{ dx: 0, dy: 0 }], 0, { targetsAllies: true, appliesStatus: { kind: 'atkUp', potency: 0.25, rounds: 2 }, cooldownMs: 6000, cooldownType: 'active' }),
  umbralFlurry: mk('umbralFlurry', 'Umbral Flurry', P.adj4, 0.7, { category: 'adjacent', triggerMs: 1000 }),
  ghostwalk: mk('ghostwalk', 'Ghostwalk', [{ dx: 0, dy: 0 }], 0, { targetsAllies: true, appliesStatus: { kind: 'slow', potency: -1, rounds: 2 }, cooldownMs: 5000, cooldownType: 'active' }),
  // --- Rogue → Ninja (Control) ---
  thousandStars: mk('thousandStars', 'Thousand Stars', P.line4, 0.6, { category: 'line', triggerMs: 750, uses: 6, cooldownMs: 3000 }),
  ensnaringWeb: mk('ensnaringWeb', 'Ensnaring Web', P.block2x2, 0.4, { category: 'area', appliesStatus: { kind: 'slow', potency: 1, rounds: 3 }, cooldownMs: 5000 }),
  blindingAsh: mk('blindingAsh', 'Blinding Ash', P.adj8, 0.5, { category: 'area', appliesStatus: { kind: 'atkDown', potency: 0.3, rounds: 2 }, cooldownMs: 6000 }),

  // --- Fusion specialized skills ---
  phoenixFusillade: mk('phoenixFusillade', 'Phoenix Fusillade', P.line4, 1.7, { category: 'line', triggerMs: 1250 }),
  wildfireBloom: mk('wildfireBloom', 'Wildfire Bloom', P.block2x2, 1.4, { category: 'area', telegraphRounds: 1, cooldownMs: 5000 }),
  scorchedHeavens: mk('scorchedHeavens', 'Scorched Heavens', P.cone, 2.0, { category: 'area', critChance: 0.4, appliesStatus: { kind: 'poison', potency: 0.1, rounds: 3 }, uses: 1, cooldownMs: 9000, cooldownType: 'active' }),
  phantomBulwark: mk('phantomBulwark', 'Phantom Bulwark', P.adj4, 0.8, { category: 'adjacent', cooldownMs: 5000 }),
  evasiveBastion: mk('evasiveBastion', 'Evasive Bastion', [{ dx: 0, dy: 0 }], 0, { targetsAllies: true, appliesStatus: { kind: 'defDown', potency: -0.3, rounds: 3 }, cooldownMs: 6000, cooldownType: 'active' }),
  embermind: mk('embermind', 'Embermind', P.cone, 1.5, { category: 'area', triggerMs: 1750 }),
  cataclysmKindling: mk('cataclysmKindling', 'Cataclysm Kindling', P.block2x2, 1.6, { category: 'area', telegraphRounds: 1, cooldownMs: 5000 }),

  // --- Enemy skills ---
  dissolve: mk('dissolve', 'Dissolve', P.point, 1.0, { category: 'point' }),
  sonicBite: mk('sonicBite', 'Sonic Bite', P.point, 1.1, { category: 'point', triggerMs: 1250 }),
  venomFang: mk('venomFang', 'Venom Fang', P.point, 0.9, { category: 'point', appliesStatus: { kind: 'poison', potency: 0.1, rounds: 3 } }),
  sporeBurst: mk('sporeBurst', 'Spore Burst', P.adj8, 1.2, { category: 'area', telegraphRounds: 2 }),
  boulderSmash: mk('boulderSmash', 'Boulder Smash', P.block2x2, 1.6, { category: 'area', telegraphRounds: 3, cooldownMs: 4000 }),
};

// ============================================================================
// Jobs — player class DAG (Beginner → base → second → fusion). Roles/accents
// from the handoff. FLAT placeholder model; Phase 2 makes merges generative.
// ============================================================================
export const JOBS: Record<string, JobNode> = {
  // Tier 0
  beginner: { id: 'beginner', name: 'Beginner', requires: [], growth: 1.0, grantsSkills: ['strike'], accent: '#c2a06a' },
  // Tier 1 — base classes
  swordsman: { id: 'swordsman', name: 'Swordsman', requires: ['beginner'], growth: 1.05, grantsSkills: ['strike'], accent: '#7fa8cc' },
  archer: { id: 'archer', name: 'Archer', requires: ['beginner'], growth: 1.05, grantsSkills: ['tempestVolley'], accent: '#6fce8f' },
  magician: { id: 'magician', name: 'Magician', requires: ['beginner'], growth: 1.05, grantsSkills: ['emberLance'], accent: '#b78fe0' },
  rogue: { id: 'rogue', name: 'Rogue', requires: ['beginner'], growth: 1.05, grantsSkills: ['strike'], accent: '#8f7ad6' },
  // Tier 2 — second classes (base → 3 each)
  knight: { id: 'knight', name: 'Knight', requires: ['swordsman'], growth: 1.12, role: 'Tank', accent: '#7fa8cc', grantsSkills: ['aegisBastion', 'undyingProvocation', 'earthshatterBash'] },
  paladin: { id: 'paladin', name: 'Paladin', requires: ['swordsman'], growth: 1.12, role: 'Healer', accent: '#d8c06a', grantsSkills: ['radiantSmite', 'handOfDawn', 'hallowedGround'] },
  duelist: { id: 'duelist', name: 'Duelist', requires: ['swordsman'], growth: 1.12, role: 'DPS', accent: '#b8925a', grantsSkills: ['mirrorRiposte', 'vipersLunge', 'crimsonDisarm'] },
  hunter: { id: 'hunter', name: 'Hunter', requires: ['archer'], growth: 1.12, role: 'DPS', accent: '#6fce8f', grantsSkills: ['tempestVolley', 'hobblingShot', 'relentlessBarrage'] },
  sniper: { id: 'sniper', name: 'Sniper', requires: ['archer'], growth: 1.12, role: 'DPS', accent: '#52b878', grantsSkills: ['deadeyeMark', 'heavenPiercer', 'killshot'] },
  ranger: { id: 'ranger', name: 'Ranger', requires: ['archer'], growth: 1.12, role: 'Support', accent: '#43b0a0', grantsSkills: ['wardOfTheWild', 'quarrysMark', 'graspingThorns'] },
  arcaneMage: { id: 'arcaneMage', name: 'Arcane Mage', requires: ['magician'], growth: 1.12, role: 'Control', accent: '#b78fe0', grantsSkills: ['arcaneCataclysm', 'sunderingSilence', 'chronostasis'] },
  fireWizard: { id: 'fireWizard', name: 'Fire Wizard', requires: ['magician'], growth: 1.12, role: 'DPS', accent: '#e08a3a', grantsSkills: ['cinderstorm', 'emberLance', 'immolation'] },
  druid: { id: 'druid', name: 'Druid', requires: ['magician'], growth: 1.12, role: 'Healer', accent: '#8fbf6f', grantsSkills: ['verdantWellspring', 'avalanche', 'ironbarkAegis'] },
  assassin: { id: 'assassin', name: 'Assassin', requires: ['rogue'], growth: 1.12, role: 'DPS', accent: '#8f7ad6', grantsSkills: ['venomKiss', 'mortalAmbush', 'exposingRupture'] },
  shadower: { id: 'shadower', name: 'Shadower', requires: ['rogue'], growth: 1.12, role: 'Bruiser', accent: '#6a5aa0', grantsSkills: ['nightshroud', 'umbralFlurry', 'ghostwalk'] },
  ninja: { id: 'ninja', name: 'Ninja', requires: ['rogue'], growth: 1.12, role: 'Control', accent: '#5aa0c0', grantsSkills: ['thousandStars', 'ensnaringWeb', 'blindingAsh'] },
  // Fusions (any two seconds; carry both kits + 2–3 specialized). Demo party:
  flameRanger: {
    id: 'flameRanger', name: 'Flame Ranger', requires: ['fireWizard', 'ranger'], growth: 1.25, role: 'DPS', accent: '#e08a3a',
    grantsSkills: ['emberLance', 'cinderstorm', 'immolation', 'quarrysMark', 'graspingThorns', 'wardOfTheWild', 'phoenixFusillade', 'wildfireBloom', 'scorchedHeavens'],
  },
  nimbleKnight: {
    id: 'nimbleKnight', name: 'Nimble Knight', requires: ['knight', 'shadower'], growth: 1.25, role: 'Tank', accent: '#43c7c0',
    grantsSkills: ['earthshatterBash', 'aegisBastion', 'umbralFlurry', 'nightshroud', 'undyingProvocation', 'phantomBulwark', 'evasiveBastion'],
  },
  cinderSage: {
    id: 'cinderSage', name: 'Cinder Sage', requires: ['fireWizard', 'arcaneMage'], growth: 1.25, role: 'Control', accent: '#a07ad0',
    grantsSkills: ['emberLance', 'cinderstorm', 'arcaneCataclysm', 'sunderingSilence', 'immolation', 'embermind', 'cataclysmKindling'],
  },
};

// ============================================================================
// Monsters — kept OUT of JOBS so they never appear as player-unlockable classes.
// ============================================================================
export type MonsterTemplate = {
  id: string;
  name: string;
  sprite: string; // sprites.js builder
  growth: number; // stat multiplier vs the symmetric baseline
  skills: string[];
  elite?: boolean;
};
export const MONSTERS: Record<string, MonsterTemplate> = {
  slime: { id: 'slime', name: 'Cave Slime', sprite: 'slime', growth: 0.85, skills: ['dissolve'] },
  bat: { id: 'bat', name: 'Gloom Bat', sprite: 'bat', growth: 0.9, skills: ['sonicBite'] },
  spider: { id: 'spider', name: 'Venom Spider', sprite: 'spider', growth: 0.95, skills: ['venomFang'] },
  mushroom: { id: 'mushroom', name: 'Sporeling', sprite: 'mushroom', growth: 0.9, skills: ['sporeBurst'] },
  golem: { id: 'golem', name: 'Stoneheart Golem', sprite: 'golem', growth: 1.15, skills: ['boulderSmash'], elite: true },
};

// ============================================================================
// Demo scenario — party + a nearby enemy cluster the player can walk into.
// ============================================================================
export const PARTY_SPAWN = [
  { id: 'p1', name: 'Ravyn', sprite: 'ranger', jobId: 'flameRanger', level: 24, faction: 'player' as const, cell: { x: 6, y: 8 } },
  { id: 'p2', name: 'Sable', sprite: 'knight', jobId: 'nimbleKnight', level: 23, faction: 'ally' as const, cell: { x: 5, y: 8 } },
  { id: 'p3', name: 'Orrin', sprite: 'wizard', jobId: 'cinderSage', level: 24, faction: 'ally' as const, cell: { x: 5, y: 9 } },
];
export const ENEMY_SPAWN = [
  { monster: 'slime', level: 20, cell: { x: 14, y: 7 } },
  { monster: 'bat', level: 19, cell: { x: 16, y: 8 } },
  { monster: 'spider', level: 21, cell: { x: 15, y: 9 } },
  { monster: 'mushroom', level: 20, cell: { x: 17, y: 6 } },
  { monster: 'golem', level: 25, cell: { x: 18, y: 8 } },
];

// ============================================================================
// Maps — tile data will move to JSON later.
// ============================================================================
export function demoMap(width = 30, height = 17): TileMap {
  const tiles: TileKind[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      tiles.push(border ? 'wall' : 'floor');
    }
  }
  // A couple of interior wall props for visual interest.
  const wall = (x: number, y: number) => {
    tiles[y * width + x] = 'wall';
  };
  wall(10, 3); wall(10, 4); wall(11, 3);
  wall(22, 12); wall(23, 12); wall(23, 13);
  return { width, height, tiles };
}
