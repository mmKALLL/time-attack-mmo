import { describe, it, expect } from 'vitest';
import { parseTileRef, tileRect, tileLayout } from '../asset-tiles';

describe('asset tile refs', () => {
  it('parses q<quadrant>-<index> and rejects out-of-range', () => {
    expect(parseTileRef('q1-1')).toEqual({ quadrant: 1, index: 1 });
    expect(parseTileRef('q4-16')).toEqual({ quadrant: 4, index: 16 });
    expect(() => parseTileRef('q5-1')).toThrow();
    expect(() => parseTileRef('q1-17')).toThrow();
    expect(() => parseTileRef('nope')).toThrow();
  });
  it('maps quadrant+index to the right 256px source rect', () => {
    expect(tileRect('q1-1')).toEqual({ x: 0, y: 0, w: 256, h: 256 });
    expect(tileRect('q1-16')).toEqual({ x: 768, y: 768, w: 256, h: 256 }); // col 3, row 3
    expect(tileRect('q2-1')).toEqual({ x: 1024, y: 0, w: 256, h: 256 });
    expect(tileRect('q3-1')).toEqual({ x: 0, y: 1024, w: 256, h: 256 });
    expect(tileRect('q4-7')).toEqual({ x: 1536, y: 1280, w: 256, h: 256 }); // col 2, row 1
  });
  it('lays out 1 / 2 / 4 tiles', () => {
    expect(tileLayout('q1-1')).toEqual({ cols: 1, rows: 1, refs: ['q1-1'] });
    expect(tileLayout(['q1-1', 'q1-2'])).toEqual({ cols: 1, rows: 2, refs: ['q1-1', 'q1-2'] });
    expect(tileLayout(['q1-9', 'q1-10', 'q1-13', 'q1-14'])).toEqual({ cols: 2, rows: 2, refs: ['q1-9', 'q1-10', 'q1-13', 'q1-14'] });
  });
});
