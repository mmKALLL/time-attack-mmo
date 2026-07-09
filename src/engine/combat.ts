import type { Cell, CombatGroup, Direction, Entity, EntityId, Offset, ShapeKind, Skill, Telegraph, WorldState } from '../types';
import { DIRECTIONS, isWall, equals, key } from './grid';
import { combatClassForJob } from '../data';
import { getSkill } from '../data-skills';
import { areEnemies, isAlive } from './entities';
import { skillTargets, canCast, afterCast, tickCooldowns, magnitude } from './skills';
import { shapeFor } from './shapes';
import { ATTR_POINTS_PER_LEVEL, CLASS_COMBAT, CRIT_MULT, SKILL_POINTS_PER_LEVEL, deriveStats, hitChance, rawDamage, xpReward, xpToNext, COMBAT_TICK_MS, ENEMY_ATTACK_RANGE, ENEMY_APPROACH_MS } from '../config';
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

// Chebyshev distance (max axis): the range metric for enemy attacks — diagonals
// count the same as orthogonals, so a 4-range mage hits a full 9x9 box.
function chebyshevDistance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

// The nearest living hero (faction !== 'enemy') in `enemy`'s group by Chebyshev
// distance; ties broken by iteration order. Recomputed each tick so an enemy
// retargets to a hero that has moved closer. Undefined if the enemy is ungrouped
// or its group holds no living heroes.
export function nearestHero(s: WorldState, enemy: Entity): Entity | undefined {
  const g = groupOf(s, enemy.id);
  if (!g) return undefined;
  let best: Entity | undefined;
  let bestDist = Infinity;
  for (const m of membersOf(s, g)) {
    if (m.faction === 'enemy' || !isAlive(m)) continue;
    const dist = chebyshevDistance(enemy.cell, m.cell);
    if (dist < bestDist) {
      bestDist = dist;
      best = m;
    }
  }
  return best;
}

// True if any entity other than `selfId` occupies `c` (walls handled separately).
// Mirrors the occupancy the player's ungrouped move respects (roaming.occupiedBy).
function occupiedBy(s: WorldState, c: Cell, selfId: EntityId): boolean {
  return Object.values(s.entities).some((e) => e.id !== selfId && isAlive(e) && equals(e.cell, c));
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

  if (leading.some((c) => isWall(s.map, c))) {
    // Block jammed against a wall. Let the PLAYER (only) peel off toward its own
    // next cell if that cell is walkable+empty, deforming the block to close
    // distance so it isn't stuck permanently out of range. Allies never deform.
    if (id === s.playerId) {
      const ahead: Cell = { x: e.cell.x + off.dx, y: e.cell.y + off.dy };
      if (!isWall(s.map, ahead) && !occupiedBy(s, ahead, id)) e.cell = ahead;
    }
    return;
  }
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
      // Enemies approach on their own 2s clock (once per tick), independent of
      // the cast timer, so a slow attacker still creeps forward each frame.
      if (m.faction === 'enemy') advanceApproach(s, m, dt);
      const interval = COMBAT_TICK_MS / (CLASS_COMBAT[m.combatClass]?.speed ?? 1);
      m.castTimerMs += dt;
      let guard = 0;
      while (m.castTimerMs >= interval && guard++ < 8) {
        m.castTimerMs -= interval;
        // Heroes cast shape-based (unchanged). Enemies do a single-target hit on
        // their nearest hero, gated by class attack range (Slice 1 — no AoE).
        if (m.faction === 'enemy') enemyAttack(s, m);
        else castSkill(s, g, m);
      }
    }
  }
  cleanupDead(s);
}

// A skill's role lives in its shape: line/arc/area/cross paint an AoE footprint
// (telegraphed + dodgeable); self/melee/point hit a single target. Classified
// here so enemy roles are data-driven (see src/data.ts), not class special-cases.
const AOE_SHAPES: ReadonlySet<ShapeKind> = new Set<ShapeKind>(['line', 'arc', 'area', 'cross']);
function isAoESkill(skill: Skill): boolean {
  return AOE_SHAPES.has(skill.shapeKind);
}

