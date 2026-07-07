import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { CombatGroup, Entity, WorldState } from '../types';
import { getSkill } from '../data';
import { shapeFor } from '../engine/shapes';
import {
  ANIM_FRAME_MS,
  CAMERA_ZOOM_PCT,
  CELL_PX,
  COLORS,
  COMBAT_TICK_MS,
  DAMAGE_FLOAT_MS,
  DESIGN_H,
  DESIGN_W,
  FLOOR_CHECKER_SIZE,
} from '../config';
import { Sprites } from './sprites';

const KEY = (x: number, y: number) => `${x},${y}`;
const FACING: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

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
  private prevHp = new Map<string, number>();
  private prevLevel = new Map<string, number>();
  private floats: Float[] = [];
  private builtBg = false;

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
    if (this.builtBg) return;
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

    // Vignette + warm tint overlay (Emberdeep): screen-anchored (added to the
    // app stage, not the world root) so it stays put as the camera scrolls.
    const cv = document.createElement('canvas');
    cv.width = DESIGN_W;
    cv.height = DESIGN_H;
    const ctx = cv.getContext('2d')!;
    const grad = ctx.createRadialGradient(
      cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.3,
      cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.62,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.66)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = 'rgba(180,110,50,0.06)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    this.vignette = new Sprite(Texture.from(cv));
    this.vignette.eventMode = 'none';
    this.app.stage.addChild(this.vignette); // screen-space, above the world root
    this.builtBg = true;
  }

  render(world: WorldState, elapsedMs: number) {
    this.buildBg(world);
    this.camera(world);
    this.fx.removeChildren();
    this.actors.removeChildren();
    const frame = Math.floor(elapsedMs / ANIM_FRAME_MS) % 2;
    const bob = frame ? -2 : 0;

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
          fontSize: 13,
          fill: COLORS.emberHi,
          stroke: { color: 0x000000, width: 4 },
        },
      });
      t.anchor.set(0.5);
      const x = e.cell.x * CELL_PX + CELL_PX / 2;
      const y = e.cell.y * CELL_PX - 10;
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
    shadow.ellipse(px + CELL_PX / 2, py + CELL_PX - 7, CELL_PX * 0.32, CELL_PX * 0.12).fill({ color: 0x000000, alpha: 0.32 });
    this.actors.addChild(shadow);

    // sprite
    const sp = new Sprite(this.tex(e.sprite, frame));
    sp.setSize(CELL_PX, CELL_PX);
    sp.position.set(px, py + bob);
    this.actors.addChild(sp);

    this.drawFacing(e, px, py);
    const inFight = Object.values(world.groups).some((g) => g.memberIds.includes(e.id));
    if (e.faction === 'enemy') this.drawHpPip(px, py, e);
    if (inFight) this.drawSquareTimer(world, e, px, py);
  }

  // Small yellow arrowhead near the character showing its facing direction.
  private drawFacing(e: Entity, px: number, py: number) {
    const [dx, dy] = FACING[e.facing];
    const cx = px + CELL_PX / 2 + dx * 24;
    const cy = py + CELL_PX / 2 + dy * 24;
    const perpx = -dy;
    const perpy = dx;
    this.actors.addChild(
      new Graphics()
        .poly([
          cx + dx * 6, cy + dy * 6,
          cx - dx * 3 + perpx * 5, cy - dy * 3 + perpy * 5,
          cx - dx * 3 - perpx * 5, cy - dy * 3 - perpy * 5,
        ])
        .fill(0xffd24a),
    );
  }

  private drawHpPip(px: number, py: number, e: Entity) {
    const w = CELL_PX - 16;
    const pct = Math.max(0, e.hp / e.stats.maxHp);
    const g = new Graphics();
    g.rect(px + 8, py + 4, w, 4).fill({ color: 0x000000, alpha: 0.55 });
    g.rect(px + 8, py + 4, w * pct, 4).fill(e.elite ? COLORS.timerBorder : COLORS.hpEnemy);
    this.actors.addChild(g);
  }

  private drawSquareTimer(world: WorldState, e: Entity, px: number, py: number) {
    const group = Object.values(world.groups).find((g) => g.memberIds.includes(e.id));
    if (!group) return;
    const frac = group.timerMs / COMBAT_TICK_MS; // 0 -> just cast, 1 -> about to cast
    const size = 12;
    const bx = px + CELL_PX - size - 4;
    const by = py + 4;
    const near = frac > 0.92;
    const isHero = e.faction !== 'enemy';
    const g = new Graphics();
    g.rect(bx, by, size, size).fill({ color: 0x0a0d12, alpha: 0.85 });
    // drains top->down: remaining fill height shrinks as frac -> 1
    const fillH = size * (1 - frac);
    g.rect(bx, by, size, fillH).fill(near ? 0xffffff : isHero ? COLORS.timerPlayer : COLORS.timerEnemy);
    g.rect(bx, by, size, size).stroke({ width: 1, color: COLORS.timerBorder, alpha: 0.9 });
    this.actors.addChild(g);
  }

  private drawBlockOutline(world: WorldState, group: CombatGroup) {
    const cells = new Set(group.memberIds.map((id) => world.entities[id]).filter(Boolean).map((e) => KEY(e!.cell.x, e!.cell.y)));
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
          fontSize: 16,
          fill: heal ? COLORS.healText : COLORS.normalText,
          stroke: { color: 0x000000, width: 4 },
        },
      });
      t.anchor.set(0.5);
      const x = e.cell.x * CELL_PX + CELL_PX / 2 + (Math.abs(delta) % 7) - 3;
      const y = e.cell.y * CELL_PX + 12;
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
      f.text.y = f.y - 62 * p;
      f.text.alpha = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
      return true;
    });
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
