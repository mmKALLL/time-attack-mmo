import { Application, Container, FillGradient, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { Biome, CombatGroup, Entity, ObstacleSize, TilesetName, WorldState } from '../types';
import { getSkill } from '../data-skills';
import { MAPS } from '../data-map';
import { shapeFor } from '../engine/shapes';
import { tileRect, tileLayout } from '../asset-tiles';
import { PLAYER_TILE_SRC, keyedSheet, playerTile } from './player-art';

// Enemy spritesheets under assets/ — Vite gives us their served URLs.
const ASSET_URLS = import.meta.glob('../../assets/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
function assetUrl(filename: string): string | undefined {
  for (const [k, v] of Object.entries(ASSET_URLS)) if (k.endsWith('/' + filename)) return v;
  return undefined;
}

// Enemy sheets ship with an opaque white background. Two passes make it
// transparent: (1) key every near-pure-white pixel anywhere — this catches the
// flat background AND pockets fully enclosed by the sprite (e.g. the gap between
// a drawn bow and the body); (2) flood-fill the softer anti-aliased edge pixels
// that connect to the background. Shaded / off-white sprite details survive.
function keyOutBackground(img: ImageData) {
  const { data, width, height } = img;
  const pure = (i: number) => data[i] >= 248 && data[i + 1] >= 248 && data[i + 2] >= 248;
  const near = (i: number) => data[i] >= 236 && data[i + 1] >= 236 && data[i + 2] >= 236;

  // (1) enclosed + open pure-white
  for (let i = 0; i < data.length; i += 4) if (pure(i)) data[i + 3] = 0;

  // (2) soft edges connected to the (now-keyed) border background
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    if (data[i + 3] !== 0 && !near(i)) continue; // opaque, non-white sprite pixel: stop
    data[i + 3] = 0;
    const x = p % width;
    const y = (p / width) | 0;
    if (x + 1 < width) stack.push(p + 1);
    if (x - 1 >= 0) stack.push(p - 1);
    if (y + 1 < height) stack.push(p + width);
    if (y - 1 >= 0) stack.push(p - width);
  }
}

// Enemy sheets have a faint dark "cross" along the quadrant seams (at the image
// mid-lines). Sprites never span quadrants, so clear a band around both centers.
function clearQuadrantCross(img: ImageData, half = 7) {
  const { data, width, height } = img;
  const cx = width / 2;
  const cy = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.abs(x - cx) < half || Math.abs(y - cy) < half) data[(y * width + x) * 4 + 3] = 0;
    }
  }
}
import {
  ANIM_FRAME_MS,
  CAMERA_ZOOM_PERCENT,
  CELL_PX,
  COLORS,
  DAMAGE_FLOAT_MS,
  DAMAGE_FLOAT_STACK_TILES,
  DESIGN_H,
  DESIGN_W,
  ENEMY_GLOW,
  FLOOR_CHECKER_SIZE,
  LEVELUP_FX,
  MAP_CONFIG,
  MOVE_LERP_MS,
  OBSTACLE_OVERLAY_ALPHA,
  PLAYER_SPRITE_SCALE,
  TORCH_GLOW,
  VIGNETTE,
} from '../config';
import { castInterval } from '../engine/combat';
import { Sprites } from './sprites';
import { groupStatuses, renderBadgeCanvas, renderOverflowBadgeCanvas } from './statusBadge';
import type { StatusBadgeGroup } from './statusBadge';
import { backOvershoot, easeOutCubic, lerp, shouldSnap } from './tween';

const KEY = (x: number, y: number) => `${x},${y}`;
const FACING: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const UI = CELL_PX / 64; // world-space HUD/text was tuned for 64px cells; scale to the current cell size
// Pulse factor in ~[0.4,1] for a glow; pulseMs<=0 means steady. `phase` desyncs instances.
const glowPulse = (pulseMs: number, elapsedMs: number, phase: number) => (pulseMs > 0 ? 0.7 + 0.3 * Math.sin((elapsedMs / pulseMs) * 2 * Math.PI + phase) : 1);
// Enemy HP-bar status badges: 16px squares, up to 4 slots (4th is a "…" overflow
// badge when there are more groups). Counts above the cap share one texture.
const STATUS_BADGE_PX = 16;
const STATUS_BADGE_MAX = 4;
const BADGE_COUNT_CAP = 9; // ×N textures cached up to this; higher counts reuse it

// Map tile sheets (2048x2048): four biome quadrants of 1024x1024, each a 4x4
// grid of CELL_PX tiles. Floor quadrants are tileable ground fields; obstacle
// quadrants hold one prop per footprint size (1x1 corner, 3x1 top, 1x3 left,
// 3x3 center). Quadrant order: forest, lake / deepForest, town.
const FLOOR_SHEET = 'tiles-floor.png';
const FLOOR_SHEET_LAKE = 'tiles-floor-lake.png'; // dedicated lake floor: a 2x2 sheet (512x512) of CELL_PX tiles
const OBSTACLE_SHEET = 'tiles-obstacles.png';
const QUAD_PX = CELL_PX * 4; // one biome quadrant spans 4x4 cells
const QUAD: Record<TilesetName, [number, number]> = {
  forest: [0, 0],
  lake: [QUAD_PX, 0],
  deepForest: [0, QUAD_PX],
  town: [QUAD_PX, QUAD_PX],
};
// obstacle footprint -> [col, row, cols, rows] within its biome quadrant
const OBS_SRC: Record<ObstacleSize, [number, number, number, number]> = {
  '1x1': [0, 0, 1, 1],
  '3x1': [1, 0, 3, 1],
  '1x3': [0, 1, 1, 3],
  '3x3': [1, 1, 3, 3],
};

type Float = { text: Text; born: number; x: number; y: number; driftX: number; cx: number; cy: number }; // cx/cy = source cell, for per-character stacking
// Per-entity movement tween: the sprite eases from `from` (old pixel top-left)
// toward `to` (target = cell * CELL_PX) over MOVE_LERP_MS. `elapsed` accumulates
// render delta time. `cell` is the last cell we saw so we can detect a step and
// decide slide-vs-snap. The engine's Entity.cell is unaffected — this is drawing
// only.
type MoveTween = { fromX: number; fromY: number; toX: number; toY: number; elapsed: number; cellX: number; cellY: number };

// One rising sparkle glint in a level-up burst. Authored once at spawn, then
// animated purely as a function of the burst's age: `ax`/`ay` are its drift
// velocity (px over the lifetime), `size` its base scale, `twinkleHz`/`phase`
// its flicker. `sp` is the Sprite (reuses the shared radial glow texture).
type LevelUpGlint = { sp: Sprite; ax: number; ay: number; size: number; twinkleHz: number; phase: number };
// An active level-up burst anchored on a character. `born` is its spawn clock;
// `cx`/`cy` the anchor (the character's INTERPOLATED torso, captured at spawn so
// the burst stays put even if the entity later moves/despawns). `root` holds all
// its display objects; the named layers are re-drawn each frame from the age.
type LevelUpFx = {
  born: number;
  entityId: string; // the character the burst rides, so it follows their glide
  cx: number;
  cy: number;
  root: Container;
  flash: Sprite; // bright radial pop on trigger (reuses the shared glow texture)
  pillar: Sprite; // tall additive column of golden light
  rings: Graphics; // expanding concentric halos, redrawn each frame
  rays: Graphics; // rotating starburst spokes, redrawn each frame
  glints: LevelUpGlint[]; // rising twinkling particles
  banner: Text; // popped "LEVEL UP!" words
};

