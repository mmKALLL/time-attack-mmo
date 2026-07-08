import type { Cell, CombatGroup, Direction, Entity, EntityId, WorldState } from '../types';
import { DIRECTIONS, isWall, equals, key } from './grid';
import { JOBS, getSkill, archetypeForJob, combatClassForJob } from '../data';
import { areEnemies, isAlive } from './entities';
import { skillTargets, canCast, afterCast, tickCooldowns, magnitude } from './skills';
import { ARCHETYPE_WEIGHTS, CLASS_COMBAT, CRIT_MULT, allocatePrimaries, deriveStats, hitChance, rawDamage, xpReward, xpToNext, COMBAT_TICK_MS } from '../config';
import { nextRand } from './rng';

// ---------- Queries (never mutate) ----------
export function groupOf(s: WorldState, id: EntityId): CombatGroup | undefined {
  return Object.values(s.groups).find((g) => g.memberIds.includes(id));
}
export function membersOf(s: WorldState, g: CombatGroup): Entity[] {
  return g.memberIds.map((id) => s.entities[id]).filter(Boolean) as Entity[];
}
export function enemyAt(s: WorldState, c: Cell): Entity | undefined {
  return Object.values(s.entities).find((e) => e.faction === 'enemy' && isAlive(e) && equals(e.cell, c));
}

// ---------- Commands (mutate `s` in place) ----------
// Attach `enemyId` (and any group it already belongs to) into `byId`'s group.
export function stick(s: WorldState, byId: EntityId, enemyId: EntityId): void {
  let group = groupOf(s, byId);
  if (!group) {
    const id = 'g' + s.seq++;
    group = { id, memberIds: [byId] };
    s.groups[id] = group;
  }
  const enemyGroup = groupOf(s, enemyId);
  const toAdd = enemyGroup ? [...enemyGroup.memberIds] : [enemyId];
  for (const mid of toAdd) if (!group.memberIds.includes(mid)) group.memberIds.push(mid);
  if (enemyGroup && enemyGroup.id !== group.id) delete s.groups[enemyGroup.id];
}

export function moveOrStick(s: WorldState, id: EntityId, dir: Direction): void {
  const e = s.entities[id];
  if (!e) return;
  e.facing = dir;
  const off = DIRECTIONS[dir];
  const g = groupOf(s, id);

  if (!g) {
    const target: Cell = { x: e.cell.x + off.dx, y: e.cell.y + off.dy };
    if (isWall(s.map, target)) return;
    const foe = enemyAt(s, target);
    if (foe) return void stick(s, id, foe.id);
    e.cell = target; // players/allies may share a cell; move freely
    return;
  }

  // Grouped: rigid translation with leading-edge collision.
  const members = membersOf(s, g);
  const footprint = new Set(members.map((m) => key(m.cell)));
  const leading = members
    .map((m) => ({ x: m.cell.x + off.dx, y: m.cell.y + off.dy }))
    .filter((c) => !footprint.has(key(c)));

  if (leading.some((c) => isWall(s.map, c))) return; // wall blocks the whole group
  const memberIds = new Set(g.memberIds);
  const foes = leading.map((c) => enemyAt(s, c)).filter((f): f is Entity => !!f && !memberIds.has(f.id));
  if (foes.length) {
    for (const f of foes) stick(s, id, f.id); // touched more enemies -> grow the block
    return;
  }
  for (const m of members) m.cell = { x: m.cell.x + off.dx, y: m.cell.y + off.dy };
}

function dirFromDelta(dx: number, dy: number): Direction {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

// AI combatants (allies + enemies) face their nearest foe so directional attacks
// connect. The controlled player is exempt — they aim by their last move direction.
function orientCombatants(s: WorldState): void {
  for (const g of Object.values(s.groups)) {
    const members = membersOf(s, g).filter(isAlive);
    for (const m of members) {
      if (m.id === s.playerId) continue;
      let best: { dx: number; dy: number } | undefined;
      let bestDist = Infinity;
      for (const o of members) {
        if (!areEnemies(m, o)) continue;
        const dx = o.cell.x - m.cell.x;
        const dy = o.cell.y - m.cell.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = { dx, dy };
        }
      }
      if (best) m.facing = dirFromDelta(best.dx, best.dy);
    }
  }
}

// Advance combat clocks + resolve auto-casts for every group.
export function advanceCombat(s: WorldState, dt: number): void {
  for (const e of Object.values(s.entities)) e.skills = tickCooldowns(e, dt);
  orientCombatants(s);

  // Each combatant casts on its own timer, so attack speed varies by class.
  for (const g of Object.values(s.groups)) {
    for (const m of membersOf(s, g)) {
      if (!isAlive(m)) continue;
      const interval = COMBAT_TICK_MS / (CLASS_COMBAT[m.combatClass]?.speed ?? 1);
      m.castTimerMs += dt;
      let guard = 0;
      while (m.castTimerMs >= interval && guard++ < 8) {
        m.castTimerMs -= interval;
        castSkill(s, g, m);
      }
    }
  }
  cleanupDead(s);
}

