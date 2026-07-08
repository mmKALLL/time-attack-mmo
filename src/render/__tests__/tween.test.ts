import { describe, it, expect } from 'vitest';
import { lerp, shouldSnap } from '../tween';

describe('lerp', () => {
  it('interpolates linearly and clamps t to [0,1]', () => {
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 0.25)).toBe(25);
    expect(lerp(0, 100, 1)).toBe(100);
    expect(lerp(0, 100, -1)).toBe(0); // clamped below
    expect(lerp(0, 100, 2)).toBe(100); // clamped above
  });
});

describe('shouldSnap', () => {
  it('slides a one-tile step (Chebyshev distance <= 1)', () => {
    expect(shouldSnap({ x: 3, y: 3 }, { x: 3, y: 3 })).toBe(false); // still
    expect(shouldSnap({ x: 3, y: 3 }, { x: 4, y: 3 })).toBe(false); // orthogonal
    expect(shouldSnap({ x: 3, y: 3 }, { x: 4, y: 4 })).toBe(false); // diagonal
  });
  it('snaps a jump greater than one tile (travel/portal/respawn)', () => {
    expect(shouldSnap({ x: 3, y: 3 }, { x: 5, y: 3 })).toBe(true);
    expect(shouldSnap({ x: 0, y: 0 }, { x: 12, y: 8 })).toBe(true);
  });
});
