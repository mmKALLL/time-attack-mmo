import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { CombatGroup, Entity, ObstacleSize, TilesetName, WorldState } from '../types';
import { getSkill } from '../data';
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
import { ANIM_FRAME_MS, CAMERA_ZOOM_PCT, CELL_PX, COLORS, COMBAT_TICK_MS, DAMAGE_FLOAT_MS, DESIGN_H, DESIGN_W, FLOOR_CHECKER_SIZE, OBSTACLE_OVERLAY_ALPHA } from '../config';
import { Sprites } from './sprites';

const KEY = (x: number, y: number) => `${x},${y}`;
const FACING: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const UI = CELL_PX / 64; // world-space HUD/text was tuned for 64px cells; scale to the current cell size

// Map tile sheets (2048x2048): four biome quadrants of 1024x1024, each a 4x4
// grid of CELL_PX tiles. Floor quadrants are tileable ground fields; obstacle
// quadrants hold one prop per footprint size (1x1 corner, 3x1 top, 1x3 left,
// 3x3 center). Quadrant order: forest, lake / deepForest, town.
const FLOOR_SHEET = 'tiles-floor.png';
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

type Float = { text: Text; born: number; x: number; y: number };

// Draws the Emberdeep combat world imperatively from engine state. No React here.
export class WorldRenderer {
  readonly root = new Container();
  private bg = new Container();
  private fx = new Container();
  private actors = new Container();
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
  private bgTilesReady = false; // floor + obstacle sheets loaded when the current bg was built
  private propCells = new Set<string>(); // cells carrying an obstacle prop (wall ring + features)
  private prevHp = new Map<string, number>();
  private prevLevel = new Map<string, number>();
  private floats: Float[] = [];
  private bgMapId: string | undefined; // tiles are rebuilt when the map changes
  private builtVignette = false;

