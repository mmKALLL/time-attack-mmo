import type { Input, WorldState } from '../types';
import { moveOrStick, advanceCombat, groupOf } from './combat';
import { exitAt, travelTo, advanceRespawns } from './maps';
import { spendAttribute, levelUpSkill } from './progression';
import { START_MAP } from '../data-map';
import { step } from './grid';

// On death the player returns to the starting town (Mäntyharju) at full health.
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
  // Character-screen actions work regardless of combat/death state.
  if (input.type === 'spendAttr') return spendAttribute(s, input.key);
  if (input.type === 'levelUpSkill') return levelUpSkill(s, input.index);
  const player = s.entities[s.playerId];
  if (!player || player.hp <= 0) return; // dead players take no actions until respawn
  if (input.type === 'move') {
    // Stepping onto a portal tile (while not stuck in combat) warps to the linked map.
    if (!groupOf(s, player.id)) {
      const exit = exitAt(s, step(player.cell, input.dir));
      if (exit) {
        travelTo(s, exit.toMap, s.mapId);
        return;
      }
    }
    moveOrStick(s, s.playerId, input.dir);
  } else if (input.type === 'selectSkill') {
    if (input.slot >= 0 && input.slot < player.skills.length) player.activeSkillIndex = input.slot;
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
  advanceCombat(s, dt);
  advanceRespawns(s, dt);
  const player = s.entities[s.playerId];
  if (player && player.hp <= 0) respawnAtStart(s);
  s.tickCount += 1;
  return s;
}