// Draws the Emberdeep combat world imperatively from engine state. No React here.
export class WorldRenderer {
  readonly root = new Container();
  private bg = new Container();
  private fx = new Container();
  private actors = new Container();
  private levelUpFx = new Container(); // celebratory level-up bursts, above the actors
  private statusBadges = new Container(); // pooled per-enemy status-badge sprites (not cleared each frame)
  private lights = new Container(); // dusk veil + additive torch glows (world-space)
  private floatLayer = new Container();
  private vignette: Sprite | null = null;
  private glowTexture?: Texture;
  private texCache = new Map<string, Texture>();
  private atlasReady = new Map<string, Texture>(); // background-keyed enemy sheets
  private atlasLoading = new Set<string>();
  private plainReady = new Map<string, Texture>(); // map sheets, used as-is (no keying)
  private plainLoading = new Set<string>();
  private pAtlasReady = new Map<string, Texture>(); // player sheets, corner-color keyed
  private pAtlasLoading = new Set<string>();
  private subCache = new Map<string, Texture>();
  private badgeTexCache = new Map<string, Texture>(); // status-badge textures keyed by appearance (kind:stat:count:up | '…')
  private badgeSprites = new Map<string, Sprite[]>(); // pooled badge Sprites per enemy, reused across frames
  private hpGradients: Partial<Record<'enemy' | 'elite', FillGradient>> = {}; // cached vertical HP-bar fills
  private bgTilesReady = false; // floor + obstacle sheets loaded when the current bg was built
  private propCells = new Set<string>(); // cells carrying an obstacle prop (wall ring + features)
  private prevLevel = new Map<string, number>();
  private lastFloatTick = -1; // tickCount whose hit events were already floated
  private lastFlip = new Map<string, boolean>(); // horizontal flip persists across up/down moves
  private tweens = new Map<string, MoveTween>(); // per-entity glide from old to new cell (draw-only)
  private prevElapsed = -1; // last render's elapsedMs, to derive the frame's dt
  private floats: Float[] = [];
  private levelUps: LevelUpFx[] = []; // active level-up bursts, aged out by elapsedMs
  private bgMapId: string | undefined; // tiles are rebuilt when the map changes
  private vignetteBiome: Biome | null = null; // vignette is rebuilt when the biome changes

  constructor(private app: Application) {
    this.root.addChild(this.bg, this.fx, this.actors, this.levelUpFx, this.statusBadges, this.lights, this.floatLayer);
    app.stage.addChild(this.root);
  }

  private tex(name: string, frame: number): Texture {
    const k = name + frame;
    let t = this.texCache.get(k);
    if (!t) {
      t = Texture.from(Sprites.build(name, frame, Sprites.DIRS.A));
      t.source.scaleMode = 'nearest'; // crisp pixel art
      this.texCache.set(k, t);
    }
    return t;
  }