// Roll one attack: check hit (accuracy vs dodge), roll damage in [minDmg,maxDmg],
// apply the skill multiplier and target defense, then a chance to crit. Uses the
// world's seeded RNG so replays/networking stay deterministic.
function resolveAttack(s: WorldState, caster: Entity, target: Entity, mult: number): { amount: number; crit: boolean; miss: boolean } {
  if (nextRand(s) > hitChance(caster.stats.accuracy, target.stats.dodge)) return { amount: 0, crit: false, miss: true };
  const { minDmg, maxDmg } = caster.stats;
  const rolled = minDmg + nextRand(s) * Math.max(0, maxDmg - minDmg);
  const power = CLASS_COMBAT[caster.combatClass]?.power ?? 1; // slow classes (mages) hit harder
  let amount = rawDamage(rolled, mult * power, target.stats.def);
  const crit = nextRand(s) < caster.stats.crit / 100;
  if (crit) amount = Math.round(amount * CRIT_MULT);
  return { amount, crit, miss: false };
}

// Fire one combatant's active skill (called on that combatant's own cast timer).
function castSkill(s: WorldState, g: CombatGroup, caster: Entity): void {
  const rt = caster.skills[caster.activeSkillIndex];
  if (!rt || !canCast(rt)) return;
  const skill = getSkill(rt.skillId);
  const living = membersOf(s, g).filter(isAlive);
  const mag = magnitude(skill, rt.level);
  for (const t of skillTargets(caster, skill, living, rt.level)) {
    if (skill.kind === 'heal') {
      if (mag > 0) {
        const heal = Math.round(caster.stats.maxDmg * mag);
        t.hp = Math.min(t.stats.maxHp, t.hp + heal);
        s.hits.push({ cell: { ...t.cell }, from: { ...caster.cell }, kind: 'heal', amount: heal });
      }
    } else if (skill.params.dmg) {
      // attack + damaging debuffs; pure buffs/debuffs/DoTs are inert until Phase 2.
      const r = resolveAttack(s, caster, t, mag);
      t.hp = Math.max(0, t.hp - r.amount);
      s.hits.push({ cell: { ...t.cell }, from: { ...caster.cell }, kind: r.miss ? 'miss' : r.crit ? 'crit' : 'damage', amount: r.amount });
    }
  }
  caster.skills = caster.skills.map((r, i) => (i === caster.activeSkillIndex ? afterCast(r, skill) : r));
}

// Level up a hero: bump level, re-allocate primaries for the new level, re-derive
// stats, refill hp/mp (carry surplus XP). Manual allocation lands with the
// allocation screen; until then heroes auto-allocate by their job archetype.
function levelUp(e: Entity): void {
  const growth = JOBS[e.jobId]?.growth ?? 1;
  while (e.xp >= xpToNext(e.level)) {
    e.xp -= xpToNext(e.level);
    e.level += 1;
    e.primaries = allocatePrimaries(ARCHETYPE_WEIGHTS[archetypeForJob(e.jobId)], e.level, growth);
    e.stats = deriveStats(e.primaries, e.level, combatClassForJob(e.jobId));
    e.hp = e.stats.maxHp;
    e.mp = e.stats.maxMp;
  }
}

// Award XP for a defeated enemy to every living hero (player + allies).
function awardXp(s: WorldState, amount: number): void {
  for (const e of Object.values(s.entities)) {
    if (e.faction !== 'enemy' && isAlive(e)) {
      e.xp += amount;
      levelUp(e);
    }
  }
}

function cleanupDead(s: WorldState): void {
  for (const g of Object.values(s.groups)) {
    g.memberIds = g.memberIds.filter((id) => s.entities[id] && isAlive(s.entities[id]));
    const factions = new Set(g.memberIds.map((id) => s.entities[id].faction));
    const hasEnemy = factions.has('enemy');
    const hasHero = factions.has('player') || factions.has('ally');
    if (!hasEnemy || !hasHero || g.memberIds.length < 2) delete s.groups[g.id];
  }
  for (const e of Object.values(s.entities)) {
    if (e.faction === 'enemy' && !isAlive(e)) {
      awardXp(s, xpReward(e.level));
      delete s.entities[e.id];
    }
  }
}

// re-exported for callers/tests that reason about hostility
export { areEnemies };