// One enemy attack on its own cast timer: target the nearest living hero, but only
// if it's within the class's static Chebyshev range (else hold fire). Single-target
// skills (fighter/archer) hit the target instantly (slice 1); AoE skills
// (mage/rogue/leader) instead PLANT a telegraph on the ground under the target and
// resolve later (slice 2). Either way the cast is consumed (afterCast bookkeeping).
function enemyAttack(s: WorldState, caster: Entity): void {
  const target = nearestHero(s, caster);
  if (!target) return;
  if (chebyshevDistance(caster.cell, target.cell) > ENEMY_ATTACK_RANGE[caster.combatClass]) return; // out of range: hold fire
  // Use the active skill when it's ready; otherwise fall back to a basic Strike so a
  // cooling-down mage/rogue/leader still jabs each round. The primary's cooldown keeps
  // ticking (tickCooldowns) and resumes when ready; the fallback consumes nothing.
  const primary = caster.skills[caster.activeSkillIndex];
  const usePrimary = !!primary && canCast(primary);
  const skill = usePrimary ? getSkill(primary.skillId) : getSkill('enemyStrike');
  const level = primary?.level ?? 1;
  if (skill.params.dmg) {
    const mag = magnitude(skill, level);
    if (isAoESkill(skill)) {
      s.telegraphs.push(makeTelegraph(caster, target, skill, level, mag));
    } else {
      const r = resolveAttack(s, caster, target, mag);
      target.hp = Math.max(0, target.hp - r.amount);
      s.hits.push({ cell: { ...target.cell }, from: { ...caster.cell }, kind: r.miss ? 'miss' : r.crit ? 'crit' : 'damage', amount: r.amount });
    }
  }
  if (usePrimary) caster.skills = caster.skills.map((r, i) => (i === caster.activeSkillIndex ? afterCast(r, skill) : r));
}

// The direction from `caster` to `target`, so the footprint aims at the hero. AI
// combatants are already oriented (orientCombatants), but derive it here so a
// telegraph is correct regardless of the caster's rendered facing.
function facingToward(caster: Entity, target: Entity): Direction {
  return dirFromDelta(target.cell.x - caster.cell.x, target.cell.y - caster.cell.y);
}

// Build a telegraph: take the skill's footprint (rotated toward the target),
// translate it so the footprint's bounding-box CENTRE lands on the target's cell
// ("marks the ground under you"), convert to ABSOLUTE map cells, and LOCK them.
// The damage inputs are snapshotted now so the AoE resolves the same way even if
// the caster dies during the lead time.
function makeTelegraph(caster: Entity, target: Entity, skill: Skill, level: number, mag: number): Telegraph {
  const offsets = shapeFor(skill, level, facingToward(caster, target));
  const tiles = anchorOnCell(offsets, target.cell);
  const src = damageSource(caster, mag);
  const dur = skill.telegraphMs ?? 0; // per-skill wind-up (AoE skills must define telegraphMs)
  return { tiles, remainingMs: dur, totalMs: dur, from: { ...caster.cell }, accuracy: src.accuracy, minDmg: src.minDmg, maxDmg: src.maxDmg, power: src.power, crit: src.crit, mag: src.mult };
}

// Centre a set of shape offsets on `anchor`: shift by the offsets' bounding-box
// centre (rounded to a whole tile) so the footprint's middle sits on `anchor`,
// then add `anchor` to get absolute cells. Integer math keeps tiles grid-aligned.
function anchorOnCell(offsets: Offset[], anchor: Cell): Cell[] {
  const xs = offsets.map((o) => o.dx);
  const ys = offsets.map((o) => o.dy);
  const cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
  const cy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
  return offsets.map((o) => ({ x: anchor.x + o.dx - cx, y: anchor.y + o.dy - cy }));
}

// Advance every pending telegraph's clock; when one elapses, RESOLVE it: for each
// living hero standing on a locked tile, roll a hit from the frozen snapshot (same
// seeded rolls as a direct attack) and subtract hp + push a hit event. Then drop
// the resolved telegraphs. Called from tick() AFTER applyInput, so a hero's move
// this tick is already reflected — stepping off the tiles dodges the hit.
export function advanceTelegraphs(s: WorldState, dt: number): void {
  const survivors: Telegraph[] = [];
  for (const t of s.telegraphs) {
    t.remainingMs -= dt;
    if (t.remainingMs > 0) {
      survivors.push(t);
      continue;
    }
    const marked = new Set(t.tiles.map(key));
    const src: DamageSource = { accuracy: t.accuracy, minDmg: t.minDmg, maxDmg: t.maxDmg, power: t.power, crit: t.crit, mult: t.mag };
    for (const e of Object.values(s.entities)) {
      if (e.faction === 'enemy' || !isAlive(e) || !marked.has(key(e.cell))) continue;
      const r = rollDamage(s, src, e);
      e.hp = Math.max(0, e.hp - r.amount);
      s.hits.push({ cell: { ...e.cell }, from: { ...t.from }, kind: r.miss ? 'miss' : r.crit ? 'crit' : 'damage', amount: r.amount });
    }
  }
  s.telegraphs = survivors;
}

