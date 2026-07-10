// Character stat cluster: leveling grants/caps, primary-stat allocation,
// class-combat tables, derived-stat formulas, and damage/accuracy math.
import type { CombatClass, Entity, Primaries, PrimaryKey, Stats, StatusEffect, StatusKind } from './types';
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

// % that harmful-status effect params are reduced by, per enemy combat class
// (warriors=fighter). Leaders shrug off most debuffs; archers/mages take them
// in full. See statusResistPercent (clamped [0,95]; never fully immune).
export const CLASS_STATUS_RESIST: Record<CombatClass, number> = { fighter: 25, rogue: 25, leader: 75, archer: 0, magician: 0, beginner: 0 };

// A target's harmful-status resist %, clamped to [0,95] (negative statuses always
// apply — resist only scales their effect down). Enemies use the per-class table;
// heroes use the derived statusResist stat so it stays meaningful for players.
export function statusResistPercent(e: Entity): number {
  const raw = e.faction === 'enemy' ? (CLASS_STATUS_RESIST[e.combatClass] ?? 0) : effectiveStats(e).statusResist;
  return Math.max(0, Math.min(95, raw));
}

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
  const magical = p.int * 4;
  const { phys, minDamageRatio } = CLASS_COMBAT[cls];
  const power = (phys * physical + (1 - phys) * magical) * 2;
  const accuracy = p.dex * 2;
  return {
    maxHp: p.vit * 20 + level * 10 - 10,
    maxMp: p.int * 8 + level * 2 - 2,
    minDmg: Math.round(power * minDamageRatio),
    maxDmg: Math.round(power),
    def: p.str * 2,
    accuracy,
    crit: critCurve(p.dex * 2 + p.int),
    dodge: accuracy * 0.25,
    statusResist: Math.floor(10 + p.vit / 2 - 2),
    attackSpeed: 100 + 0.6 * p.dex - 3, // trigger-speed % (100 = normal); very gradual DEX scaling, base dex 5 => 100%
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
  return Math.max(0.2, Math.min(1, 1.2 - dodge / accuracy));
}
// Final damage from a rolled base value, the skill multiplier, and target defense.
export function rawDamage(rolled: number, mult: number, def: number): number {
  return Math.max(1, Math.round(rolled * mult - def));
}

// ---------- Status effects ----------
// Per-kind rules: total lifetime, DoT tick cadence (poison/bleed/burn only),
// whether it counts as harmful (drives the attacker crit bonus), and how many
// copies from the SAME source stack (bleed 5, everything else 1).
export const STATUS: Record<StatusKind, { durationMs: number; tickMs?: number; harmful: boolean; maxStacksPerSource: number }> = {
  poison: { durationMs: 10000, tickMs: 1000, harmful: true, maxStacksPerSource: 1 },
  bleed: { durationMs: 10000, tickMs: 1000, harmful: true, maxStacksPerSource: 5 },
  burn: { durationMs: 5000, tickMs: 500, harmful: true, maxStacksPerSource: 1 },
  slow: { durationMs: 5000, harmful: true, maxStacksPerSource: 1 },
  stun: { durationMs: 2000, harmful: true, maxStacksPerSource: 1 },
  atkUp: { durationMs: 10000, harmful: false, maxStacksPerSource: 1 },
  atkDown: { durationMs: 10000, harmful: true, maxStacksPerSource: 1 },
  defUp: { durationMs: 10000, harmful: false, maxStacksPerSource: 1 },
  defDown: { durationMs: 10000, harmful: true, maxStacksPerSource: 1 },
  dodge: { durationMs: 10000, harmful: false, maxStacksPerSource: 1 },
  blind: { durationMs: 10000, harmful: true, maxStacksPerSource: 1 },
  critUp: { durationMs: 90000, harmful: false, maxStacksPerSource: 1 }, // +crit chance % (self-buff, e.g. Improved Critical)
  critDmgUp: { durationMs: 90000, harmful: false, maxStacksPerSource: 1 }, // +crit damage % (self-buff, e.g. Improved Critical)
  statPercent: { durationMs: 10000, harmful: false, maxStacksPerSource: 1 },
  statFlat: { durationMs: 10000, harmful: false, maxStacksPerSource: 1 },
};
export const STUN_IMMUNITY_MS = 5000; // post-stun immunity window (blocks re-stun)
export const HARMFUL_CRIT_STEP = 1.1; // attacker crit ×1.1 per harmful status STACK on the target

