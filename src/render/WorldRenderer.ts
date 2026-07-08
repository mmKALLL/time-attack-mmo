import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { CombatGroup, Entity, WorldState } from '../types';
import { getSkill } from '../data';
import { shapeFor } from '../engine/shapes';
import { tileRect, tileLayout } from '../asset-tiles';

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
import { ANIM_FRAME_MS, CAMERA_ZOOM_PCT, CELL_PX, COLORS, COMBAT_TICK_MS, DAMAGE_FLOAT_MS, DESIGN_H, DESIGN_W, FLOOR_CHECKER_SIZE } from '../config';
import { Sprites } from './sprites';

const KEY = (x: number, y: number) => `${x},${y}`;
const FACING: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const UI = CELL_PX / 64; // world-space HUD/text was tuned for 64px cells; scale to the current cell size

type Float = { text: Text; born: number; x: number; y: number };

// Draws the Emberdeep combat world imperatively from engine state. No React here.
export class WorldRenderer {
  readonly root = new Container();
  private bg = new Container();
  private fx = new Container();
  private actors = new Container();
  private floatLayer = new Container();
  private vignette: Sprite | null = null;
  private texCache = new Map<string, Texture>();
  private atlasReady = new Map<string, Texture>(); // background-keyed enemy sheets
  private atlasLoading = new Set<string>();
  private subCache = new Map<string, Texture>();
  private prevHp = new Map<string, number>();
  private prevLevel = new Map<string, number>();
  private floats: Float[] = [];
  private bgMapId: string | undefined; // tiles are rebuilt when the map changes
  private builtVignette = false;

  constructor(private app: Application) {
    this.root.addChild(this.bg, this.fx, this.actors, this.floatLayer);
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
    if (this.bgMapId === world.mapId) return; // tiles unchanged
    this.bgMapId = world.mapId;
    this.bg.removeChildren();
    const g = new Graphics();
    const { width, height, tiles } = world.map;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = tiles[y * width + x];
        const px = x * CELL_PX;
        const py = y * CELL_PX;
        if (t === 'wall') {
          g.rect(px, py, CELL_PX, CELL_PX).fill(COLORS.wallBottom);
          g.rect(px, py, CELL_PX, CELL_PX * 0.55).fill(COLORS.wallTop);
        } else {
          const checker = (Math.floor(x / FLOOR_CHECKER_SIZE) + Math.floor(y / FLOOR_CHECKER_SIZE)) % 2;
          g.rect(px, py, CELL_PX, CELL_PX).fill(checker ? COLORS.floor : COLORS.floorAlt);
          g.rect(px, py, CELL_PX, CELL_PX).stroke({ width: 1, color: COLORS.gridLine, alpha: 0.8 });
        }
      }
    }
    this.bg.addChild(g);
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

  private drawFeatures(world: WorldState, frame: number) {
    const OBS: Record<string, [number, number]> = { '1x1': [1, 1], '1x3': [1, 3], '3x1': [3, 1], '3x3': [3, 3] };
    for (const f of world.features) {
      if (f.kind === 'torch') {
        const sp = new Sprite(this.tex('torch', frame));
        sp.setSize(CELL_PX, CELL_PX);
        sp.position.set(f.cell.x * CELL_PX, f.cell.y * CELL_PX);
        this.actors.addChild(sp);
      } else {
        const [ow, oh] = OBS[f.size];
        const px = f.cell.x * CELL_PX;
        const py = f.cell.y * CELL_PX;
        const g = new Graphics();
        g.rect(px + 3, py + 3, ow * CELL_PX - 6, oh * CELL_PX - 6).fill(0x2c2822);
        g.rect(px + 3, py + 3, ow * CELL_PX - 6, (oh * CELL_PX - 6) * 0.45).fill(0x453f34);
        this.fx.addChild(g);
      }
    }
  }

  private drawPortals(world: WorldState, elapsedMs: number) {
    const pulse = 0.5 + 0.5 * Math.sin(elapsedMs / 400);
    for (const ex of world.exits) {
      const cx = ex.cell.x * CELL_PX + CELL_PX / 2;
      const cy = ex.cell.y * CELL_PX + CELL_PX / 2;
      const g = new Graphics();
      g.rect(cx - CELL_PX / 2 + 2, cy - CELL_PX / 2 + 2, CELL_PX - 4, CELL_PX - 4).fill({ color: 0x43c7c0, alpha: 0.1 });
      g.circle(cx, cy, 22 * UI).stroke({ width: 3 * UI, color: 0x43c7c0, alpha: 0.45 + 0.4 * pulse });
      g.circle(cx, cy, (10 + 6 * pulse) * UI).stroke({ width: 2 * UI, color: 0x8fe0d8, alpha: 0.6 });
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
    this.drawFeatures(world, frame);
    const playerGroup = Object.values(world.groups).find((g) => g.memberIds.includes(world.playerId));
    if (playerGroup) {
      this.drawBlockOutline(world, playerGroup);
      this.drawAttackRadius(world, elapsedMs);
    }

    for (const e of Object.values(world.entities)) {
      this.drawEntity(world, e, frame, bob);
      this.spawnFloatIfDamaged(e, elapsedMs);
      this.spawnLevelUpIfLeveled(e, elapsedMs);
    }
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

    // sprite: asset-based enemies use spritesheet tiles; players use procedural art
    if (e.asset) {
      this.drawEnemyAsset(e, px, py, bob);
    } else {
      const sp = new Sprite(this.tex(e.sprite, frame));
      sp.setSize(CELL_PX, CELL_PX);
      sp.position.set(px, py + bob);
      this.actors.addChild(sp);
    }

    this.drawFacing(e, px, py);
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
    const group = Object.values(world.groups).find((gr) => gr.memberIds.includes(world.playerId));
    if (!player || !group) return;
    const rt = player.skills[player.activeSkillIndex];
    const skill = rt && getSkill(rt.skillId);
    if (!skill) return;
    const frac = group.timerMs / COMBAT_TICK_MS;
    const pulse = 0.14 + 0.18 * frac + 0.05 * Math.sin(elapsedMs / 120);
    const g = new Graphics();
    for (const o of shapeFor(skill, rt.level, player.facing)) {
      const cx = (player.cell.x + o.dx) * CELL_PX;
      const cy = (player.cell.y + o.dy) * CELL_PX;
      g.rect(cx + 1, cy + 1, CELL_PX - 2, CELL_PX - 2).fill({ color: COLORS.attackCurrentFill, alpha: pulse });
      g.rect(cx + 1, cy + 1, CELL_PX - 2, CELL_PX - 2).stroke({ width: 2, color: COLORS.attackCurrentBorder, alpha: 0.85 });
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
