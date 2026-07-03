import type { Input, WorldState } from '../types';
import { moveOrStick, advanceCombat } from './combat';

export function applyInput(s: WorldState, input: Input): void {
  if (input.type === 'move') {
    moveOrStick(s, s.playerId, input.dir);
  } else if (input.type === 'selectSkill') {
    const p = s.entities[s.playerId];
    if (p && input.slot >= 0 && input.slot < p.skills.length) p.activeSkillIndex = input.slot;
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
