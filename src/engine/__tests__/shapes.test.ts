import { describe, it, expect } from 'vitest';
import { shapeFor, rotate } from '../shapes';
import { getSkill } from '../../data-skills';

describe('shapeFor', () => {
  it('self / party shapes are fixed regardless of level', () => {
    expect(shapeFor(getSkill('recover'), 1)).toEqual([{ dx: 0, dy: 0 }]);
    expect(shapeFor(getSkill('verdantWellspring'), 1)).toHaveLength(shapeFor(getSkill('verdantWellspring'), 5).length);
  });
  it('AoE footprints grow with the {tiles} param as level rises', () => {
    const earthLo = shapeFor(getSkill('earthsmash'), 1).length; // tiles = 3
    const earthHi = shapeFor(getSkill('earthsmash'), 5).length; // tiles = 3 + 0.5*4 = 5
    expect(earthHi).toBeGreaterThan(earthLo);
  });
  it('a line skill lays cells straight ahead', () => {
    const cells = shapeFor(getSkill('emberLance'), 3);
    expect(cells.every((c) => c.dy === 0 && c.dx > 0)).toBe(true);
  });
  it('melee resolves to the single faced tile', () => {
    expect(shapeFor(getSkill('strike'), 1)).toEqual([{ dx: 1, dy: 0 }]);
  });
  it('surround covers exactly the 8 ring tiles around the caster', () => {
    const cells = shapeFor(getSkill('spinSlash'), 1);
    expect(cells).toHaveLength(8);
    expect(cells.some((c) => c.dx === 0 && c.dy === 0)).toBe(false); // never the caster's own tile
    expect(cells.every((c) => Math.abs(c.dx) <= 1 && Math.abs(c.dy) <= 1)).toBe(true);
  });
  it('surround is fixed at 8 and does NOT scale with the {tiles} param', () => {
    expect(shapeFor(getSkill('spinSlash'), 1)).toHaveLength(8);
    expect(shapeFor(getSkill('spinSlash'), 20)).toHaveLength(8);
    expect(shapeFor(getSkill('spinSlash'), 1)).toEqual(shapeFor(getSkill('spinSlash'), 20));
  });
  it('Spin Slash uses the surround shape', () => {
    expect(getSkill('spinSlash').shapeKind).toBe('surround');
  });
});

describe('facing rotation', () => {
  it('rotate maps forward (1,0) to each facing', () => {
    expect(rotate({ dx: 1, dy: 0 }, 'right')).toEqual({ dx: 1, dy: 0 });
    expect(rotate({ dx: 1, dy: 0 }, 'down')).toEqual({ dx: 0, dy: 1 });
    expect(rotate({ dx: 1, dy: 0 }, 'up')).toEqual({ dx: 0, dy: -1 });
    expect(rotate({ dx: 1, dy: 0 }, 'left')).toEqual({ dx: -1, dy: 0 });
  });
  it('rotates a line skill to lay cells in the facing direction', () => {
    expect(shapeFor(getSkill('emberLance'), 3, 'down').every((c) => c.dx === 0 && c.dy > 0)).toBe(true);
    expect(shapeFor(getSkill('emberLance'), 3, 'left').every((c) => c.dy === 0 && c.dx < 0)).toBe(true);
  });
  it('melee rotates to the faced tile', () => {
    expect(shapeFor(getSkill('strike'), 1, 'right')).toEqual([{ dx: 1, dy: 0 }]);
    expect(shapeFor(getSkill('strike'), 1, 'down')).toEqual([{ dx: 0, dy: 1 }]);
  });
});
