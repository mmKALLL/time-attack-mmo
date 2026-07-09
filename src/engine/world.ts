import type { Input, WorldState } from '../types';
import { moveOrStick, advanceCombat, advanceArming, advanceTelegraphs, groupOf } from './combat';
import { exitAt, travelTo, advanceRespawns } from './maps';
import { advanceRoaming } from './roaming';
import { spendAttribute, levelUpSkill } from './progression';
import { START_MAP } from '../data-map';
import { step } from './grid';

// Respawn the player at the starting town (Mäntyharju) at full health — triggered
// by the "You Died" screen's Respawn button.
function respawnAtStart(s: WorldState): void {
  travelTo(s, START_MAP);
  const p = s.entities[s.playerId];
  if (p) {
    p.hp = p.stats.maxHp;
    p.mp = p.stats.maxMp;
    p.castTimerMs = 0;
  }
}

export function applyInput(s: WorldState, input: Input): void {
  // Actions allowed regardless of combat/death state (character screen, respawn).
  if (input.type === 'spendAttr') return spendAttribute(s, input.key);
  if (input.type === 'levelUpSkill') return levelUpSkill(s, input.index);
  if (input.type === 'travelToMap') return travelTo(s, input.mapId); // world-map quick travel (no fromMap => arrive at the map's entry)
  if (input.type === 'respawn') return respawnAtStart(s);
  const player = s.entities[s.playerId];
  if (!player || player.hp <= 0) return; // dead players take no actions until respawn
  if (input.type === 'move') {
    // Stepping onto a portal tile (while not stuck in combat) warps to the linked map.
    if (!groupOf(s, player.id)) {
      const exit = exitAt(s, step(player.cell, input.dir));
      if (exit) {
        player.facing = input.dir; // face the way we walked into the portal
        travelTo(s, exit.toMap, s.mapId, input.dir); // ...and arrive continuing that way
        return;
      }
    }
    moveOrStick(s, s.playerId, input.dir);
  } else if (input.type === 'selectSkill') {
    if (input.slot < 0 || input.slot >= player.skills.length) return;
    player.activeSkillIndex = input.slot;
    // In a combat group: just swap the active skill (auto-cast is unchanged) — no arming.
    // Out of combat: ARM a ranged fire-and-engage (resolved by advanceArming). Only reset
    // the wind-up when arming fresh (previously unarmed); re-pressing while already armed
    // swaps the skill mid-wind-up without dropping the timer.
    if (groupOf(s, player.id)) return;
    if (!player.armed) player.castTimerMs = 0;
    player.armed = true;
  }
}

// Apply a single input outside the sim clock (character-screen allocation, which
// runs while the game loop is paused). Pure: clones, mutates the copy, returns it.
export function applyAction(state: WorldState, input: Input): WorldState {
  const s = structuredClone(state) as WorldState;
  applyInput(s, input);
  return s;
}

// Pure reducer: clones once, mutates the copy via commands, returns it.
// This exact signature is what a future authoritative server would run.
export function tick(state: WorldState, inputs: Input[], dt: number): WorldState {
  const s = structuredClone(state) as WorldState;
  s.hits = []; // combat text events for this tick only
  for (const input of inputs) applyInput(s, input);
  // Roam AFTER input so idle enemies see the player's already-updated cell:
  // they avoid it or bump it into combat, never co-occupying a tile the player
  // moved into on the same frame.
  advanceRoaming(s, dt);
  advanceCombat(s, dt);
  // Out-of-combat ranged fire: wind up + fire an ARMED skill at enemies its shape
  // covers, engaging them. AFTER advanceCombat so an engage this frame is combat's
  // to drive next frame; BEFORE telegraphs so a stick lands before AoEs resolve.
  advanceArming(s, dt);
  // Resolve telegraphed AoEs AFTER input+combat: a hero's move this tick (applied
  // at the top) is already reflected, so stepping off a marked tile dodges the hit.
  // A telegraph planted this same tick won't resolve yet (its full lead time remains).
  advanceTelegraphs(s, dt);
  advanceRespawns(s, dt);
  s.tickCount += 1;
  return s;
}
