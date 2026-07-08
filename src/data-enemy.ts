import type { EnemyAsset, Skill } from './types';
import { getSkill } from './data';

// ============================================================================
// Asset-based enemies. Each race occupies one quadrant of a 2048x2048 sheet;
// within a quadrant the 4x4 tiles are: fighter t1/t2, archer t1/t2 (row 0),
// mage t1/t2, rogue t1/t2 (row 1), then a 2x2 leader t1 and 2x2 leader t2.
// Class sets the level offset (fighter +0, archer +1, rogue +2, mage +4,
// leader +6); tier 2 is the "strong" variant. See the "Use assets" card.
// ============================================================================
export type EnemyClass = 'fighter' | 'archer' | 'mage' | 'rogue' | 'leader';
export type EnemyDef = { id: string; name: string; asset: EnemyAsset; cls: EnemyClass; levelOffset: number; growth: number; skills: Skill[]; elite?: boolean };

const CLASS_OFFSET: Record<EnemyClass, number> = { fighter: 0, archer: 1, rogue: 2, mage: 4, leader: 6 };
const CLASS_SKILL: Record<EnemyClass, string> = { fighter: 'enemyStrike', archer: 'enemyShot', mage: 'enemyHex', rogue: 'enemyGouge', leader: 'enemyRuin' };
const CLASS_GROWTH: Record<EnemyClass, number> = { fighter: 1.0, archer: 0.95, rogue: 0.95, mage: 1.0, leader: 1.25 };
const CLASS_TITLE: Record<EnemyClass, string> = { fighter: 'Warrior', archer: 'Archer', mage: 'Mage', rogue: 'Rogue', leader: 'Chief' };
const CLASS_TILE: Record<Exclude<EnemyClass, 'leader'>, [number, number]> = { fighter: [1, 2], archer: [3, 4], mage: [5, 6], rogue: [7, 8] };
const LEADER_TILES: Record<1 | 2, [number, number, number, number]> = { 1: [9, 10, 13, 14], 2: [11, 12, 15, 16] };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function enemy(id: string, name: string, filename: string, quadrant: 1 | 2 | 3 | 4, cls: EnemyClass, tier: 1 | 2): EnemyDef {
  const tiles = cls === 'leader' ? LEADER_TILES[tier].map((i) => `q${quadrant}-${i}`) : `q${quadrant}-${CLASS_TILE[cls][tier - 1]}`;
  return {
    id,
    name,
    asset: { filename, tiles },
    cls,
    levelOffset: CLASS_OFFSET[cls],
    growth: CLASS_GROWTH[cls] * (tier === 2 ? 1.12 : 1),
    skills: [getSkill(CLASS_SKILL[cls])],
    elite: cls === 'leader',
  };
}

// The full 10-enemy roster for a single race occupying one quadrant.
function race(filename: string, quadrant: 1 | 2 | 3 | 4, raceId: string, raceName: string): EnemyDef[] {
  const out: EnemyDef[] = [];
  for (const cls of ['fighter', 'archer', 'mage', 'rogue'] as const) {
    out.push(enemy(`${raceId}${cap(cls)}`, `${raceName} ${CLASS_TITLE[cls]}`, filename, quadrant, cls, 1));
    out.push(enemy(`${raceId}${cap(cls)}2`, `Greater ${raceName} ${CLASS_TITLE[cls]}`, filename, quadrant, cls, 2));
  }
  out.push(enemy(`${raceId}Leader`, `${raceName} Chief`, filename, quadrant, 'leader', 1));
  out.push(enemy(`${raceId}Leader2`, `${raceName} Warlord`, filename, quadrant, 'leader', 2));
  return out;
}

const FOREST = 'forest-enemies.png'; // q1 menninkäinen, q2 peikko, q3 haltia, q4 metsänpeitto
const AQUATIC = 'aquatic-enemies.png'; // q1 näkki, q2 vetehinen, q3 iku-turso, q4 vesihiisi
const HIGHWAY = 'highway-enemies-3.png'; // q3 rosvo; q4 varas (fighter/archer/rogue) + haamu (mage/leader)

const list: EnemyDef[] = [
  // Forest folk
  ...race(FOREST, 1, 'menninkainen', 'Menninkäinen'),
  ...race(FOREST, 2, 'peikko', 'Peikko'),
  ...race(FOREST, 3, 'haltia', 'Haltia'),
  ...race(FOREST, 4, 'metsanpeitto', 'Metsänpeitto'),
  // Aquatic (used once a lake/water biome exists)
  ...race(AQUATIC, 1, 'nakki', 'Näkki'),
  ...race(AQUATIC, 2, 'vetehinen', 'Vetehinen'),
  ...race(AQUATIC, 3, 'ikuturso', 'Iku-Turso'),
  ...race(AQUATIC, 4, 'vesihiisi', 'Vesihiisi'),
  // Highway bandits (q3) + a mixed q4: varas thieves + haamu ghosts
  ...race(HIGHWAY, 3, 'rosvo', 'Rosvo'),
  enemy('varasFighter', 'Varas Bruiser', HIGHWAY, 4, 'fighter', 1),
  enemy('varasFighter2', 'Greater Varas Bruiser', HIGHWAY, 4, 'fighter', 2),
  enemy('varasArcher', 'Varas Bowman', HIGHWAY, 4, 'archer', 1),
  enemy('varasArcher2', 'Greater Varas Bowman', HIGHWAY, 4, 'archer', 2),
  enemy('varasRogue', 'Varas Thief', HIGHWAY, 4, 'rogue', 1),
  enemy('varasRogue2', 'Greater Varas Thief', HIGHWAY, 4, 'rogue', 2),
  enemy('haamuMage', 'Haamu Wraith', HIGHWAY, 4, 'mage', 1),
  enemy('haamuMage2', 'Greater Haamu Wraith', HIGHWAY, 4, 'mage', 2),
  enemy('haamuLeader', 'Kummitus Revenant', HIGHWAY, 4, 'leader', 1),
  enemy('haamuLeader2', 'Kummitus Overlord', HIGHWAY, 4, 'leader', 2),
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(list.map((d) => [d.id, d]));
