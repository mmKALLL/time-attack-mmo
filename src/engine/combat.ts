import type { Cell, CombatGroup, Direction, Entity, EntityId, WorldState } from '../types';
import { DIRECTIONS, isWall, equals, key } from './grid';
import { SKILLS } from '../data';
import { areEnemies, isAlive } from './entities';
import { skillTargets, canCast, afterCast, tickCooldowns } from './skills';
import { damage, COMBAT_TICK_MS } from '../config';

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
    group = { id, memberIds: [byId], timerMs: 0 };
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

// Advance combat clocks + resolve auto-casts for every group.
export function advanceCombat(s: WorldState, dt: number): void {
  for (const e of Object.values(s.entities)) e.skills = tickCooldowns(e, dt);

  for (const g of Object.values(s.groups)) {
    g.timerMs += dt;
    while (g.timerMs >= COMBAT_TICK_MS) {
      g.timerMs -= COMBAT_TICK_MS;
      fireSkills(s, g);
    }
  }
  cleanupDead(s);
}

function fireSkills(s: WorldState, g: CombatGroup): void {
  for (const caster of membersOf(s, g)) {
    if (!isAlive(caster)) continue;
    const rt = caster.skills[caster.activeSkillIndex];
    if (!rt || !canCast(rt)) continue;
    const skill = SKILLS[rt.skillId];
    const living = membersOf(s, g).filter(isAlive);
    for (const t of skillTargets(caster, skill, living)) {
      if (skill.healing) {
        t.hp = Math.min(t.stats.maxHp, t.hp + skill.healing);
      } else {
        t.hp = Math.max(0, t.hp - damage(caster.stats.atk, skill.power, t.stats.def));
      }
    }
    caster.skills = caster.skills.map((r, i) => (i === caster.activeSkillIndex ? afterCast(r, skill) : r));
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
    if (e.faction === 'enemy' && !isAlive(e)) delete s.entities[e.id];
  }
}

// re-exported for callers/tests that reason about hostility
export { areEnemies };
