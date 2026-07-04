import { describe, it, expect } from 'vitest';
import { shapeFor } from '../shapes';
import { getSkill } from '../../data';

describe('shapeFor', () => {
  it('self / party shapes are fixed regardless of level', () => {
    expect(shapeFor(getSkill('recover'), 1)).toEqual([{ dx: 0, dy: 0 }]);
    expect(shapeFor(getSkill('verdantWellspring'), 1)).toHaveLength(shapeFor(getSkill('verdantWellspring'), 5).length);
  });
  it('AoE footprints grow with the {tiles} param as level rises', () => {
    const cleaveLo = shapeFor(getSkill('cleave'), 1).length; // tiles = 3
    const cleaveHi = shapeFor(getSkill('cleave'), 5).length; // tiles = 3 + 0.5*4 = 5
    expect(cleaveHi).toBeGreaterThan(cleaveLo);
  });
  it('a line skill lays cells straight ahead', () => {
    const cells = shapeFor(getSkill('emberLance'), 3);
    expect(cells.every((c) => c.dy === 0 && c.dx > 0)).toBe(true);
  });
  it('melee resolves to the four adjacent tiles', () => {
    expect(shapeFor(getSkill('strike'), 1)).toHaveLength(4);
  });
});
