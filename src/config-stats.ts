// Character stat cluster: leveling grants/caps, primary-stat allocation,
// class-combat tables, derived-stat formulas, and damage/accuracy math.
import type { CombatClass, Primaries, Stats } from './types';
import { DEBUG } from './config';

export const START_SKILL_LEVEL = DEBUG ? 2 : 1;
// ---------- Leveling: points granted per level + skill-level caps ----------
export const ATTR_POINTS_PER_LEVEL = 3;
export const SKILL_POINTS_PER_LEVEL = 1;
export const SKILL_CAP_BEGINNER = 5; // beginner skills cap at 5, later jobs at 10
export const SKILL_CAP = 10;

// ---------- Primary-stat allocation (symmetric for players AND enemies) ----------
// Points are spread by class archetype so every stat matters for every class
// (all weights non-zero). Enemies allocate the same way by level, keeping a
// same-level fight ~50/50.
export type Archetype = 'str' | 'dex' | 'int' | 'balanced';
export const PRIMARY_BASE = 5; // each primary at level 1
export const PRIMARY_POINTS_PER_LEVEL = 3; // design-doc: +3 attribute points / level
export const ARCHETYPE_WEIGHTS: Record<Archetype, Primaries> = {
  str: { str: 40, dex: 15, int: 15, vit: 30 },
  dex: { str: 20, dex: 40, int: 15, vit: 25 },
  int: { str: 15, dex: 15, int: 50, vit: 20 },
  balanced: { str: 25, dex: 25, int: 25, vit: 25 },
};
export function allocatePrimaries(w: Primaries, level: number, growth = 1): Primaries {
  const pts = PRIMARY_POINTS_PER_LEVEL * Math.max(0, level - 1) * growth;
  const sum = w.str + w.dex + w.int + w.vit || 1;
  const at = (k: keyof Primaries) => PRIMARY_BASE + Math.round((pts * w[k]) / sum);
  return { str: at('str'), dex: at('dex'), int: at('int'), vit: at('vit') };
}
// Which archetype each enemy class allocates toward — tune enemy stat leanings here.
export const ENEMY_CLASS_ARCHETYPE: Record<string, Archetype> = {
  fighter: 'str',
  archer: 'dex',
  mage: 'int',
  rogue: 'dex',
  leader: 'balanced',
};

// Per-class combat weighting (design-doc): `phys` = physical share of damage
// (magical = 1 - phys); `minDamageRatio` = minimum damage as a fraction of maximum
// (rogues 40%, everyone else 60%). `speed` scales attack cadence (rogues quicker,
// mages slower) and `power` scales per-hit damage (slow mages hit harder). Tune here.
export const CLASS_COMBAT: Record<CombatClass, { phys: number; minDamageRatio: number; speed: number; power: number }> = {
  beginner: { phys: 0.5, minDamageRatio: 0.6, speed: 1.0, power: 1.0 },
  fighter: { phys: 0.8, minDamageRatio: 0.6, speed: 1.0, power: 1.0 },
  archer: { phys: 0.4, minDamageRatio: 0.6, speed: 1.0, power: 1.0 },
  magician: { phys: 0.2, minDamageRatio: 0.6, speed: 0.8, power: 1.25 },
  rogue: { phys: 0.6, minDamageRatio: 0.4, speed: 1.5, power: 0.8 },
  leader: { phys: 0.5, minDamageRatio: 0.7, speed: 1.0, power: 1.0 },
};
// Enemy class -> combat class (enemies use 'mage'; players use 'magician').
export const ENEMY_CLASS_COMBAT: Record<string, CombatClass> = { fighter: 'fighter', archer: 'archer', mage: 'magician', rogue: 'rogue', leader: 'leader' };

// Early enemies (level <= maxLevel) take a flat stat penalty so a fresh, under-
// leveled player isn't overwhelmed. Applied to enemy derived stats only.
export const ENEMY_STAT_PENALTY = { maxLevel: 9, factor: 0.7 };

export function enemyStatMult(level: number): number {
  return level <= ENEMY_STAT_PENALTY.maxLevel ? ENEMY_STAT_PENALTY.factor : 1;
}

// ---------- Derived stats (design-doc formulas) ----------
// Crit grows as (dex*2+int)^0.7, softening to ^0.6 past 300; never a sure crit.
function critCurve(base: number): number {
  if (base <= 0) return 0;
  const c = base < 300 ? Math.pow(base, 0.7) : Math.pow(300, 0.7) + Math.pow(base - 300, 0.6);
  return Math.min(95, c);
}
// Power is a class-weighted blend of physical + magical (beginner 50/50); the
// class also sets how far minDmg sits below maxDmg.
export function deriveStats(p: Primaries, level: number, cls: CombatClass = 'beginner'): Stats {
  const physical = p.str * 4 + p.dex * 2;
  const magical = p.int * 4; // DEX's old magical share now lives in attackSpeed instead
  const { phys, minDamageRatio } = CLASS_COMBAT[cls];
  const power = (phys * physical + (1 - phys) * magical) * 2;
  const accuracy = p.dex * 2;
  return {
    maxHp: p.vit * 20 + level * 10 - 10,
    maxMp: p.int * 8 + level * 2 - 2,
    minDmg: Math.round(power * minDamageRatio),
    maxDmg: Math.round(power),
    def: p.str * 4,
    accuracy,
    crit: critCurve(p.dex * 2 + p.int),
    dodge: accuracy * 0.25,
    statusResist: Math.floor(10 + p.vit / 2 - 2),
    attackSpeed: 100 + 0.6 * p.dex - 3, // trigger-speed % (100 = normal); very gradual DEX scaling, base dex 5 = 100
  };
}

// Uniformly scale every derived stat (used for the early-enemy stat penalty).
export function scaleStats(s: Stats, mult: number): Stats {
  if (mult === 1) return s;
  return {
    maxHp: Math.max(1, Math.round(s.maxHp * mult)),
    maxMp: Math.round(s.maxMp * mult),
    minDmg: Math.round(s.minDmg * mult),
    maxDmg: Math.round(s.maxDmg * mult),
    def: Math.round(s.def * mult),
    accuracy: Math.round(s.accuracy * mult),
    crit: s.crit * mult,
    dodge: s.dodge * mult,
    statusResist: Math.round(s.statusResist * mult),
    attackSpeed: Math.round(s.attackSpeed * mult),
  };
}

// ---------- Damage / accuracy ----------
export const CRIT_MULT = 1.8; // crit deals 180% damage
// Hit rate = 1.2 - dodge/accuracy (5x accuracy over dodge => guaranteed hit).
export function hitChance(accuracy: number, dodge: number): number {
  if (accuracy <= 0) return 0.05;
  return Math.max(0.05, Math.min(1, 1.2 - dodge / accuracy));
}
// Final damage from a rolled base value, the skill multiplier, and target defense.
export function rawDamage(rolled: number, mult: number, def: number): number {
  return Math.max(1, Math.round(rolled * mult - def));
}