  constructor(private app: Application) {
    this.root.addChild(this.bg, this.fx, this.actors, this.lights, this.floatLayer);
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
      const sp = new Sprite(tex);
      sp.setSize(CELL_PX, CELL_PX); // downscale the 512px portrait to one cell
      sp.anchor.set(0.5, 1); // bottom-center on the cell
      if (e.facing === 'left' || e.facing === 'up') sp.scale.x = -Math.abs(sp.scale.x); // face left on up too
      sp.position.set(px + CELL_PX / 2, py + CELL_PX + bob);
      this.actors.addChild(sp);
    }
    return true;
  }

  // Follow camera: fixed zoom (CAMERA_ZOOM_PCT), always centered on the player.
  // No edge clamp — space outside the map shows the black stage background.
  private camera(world: WorldState) {
    const scale = CAMERA_ZOOM_PCT / 100;
    const p = world.entities[world.playerId];
    const cx = (p ? p.cell.x * CELL_PX + CELL_PX / 2 : (world.map.width * CELL_PX) / 2) * scale;
    const cy = (p ? p.cell.y * CELL_PX + CELL_PX / 2 : (world.map.height * CELL_PX) / 2) * scale;
    this.root.scale.set(scale);
    this.root.x = DESIGN_W / 2 - cx;
    this.root.y = DESIGN_H / 2 - cy;
  }

  private buildBg(world: WorldState) {
    this.buildVignette();
    // Rebuilt when the map changes, and retried each frame until both tile sheets
    // have loaded (so we swap the procedural fallback for the real biome art).
    const floor = this.plainAtlas(FLOOR_SHEET);
    const obst = this.plainAtlas(OBSTACLE_SHEET);
    if (this.bgMapId === world.mapId && this.bgTilesReady) return;
    this.bgMapId = world.mapId;
    this.bgTilesReady = !!(floor && obst);
    this.bg.removeChildren();

    const { width, height } = world.map;
    const ts = MAPS[world.mapId]?.gen.tileset ?? 'forest';
    const [qx, qy] = QUAD[ts];

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
    const g = new Graphics(); // procedural-floor fallback until the sheet loads
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x * CELL_PX;
        const py = y * CELL_PX;
        if (floor) {
          const tex = this.mapSub(FLOOR_SHEET, qx + (x % 4) * CELL_PX, qy + (y % 4) * CELL_PX, CELL_PX, CELL_PX);
          if (tex) {
            const sp = new Sprite(tex);
            sp.setSize(CELL_PX, CELL_PX);
            sp.position.set(px, py);
            this.bg.addChild(sp);
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
      for (let dy = 0; dy < oh; dy++) for (let dx = 0; dx < ow; dx++) {
        covered.add(KEY(x + dx, y + dy));
        this.propCells.add(KEY(x + dx, y + dy));
      }
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!free(x, y)) continue;
        if (free(x + 1, y) && free(x + 2, y)) place('3x1', x, y); // horizontal run
        else if (free(x, y + 1) && free(x, y + 2)) place('1x3', x, y); // vertical run
        else place('1x1', x, y); // corner / straggler
      }
    }
  }

  // Vignette + warm tint overlay (Emberdeep): screen-anchored (added to the app
  // stage, not the world root) so it stays put as the camera scrolls. Built once.
  private buildVignette() {
    if (this.builtVignette) return;
    const cv = document.createElement('canvas');
    cv.width = DESIGN_W;
    cv.height = DESIGN_H;
    const ctx = cv.getContext('2d')!;
    const grad = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.3, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.62);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.66)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = 'rgba(180,110,50,0.06)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    this.vignette = new Sprite(Texture.from(cv));
    this.vignette.eventMode = 'none';
    this.app.stage.addChild(this.vignette);
    this.builtVignette = true;
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

  private addGlow(layer: Container, cx: number, cy: number, wCells: number, tint: number, alpha: number, hCells = wCells) {
    const sp = new Sprite(this.glowTex());
    sp.anchor.set(0.5);
    sp.blendMode = 'add';
    sp.tint = tint;
    sp.alpha = alpha;
    sp.setSize(CELL_PX * wCells, CELL_PX * hCells);
    sp.position.set(cx, cy);
    layer.addChild(sp);
  }

  // Faint red elliptical glow overlapping each enemy (taller than wide to hug a
  // standing sprite). Drawn into fx so it sits behind the enemy sprite (actors).
  private drawEnemyGlow(world: WorldState) {
    for (const e of Object.values(world.entities)) {
      if (e.faction !== 'enemy') continue;
      const cx = e.cell.x * CELL_PX + CELL_PX / 2;
      const cy = e.cell.y * CELL_PX + CELL_PX * 0.45; // over the sprite body
      this.addGlow(this.fx, cx, cy, 1.2, 0xff5a5a, 0.28, 1.7);
    }
  }

  // A gentle ambient dusk over the map, with additive glows: warm at each torch
  // (the prop itself is hidden) and aqua around each portal.
  private buildLights(world: WorldState, elapsedMs: number) {
    this.lights.removeChildren();
    const veil = new Graphics();
    veil.rect(0, 0, world.map.width * CELL_PX, world.map.height * CELL_PX).fill({ color: 0x0a0a12, alpha: 0.22 });
    this.lights.addChild(veil);
    for (const f of world.features) {
      if (f.kind !== 'torch') continue;
      const pulse = 0.85 + 0.15 * Math.sin(elapsedMs / 260 + (f.cell.x + f.cell.y));
      this.addGlow(this.lights, f.cell.x * CELL_PX + CELL_PX / 2, f.cell.y * CELL_PX + CELL_PX / 2, 3.4, 0xffc27a, pulse);
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
    this.buildBg(world);
    this.camera(world);
    this.fx.removeChildren();
    this.actors.removeChildren();
    const frame = Math.floor(elapsedMs / ANIM_FRAME_MS) % 2;
    const bob = frame ? -2 * UI : 0;

    this.drawPortals(world, elapsedMs);
    this.drawFeatures(world);
    this.drawCollisionOverlay(); // above walls/obstacles, below actors
    this.drawEnemyGlow(world); // elliptical red glow behind each enemy
    const playerGroup = Object.values(world.groups).find((g) => g.memberIds.includes(world.playerId));
    if (playerGroup) this.drawBlockOutline(world, playerGroup);
    this.drawAttackRadius(world, elapsedMs); // always visible for the selected skill

    for (const e of Object.values(world.entities)) {
      this.drawEntity(world, e, frame, bob);
      this.spawnFloatIfDamaged(e, elapsedMs);
      this.spawnLevelUpIfLeveled(e, elapsedMs);
    }
    this.buildLights(world, elapsedMs); // dusk veil + torch glows over the scene
    // reap tracking maps for entities that no longer exist
    for (const id of [...this.prevHp.keys()]) if (!world.entities[id]) this.prevHp.delete(id);
    for (const id of [...this.prevLevel.keys()]) if (!world.entities[id]) this.prevLevel.delete(id);

    this.updateFloats(elapsedMs);
  }

  private spawnLevelUpIfLeveled(e: Entity, elapsedMs: number) {
    const prev = this.prevLevel.get(e.id);
    if (prev !== undefined && e.level > prev) {
      const t = new Text({
        text: 'LEVEL UP!',
        style: {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 26 * UI,
          fill: COLORS.emberHi,
          stroke: { color: 0x000000, width: 4 * UI },
        },
      });
      t.anchor.set(0.5);
      const x = e.cell.x * CELL_PX + CELL_PX / 2;
      const y = e.cell.y * CELL_PX - 10 * UI;
      t.position.set(x, y);
      this.floatLayer.addChild(t);
      this.floats.push({ text: t, born: elapsedMs, x, y });
    }
    this.prevLevel.set(e.id, e.level);
  }

  private drawEntity(world: WorldState, e: Entity, frame: number, bob: number) {
    const px = e.cell.x * CELL_PX;
    const py = e.cell.y * CELL_PX;

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

    if (e.faction !== 'enemy') this.drawFacing(e, px, py); // enemies show no facing arrow
    const inFight = Object.values(world.groups).some((g) => g.memberIds.includes(e.id));
    if (e.faction === 'enemy') this.drawHpPip(px, py, e);
    if (inFight) this.drawSquareTimer(world, e, px, py);
  }

  // Small yellow arrowhead near the character showing its facing direction.
  private drawFacing(e: Entity, px: number, py: number) {
    const [dx, dy] = FACING[e.facing];
    const cx = px + CELL_PX / 2 + dx * 24 * UI;
    const cy = py + CELL_PX / 2 + dy * 24 * UI;
    const perpx = -dy;
    const perpy = dx;
    const a = 6 * UI;
    const b = 3 * UI;
    const c = 5 * UI;
    this.actors.addChild(new Graphics().poly([cx + dx * a, cy + dy * a, cx - dx * b + perpx * c, cy - dy * b + perpy * c, cx - dx * b - perpx * c, cy - dy * b - perpy * c]).fill(0xffd24a));
  }

  private drawHpPip(px: number, py: number, e: Entity) {
    const m = 8 * UI;
    const h = 4 * UI;
    const w = CELL_PX - 2 * m;
    const pct = Math.max(0, e.hp / e.stats.maxHp);
    const g = new Graphics();
    g.rect(px + m, py + h, w, h).fill({ color: 0x000000, alpha: 0.55 });
    g.rect(px + m, py + h, w * pct, h).fill(e.elite ? COLORS.timerBorder : COLORS.hpEnemy);
    this.actors.addChild(g);
  }

  private drawSquareTimer(world: WorldState, e: Entity, px: number, py: number) {
    const group = Object.values(world.groups).find((g) => g.memberIds.includes(e.id));
    if (!group) return;
    const frac = group.timerMs / COMBAT_TICK_MS; // 0 -> just cast, 1 -> about to cast
    const size = 12 * UI;
    const pad = 4 * UI;
    const bx = px + CELL_PX - size - pad;
    const by = py + pad;
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
    // Support skills (buffs blue, terrain/heals green) always show their footprint;
    // attacks only while in combat. Pulse harder as a cast nears.
    const group = Object.values(world.groups).find((gr) => gr.memberIds.includes(world.playerId));
    const isBuff = skill.kind === 'buff';
    const isTerrain = skill.kind === 'heal';
    if (!group && !isBuff && !isTerrain) return; // attacks hidden out of combat
    const fill = isBuff ? 0x4a8fe0 : isTerrain ? 0x54c56a : COLORS.attackCurrentFill;
    const stroke = isBuff ? 0x86b6f2 : isTerrain ? 0x8fe0a0 : COLORS.attackCurrentBorder;
    const frac = group ? group.timerMs / COMBAT_TICK_MS : 0;
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

  private spawnFloatIfDamaged(e: Entity, elapsedMs: number) {
    const prev = this.prevHp.get(e.id);
    if (prev !== undefined && e.hp !== prev) {
      const delta = e.hp - prev;
      const heal = delta > 0;
      const t = new Text({
        text: heal ? `+${delta}` : `${-delta}`,
        style: {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 16 * UI,
          fill: heal ? COLORS.healText : COLORS.normalText,
          stroke: { color: 0x000000, width: 4 * UI },
        },
      });
      t.anchor.set(0.5);
      const x = e.cell.x * CELL_PX + CELL_PX / 2 + ((Math.abs(delta) % 7) - 3) * UI;
      const y = e.cell.y * CELL_PX + 12 * UI;
      t.position.set(x, y);
      this.floatLayer.addChild(t);
      this.floats.push({ text: t, born: elapsedMs, x, y });
    }
    this.prevHp.set(e.id, e.hp);
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
      f.text.alpha = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
      return true;
    });
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
