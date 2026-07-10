import { create } from 'zustand';
import type { Input, WorldState } from '../types';
import { applyAction, createDemoWorld, tick, travelTo } from '../engine';
import { deleteSlot, exportSlot, getActiveSlot, hasSave, importJson, listSlots, loadSlotRaw, saveSlot, setActiveSlot, type SaveSlotMeta } from './persist';

export type Scene =
  | 'mainMenu'
  | 'worldMap'
  | 'dungeon'
  | 'shop'
  | 'skills'
  | 'charCreate'
  | 'hotkeys'
  | 'npcChat';

// Auto-save cadence: persist the active slot every ~5s of accumulated sim time.
const AUTOSAVE_INTERVAL_MS = 5000;

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
  // Persistence actions
  newGame: () => void;
  loadGame: (slot: number) => void;
  deleteSave: (slot: number) => void;
  exportSave: (slot: number) => string | null;
  importSave: (slot: number, json: string) => void;
  // Thin re-exports for the UI (so screens read persistence through the store).
  getActiveSlot: () => number;
  listSlots: () => SaveSlotMeta[];
  hasSave: (slot: number) => boolean;
};

// Turn a loaded world into a clean map re-entry: keep the HERO party, drop the
// frozen enemy snapshot + groups + transient fields, then re-enter its map via
// travelTo (which regenerates geometry, respawns enemies, and places the party
// at the portal entry). This is the "spawn as if you walked in from the portal"
// behaviour — no stale combat state is restored. Idempotent w.r.t. travelTo's
// own enemy-clearing.
function enterLoaded(w: WorldState): WorldState {
  const heroes = Object.values(w.entities).filter((e) => e.faction !== 'enemy');
  const world: WorldState = {
    ...w,
    entities: Object.fromEntries(heroes.map((e) => [e.id, e])),
    groups: {},
    hits: [],
    xpGains: [],
    telegraphs: [],
  };
  travelTo(world, world.mapId);
  return world;
}

// Boot the world: restore the active slot if it holds a valid save, else start
// a fresh demo world.
function bootWorld(): WorldState {
  const loaded = loadSlotRaw(getActiveSlot());
  return loaded ? enterLoaded(loaded) : createDemoWorld();
}

// Auto-save accumulator (sim time since the last persist).
let autosaveClockMs = 0;

export const useGame = create<GameStore>((set) => ({
  scene: 'mainMenu',
  world: bootWorld(),
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
      // Throttled auto-save: accumulate sim time and persist every ~5s.
      const clock = autosaveClockMs + dt;
      if (clock >= AUTOSAVE_INTERVAL_MS) {
        autosaveClockMs = clock % AUTOSAVE_INTERVAL_MS;
        saveSlot(getActiveSlot(), world);
      } else {
        autosaveClockMs = clock;
      }
      return { world, inputQueue: [], highlights };
    }),
  reset: () => {
    const world = createDemoWorld();
    saveSlot(getActiveSlot(), world);
    autosaveClockMs = 0;
    set({ scene: 'dungeon', world, inputQueue: [], highlights: {} });
  },
  newGame: () => {
    const world = createDemoWorld();
    saveSlot(getActiveSlot(), world);
    autosaveClockMs = 0;
    set({ world, inputQueue: [], highlights: {} });
  },
  loadGame: (slot) => {
    setActiveSlot(slot);
    const loaded = loadSlotRaw(slot);
    if (!loaded) return;
    autosaveClockMs = 0;
    set({ world: enterLoaded(loaded), inputQueue: [], highlights: {} });
  },
  deleteSave: (slot) => deleteSlot(slot),
  exportSave: (slot) => exportSlot(slot),
  importSave: (slot, json) => {
    const w = importJson(json);
    if (!w) return;
    const world = enterLoaded(w);
    saveSlot(slot, world);
    setActiveSlot(slot);
    autosaveClockMs = 0;
    set({ world, inputQueue: [], highlights: {} });
  },
  getActiveSlot: () => getActiveSlot(),
  listSlots: () => listSlots(),
  hasSave: (slot) => hasSave(slot),
}));
