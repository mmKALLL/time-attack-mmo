import type { CombatClass, JobNode } from './types';
import type { Archetype } from './config-stats';

// Skill data (SKILLS, SKILL_INDEX, getSkill, describeSkill) lives in ./data-skills.ts.

// ============================================================================
// Jobs — player class DAG. Roles/accents from the handoff. Kits derived via kitOf().
// ============================================================================
export const JOBS: Record<string, JobNode> = {
  beginner: { id: 'beginner', name: 'Beginner', requires: [], growth: 1.0, accent: '#c2a06a' },
  fighter: { id: 'fighter', name: 'Fighter', requires: ['beginner'], growth: 1.05, accent: '#7fa8cc' },
  archer: { id: 'archer', name: 'Archer', requires: ['beginner'], growth: 1.05, accent: '#6fce8f' },
  magician: { id: 'magician', name: 'Magician', requires: ['beginner'], growth: 1.05, accent: '#b78fe0' },
  rogue: { id: 'rogue', name: 'Rogue', requires: ['beginner'], growth: 1.05, accent: '#8f7ad6' },
  knight: { id: 'knight', name: 'Knight', requires: ['fighter'], growth: 1.12, role: 'Tank', accent: '#7fa8cc' },
  paladin: { id: 'paladin', name: 'Paladin', requires: ['fighter'], growth: 1.12, role: 'Healer', accent: '#d8c06a' },
  duelist: { id: 'duelist', name: 'Duelist', requires: ['fighter'], growth: 1.12, role: 'DPS', accent: '#b8925a' },
  hunter: { id: 'hunter', name: 'Hunter', requires: ['archer'], growth: 1.12, role: 'DPS', accent: '#6fce8f' },
  sniper: { id: 'sniper', name: 'Sniper', requires: ['archer'], growth: 1.12, role: 'DPS', accent: '#52b878' },
  ranger: { id: 'ranger', name: 'Ranger', requires: ['archer'], growth: 1.12, role: 'Support', accent: '#43b0a0' },
  arcanist: { id: 'arcanist', name: 'Arcanist', requires: ['magician'], growth: 1.12, role: 'Control', accent: '#b78fe0' },
  wizard: { id: 'wizard', name: 'Wizard', requires: ['magician'], growth: 1.12, role: 'DPS', accent: '#e08a3a' },
  druid: { id: 'druid', name: 'Druid', requires: ['magician'], growth: 1.12, role: 'Healer', accent: '#8fbf6f' },
  assassin: { id: 'assassin', name: 'Assassin', requires: ['rogue'], growth: 1.12, role: 'DPS', accent: '#8f7ad6' },
  shadower: { id: 'shadower', name: 'Shadowblade', requires: ['rogue'], growth: 1.12, role: 'Bruiser', accent: '#6a5aa0' },
  ninja: { id: 'ninja', name: 'Reaver', requires: ['rogue'], growth: 1.12, role: 'Control', accent: '#5aa0c0' },
};

// Asset-based enemies (race/class/tier with spritesheet art) live in ./data-enemy.ts.

// Which primary-stat archetype a job favors (drives auto-allocated attributes).
// Base classes set the archetype; second classes inherit their base's lean.
const JOB_ARCHETYPE: Record<string, Archetype> = {
  beginner: 'balanced',
  fighter: 'str',
  knight: 'str',
  paladin: 'str',
  duelist: 'str',
  archer: 'dex',
  hunter: 'dex',
  sniper: 'dex',
  ranger: 'dex',
  magician: 'int',
  arcanist: 'int',
  wizard: 'int',
  druid: 'int',
  rogue: 'dex',
  assassin: 'dex',
  shadower: 'dex',
  ninja: 'dex',
};
export function archetypeForJob(jobId: string): Archetype {
  return JOB_ARCHETYPE[jobId] ?? 'balanced';
}

// Which combat class a job resolves to (drives the phys/mag damage split). Every
// class in a base's line inherits the base's combat class.
const JOB_COMBAT_CLASS: Record<string, CombatClass> = {
  beginner: 'beginner',
  fighter: 'fighter',
  knight: 'fighter',
  paladin: 'fighter',
  duelist: 'fighter',
  archer: 'archer',
  hunter: 'archer',
  sniper: 'archer',
  ranger: 'archer',
  magician: 'magician',
  arcanist: 'magician',
  wizard: 'magician',
  druid: 'magician',
  rogue: 'rogue',
  assassin: 'rogue',
  shadower: 'rogue',
  ninja: 'rogue',
};
export function combatClassForJob(jobId: string): CombatClass {
  return JOB_COMBAT_CLASS[jobId] ?? 'beginner';
}

// ============================================================================
// Start scenario — a lone level-1 Beginner. (Allies were dropped for the
// prototype; the player begins with a single point in Strike, see engine/demo.)
// ============================================================================
const randomFinnishWarriorNames = ['Aapo', 'Aino', 'Eero', 'Eeva', 'Ilmari', 'Kaisa', 'Lauri', 'Liisa', 'Matti', 'Ravyn', 'Sanna', 'Oskari', 'Taisto', 'Tapio', 'Tuuli'];
export const PARTY_SPAWN = [{ id: 'p1', name: randomFinnishWarriorNames[Math.floor(Math.random() * randomFinnishWarriorNames.length)], sprite: 'ranger', jobId: 'beginner', level: 1, faction: 'player' as const, cell: { x: 6, y: 8 } }];

// Map data (biomes, tiles, portals, spawns) lives in ./data-map.ts.