// Accumulate an out-of-range enemy's approach clock; when it fills, take ONE
// greedy 4-way step toward its nearest hero and reset. In range: hold/reset the
// timer so it never banks a step. The step is intentionally dumb — it moves only
// if the cell straight ahead is walkable+empty, and never routes around a block.
function advanceApproach(s: WorldState, enemy: Entity, dt: number): void {
  const target = nearestHero(s, enemy);
  if (!target || chebyshevDistance(enemy.cell, target.cell) <= ENEMY_ATTACK_RANGE[enemy.combatClass]) {
    enemy.approachTimerMs = 0; // in range (or no target): don't creep, don't bank
    return;
  }
  enemy.approachTimerMs = (enemy.approachTimerMs ?? 0) + dt;
  if (enemy.approachTimerMs < ENEMY_APPROACH_MS) return;
  enemy.approachTimerMs = 0;
  // Greedy 4-way axis that most reduces distance to the target (same tie-break as
  // dirFromDelta: horizontal wins on |dx| >= |dy|).
  const dir = dirFromDelta(target.cell.x - enemy.cell.x, target.cell.y - enemy.cell.y);
  const off = DIRECTIONS[dir];
  const ahead: Cell = { x: enemy.cell.x + off.dx, y: enemy.cell.y + off.dy };
  if (isWall(s.map, ahead) || occupiedBy(s, ahead, enemy.id)) return; // blocked ahead: skip (no pathfinding this slice)
  enemy.facing = dir;
  enemy.cell = ahead;
}

// Frozen attacker inputs a damage roll needs — a caster's stats snapshotted so a
// hit can resolve identically even after the caster is gone (telegraphed AoE).
type DamageSource = { accuracy: number; minDmg: number; maxDmg: number; power: number; crit: number; mult: number };
function damageSource(caster: Entity, mult: number): DamageSource {
  const { accuracy, minDmg, maxDmg, crit } = caster.stats;
  const power = CLASS_COMBAT[caster.combatClass]?.power ?? 1; // slow classes (mages) hit harder
  return { accuracy, minDmg, maxDmg, power, crit, mult };
}

// Roll one attack against a target: check hit (accuracy vs dodge), roll damage in
// [minDmg,maxDmg], apply the skill×power multiplier and target defense, then a
// chance to crit. Uses the world's seeded RNG so replays/networking stay
// deterministic. Reads only the frozen `src`, so single-target and telegraph
// resolution roll damage the exact same way.
function rollDamage(s: WorldState, src: DamageSource, target: Entity): { amount: number; crit: boolean; miss: boolean } {
  if (nextRand(s) > hitChance(src.accuracy, target.stats.dodge)) return { amount: 0, crit: false, miss: true };
  const rolled = src.minDmg + nextRand(s) * Math.max(0, src.maxDmg - src.minDmg);
  let amount = rawDamage(rolled, src.mult * src.power, target.stats.def);
  const crit = nextRand(s) < src.crit / 100;
  if (crit) amount = Math.round(amount * CRIT_MULT);
  return { amount, crit, miss: false };
}

// Single-target convenience: snapshot the caster and roll (slice-1 behavior).
function resolveAttack(s: WorldState, caster: Entity, target: Entity, mult: number): { amount: number; crit: boolean; miss: boolean } {
  return rollDamage(s, damageSource(caster, mult), target);
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
// stats, refill hp/mp (carry surplus XP). Heroes now spend points manually on the
// allocation screen, so each level grants attribute + skill points (primaries are
// unchanged; level scaling still re-derives HP/MP/etc.).
function levelUp(e: Entity): void {
  while (e.xp >= xpToNext(e.level)) {
    e.xp -= xpToNext(e.level);
    e.level += 1;
    e.attrPoints += ATTR_POINTS_PER_LEVEL;
    e.skillPoints += SKILL_POINTS_PER_LEVEL;
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
