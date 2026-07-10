import type { Entity, Skill, StatusApplication, WorldState } from '../types';
import { STATUS, STUN_IMMUNITY_MS, effectiveStats, poisonTickDamage, statusResistPercent } from '../config-stats';
import { cleanupDead } from './combat';
import { isAlive } from './entities';

// Resolve one StatusApplication's magnitude against the caster + skill level and
// push (or refresh) it onto the target. `potency` is baked in now so the effect
// never depends on the caster afterward.
export function applyStatus(_s: WorldState, target: Entity, application: StatusApplication, caster: Entity, skill: Skill, level: number): void {
  const kind = application.name;
  const paramName = application.param ?? 'pct';
  const paramValue = skill.params[paramName]?.(level) ?? 0;

  // Stun ignores post-stun immunity: a fresh stun on an immune target is a no-op.
  if (kind === 'stun' && (target.stunImmuneMs ?? 0) > 0) return;

  let potency = 0;
  if (kind === 'burn' || kind === 'bleed') {
    // Absolute damage per tick = caster max damage × pct%.
    potency = Math.round((effectiveStats(caster).maxDmg * paramValue) / 100);
  } else if (kind === 'stun') {
    potency = 0; // unused
  } else {
    // poison = %/sec; slow/atk*/def*/dodge/blind/statPercent/statFlat = the raw param value.
    potency = paramValue;
  }

  // Status-resist: harmful effects still land, but the target's resist % scales
  // their magnitude down (stun has no potency, so its DURATION shrinks instead).
  // statPercent/statFlat only count as harmful when their potency is a net penalty.
  const harmful = STATUS[kind].harmful || ((kind === 'statPercent' || kind === 'statFlat') && potency < 0);
  const resist = statusResistPercent(target); // already clamped [0,95]
  let msLeft = STATUS[kind].durationMs;
  if (harmful && resist > 0) {
    if (kind === 'stun') msLeft = Math.round(STATUS[kind].durationMs * (1 - resist / 100));
    else potency *= 1 - resist / 100;
  }

  const sourceId = `${caster.id}:${skill.id}`;
  const cap = STATUS[kind].maxStacksPerSource;
  const sameSource = target.statuses.filter((st) => st.kind === kind && st.sourceId === sourceId);

  if (sameSource.length < cap) {
    target.statuses.push({ kind, potency, msLeft, sourceId, stat: application.stat, dotElapsedMs: 0 });
    return;
  }
  // At cap. Single-stack kinds hold the existing instance (re-applies after it
  // expires). Multi-stack kinds (bleed) refresh the stack with the least time left.
  if (cap > 1) {
    let smallest = sameSource[0];
    for (const st of sameSource) if (st.msLeft < smallest.msLeft) smallest = st;
    smallest.msLeft = msLeft;
    smallest.potency = potency;
    smallest.dotElapsedMs = 0;
  }
}

// New tick step: age every entity's statuses, resolve DoT ticks, drop expired
// ones, and manage the post-stun immunity window. Runs after combat/telegraphs
// and before respawns so DoT deaths get cleaned up + respawned this same tick.
export function advanceStatuses(s: WorldState, dt: number): void {
  for (const e of Object.values(s.entities)) {
    if (!isAlive(e)) continue;
    if (e.stunImmuneMs && e.stunImmuneMs > 0) e.stunImmuneMs = Math.max(0, e.stunImmuneMs - dt);

    const hadStun = e.statuses.some((st) => st.kind === 'stun');
    for (const st of e.statuses) {
      st.msLeft -= dt;
      const tickMs = STATUS[st.kind].tickMs;
      if (tickMs) {
        st.dotElapsedMs = (st.dotElapsedMs ?? 0) + dt;
        while (st.dotElapsedMs >= tickMs && isAlive(e)) {
          st.dotElapsedMs -= tickMs;
          const amount = st.kind === 'poison' ? poisonTickDamage(st.potency, e.stats.maxHp) : Math.round(st.potency);
          if (amount <= 0) continue;
          e.hp = Math.max(0, e.hp - amount);
          s.hits.push({ cell: { ...e.cell }, kind: 'damage', amount });
        }
      }
    }
    // Drop expired. A stun that fully expires (and leaves no other active stun)
    // grants the post-stun immunity window.
    const expiredStun = e.statuses.some((st) => st.kind === 'stun' && st.msLeft <= 0);
    e.statuses = e.statuses.filter((st) => st.msLeft > 0);
    if (hadStun && expiredStun && !e.statuses.some((st) => st.kind === 'stun')) e.stunImmuneMs = STUN_IMMUNITY_MS;
  }
  cleanupDead(s); // route DoT deaths through the same kill/respawn handling as combat
}
