// Pure helpers for the renderer's per-entity movement tween (see WorldRenderer).
// Kept engine-free and side-effect-free so they're unit-testable headlessly.
import type { Cell } from '../types';

// Linear interpolation from a to b by t (t clamped to [0,1]).
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

// Decelerating ease (cubic) for t in [0,1]: fast start, soft settle. Used for
// the level-up burst's expanding rings/rays so they whoosh out then ease off.
export function easeOutCubic(t: number): number {
  const c = 1 - Math.min(1, Math.max(0, t));
  return 1 - c * c * c;
}

// Scale-overshoot pop for t in [0,1]: rises past 1.0 then settles back to 1.0
// (back-ease). Drives the "LEVEL UP!" banner's springy pop-in. `s` is the
// overshoot amount (~1.70158 is the classic "back" constant).
export function backOvershoot(t: number, s = 1.70158): number {
  const x = Math.min(1, Math.max(0, t)) - 1;
  return x * x * ((s + 1) * x + s) + 1;
}

// A one-tile step glides; anything larger snaps. Snap when the Chebyshev (king-
// move) distance between the previous and next cell exceeds one — i.e. map
// travel / portal / respawn or any teleport — so the sprite never slides across
// the map. (A normal walk is Chebyshev distance 1; standing still is 0.)
export function shouldSnap(prev: Cell, next: Cell): boolean {
  return Math.max(Math.abs(next.x - prev.x), Math.abs(next.y - prev.y)) > 1;
}
