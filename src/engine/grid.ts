import type { Cell, Direction, Offset, TileKind, TileMap } from '../types';

export const DIRECTIONS: Record<Direction, Offset> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function inBounds(map: TileMap, c: Cell): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
}

export function tileAt(map: TileMap, c: Cell): TileKind | undefined {
  if (!inBounds(map, c)) return undefined;
  return map.tiles[c.y * map.width + c.x];
}

export function isWall(map: TileMap, c: Cell): boolean {
  return tileAt(map, c) !== 'floor'; // out-of-bounds counts as wall
}

export function add(c: Cell, o: Offset): Cell {
  return { x: c.x + o.dx, y: c.y + o.dy };
}

export function step(c: Cell, dir: Direction): Cell {
  return add(c, DIRECTIONS[dir]);
}

export function equals(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function key(c: Cell): string {
  return `${c.x},${c.y}`;
}
