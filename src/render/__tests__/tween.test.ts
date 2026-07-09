import { describe, it, expect } from 'vitest';
import { lerp, shouldSnap, easeOutCubic, backOvershoot } from '../tween';

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

describe('easeOutCubic', () => {
  it('pins the endpoints and decelerates (fast start, soft settle)', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5); // past halfway by the midpoint
    expect(easeOutCubic(-1)).toBe(0); // clamped below
    expect(easeOutCubic(2)).toBe(1); // clamped above
  });
});

describe('backOvershoot', () => {
  it('pins the endpoints and overshoots past 1.0 before settling', () => {
    expect(backOvershoot(0)).toBeCloseTo(0, 5);
    expect(backOvershoot(1)).toBeCloseTo(1, 5);
    // classic back-ease peaks above 1 in the back half of the curve
    const peak = Math.max(...[0.6, 0.7, 0.75, 0.8, 0.9].map((t) => backOvershoot(t)));
    expect(peak).toBeGreaterThan(1);
  });
});
