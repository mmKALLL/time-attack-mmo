import { create } from 'zustand';
import type { Input, WorldState } from '../types';
import { applyAction, createDemoWorld, tick } from '../engine';

export type Scene =
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
  setScene: (scene: Scene) => void;
  enqueue: (input: Input) => void;
  dispatch: (input: Input) => void; // apply an input now (used off the sim clock)
  advance: (dt: number) => void;
  reset: () => void;
};

export const useGame = create<GameStore>((set) => ({
  scene: 'dungeon',
  world: createDemoWorld(),
  inputQueue: [],
  setScene: (scene) => set({ scene }),
  enqueue: (input) => set((st) => ({ inputQueue: [...st.inputQueue, input] })),
  dispatch: (input) => set((st) => ({ world: applyAction(st.world, input) })),
  advance: (dt) => set((st) => ({ world: tick(st.world, st.inputQueue, dt), inputQueue: [] })),
  reset: () => set({ scene: 'dungeon', world: createDemoWorld(), inputQueue: [] }),
}));
