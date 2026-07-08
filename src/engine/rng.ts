// Deterministic seeded PRNG (mulberry32). It mutates the holder's `rng` state so
// randomness threads through the pure tick() reducer and stays replay/network-safe.
export function nextRand(s: { rng: number }): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(s: { rng: number }, min: number, max: number): number {
  return min + Math.floor(nextRand(s) * (max - min + 1));
}

export function pick<T>(s: { rng: number }, arr: readonly T[]): T {
  return arr[randInt(s, 0, arr.length - 1)];
}

export function chance(s: { rng: number }, p: number): boolean {
  return nextRand(s) < p;
}
