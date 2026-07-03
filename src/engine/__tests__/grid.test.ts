import { describe, it, expect } from 'vitest';
import { DIRECTIONS, inBounds, isWall, step, equals } from '../grid';
import { demoMap } from '../../data';

const map = demoMap(5, 5);

describe('grid', () => {
  it('steps one cell in a direction', () => {
    expect(step({ x: 2, y: 2 }, 'left')).toEqual({ x: 1, y: 2 });
    expect(step({ x: 2, y: 2 }, 'down')).toEqual({ x: 2, y: 3 });
  });
  it('detects bounds', () => {
    expect(inBounds(map, { x: 0, y: 0 })).toBe(true);
    expect(inBounds(map, { x: -1, y: 0 })).toBe(false);
  });
  it('treats the border and out-of-bounds as walls', () => {
    expect(isWall(map, { x: 0, y: 0 })).toBe(true);
    expect(isWall(map, { x: 2, y: 2 })).toBe(false);
    expect(isWall(map, { x: 99, y: 99 })).toBe(true);
  });
  it('has four cardinal directions', () => {
    expect(Object.keys(DIRECTIONS).sort()).toEqual(['down', 'left', 'right', 'up']);
  });
  it('compares cells', () => {
    expect(equals({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true);
    expect(equals({ x: 1, y: 1 }, { x: 1, y: 2 })).toBe(false);
  });
});
