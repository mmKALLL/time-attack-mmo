import type { Input, WorldState } from '../types';
import { moveOrStick, advanceCombat } from './combat';

export function applyInput(s: WorldState, input: Input): void {
  const player = s.entities[s.playerId];
  if (!player || player.hp <= 0) return; // dead players take no actions until respawn
  if (input.type === 'move') {
    moveOrStick(s, s.playerId, input.dir);
  } else if (input.type === 'selectSkill') {
    if (input.slot >= 0 && input.slot < player.skills.length) player.activeSkillIndex = input.slot;
  }
}

// Pure reducer: clones once, mutates the copy via commands, returns it.
// This exact signature is what a future authoritative server would run.
export function tick(state: WorldState, inputs: Input[], dt: number): WorldState {
  const s = structuredClone(state) as WorldState;
  for (const input of inputs) applyInput(s, input);
  advanceCombat(s, dt);
  s.tickCount += 1;
  return s;
}