  // Load an enemy sheet and key out its (opaque white) background before use.
  private async loadAtlas(filename: string) {
    const url = assetUrl(filename);
    if (!url) return;
    const img = new Image();
    img.src = url;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, cv.width, cv.height);
    keyOutBackground(data);
    clearQuadrantCross(data);
    ctx.putImageData(data, 0, 0);
    this.atlasReady.set(filename, Texture.from(cv));
  }

  private atlas(filename: string): Texture | undefined {
    const ready = this.atlasReady.get(filename);
    if (ready) return ready;
    if (!this.atlasLoading.has(filename)) {
      this.atlasLoading.add(filename);
      void this.loadAtlas(filename);
    }
    return undefined; // still loading
  }

  // A 256x256 sub-texture of a (keyed) enemy sheet.
  private subTexture(filename: string, ref: string): Texture | undefined {
    const key = filename + '|' + ref;
    const cached = this.subCache.get(key);
    if (cached) return cached;
    const base = this.atlas(filename);
    if (!base) return undefined; // still loading
    const r = tileRect(ref);
    const t = new Texture({ source: base.source, frame: new Rectangle(r.x, r.y, r.w, r.h) });
    this.subCache.set(key, t);
    return t;
  }

  // Map sheets (floor/obstacles) are used as authored — opaque floor, already-
  // transparent obstacles — so they skip the white-key pass the enemy sheets need.
  private async loadPlainAtlas(filename: string) {
    const url = assetUrl(filename);
    if (!url) return;
    const img = new Image();
    img.src = url;
    await img.decode();
    this.plainReady.set(filename, Texture.from(img));
  }

  private plainAtlas(filename: string): Texture | undefined {
    const ready = this.plainReady.get(filename);
    if (ready) return ready;
    if (!this.plainLoading.has(filename)) {
      this.plainLoading.add(filename);
      void this.loadPlainAtlas(filename);
    }
    return undefined; // still loading
  }

  // A rectangular sub-texture (px) of a map sheet.
  private mapSub(filename: string, x: number, y: number, w: number, h: number): Texture | undefined {
    const key = `${filename}|${x},${y},${w},${h}`;
    const cached = this.subCache.get(key);
    if (cached) return cached;
    const base = this.plainAtlas(filename);
    if (!base) return undefined; // still loading
    const t = new Texture({ source: base.source, frame: new Rectangle(x, y, w, h) });
    this.subCache.set(key, t);
    return t;
  }

  private drawEnemyAsset(e: Entity, px: number, py: number, bob: number) {
    const asset = e.asset!;
    const layout = tileLayout(asset.tiles);
    const totalW = layout.cols * CELL_PX;
    const totalH = layout.rows * CELL_PX;
    const cont = new Container();
    layout.refs.forEach((ref, i) => {
      const tex = this.subTexture(asset.filename, ref);
      if (!tex) return;
      const sp = new Sprite(tex);
      sp.setSize(CELL_PX, CELL_PX);
      sp.position.set((i % layout.cols) * CELL_PX, Math.floor(i / layout.cols) * CELL_PX);
      cont.addChild(sp);
    });
    // anchor bottom-center on the cell; flip when facing opposes the art's default
    const baseX = px + CELL_PX / 2 - totalW / 2;
    const flip = (e.facing === 'left') !== ((asset.facing ?? 'right') === 'left');
    cont.scale.x = flip ? -1 : 1;
    cont.position.set(flip ? baseX + totalW : baseX, py + CELL_PX - totalH + bob);
    this.actors.addChild(cont);
  }

  // Player class sheets: key out the neutral-gray background, then serve tiles.
  private async loadPlayerAtlas(filename: string) {
    const cv = await keyedSheet(filename); // shared gray-keyed canvas (also used by HUD)
    if (cv) this.pAtlasReady.set(filename, Texture.from(cv));
  }

  private playerAtlas(filename: string): Texture | undefined {
    const ready = this.pAtlasReady.get(filename);
    if (ready) return ready;
    if (!this.pAtlasLoading.has(filename)) {
      this.pAtlasLoading.add(filename);
      void this.loadPlayerAtlas(filename);
    }
    return undefined;
  }

  private playerSub(filename: string, sx: number, sy: number, size: number): Texture | undefined {
    const key = `P|${filename}|${sx},${sy},${size}`;
    const cached = this.subCache.get(key);
    if (cached) return cached;
    const base = this.playerAtlas(filename);
    if (!base) return undefined;
    const t = new Texture({ source: base.source, frame: new Rectangle(sx, sy, size, size) });
    this.subCache.set(key, t);
    return t;
  }

  // Render a hero from the class art (Beginner has its own image). Returns false
  // when the job has no portrait (e.g. a fusion) so the caller falls back to the
  // procedural sprite; true means "uses class art" even while it's still loading.
  private drawPlayerAsset(e: Entity, px: number, py: number, bob: number): boolean {
    const t = playerTile(e.jobId);
    if (!t) return false;
    const tex = this.playerSub(t.filename, t.sx, t.sy, PLAYER_TILE_SRC);
    if (tex) {
      // Only left/right change the horizontal flip; up/down keep the last one.
      let flip = this.lastFlip.get(e.id) ?? false;
      if (e.facing === 'left') flip = true;
      else if (e.facing === 'right') flip = false;
      this.lastFlip.set(e.id, flip);
      const sp = new Sprite(tex);
      sp.setSize(CELL_PX * PLAYER_SPRITE_SCALE, CELL_PX * PLAYER_SPRITE_SCALE); // scale from the feet (anchor below)
      sp.anchor.set(0.5, 1); // bottom-center on the cell — scaling grows the sprite up + out from here
      if (flip) sp.scale.x = -Math.abs(sp.scale.x);
      sp.position.set(px + CELL_PX / 2, py + CELL_PX + bob);
      this.actors.addChild(sp);
    }
    return true;
  }

  // Follow camera: fixed zoom (CAMERA_ZOOM_PERCENT), always centered on the player.
  // Tracks the player's interpolated pixel position so scrolling glides with the
  // sprite instead of snapping a tile ahead. No edge clamp — space outside the
  // map shows the black stage background.
  private camera(world: WorldState, pos: Map<string, { px: number; py: number }>) {
    const scale = CAMERA_ZOOM_PERCENT / 100;
    const p = world.entities[world.playerId];
    const pp = p && pos.get(world.playerId);
    const cx = (pp ? pp.px + CELL_PX / 2 : (world.map.width * CELL_PX) / 2) * scale;
    const cy = (pp ? pp.py + CELL_PX / 2 : (world.map.height * CELL_PX) / 2) * scale;
    this.root.scale.set(scale);
    this.root.x = DESIGN_W / 2 - cx;
    this.root.y = DESIGN_H / 2 - cy;
  }

  private buildBg(world: WorldState) {
    this.buildVignette(world);
    // Rebuilt when the map changes, and retried each frame until both tile sheets
    // have loaded (so we swap the procedural fallback for the real biome art).
    const ts = MAPS[world.mapId]?.gen.tileset ?? 'forest';
    // Lake floor ships as a dedicated 2x2 sheet (512x512); every other biome tiles
    // a 4x4 quadrant of the shared floor sheet.
    const lake = ts === 'lake';
    const floorSheet = lake ? FLOOR_SHEET_LAKE : FLOOR_SHEET;
    const [qx, qy]: [number, number] = lake ? [0, 0] : QUAD[ts];
    const grid = lake ? 2 : 4;
    const floor = this.plainAtlas(floorSheet);
    const obst = this.plainAtlas(OBSTACLE_SHEET);
    if (this.bgMapId === world.mapId && this.bgTilesReady) return;
    this.bgMapId = world.mapId;
    this.bgTilesReady = !!(floor && obst);
    this.bg.removeChildren();

    const { width, height } = world.map;

    // Track which cells carry a prop (feature obstacles + the wall ring) for the
    // collision overlay. Feature obstacles occupy their whole footprint.
    this.propCells = new Set<string>();
    for (const f of world.features) {
      if (f.kind !== 'obstacle') continue;
      const [, , ow, oh] = OBS_SRC[f.size];
      for (let dy = 0; dy < oh; dy++) for (let dx = 0; dx < ow; dx++) this.propCells.add(KEY(f.cell.x + dx, f.cell.y + dy));
    }

    // Floor extends everywhere — even under walls — so the (transparent) wall
    // props sit on ground and the floor shows around and beyond them.
    // Lake floor tiles render at 2x — each spans a 2x2 cell block; other biomes 1x.
    const step = lake ? 2 : 1;
    const g = new Graphics(); // procedural-floor fallback until the sheet loads
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x * CELL_PX;
        const py = y * CELL_PX;
        if (floor) {
          if (x % step === 0 && y % step === 0) {
            const tex = this.mapSub(floorSheet, qx + ((x / step) % grid) * CELL_PX, qy + ((y / step) % grid) * CELL_PX, CELL_PX, CELL_PX);
            if (tex) {
              const sp = new Sprite(tex);
              sp.setSize(step * CELL_PX, step * CELL_PX);
              sp.position.set(px, py);
              this.bg.addChild(sp);
            }
          }
        } else {
          const checker = (Math.floor(x / FLOOR_CHECKER_SIZE) + Math.floor(y / FLOOR_CHECKER_SIZE)) % 2;
          g.rect(px, py, CELL_PX, CELL_PX).fill(checker ? COLORS.floor : COLORS.floorAlt);
          g.rect(px, py, CELL_PX, CELL_PX).stroke({ width: 1, color: COLORS.gridLine, alpha: 0.8 });
        }
      }
    }
    this.bg.addChildAt(g, 0); // fallback beneath the floor sprites

    this.buildWallProps(world, qx, qy); // records ring cells even before the sheet loads
  }

  // Cover only the innermost wall ring + corners with obstacle props: wall cells
  // that touch walkable floor. Straight runs use the 3x1 / 1x3 props; corners and
  // stragglers use the 1x1. (Feature obstacles carry their own art, so skip them.)
  private buildWallProps(world: WorldState, qx: number, qy: number) {
    const { width, height, tiles } = world.map;
    const featureCells = new Set<string>();
    for (const f of world.features) {
      if (f.kind !== 'obstacle') continue;
      const [, , ow, oh] = OBS_SRC[f.size];
      for (let dy = 0; dy < oh; dy++) for (let dx = 0; dx < ow; dx++) featureCells.add(KEY(f.cell.x + dx, f.cell.y + dy));
    }
    const inBounds = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height;
    const walkable = (x: number, y: number) => inBounds(x, y) && tiles[y * width + x] === 'floor';
    const capWall = (x: number, y: number) => {
      if (!inBounds(x, y) || tiles[y * width + x] !== 'wall' || featureCells.has(KEY(x, y))) return false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && walkable(x + dx, y + dy)) return true;
      return false;
    };

    const covered = new Set<string>();
    const free = (x: number, y: number) => capWall(x, y) && !covered.has(KEY(x, y));
    const place = (size: ObstacleSize, x: number, y: number) => {
      const [col, row, ow, oh] = OBS_SRC[size];
      const tex = this.mapSub(OBSTACLE_SHEET, qx + col * CELL_PX, qy + row * CELL_PX, ow * CELL_PX, oh * CELL_PX);
      if (tex) {
        const sp = new Sprite(tex);
        sp.setSize(ow * CELL_PX, oh * CELL_PX);
        sp.position.set(x * CELL_PX, y * CELL_PX);
        this.bg.addChild(sp);
      }
      for (let dy = 0; dy < oh; dy++)
        for (let dx = 0; dx < ow; dx++) {
          covered.add(KEY(x + dx, y + dy));
          this.propCells.add(KEY(x + dx, y + dy));
        }
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!free(x, y)) continue;
        if (free(x + 1, y) && free(x + 2, y))
          place('3x1', x, y); // horizontal run
        else if (free(x, y + 1) && free(x, y + 2))
          place('1x3', x, y); // vertical run
        else place('1x1', x, y); // corner / straggler
      }
    }
  }

  // Vignette + warm tint overlay (Emberdeep): screen-anchored (added to the app
  // stage, not the world root) so it stays put as the camera scrolls. Rebuilt when
  // the biome changes, since its darkness/clear-radius are configured per biome.
  private buildVignette(world: WorldState) {
    const biome = MAPS[world.mapId]?.biome ?? 'forest';
    if (this.vignetteBiome === biome) return;
    this.vignetteBiome = biome;
    if (this.vignette) {
      this.vignette.removeFromParent();
      this.vignette.destroy();
      this.vignette = null;
    }
    const v = VIGNETTE[biome];
    if (v.edgeAlpha <= 0 && v.warmAlpha <= 0) return; // fully disabled for this biome
    const cv = document.createElement('canvas');
    cv.width = DESIGN_W;
    cv.height = DESIGN_H;
    const ctx = cv.getContext('2d')!;
    const grad = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * v.innerRadius, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * v.outerRadius);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${v.edgeAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = `rgba(180,110,50,${v.warmAlpha})`;
    ctx.fillRect(0, 0, cv.width, cv.height);
    this.vignette = new Sprite(Texture.from(cv));
    this.vignette.eventMode = 'none';
    this.app.stage.addChild(this.vignette);
    this.layoutVignette();
  }

  // The vignette lives on the (letterbox-scaled) stage, so stretch it to cover the
  // whole viewport in stage-local coords, extended a touch past every edge — else
  // the world shows un-darkened at the very top/bottom when the window isn't 16:9.
  private layoutVignette() {
    if (!this.vignette) return;
    const scale = this.app.stage.scale.x || 1;
    const over = 24; // overscan beyond the viewport edges (stage units)
    this.vignette.position.set(-this.app.stage.position.x / scale - over, -this.app.stage.position.y / scale - over);
    this.vignette.width = this.app.screen.width / scale + over * 2;
    this.vignette.height = this.app.screen.height / scale + over * 2;
  }

  // Obstacle props (torches are handled by buildLights — they emit light only).
  private drawFeatures(world: WorldState) {
    const ts = MAPS[world.mapId]?.gen.tileset ?? 'forest';
    const [qx, qy] = QUAD[ts];
    for (const f of world.features) {
      if (f.kind !== 'obstacle') continue;
      const [col, row, ow, oh] = OBS_SRC[f.size];
      const px = f.cell.x * CELL_PX;
      const py = f.cell.y * CELL_PX;
      const tex = this.mapSub(OBSTACLE_SHEET, qx + col * CELL_PX, qy + row * CELL_PX, ow * CELL_PX, oh * CELL_PX);
      if (tex) {
        const sp = new Sprite(tex);
        sp.setSize(ow * CELL_PX, oh * CELL_PX);
        sp.position.set(px, py);
        this.fx.addChild(sp);
      } else {
        const g = new Graphics(); // fallback block until the obstacle sheet loads
        g.rect(px + 3, py + 3, ow * CELL_PX - 6, oh * CELL_PX - 6).fill(0x2c2822);
        g.rect(px + 3, py + 3, ow * CELL_PX - 6, (oh * CELL_PX - 6) * 0.45).fill(0x453f34);
        this.fx.addChild(g);
      }
    }
  }

  // Danger overlay for pending telegraphed AoEs (engine/combat.ts): each locked
  // tile glows red/orange and INTENSIFIES as its resolution nears (remainingMs→0),
  // with a quickening flash in the final stretch so the imminent hit reads clearly.
  // Drawn into fx (below actors, above the floor), matching the collision overlay.
  private drawTelegraphs(world: WorldState, elapsedMs: number) {
    if (!world.telegraphs.length) return;
    const g = new Graphics();
    for (const t of world.telegraphs) {
      // frac 0 (just cast) -> 1 (about to resolve); ramps the fill + border alpha.
      const frac = t.totalMs > 0 ? Math.max(0, Math.min(1, 1 - t.remainingMs / t.totalMs)) : 1;
      // Flash faster the closer it is to detonating (period shrinks from ~200 to ~90ms).
      const flash = 0.5 + 0.5 * Math.sin(elapsedMs / (200 - 110 * frac));
      const fillAlpha = 0.16 + 0.34 * frac + 0.12 * frac * flash;
      const strokeAlpha = 0.5 + 0.45 * frac;
      const fill = frac < 0.66 ? 0xff8c1a : 0xff3020; // orange warning -> red imminent
      // Inner fill is a centered square that scales linearly (no easing) with the
      // delay: player (hitsEnemies) telegraphs shrink full→0, enemy telegraphs grow
      // 0→full. The outer stroke stays the full tile as a stable warning border.
      const sizeFrac = t.hitsEnemies ? 1 - frac : frac;
      const side = (CELL_PX - 2) * sizeFrac;
      for (const c of t.tiles) {
        const px = c.x * CELL_PX;
        const py = c.y * CELL_PX;
        g.rect(px + 1 + (CELL_PX - 2 - side) / 2, py + 1 + (CELL_PX - 2 - side) / 2, side, side).fill({ color: fill, alpha: fillAlpha });
        g.rect(px + 1, py + 1, CELL_PX - 2, CELL_PX - 2).stroke({ width: 2 + 2 * frac, color: 0xffce6b, alpha: strokeAlpha });
      }
    }
    this.fx.addChild(g);
  }

  // Translucent red over cells that carry an obstacle prop (the wall ring +
  // feature obstacles) so blockers stand out against the floor.
  private drawCollisionOverlay() {
    if (!this.propCells.size) return;
    const g = new Graphics();
    for (const key of this.propCells) {
      const [x, y] = key.split(',').map(Number);
      g.rect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX).fill({ color: 0xff3b30, alpha: OBSTACLE_OVERLAY_ALPHA });
    }
    this.fx.addChild(g);
  }

  // White radial falloff shared by every light; the color comes from the sprite
  // tint (warm for torches, aqua for portals) under an additive blend.
  private glowTex(): Texture {
    if (this.glowTexture) return this.glowTexture;
    const S = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!;
    const grad = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.42)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
    this.glowTexture = Texture.from(cv);
    return this.glowTexture;
  }

  private addGlow(layer: Container, cx: number, cy: number, wCells: number, tint: number, alpha: number, hCells = wCells, additive = true) {
    const sp = new Sprite(this.glowTex());
    sp.anchor.set(0.5);
    sp.blendMode = additive ? 'add' : 'normal'; // normal so dark tints still register
    sp.tint = tint;
    sp.alpha = alpha;
    sp.setSize(CELL_PX * wCells, CELL_PX * hCells);
    sp.position.set(cx, cy);
    layer.addChild(sp);
  }

  // Faint red elliptical glow overlapping each enemy (taller than wide to hug a
  // standing sprite). Drawn into fx so it sits behind the enemy sprite (actors).
  private drawEnemyGlow(world: WorldState, elapsedMs: number, pos: Map<string, { px: number; py: number }>) {
    if (ENEMY_GLOW.intensity <= 0) return;
    for (const e of Object.values(world.entities)) {
      if (e.faction !== 'enemy') continue;
      const p = pos.get(e.id) ?? { px: e.cell.x * CELL_PX, py: e.cell.y * CELL_PX };
      const cx = p.px + CELL_PX / 2; // follow the interpolated sprite, not the raw cell
      const cy = p.py + CELL_PX * 0.45; // over the sprite body
      const alpha = ENEMY_GLOW.intensity * glowPulse(ENEMY_GLOW.pulseMs, elapsedMs, e.cell.x + e.cell.y);
      this.addGlow(this.fx, cx, cy, ENEMY_GLOW.wCells, ENEMY_GLOW.color, alpha, ENEMY_GLOW.hCells, false);
    }
  }

  // A gentle ambient dusk over the map, with additive glows: warm at each torch
  // (the prop itself is hidden) and aqua around each portal.
  private buildLights(world: WorldState, elapsedMs: number) {
    this.lights.removeChildren();
    // Per-biome dusk veil, oversized well past the map so it always fills the
    // viewport (the camera can scroll past the map edges into the black stage).
    const light = MAP_CONFIG[MAPS[world.mapId]?.biome ?? 'forest'].light;
    const M = 10000;
    const veil = new Graphics();
    veil.rect(-M, -M, world.map.width * CELL_PX + 2 * M, world.map.height * CELL_PX + 2 * M).fill({ color: light.duskColor, alpha: light.ambientDuskLevel / 100 });
    this.lights.addChild(veil);
    for (const f of world.features) {
      if (f.kind !== 'torch') continue;
      const alpha = TORCH_GLOW.intensity * glowPulse(TORCH_GLOW.pulseMs, elapsedMs, f.cell.x + f.cell.y);
      this.addGlow(this.lights, f.cell.x * CELL_PX + CELL_PX / 2, f.cell.y * CELL_PX + CELL_PX / 2, light.torchGlowDistance, TORCH_GLOW.color, alpha);
    }
    for (const ex of world.exits) {
      const pulse = 0.7 + 0.3 * Math.sin(elapsedMs / 360 + (ex.cell.x + ex.cell.y));
      this.addGlow(this.lights, ex.cell.x * CELL_PX + CELL_PX / 2, ex.cell.y * CELL_PX + CELL_PX / 2, 3.2, 0x7fe6dd, pulse);
    }
  }

  private drawPortals(world: WorldState, elapsedMs: number) {
    const pulse = 0.5 + 0.5 * Math.sin(elapsedMs / 400);
    for (const ex of world.exits) {
      const cx = ex.cell.x * CELL_PX + CELL_PX / 2;
      const cy = ex.cell.y * CELL_PX + CELL_PX / 2;
      const g = new Graphics();
      g.circle(cx, cy, 26 * UI).fill({ color: 0x8fe0d8, alpha: 0.12 + 0.12 * pulse }); // soft aqua disc
      g.circle(cx, cy, 22 * UI).stroke({ width: 3 * UI, color: 0x5fe0d6, alpha: 0.75 + 0.25 * pulse });
      g.circle(cx, cy, (10 + 6 * pulse) * UI).stroke({ width: 2.5 * UI, color: 0xbdf4ee, alpha: 0.9 });
      g.circle(cx, cy, 4 * UI).fill({ color: 0xffffff, alpha: 0.85 }); // bright core
      this.fx.addChild(g);
    }
  }

  render(world: WorldState, elapsedMs: number) {
    // Frame delta drives the movement tweens (framerate-independent); guard the
    // first frame and any clock reset so a huge dt can't teleport a glide.
    const dt = this.prevElapsed < 0 ? 0 : Math.max(0, elapsedMs - this.prevElapsed);
    this.prevElapsed = elapsedMs;
    // Advance every entity's glide once per frame into `pos`; camera, glow, and
    // sprites then read the same interpolated position (so nothing lags the sprite).
    const pos = new Map<string, { px: number; py: number }>();
    for (const e of Object.values(world.entities)) pos.set(e.id, this.entityPos(e, dt));
    const at = (e: Entity) => pos.get(e.id) ?? { px: e.cell.x * CELL_PX, py: e.cell.y * CELL_PX };

    this.buildBg(world);
    this.layoutVignette(); // keep the vignette covering the whole viewport (past its edges) as it resizes
    this.camera(world, pos);
    this.fx.removeChildren();
    this.actors.removeChildren();
    const frame = Math.floor(elapsedMs / ANIM_FRAME_MS) % 2;
    const bob = frame ? -2 * UI : 0;

    this.drawPortals(world, elapsedMs);
    this.drawFeatures(world);
    this.drawCollisionOverlay(); // above walls/obstacles, below actors
    this.drawTelegraphs(world, elapsedMs); // pending dodgeable AoEs, escalating toward resolution
    this.drawEnemyGlow(world, elapsedMs, pos); // elliptical red glow behind each enemy
    const playerGroup = Object.values(world.groups).find((g) => g.memberIds.includes(world.playerId));
    if (playerGroup) this.drawBlockOutline(world, playerGroup);
    this.drawAttackRadius(world, elapsedMs); // always visible for the selected skill

    for (const e of Object.values(world.entities)) {
      const { px, py } = at(e);
      this.drawEntity(world, e, frame, bob, px, py);
      this.spawnLevelUpIfLeveled(e, px, py, elapsedMs);
    }
    this.spawnHitFloats(world, elapsedMs); // damage/crit/heal/miss numbers from the tick
    this.buildLights(world, elapsedMs); // dusk veil + torch glows over the scene
    // reap tracking maps for entities that no longer exist
    for (const id of [...this.prevLevel.keys()]) if (!world.entities[id]) this.prevLevel.delete(id);
    for (const id of [...this.tweens.keys()]) if (!world.entities[id]) this.tweens.delete(id);
    for (const id of [...this.badgeSprites.keys()]) {
      if (world.entities[id]) continue;
      for (const sp of this.badgeSprites.get(id)!) sp.destroy(); // texture is cached+shared, don't destroy it
      this.badgeSprites.delete(id);
    }

    this.updateFloats(elapsedMs);
    this.updateLevelUps(elapsedMs, pos); // advance/animate active bursts (following their character); reap finished ones
  }

  // Detect a level gain (reusing the prevLevel map) and, on the frame it happens,
  // spawn the celebratory burst anchored on the character's INTERPOLATED torso
  // (px/py are this frame's glide top-left) so it sits on the sprite mid-glide.
  private spawnLevelUpIfLeveled(e: Entity, px: number, py: number, elapsedMs: number) {
    const prev = this.prevLevel.get(e.id);
    if (prev !== undefined && e.level > prev) {
      this.spawnLevelUp(e.id, px + CELL_PX / 2, py + CELL_PX * 0.55, elapsedMs); // torso anchor
    }
    this.prevLevel.set(e.id, e.level);
  }

  // Build one level-up burst's display objects up front (no per-frame allocation):
  // flash, golden pillar, ring/ray Graphics we redraw in place each frame, a fixed
  // fan of sparkle glints, and the popped banner. All ride a per-burst `root`
  // container positioned at the anchor, so animating is local to that origin.
  private spawnLevelUp(entityId: string, cx: number, cy: number, elapsedMs: number) {
    const root = new Container();
    root.position.set(cx, cy);
    root.blendMode = 'add'; // whole burst reads as light; the banner opts back to normal below

    // Bright flash: a soft radial pop that snaps in and fades within the first beat.
    const flash = new Sprite(this.glowTex());
    flash.anchor.set(0.5);
    flash.tint = LEVELUP_FX.coreColor;

    // Pillar: a tall, narrow additive column of golden light rising from the feet.
    const pillar = new Sprite(this.glowTex());
    pillar.anchor.set(0.5, 1); // grow upward from the torso anchor
    pillar.tint = LEVELUP_FX.goldColor;

    const rings = new Graphics(); // expanding concentric halos, redrawn each frame
    const rays = new Graphics(); // rotating starburst spokes, redrawn each frame

    // Sparkle glints: a fixed fan authored once; each drifts up-and-out + twinkles.
    const glints: LevelUpGlint[] = [];
    for (let i = 0; i < LEVELUP_FX.particleCount; i++) {
      const sp = new Sprite(this.glowTex());
      sp.anchor.set(0.5);
      sp.tint = i % 3 === 0 ? LEVELUP_FX.coreColor : LEVELUP_FX.goldColor; // some white, mostly gold
      // biased upward (angle near straight-up); fan out ~1 cell horizontally, rise 1.6..2.6 cells
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
      const spread = 0.4 + Math.random() * 0.9;
      glints.push({
        sp,
        ax: Math.cos(ang) * CELL_PX * spread,
        ay: -CELL_PX * (1.6 + Math.random()), // always rise
        size: (0.16 + Math.random() * 0.18) * CELL_PX,
        twinkleHz: 6 + Math.random() * 8,
        phase: Math.random() * Math.PI * 2,
      });
      root.addChild(sp);
    }

    // Banner: keep the words, but celebratory — gold fill, dark stroke, its own
    // normal blend (additive text on a bright pillar would wash out) and a pop.
    const banner = new Text({
      text: 'LEVEL UP!',
      style: {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 24 * UI,
        fill: LEVELUP_FX.goldColor,
        stroke: { color: 0x2a1500, width: 5 * UI },
        dropShadow: { color: LEVELUP_FX.warmColor, blur: 8 * UI, distance: 0, alpha: 0.9 },
      },
    });
    banner.anchor.set(0.5);
    banner.blendMode = 'normal';

    root.addChild(pillar, rings, rays, flash, banner); // flash + banner read on top
    this.levelUpFx.addChild(root);
    this.levelUps.push({ born: elapsedMs, entityId, cx, cy, root, flash, pillar, rings, rays, glints, banner });
  }

  // Advance every active burst as a pure function of its age (0..1 over durationMs),
  // then destroy + remove the ones that have finished. Redraws the ring/ray
  // Graphics in place (clear + re-fill) — no new display objects per frame.
  private updateLevelUps(elapsedMs: number, pos: Map<string, { px: number; py: number }>) {
    const D = LEVELUP_FX.durationMs;
    this.levelUps = this.levelUps.filter((fx) => {
      const age = elapsedMs - fx.born;
      if (age >= D) {
        fx.root.destroy({ children: true });
        return false;
      }
      const p = age / D; // 0 -> just spawned, 1 -> about to end

      // Follow the character as it glides; fall back to the spawn anchor if it despawned.
      const ep = pos.get(fx.entityId);
      if (ep) fx.root.position.set(ep.px + CELL_PX / 2, ep.py + CELL_PX * 0.55);

      // Flash: snaps to full in ~0.1, gone by ~0.35. Big soft radial pop that keeps
      // expanding as it fades (size from fp, alpha from fadeF — never a 0-size sprite).
      const fp = Math.min(1, p / 0.1);
      const fadeF = p < 0.1 ? 1 : Math.max(0, 1 - (p - 0.1) / 0.25);
      const flashSize = CELL_PX * (1.4 + 1.6 * fp);
      fx.flash.setSize(flashSize, flashSize);
      fx.flash.alpha = fadeF;

      // Pillar: shoots up over the first ~0.35 (eased), holds, fades out by the end.
      const grow = easeOutCubic(Math.min(1, p / 0.35));
      const pillarFade = p < 0.65 ? 0.85 : Math.max(0, 0.85 * (1 - (p - 0.65) / 0.35));
      fx.pillar.setSize(CELL_PX * 0.7, CELL_PX * LEVELUP_FX.pillarCells * grow);
      fx.pillar.alpha = pillarFade;

      // Rings: N staggered halos, each expanding (eased) + fading over its own window.
      fx.rings.clear();
      for (let i = 0; i < LEVELUP_FX.ringCount; i++) {
        const start = i * 0.14; // stagger the rings' launches
        const rp = (p - start) / (1 - start);
        if (rp <= 0 || rp >= 1) continue;
        const rad = easeOutCubic(rp) * CELL_PX * (1.1 + i * 0.55);
        const a = (1 - rp) * 0.9;
        const color = i === LEVELUP_FX.ringCount - 1 ? LEVELUP_FX.warmColor : LEVELUP_FX.goldColor;
        fx.rings.ellipse(0, 0, rad, rad * 0.42).stroke({ width: (7 - i) * UI * (1 - rp) + 1, color, alpha: a });
      }

      // Rays: a starburst that expands, rotates slightly, and fades out early-ish.
      fx.rays.clear();
      const rayLen = easeOutCubic(Math.min(1, p / 0.4)) * CELL_PX * 1.6;
      const rayA = Math.max(0, 1 - p / 0.7) * 0.8;
      if (rayA > 0.001) {
        const spin = p * 0.6; // gentle rotation over the life
        for (let i = 0; i < LEVELUP_FX.rayCount; i++) {
          const a = spin + (i / LEVELUP_FX.rayCount) * Math.PI * 2;
          const x = Math.cos(a) * rayLen;
          const y = Math.sin(a) * rayLen * 0.6; // squash vertically (ground-plane feel)
          fx.rays.moveTo(0, 0).lineTo(x, y);
        }
        fx.rays.stroke({ width: 3 * UI, color: LEVELUP_FX.coreColor, alpha: rayA });
      }

      // Glints: rise + fan out (eased) and twinkle; small, capped, fade near the end.
      const gp = easeOutCubic(p);
      const glintFade = p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3);
      for (const g of fx.glints) {
        const twinkle = 0.55 + 0.45 * Math.sin(age * 0.001 * g.twinkleHz * Math.PI * 2 + g.phase);
        g.sp.position.set(g.ax * gp, g.ay * gp);
        g.sp.setSize(g.size, g.size);
        g.sp.alpha = glintFade * twinkle;
      }

      // Banner: pops in with a scale overshoot in the first ~0.3, rises gently, then
      // fades out over the last third. Sits above the pillar.
      const pop = backOvershoot(Math.min(1, p / 0.3));
      fx.banner.scale.set(pop);
      fx.banner.position.set(0, -CELL_PX * (1.05 + 0.35 * easeOutCubic(p)));
      fx.banner.alpha = p < 0.66 ? 1 : Math.max(0, 1 - (p - 0.66) / 0.34);
      return true;
    });
  }

  // Interpolated pixel top-left for an entity this frame. The logic cell updates
  // instantly (engine); the sprite eases from its previous pixel position to the
  // new cell over MOVE_LERP_MS, advanced by the frame's `dt`. Snaps (no slide) on
  // teleport-sized jumps, on first sight, and when the lerp window is disabled.
  // Every entity shares this so future enemy roaming glides too. Returns the
  // cell's exact pixel position when no tween is active.
  private entityPos(e: Entity, dt: number): { px: number; py: number } {
    const targetX = e.cell.x * CELL_PX;
    const targetY = e.cell.y * CELL_PX;
    const t = this.tweens.get(e.id);
    // First sight, teleport-sized jump, or disabled window: snap to the cell.
    if (!t || MOVE_LERP_MS <= 0 || shouldSnap({ x: t.cellX, y: t.cellY }, e.cell)) {
      this.tweens.set(e.id, { fromX: targetX, fromY: targetY, toX: targetX, toY: targetY, elapsed: MOVE_LERP_MS, cellX: e.cell.x, cellY: e.cell.y });
      return { px: targetX, py: targetY };
    }
    // A one-tile step retargets the glide from the sprite's current position.
    if (t.cellX !== e.cell.x || t.cellY !== e.cell.y) {
      const p = Math.min(1, t.elapsed / MOVE_LERP_MS);
      t.fromX = lerp(t.fromX, t.toX, p);
      t.fromY = lerp(t.fromY, t.toY, p);
      t.toX = targetX;
      t.toY = targetY;
      t.elapsed = 0;
      t.cellX = e.cell.x;
      t.cellY = e.cell.y;
    }
    t.elapsed += dt;
    const p = Math.min(1, t.elapsed / MOVE_LERP_MS);
    return { px: lerp(t.fromX, t.toX, p), py: lerp(t.fromY, t.toY, p) };
  }

  private drawEntity(world: WorldState, e: Entity, frame: number, bob: number, px: number, py: number) {
    // px/py are the entity's interpolated (glide) pixel top-left this frame;
    // everything pinned to it below (shadow, sprite, facing, pips) rides along.

    // contact shadow
    const shadow = new Graphics();
    shadow.ellipse(px + CELL_PX / 2, py + CELL_PX - 7 * UI, CELL_PX * 0.32, CELL_PX * 0.12).fill({ color: 0x000000, alpha: 0.32 });
    this.actors.addChild(shadow);

    // sprite: enemies use their spritesheet tiles; heroes use the class art;
    // anything without art (e.g. a fusion) falls back to the procedural sprite.
    if (e.asset) {
      this.drawEnemyAsset(e, px, py, bob);
    } else if (!this.drawPlayerAsset(e, px, py, bob)) {
      const sp = new Sprite(this.tex(e.sprite, frame));
      sp.setSize(CELL_PX, CELL_PX);
      sp.position.set(px, py + bob);
      this.actors.addChild(sp);
    }

    if (e.faction === 'player' || e.faction === 'ally') this.drawFacing(e, px, py); // enemies + static town NPCs show no facing arrow
    const inFight = Object.values(world.groups).some((g) => g.memberIds.includes(e.id));
    if (e.faction === 'enemy' && inFight) this.drawHpBar(px, py, e); // only engaged enemies show HP
    // Status badges ride the HP bar, so only for engaged enemies; hide otherwise.
    if (e.faction === 'enemy' && inFight && e.statuses.length) this.drawStatusBadges(e, px, py);
    else this.hideStatusBadges(e.id);
    if (inFight || e.armed) this.drawSquareTimer(e, px, py); // armed = out-of-combat wind-up
  }

  private hideStatusBadges(id: string) {
    const pool = this.badgeSprites.get(id);
    if (pool) for (const sp of pool) sp.visible = false;
  }

  // Small yellow arrowhead near the character showing its facing direction.
  private drawFacing(e: Entity, px: number, py: number) {
    const [dx, dy] = FACING[e.facing];
    const cx = px + CELL_PX / 2 + dx * 30 * UI; // ~0.6 arrow-lengths further out
    const cy = py + CELL_PX / 2 + dy * 30 * UI;
    const perpx = -dy;
    const perpy = dx;
    const a = 6 * UI;
    const b = 3 * UI;
    const c = 5 * UI;
    this.actors.addChild(new Graphics().poly([cx + dx * a, cy + dy * a, cx - dx * b + perpx * c, cy - dy * b + perpy * c, cx - dx * b - perpx * c, cy - dy * b - perpy * c]).fill(0xffd24a));
  }

  // Cached top->bottom gradient for the enemy HP fill (mirrors the HUD hp bar's
  // vertical gradient for the same sense of depth). textureSpace 'local' maps the
  // 0..1 stops to each filled rect's bounds, so one gradient reuses across bars.
  private hpFill(elite: boolean): FillGradient {
    const key = elite ? 'elite' : 'enemy';
    let grad = this.hpGradients[key];
    if (!grad) {
      const colorStops = elite
        ? [
            { offset: 0, color: 0xf0d89a },
            { offset: 1, color: 0xc2a06a },
          ]
        : [
            { offset: 0, color: 0xd8524a }, // --hp-from
            { offset: 1, color: 0x8f2b26 }, // --hp-to
          ];
      grad = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local', colorStops });
      this.hpGradients[key] = grad;
    }
    return grad;
  }

  private drawHpBar(px: number, py: number, e: Entity) {
    const m = 8 * UI;
    const h = 4 * UI;
    const w = CELL_PX - 2 * m;
    const x = px + m;
    const y = py + h;
    const pct = Math.max(0, e.hp / e.stats.maxHp);
    const g = new Graphics();
    g.rect(x, y, w, h).fill({ color: 0x0a0d12, alpha: 0.85 }); // recessed dark track
    if (pct > 0) g.rect(x, y, w * pct, h).fill(this.hpFill(!!e.elite)); // vertical gradient fill
    g.rect(x, y, w, h).stroke({ width: 2, color: 0x000000, alpha: 1, alignment: 0.5 }); // crisp black border, sharp corners
    this.actors.addChild(g);
  }

  // Cached Pixi texture for one distinct badge appearance. The set of keys is
  // small and finite (kind × stat × count-bucket × up), so this builds each
  // canvas + Texture once and reuses it across every enemy and frame.
  private badgeTex(key: string, group: StatusBadgeGroup | null, size: number): Texture {
    let t = this.badgeTexCache.get(key);
    if (!t) {
      // Clamp the drawn count to the cache cap so its ×N matches the shared key.
      const g = group && group.count > BADGE_COUNT_CAP ? { ...group, count: BADGE_COUNT_CAP } : group;
      const cv = g ? renderBadgeCanvas(g, size) : renderOverflowBadgeCanvas(size);
      t = Texture.from(cv);
      t.source.scaleMode = 'nearest';
      this.badgeTexCache.set(key, t);
    }
    return t;
  }

  private badgeKey(g: StatusBadgeGroup): string {
    return `${g.kind}:${g.stat ?? ''}:${Math.min(g.count, BADGE_COUNT_CAP)}:${g.up ? 1 : 0}`;
  }

  // Lay out the first few status badges above an enemy's HP bar, reusing a pooled
  // row of Sprites per enemy (hidden when unused). px/py is the enemy's glide
  // top-left; the badge row starts at the HP bar's top-left and runs right.
  private drawStatusBadges(e: Entity, px: number, py: number) {
    const groups = groupStatuses(e.statuses);
    const pool = this.badgeSprites.get(e.id) ?? [];
    if (!this.badgeSprites.has(e.id)) this.badgeSprites.set(e.id, pool);

    // Match the HP bar's geometry (drawHpBar): margin m, sitting just above it.
    const m = 8 * UI;
    const barY = py + 4 * UI; // drawHpBar's y = py + h, h = 4*UI
    const bx = px + m;
    const bySize = STATUS_BADGE_PX * UI;
    const gap = 2 * UI;
    const by = barY - bySize - 2 * UI; // sit just above the bar

    // First N groups, plus an overflow "…" badge when there are more.
    const shown: (StatusBadgeGroup | null)[] = groups.slice(0, STATUS_BADGE_MAX);
    if (groups.length > STATUS_BADGE_MAX) {
      shown[STATUS_BADGE_MAX - 1] = null; // last slot becomes the overflow badge
    }

    shown.forEach((g, i) => {
      let sp = pool[i];
      if (!sp) {
        sp = new Sprite();
        sp.setSize(bySize, bySize);
        this.statusBadges.addChild(sp);
        pool[i] = sp;
      }
      const key = g ? this.badgeKey(g) : '…';
      sp.texture = this.badgeTex(key, g, STATUS_BADGE_PX);
      sp.setSize(bySize, bySize);
      sp.position.set(bx + i * (bySize + gap), by);
      sp.visible = true;
    });
    for (let i = shown.length; i < pool.length; i++) pool[i].visible = false;
  }

  private drawSquareTimer(e: Entity, px: number, py: number) {
    const interval = castInterval(e);
    const frac = Math.min(1, e.castTimerMs / interval); // 0 -> just cast, 1 -> about to cast
    const size = 12 * UI;
    const pad = 4 * UI;
    const bx = px + CELL_PX - size - pad;
    const by = py + CELL_PX - size - pad; // bottom-right, clear of the HP pip along the top edge
    const near = frac > 0.92;
    const isHero = e.faction !== 'enemy';
    const g = new Graphics();
    g.rect(bx, by, size, size).fill({ color: 0x0a0d12, alpha: 0.85 });
    // drains top->down: remaining fill height shrinks as frac -> 1
    g.rect(bx, by, size, size * (1 - frac)).fill(near ? 0xffffff : isHero ? COLORS.timerPlayer : COLORS.timerEnemy);
    g.rect(bx, by, size, size).stroke({ width: 1 * UI, color: COLORS.timerBorder, alpha: 0.9 });
    this.actors.addChild(g);
  }

  private drawBlockOutline(world: WorldState, group: CombatGroup) {
    const cells = new Set(
      group.memberIds
        .map((id) => world.entities[id])
        .filter(Boolean)
        .map((e) => KEY(e!.cell.x, e!.cell.y)),
    );
    const g = new Graphics();
    for (const id of group.memberIds) {
      const e = world.entities[id];
      if (!e) continue;
      const x = e.cell.x * CELL_PX;
      const y = e.cell.y * CELL_PX;
      // draw each edge that borders a non-member cell (union perimeter)
      if (!cells.has(KEY(e.cell.x, e.cell.y - 1))) g.moveTo(x, y).lineTo(x + CELL_PX, y);
      if (!cells.has(KEY(e.cell.x, e.cell.y + 1))) g.moveTo(x, y + CELL_PX).lineTo(x + CELL_PX, y + CELL_PX);
      if (!cells.has(KEY(e.cell.x - 1, e.cell.y))) g.moveTo(x, y).lineTo(x, y + CELL_PX);
      if (!cells.has(KEY(e.cell.x + 1, e.cell.y))) g.moveTo(x + CELL_PX, y).lineTo(x + CELL_PX, y + CELL_PX);
    }
    g.stroke({ width: 2, color: COLORS.blockOutline, alpha: 0.5 });
    this.fx.addChild(g);
  }

  private drawAttackRadius(world: WorldState, elapsedMs: number) {
    const player = world.entities[world.playerId];
    if (!player) return;
    const rt = player.skills[player.activeSkillIndex];
    const skill = rt && getSkill(rt.skillId);
    if (!skill) return;
    // Show the footprint only when the shot is live: the player is ARMED (winding up
    // an out-of-combat ranged fire) OR already in a combat group. Idle out of combat
    // (not armed, not grouped) draws nothing. Pulse harder as a cast/wind-up nears.
    const group = Object.values(world.groups).find((gr) => gr.memberIds.includes(world.playerId));
    if (!group && !player.armed) return;
    const isBuff = skill.kind === 'buff';
    const isTerrain = skill.kind === 'heal';
    const fill = isBuff ? 0x4a8fe0 : isTerrain ? 0x54c56a : COLORS.attackCurrentFill;
    const stroke = isBuff ? 0x86b6f2 : isTerrain ? 0x8fe0a0 : COLORS.attackCurrentBorder;
    const interval = castInterval(player);
    // Both the in-combat cast timer and the armed wind-up accumulate in castTimerMs.
    const frac = group || player.armed ? Math.min(1, player.castTimerMs / interval) : 0;
    const pulse = 0.14 + 0.18 * frac + 0.05 * Math.sin(elapsedMs / 120);
    const g = new Graphics();
    for (const o of shapeFor(skill, rt.level, player.facing)) {
      const cx = (player.cell.x + o.dx) * CELL_PX;
      const cy = (player.cell.y + o.dy) * CELL_PX;
      g.rect(cx + 1, cy + 1, CELL_PX - 2, CELL_PX - 2).fill({ color: fill, alpha: pulse });
      g.rect(cx + 1, cy + 1, CELL_PX - 2, CELL_PX - 2).stroke({ width: 2, color: stroke, alpha: 0.85 });
    }
    this.fx.addChild(g);
  }

  // Spawn floating combat numbers from the latest tick's hit events. Keyed on
  // tickCount so repeated renders of the same world don't double-spawn. Crits are
  // larger + red; misses are a light-grey "MISS"; heals green; hits off-white.
  // Numbers landing near the same spot within 0.2s stack ~2em upward, and each
  // drifts horizontally away from its attacker.
  private spawnHitFloats(world: WorldState, elapsedMs: number) {
    if (world.tickCount === this.lastFloatTick) return;
    this.lastFloatTick = world.tickCount;
    for (const h of world.hits) {
      const crit = h.kind === 'crit';
      const miss = h.kind === 'miss';
      const text = miss ? 'MISS' : h.kind === 'heal' ? `+${h.amount}` : `${h.amount}`;
      const fill = miss ? 0x9aa0a8 : crit ? 0xff5040 : h.kind === 'heal' ? COLORS.healText : COLORS.normalText;
      const t = new Text({
        text,
        style: {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: (crit ? 26 : miss ? 14 : 16) * UI,
          fill,
          stroke: { color: 0x000000, width: 4 * UI },
        },
      });
      t.anchor.set(0.5);
      const x = h.cell.x * CELL_PX + CELL_PX / 2;
      // stack only numbers on the SAME character (same cell) from the last 0.2s,
      // each raised a configurable fraction of a tile — so vertically-adjacent foes
      // keep their numbers at their own heights.
      const stack = this.floats.filter((f) => elapsedMs - f.born < 200 && f.cx === h.cell.x && f.cy === h.cell.y).length;
      const y = h.cell.y * CELL_PX + 12 * UI - stack * DAMAGE_FLOAT_STACK_TILES * CELL_PX;
      const away = h.from ? Math.sign(h.cell.x - h.from.x) : 0;
      // drift away from the attacker, a random amount between straight-up and full
      const driftX = (away || (stack % 2 ? 1 : -1)) * 26 * UI * Math.random();
      t.position.set(x, y);
      this.floatLayer.addChild(t);
      this.floats.push({ text: t, born: elapsedMs, x, y, driftX, cx: h.cell.x, cy: h.cell.y });
    }
  }

  private updateFloats(elapsedMs: number) {
    this.floats = this.floats.filter((f) => {
      const age = elapsedMs - f.born;
      if (age >= DAMAGE_FLOAT_MS) {
        f.text.destroy();
        return false;
      }
      const p = age / DAMAGE_FLOAT_MS;
      f.text.y = f.y - 62 * UI * p;
      f.text.x = f.x + f.driftX * p; // drift horizontally away from the attacker
      f.text.alpha = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
      return true;
    });
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
