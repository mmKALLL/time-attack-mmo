import type { Locale, WorldState } from '../types';

// Pure serialization + localStorage layer. NO engine imports (types only) so the
// engine stays free of persistence concerns. All localStorage access is wrapped
// in try/catch to stay safe under private mode / quota limits / SSR (no window).

export const SAVE_VERSION = 1;
export const MAX_SLOTS = 8; // multi-slot scaffolding; slot 0 is the default active slot

const slotKey = (slot: number): string => `tam:save:${slot}`;
const ACTIVE_KEY = 'tam:active-slot';

// The serialized payload for one slot. `world` is stored with its transient
// fields emptied (see stripTransient) to keep saves small and clean.
type SaveData = { version: number; savedAt: number; world: WorldState };

// Slot summary for the UI; null = empty slot. Derived from the saved player entity.
export type SaveSlotMeta = { slot: number; name: string; level: number; jobId: string; savedAt: number } | null;

// ---------- localStorage helpers (never throw) ----------
function readItem(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // ignore (quota / private mode / SSR)
  }
}

function removeItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ---------- world (de)serialization ----------
// Clone the world with transient combat fields emptied so saves don't carry a
// frozen snapshot of hits/xp floats/pending AoEs.
function stripTransient(world: WorldState): WorldState {
  return { ...world, hits: [], xpGains: [], telegraphs: [], pendingNpc: undefined };
}

// Structural guard: the minimum shape loadSlotRaw/importJson require before
// trusting a parsed blob as a WorldState.
function isWorldShape(w: unknown): w is WorldState {
  if (typeof w !== 'object' || w === null) return false;
  const o = w as Record<string, unknown>;
  return typeof o.entities === 'object' && o.entities !== null && typeof o.playerId === 'string' && typeof o.mapId === 'string';
}

function isSaveData(d: unknown): d is SaveData {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return typeof o.version === 'number' && typeof o.savedAt === 'number' && isWorldShape(o.world);
}

// Parse a SaveData JSON string, validating version + shape. Returns the parsed
// world with transient fields re-emptied, or null on missing/corrupt/incompatible.
function parseSave(json: string | null): WorldState | null {
  if (!json) return null;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isSaveData(data) || data.version !== SAVE_VERSION) return null;
  return stripTransient(data.world);
}

function metaFromWorld(slot: number, world: WorldState, savedAt: number): SaveSlotMeta {
  const player = world.entities[world.playerId];
  if (!player) return null;
  return { slot, name: player.name, level: player.level, jobId: player.jobId, savedAt };
}

// ---------- public API ----------
export function saveSlot(slot: number, world: WorldState): void {
  const data: SaveData = { version: SAVE_VERSION, savedAt: Date.now(), world: stripTransient(world) };
  try {
    writeItem(slotKey(slot), JSON.stringify(data));
  } catch {
    // ignore (serialization failure — shouldn't happen for a plain-data world)
  }
}

export function loadSlotRaw(slot: number): WorldState | null {
  return parseSave(readItem(slotKey(slot)));
}

export function deleteSlot(slot: number): void {
  removeItem(slotKey(slot));
}

export function hasSave(slot: number): boolean {
  return loadSlotRaw(slot) !== null;
}

// One entry per slot (length MAX_SLOTS); null for empty/corrupt slots.
export function listSlots(): SaveSlotMeta[] {
  const out: SaveSlotMeta[] = [];
  for (let slot = 0; slot < MAX_SLOTS; slot++) {
    const json = readItem(slotKey(slot));
    const world = parseSave(json);
    if (!world || !json) {
      out.push(null);
      continue;
    }
    // Recover the original savedAt for the meta (parseSave dropped it); fall back to now.
    let savedAt = Date.now();
    try {
      const raw = JSON.parse(json) as { savedAt?: number };
      if (typeof raw.savedAt === 'number') savedAt = raw.savedAt;
    } catch {
      // keep fallback
    }
    out.push(metaFromWorld(slot, world, savedAt));
  }
  return out;
}

export function getActiveSlot(): number {
  const raw = readItem(ACTIVE_KEY);
  if (raw === null) return 0;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < MAX_SLOTS ? n : 0;
}

export function setActiveSlot(slot: number): void {
  writeItem(ACTIVE_KEY, String(slot));
}

// ---------- UI language (display setting; never part of the saved world) ----------
const LOCALE_KEY = 'tam:locale';
export function getLocale(): Locale {
  return readItem(LOCALE_KEY) === 'ja' ? 'ja' : 'en'; // default English; only 'ja' overrides
}
export function saveLocale(locale: Locale): void {
  writeItem(LOCALE_KEY, locale);
}

// The full SaveData JSON for a slot (for clipboard/file export), or null if empty.
export function exportSlot(slot: number): string | null {
  return readItem(slotKey(slot));
}

// Parse + validate an exported SaveData JSON string. Returns the world or null.
export function importJson(json: string): WorldState | null {
  return parseSave(json);
}