// Poison deals a % of the target's max HP per 1s tick.
export function poisonTickDamage(percentPerSecond: number, targetMaxHp: number): number {
  return Math.round((targetMaxHp * percentPerSecond) / 100);
}
// Attacker crit multiplier vs a target carrying `stackCount` harmful statuses.
export function harmfulCritMultiplier(stackCount: number): number {
  return HARMFUL_CRIT_STEP ** stackCount;
}

// statPercent/statFlat count as harmful when their potency is a net penalty.
export function statusIsHarmful(st: StatusEffect): boolean {
  if (st.kind === 'statPercent' || st.kind === 'statFlat') return st.potency < 0;
  return STATUS[st.kind].harmful;
}

// ---------- Status sums over an entity's active statuses ----------
function sumPotency(statuses: StatusEffect[], kind: StatusKind): number {
  return statuses.reduce((acc, st) => (st.kind === kind ? acc + st.potency : acc), 0);
}
export function totalSlowPercent(e: Entity): number {
  return sumPotency(e.statuses, 'slow');
}
// Net outgoing-damage modifier %: ΣatkUp − ΣatkDown.
export function totalAtkPercent(e: Entity): number {
  return sumPotency(e.statuses, 'atkUp') - sumPotency(e.statuses, 'atkDown');
}
// Net incoming-damage modifier %: ΣdefDown − ΣdefUp (defDown raises damage taken).
export function totalDefTakenPercent(e: Entity): number {
  return sumPotency(e.statuses, 'defDown') - sumPotency(e.statuses, 'defUp');
}
export function totalDodgePercent(e: Entity): number {
  return sumPotency(e.statuses, 'dodge');
}
export function totalBlindPercent(e: Entity): number {
  return sumPotency(e.statuses, 'blind');
}
// Flat crit-chance % added by active critUp buffs.
export function totalCritPercent(e: Entity): number {
  return sumPotency(e.statuses, 'critUp');
}
// Crit-damage bonus % added by active critDmgUp buffs (added to CRIT_MULT on a crit).
export function totalCritDamagePercent(e: Entity): number {
  return sumPotency(e.statuses, 'critDmgUp');
}
// Count each harmful STACK (so bleed×3 counts as 3).
export function harmfulStackCount(e: Entity): number {
  return e.statuses.reduce((acc, st) => (statusIsHarmful(st) ? acc + 1 : acc), 0);
}
export function hasActiveStun(e: Entity): boolean {
  return e.statuses.some((st) => st.kind === 'stun');
}

// ---------- Effective (buffed) primaries + derived stats ----------
// Base primaries adjusted by active statFlat (+potency) and statPercent
// (×(1+Σpercent/100)) per stat. Order: flat first, then percent.
export function effectivePrimaries(e: Entity): Primaries {
  const out: Primaries = { ...e.primaries };
  let touched = false;
  for (const st of e.statuses) {
    if (!st.stat) continue;
    if (st.kind === 'statFlat') {
      out[st.stat] += st.potency;
      touched = true;
    }
  }
  const percentByStat = { str: 0, dex: 0, int: 0, vit: 0 } as Record<PrimaryKey, number>;
  for (const st of e.statuses) {
    if (st.kind === 'statPercent' && st.stat) {
      percentByStat[st.stat] += st.potency;
      touched = true;
    }
  }
  if (!touched) return out;
  (Object.keys(percentByStat) as PrimaryKey[]).forEach((k) => {
    if (percentByStat[k]) out[k] = Math.max(0, Math.round(out[k] * (1 + percentByStat[k] / 100)));
  });
  return out;
}
// The stats combat reads: re-derived from effective primaries when the entity
// carries any stat buff/debuff, else the pre-derived `e.stats` (no extra work).
export function effectiveStats(e: Entity): Stats {
  const hasStatMod = e.statuses.some((st) => st.kind === 'statPercent' || st.kind === 'statFlat');
  if (!hasStatMod) return e.stats;
  return deriveStats(effectivePrimaries(e), e.level, e.combatClass);
}
