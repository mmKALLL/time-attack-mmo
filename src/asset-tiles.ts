// Enemy spritesheets are 2048x2048: four quadrants (q1 q2 / q3 q4), each a 4x4
// grid of 256px tiles indexed 1-16. A tile ref is "q<quadrant>-<index>" (e.g.
// "q2-7"). An enemy uses one tile, two (stacked vertically), or four (a 2x2 grid).
import { ENEMY_TILE_SRC } from './config';

export type TileRect = { x: number; y: number; w: number; h: number };

export function parseTileRef(ref: string): { quadrant: number; index: number } {
  const m = /^q([1-4])-(\d{1,2})$/.exec(ref);
  if (!m) throw new Error(`Bad tile ref: ${ref}`);
  const index = Number(m[2]);
  if (index < 1 || index > 16) throw new Error(`Tile index out of range: ${ref}`);
  return { quadrant: Number(m[1]), index };
}

// Pixel rect of a tile ref within the full 2048x2048 sheet.
export function tileRect(ref: string, tile = ENEMY_TILE_SRC): TileRect {
  const { quadrant, index } = parseTileRef(ref);
  const qx = quadrant === 2 || quadrant === 4 ? 4 * tile : 0;
  const qy = quadrant === 3 || quadrant === 4 ? 4 * tile : 0;
  const col = (index - 1) % 4;
  const row = Math.floor((index - 1) / 4);
  return { x: qx + col * tile, y: qy + row * tile, w: tile, h: tile };
}

export type TileLayout = { cols: number; rows: number; refs: string[] };

// How the tiles arrange: 1 -> 1x1, 2 -> 1x2 (stacked), 4 -> 2x2 grid.
export function tileLayout(tiles: string | string[]): TileLayout {
  const refs = Array.isArray(tiles) ? tiles : [tiles];
  if (refs.length === 4) return { cols: 2, rows: 2, refs };
  if (refs.length === 2) return { cols: 1, rows: 2, refs };
  return { cols: refs.length, rows: 1, refs };
}
