import type { Direction, Offset, Skill, ShapeKind } from '../types';

// Rotate an offset authored for facing 'right' (+x) to the given facing.
const z = (n: number) => n + 0; // normalize -0 to 0
export function rotate(o: Offset, facing: Direction): Offset {
  switch (facing) {
    case 'right':
      return { dx: o.dx, dy: o.dy };
    case 'left':
      return { dx: z(-o.dx), dy: z(-o.dy) };
    case 'down':
      return { dx: z(-o.dy), dy: o.dx };
    case 'up':
      return { dx: o.dy, dy: z(-o.dx) };
  }
}

// Default tile counts when a skill has no {tiles} param.
const DEFAULT_TILES: Record<ShapeKind, number> = {
  self: 1,
  melee: 1,
  point: 1,
  line: 3,
  arc: 3,
  area: 6,
  cross: 5,
  diagonalCross: 5,
  party: 9,
  surround: 8,
};

function line(n: number): Offset[] {
  const out: Offset[] = [];
  for (let x = 1; x <= n; x++) out.push({ dx: x, dy: 0 });
  return out;
}

// A front-facing arc: a vertical span of `n` tiles one cell ahead.
function arc(n: number): Offset[] {
  const out: Offset[] = [];
  const half = Math.floor(n / 2);
  for (let dy = -half; out.length < n && dy <= half + 1; dy++) out.push({ dx: 1, dy });
  return out.slice(0, n);
}

// A compact forward block, width 2, growing in depth; ~2×3 at n=6.
function area(n: number): Offset[] {
  const width = 2;
  const height = Math.ceil(n / width);
  const top = -Math.floor((height - 1) / 2);
  const out: Offset[] = [];
  for (let dx = 1; dx <= width && out.length < n; dx++) for (let h = 0; h < height && out.length < n; h++) out.push({ dx, dy: top + h });
  return out;
}

// A plus centered a cell ahead; arms grow with `n`.
function cross(n: number): Offset[] {
  const cx = 2;
  const out: Offset[] = [{ dx: cx, dy: 0 }];
  for (let r = 1; out.length < n && r <= 4; r++) out.push({ dx: cx + r, dy: 0 }, { dx: cx - r, dy: 0 }, { dx: cx, dy: -r }, { dx: cx, dy: r });
  return out.slice(0, n);
}

// An X centered a cell ahead; the four arms run along the diagonals, growing with `n`.
function diagonalCross(n: number): Offset[] {
  const cx = 2;
  const out: Offset[] = [{ dx: cx, dy: 0 }];
  for (let r = 1; out.length < n && r <= 4; r++) out.push({ dx: cx + r, dy: -r }, { dx: cx + r, dy: r }, { dx: cx - r, dy: -r }, { dx: cx - r, dy: r });
  return out.slice(0, n);
}

function party(): Offset[] {
  return [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: 1 },
  ];
}

// The 8 tiles ringing the caster (the party() footprint minus its own centre).
// FIXED at the 8-ring — does not scale with {tiles}; rotation-symmetric.
function surround(): Offset[] {
  return party().filter((o) => o.dx !== 0 || o.dy !== 0);
}

// The footprint a skill hits at a given level, rotated to the caster's facing.
// AoE footprints grow with the skill's {tiles} param (design §"shapes scale").
export function shapeFor(skill: Skill, level: number, facing: Direction = 'right'): Offset[] {
  const tiles = Math.max(1, Math.round(skill.params.tiles?.(level) ?? DEFAULT_TILES[skill.shapeKind]));
  const base = baseShape(skill.shapeKind, tiles);
  return base.map((o) => rotate(o, facing));
}

function baseShape(shapeKind: ShapeKind, tiles: number): Offset[] {
  switch (shapeKind) {
    case 'self':
      return [{ dx: 0, dy: 0 }];
    case 'party':
      return party();
    case 'surround':
      return surround();
    case 'melee':
    case 'point':
      return [{ dx: 1, dy: 0 }]; // the single tile the caster faces
    case 'line':
      return line(tiles);
    case 'arc':
      return arc(tiles);
    case 'area':
      return area(tiles);
    case 'cross':
      return cross(tiles);
    case 'diagonalCross':
      return diagonalCross(tiles);
  }
}
