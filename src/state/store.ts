import { create } from 'zustand';
import type { Input, WorldState } from '../types';
import { applyAction, createDemoWorld, tick } from '../engine';

export type Scene =
  | 'mainMenu'
  | 'worldMap'
  | 'dungeon'
  | 'shop'
  | 'skills'
  | 'charCreate'
  | 'hotkeys'
  | 'npcChat';

type GameStore = {
  scene: Scene;
  world: WorldState;
  inputQueue: Input[];
  highlights: Partial<Record<Scene, boolean>>; // nav buttons flagged to glow until their scene is opened
  setScene: (scene: Scene) => void;
  enqueue: (input: Input) => void;
  dispatch: (input: Input) => void; // apply an input now (used off the sim clock)
  advance: (dt: number) => void;
  reset: () => void;
};

export const useGame = create<GameStore>((set) => ({
  scene: 'mainMenu',
  world: createDemoWorld(),
  inputQueue: [],
  highlights: {},
  // Opening a scene clears its highlight (acknowledgement).
  setScene: (scene) => set((st) => ({ scene, highlights: { ...st.highlights, [scene]: false } })),
  enqueue: (input) => set((st) => ({ inputQueue: [...st.inputQueue, input] })),
  dispatch: (input) => set((st) => ({ world: applyAction(st.world, input) })),
  // Flag the skills nav to glow when the player levels up across this tick.
  advance: (dt) =>
    set((st) => {
      const world = tick(st.world, st.inputQueue, dt);
      const before = st.world.entities[st.world.playerId]?.level ?? 0;
      const after = world.entities[world.playerId]?.level ?? 0;
      const highlights = after > before ? { ...st.highlights, skills: true } : st.highlights;
      return { world, inputQueue: [], highlights };
    }),
  reset: () => set({ scene: 'dungeon', world: createDemoWorld(), inputQueue: [], highlights: {} }),
}));
