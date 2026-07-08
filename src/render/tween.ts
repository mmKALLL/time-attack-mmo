// Pure helpers for the renderer's per-entity movement tween (see WorldRenderer).
// Kept engine-free and side-effect-free so they're unit-testable headlessly.
import type { Cell } from '../types';

// Linear interpolation from a to b by t (t clamped to [0,1]).
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

// A one-tile step glides; anything larger snaps. Snap when the Chebyshev (king-
// move) distance between the previous and next cell exceeds one — i.e. map
// travel / portal / respawn or any teleport — so the sprite never slides across
// the map. (A normal walk is Chebyshev distance 1; standing still is 0.)
export function shouldSnap(prev: Cell, next: Cell): boolean {
  return Math.max(Math.abs(next.x - prev.x), Math.abs(next.y - prev.y)) > 1;
}
