import type { EnemyAsset, Skill } from './types';
import { getSkill } from './data';

// ============================================================================
// Asset-based enemies. Each race occupies one quadrant of a 2048x2048 sheet;
// within a quadrant the 4x4 tiles are: fighter t1/t2, archer t1/t2 (row 0),
// mage t1/t2, rogue t1/t2 (row 1), then a 2x2 leader t1 and 2x2 leader t2.
// Class sets the level offset (fighter +0, archer +1, rogue +2, mage +4,
// leader +6). See the "Use assets for enemies" card.
// ============================================================================
export type EnemyClass = 'fighter' | 'archer' | 'mage' | 'rogue' | 'leader';
export type EnemyDef = { id: string; name: string; asset: EnemyAsset; cls: EnemyClass; levelOffset: number; growth: number; skills: Skill[]; elite?: boolean };

const CLASS_OFFSET: Record<EnemyClass, number> = { fighter: 0, archer: 1, rogue: 2, mage: 4, leader: 6 };
const CLASS_SKILL: Record<EnemyClass, string> = { fighter: 'enemyStrike', archer: 'enemyShot', mage: 'enemyHex', rogue: 'enemyGouge', leader: 'enemyRuin' };
const CLASS_GROWTH: Record<EnemyClass, number> = { fighter: 1.0, archer: 0.95, rogue: 0.95, mage: 1.0, leader: 1.25 };
const CLASS_TILE: Record<Exclude<EnemyClass, 'leader'>, [number, number]> = { fighter: [1, 2], archer: [3, 4], mage: [5, 6], rogue: [7, 8] };
const LEADER_TILES: Record<1 | 2, [number, number, number, number]> = { 1: [9, 10, 13, 14], 2: [11, 12, 15, 16] };

function enemy(id: string, name: string, filename: string, quadrant: 1 | 2 | 3 | 4, cls: EnemyClass, tier: 1 | 2): EnemyDef {
  const tiles =
    cls === 'leader'
      ? LEADER_TILES[tier].map((i) => `q${quadrant}-${i}`)
      : `q${quadrant}-${CLASS_TILE[cls][tier - 1]}`;
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

const FOREST = 'forest-enemies.png'; // q1 menninkäinen, q2 peikko, q3 haltia, q4 metsänpeitto
const HIGHWAY = 'highway-enemies-3.png'; // q3 rosvo, q4 varas / haamu (ghosts)

export const ENEMIES: Record<string, EnemyDef> = {
  // Highway bandits + thieves + ghosts
  rosvoFighter: enemy('rosvoFighter', 'Rosvo Brigand', HIGHWAY, 3, 'fighter', 1),
  rosvoArcher: enemy('rosvoArcher', 'Rosvo Bowman', HIGHWAY, 3, 'archer', 1),
  rosvoRogue: enemy('rosvoRogue', 'Rosvo Cutthroat', HIGHWAY, 3, 'rogue', 1),
  varasRogue: enemy('varasRogue', 'Varas Thief', HIGHWAY, 4, 'rogue', 1),
  haamuMage: enemy('haamuMage', 'Haamu Wraith', HIGHWAY, 4, 'mage', 1),
  // Forest folk
  menninkainenFighter: enemy('menninkainenFighter', 'Menninkäinen Warrior', FOREST, 1, 'fighter', 1),
  menninkainenArcher: enemy('menninkainenArcher', 'Menninkäinen Hunter', FOREST, 1, 'archer', 1),
  peikkoFighter: enemy('peikkoFighter', 'Peikko Brute', FOREST, 2, 'fighter', 1),
  peikkoWarlord: enemy('peikkoWarlord', 'Peikko Warlord', FOREST, 2, 'fighter', 2),
  haltiaArcher: enemy('haltiaArcher', 'Haltia Ranger', FOREST, 3, 'archer', 1),
  haltiaMage: enemy('haltiaMage', 'Haltia Sage', FOREST, 3, 'mage', 1),
  metsanpeittoFighter: enemy('metsanpeittoFighter', 'Metsänpeitto Ent', FOREST, 4, 'fighter', 1),
  metsanpeittoAncient: enemy('metsanpeittoAncient', 'Metsänpeitto Ancient', FOREST, 4, 'leader', 1),
};
