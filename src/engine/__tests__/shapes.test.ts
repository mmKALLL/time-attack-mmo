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
  it('diagonalCross lays an X: centre a cell ahead plus four diagonal arms', () => {
    const cells = shapeFor(getSkill('crossBlast'), 1); // crossBlast has no {tiles}: DEFAULT_TILES.diagonalCross = 5
    expect(cells).toHaveLength(5);
    expect(cells.some((c) => c.dx === 2 && c.dy === 0)).toBe(true); // the ahead-centre tile
    const arms = cells.filter((c) => !(c.dx === 2 && c.dy === 0));
    expect(arms).toHaveLength(4);
    // Every non-centre cell sits on a diagonal from the centre (2,0).
    expect(arms.every((c) => Math.abs(c.dx - 2) === Math.abs(c.dy) && c.dy !== 0)).toBe(true);
  });
  it('diagonalCross scales with the {tiles} param, capped at the r<=4 arms', () => {
    // crossBlast has no {tiles} param, so exercise scaling via a synthetic skill.
    const skill = { ...getSkill('crossBlast'), params: { ...getSkill('crossBlast').params, tiles: (lvl: number) => lvl } };
    const lo = shapeFor(skill, 5).length; // tiles = 5 -> centre + one ring
    const hi = shapeFor(skill, 9).length; // tiles = 9 -> centre + two rings
    expect(hi).toBeGreaterThan(lo);
    // The r<=4 cap tops out at the centre + four diagonal rings = 17 cells.
    expect(shapeFor(skill, 100).length).toBe(17);
  });
  it('Cross Blast uses the diagonalCross shape; Radiant Smite stays on the orthogonal cross', () => {
    expect(getSkill('crossBlast').shapeKind).toBe('diagonalCross');
    expect(getSkill('radiantSmite').shapeKind).toBe('cross');
  });
});

describe('offset shape projection', () => {
  it('shifts every cell forward by the offset (facing right: dx +2)', () => {
    const base = getSkill('emberLance');
    const shifted = { ...base, offset: 2 };
    const plain = shapeFor(base, 3, 'right');
    const moved = shapeFor(shifted, 3, 'right');
    expect(moved).toHaveLength(plain.length);
    // Every cell is the same as the no-offset cell, pushed +2 along the forward (dx) axis.
    plain.forEach((c, i) => expect(moved[i]).toEqual({ dx: c.dx + 2, dy: c.dy }));
  });
  it('rotates the offset with the facing (facing up shifts along -y)', () => {
    const base = getSkill('emberLance');
    const shifted = { ...base, offset: 2 };
    const plain = shapeFor(base, 3, 'up');
    const moved = shapeFor(shifted, 3, 'up');
    // Facing up, forward is -y, so the offset pushes cells by dy -2 (dx unchanged).
    plain.forEach((c, i) => expect(moved[i]).toEqual({ dx: c.dx, dy: c.dy - 2 }));
  });
  it('a no-offset skill is unchanged', () => {
    const base = getSkill('emberLance');
    expect(shapeFor({ ...base, offset: 0 }, 3, 'right')).toEqual(shapeFor(base, 3, 'right'));
    expect(shapeFor(base, 3, 'right')).toEqual(shapeFor({ ...base, offset: undefined }, 3, 'right'));
  });
  it('Scatter Shot projects its arc 2 tiles out with an empty row in front (facing right)', () => {
    expect(getSkill('scatterShot').offset).toBe(1); // one empty tile between caster and hitbox
    const cells = shapeFor(getSkill('scatterShot'), 1, 'right');
    const nearest = Math.min(...cells.map((c) => c.dx));
    expect(nearest).toBe(2); // nearest hitbox tile is 2 out (offset 1 => empty dx=1 row)
    expect(cells.some((c) => c.dx === 1)).toBe(false); // gap directly in front of the caster
  });
  it("Arcane Arc's nearest tile is 3 out (facing right)", () => {
    expect(getSkill('arcaneArc').offset).toBe(2); // two empty tiles between caster and hitbox
    const cells = shapeFor(getSkill('arcaneArc'), 1, 'right');
    const nearest = Math.min(...cells.map((c) => c.dx));
    expect(nearest).toBe(3); // nearest hitbox tile is 3 out (offset 2 => empty dx=1,2 rows)
    expect(cells.some((c) => c.dx === 1 || c.dx === 2)).toBe(false); // two-tile gap in front
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
