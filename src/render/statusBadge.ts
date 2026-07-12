// Procedural status-effect badge icons, shared by the world renderer (Pixi, 16px
// textures above enemy HP bars) and the HUD party frames (React, 32px canvases).
// One canvas-drawing routine (drawStatusBadge) backs both so they look identical.
// RENDER-ONLY: reads the engine's STATUS table for the harmful flag but never
// mutates engine state. Math.random is fine here (this is not the engine).
import type { PrimaryKey, StatusEffect, StatusKind } from '../types';
import { STATUS } from '../config-stats';

// Per-kind theme colour (the rounded-square fill). Chosen to pop on the dark HUD.
// statPercent/statFlat are neutral here and get tinted by sign at draw time.
export const STATUS_VISUALS: Record<StatusKind, { color: string }> = {
  poison: { color: '#6cc24a' }, // green
  bleed: { color: '#d13a3a' }, // crimson
  burn: { color: '#f0872e' }, // orange
  slow: { color: '#5bb8e8' }, // ice-blue
  stun: { color: '#f2d048' }, // yellow
  atkUp: { color: '#e0574a' }, // red
  atkDown: { color: '#4a86e0' }, // blue
  defUp: { color: '#9fb4c8' }, // steel
  defDown: { color: '#b06a6a' }, // dull-red
  dodge: { color: '#3fc7b0' }, // teal
  blind: { color: '#8a8f9c' }, // grey
  critUp: { color: '#f4c430' }, // gold (crit-chance buff)
  critDmgUp: { color: '#e8933f' }, // amber (crit-damage buff)
  statPercent: { color: '#8f96a4' }, // neutral (tinted by sign at draw time)
  statFlat: { color: '#8f96a4' }, // neutral (tinted by sign at draw time)
};

// One badge to draw: a kind (plus stat, for stat kinds), how many collapsed into
// it, whether it counts as harmful (category ring colour), and — for stat kinds —
// whether the net effect is a buff (up) or debuff.
export type StatusBadgeGroup = { kind: StatusKind; stat?: PrimaryKey; count: number; harmful: boolean; up?: boolean };

const isStatKind = (k: StatusKind) => k === 'statPercent' || k === 'statFlat';

// Collapse an entity's raw statuses into one badge per kind (and per stat for the
// stat kinds), summing counts. Order is first-seen (stable). For stat kinds,
// harmful/up follow the group's NET potency: buff (up) when net >= 0, else debuff.
export function groupStatuses(statuses: StatusEffect[]): StatusBadgeGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, { kind: StatusKind; stat?: PrimaryKey; count: number; netPotency: number }>();
  for (const st of statuses) {
    const key = isStatKind(st.kind) ? `${st.kind}:${st.stat ?? ''}` : st.kind;
    let g = byKey.get(key);
    if (!g) {
      g = { kind: st.kind, stat: st.stat, count: 0, netPotency: 0 };
      byKey.set(key, g);
      order.push(key);
    }
    g.count += 1;
    g.netPotency += st.potency;
  }
  return order.map((key) => {
    const g = byKey.get(key)!;
    if (isStatKind(g.kind)) {
      const up = g.netPotency >= 0;
      return { kind: g.kind, stat: g.stat, count: g.count, harmful: !up, up };
    }
    return { kind: g.kind, stat: g.stat, count: g.count, harmful: STATUS[g.kind].harmful };
  });
}

// ---------- Canvas drawing ----------

// Effective fill colour for a group: neutral stat kinds tint green (buff) / red
// (debuff) by sign; everything else uses its theme colour.
function fillColor(group: StatusBadgeGroup): string {
  if (isStatKind(group.kind)) return group.up ? '#5ac46a' : '#d15656';
  return STATUS_VISUALS[group.kind].color;
}

// #rrggbb -> {r,g,b}
function hexRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function mix(hex: string, toward: number, amt: number): string {
  const { r, g, b } = hexRgb(hex);
  const c = (v: number) => Math.round(v + (toward - v) * amt);
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const GLYPH = '#f4f6f8'; // near-white glyph ink (also the ×N count + overflow dots)
const GLYPH_DARK = '#14171b'; // dark glyph ink for LIGHT badge fills (yellow/steel/ice-blue/grey…)
// Perceptual luminance (0..1) of a #rrggbb colour.
function lum(hex: string): number {
  const c = hexRgb(hex);
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}
// Glyph ink that contrasts with the badge fill: dark on light fills, near-white on dark ones.
function glyphInk(base: string): string {
  return lum(base) > 0.55 ? GLYPH_DARK : GLYPH;
}

// Draws ONE badge filling a size×size box: rounded-square fill (subtle top-lighter
// gradient), a thin category ring, the procedural glyph, and a ×N stack count.
export function drawStatusBadge(ctx: CanvasRenderingContext2D, group: StatusBadgeGroup, size: number) {
  ctx.clearRect(0, 0, size, size);
  const base = fillColor(group);
  const pad = Math.max(1, size * 0.06);
  const x = pad;
  const y = pad;
  const w = size - pad * 2;
  const h = size - pad * 2;
  const r = size * 0.22;

  // Background: rounded square with a subtle top-lighter vertical gradient.
  roundRectPath(ctx, x, y, w, h, r);
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, mix(base, 255, 0.14)); // slightly lighter top
  grad.addColorStop(1, mix(base, 0, 0.2)); // darker bottom for depth
  ctx.fillStyle = grad;
  ctx.fill();

  // Category ring: subtle ~1px stroke — dark-red for harmful, soft-gold for good.
  roundRectPath(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, Math.max(1, r - 0.75));
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.strokeStyle = group.harmful ? 'rgba(120,20,20,0.85)' : 'rgba(230,197,131,0.85)';
  ctx.stroke();

  // Glyph, centered. Ink contrasts with the fill (dark ink on light badges, near-
  // white on dark ones), wrapped in an opposite-tone halo so it reads on ANY colour.
  const ink = glyphInk(base);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.shadowColor = ink === GLYPH_DARK ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  drawGlyph(ctx, group, size);
  ctx.restore();

  // Stack count ×N in the bottom-right (near-white digits, dark outline).
  if (group.count > 1) drawCount(ctx, group.count, size);
}

// The 13 procedural glyphs. Each draws centered on (0,0) in a coordinate space
// where `s` is the full badge size; keep shapes bold so they read at 16px.
function drawGlyph(ctx: CanvasRenderingContext2D, group: StatusBadgeGroup, s: number) {
  const u = s / 32; // author at 32; everything scales by u
  switch (group.kind) {
    case 'poison':
      return glyphSkull(ctx, u);
    case 'bleed':
      return glyphTeardrop(ctx, u);
    case 'burn':
      return glyphFlame(ctx, u);
    case 'slow':
      return glyphSnowflake(ctx, u);
    case 'stun':
      return glyphStars(ctx, u);
    case 'atkUp':
      return glyphChevron(ctx, u, true);
    case 'atkDown':
      return glyphChevron(ctx, u, false);
    case 'defUp':
      return glyphShield(ctx, u, false);
    case 'defDown':
      return glyphShield(ctx, u, true);
    case 'dodge':
      return glyphSwoosh(ctx, u);
    case 'blind':
      return glyphEyeSlashed(ctx, u);
    case 'statPercent':
      return glyphStatTriangle(ctx, u, !!group.up, 'percent');
    case 'statFlat':
      return glyphStatTriangle(ctx, u, !!group.up, 'flat');
  }
}

// poison — skull: rounded dome + two eye sockets + a small jaw with teeth.
function glyphSkull(ctx: CanvasRenderingContext2D, u: number) {
  ctx.beginPath();
  ctx.arc(0, -2 * u, 8 * u, Math.PI, 0); // dome
  ctx.lineTo(6 * u, 4 * u);
  ctx.lineTo(-6 * u, 4 * u);
  ctx.closePath();
  ctx.fill();
  // jaw
  ctx.beginPath();
  roundRectPath(ctx, -4.5 * u, 3 * u, 9 * u, 4.5 * u, 1.5 * u);
  ctx.fill();
  // eye sockets (punch out with the fill colour behind — draw dark)
  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(20,25,20,0.92)';
  ctx.beginPath();
  ctx.arc(-3.4 * u, -1.5 * u, 2.4 * u, 0, Math.PI * 2);
  ctx.arc(3.4 * u, -1.5 * u, 2.4 * u, 0, Math.PI * 2);
  ctx.fill();
  // teeth gaps
  ctx.fillRect(-1.4 * u, 3 * u, 0.8 * u, 4.5 * u);
  ctx.fillRect(0.6 * u, 3 * u, 0.8 * u, 4.5 * u);
  ctx.restore();
}

// bleed — blood teardrop: a circle tapering to a point at the top.
function glyphTeardrop(ctx: CanvasRenderingContext2D, u: number) {
  ctx.beginPath();
  ctx.moveTo(0, -8.5 * u); // point at top
  ctx.quadraticCurveTo(6.5 * u, 1 * u, 4.8 * u, 4.5 * u);
  ctx.arc(0, 4 * u, 5 * u, 0.15 * Math.PI, 0.85 * Math.PI, false);
  ctx.quadraticCurveTo(-6.5 * u, 1 * u, 0, -8.5 * u);
  ctx.closePath();
  ctx.fill();
}

// burn — flame: an upward teardrop/leaf with a wavy base + a lighter inner flame.
function glyphFlame(ctx: CanvasRenderingContext2D, u: number) {
  ctx.beginPath();
  ctx.moveTo(0, -9 * u); // tip
  ctx.bezierCurveTo(6 * u, -3 * u, 6 * u, 4 * u, 2 * u, 6.5 * u);
  ctx.bezierCurveTo(4 * u, 2 * u, -1 * u, 1 * u, -1.5 * u, 5.5 * u);
  ctx.bezierCurveTo(-6 * u, 3 * u, -5 * u, -3 * u, 0, -9 * u);
  ctx.closePath();
  ctx.fill();
  // inner flame, lighter
  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,230,170,0.85)';
  ctx.beginPath();
  ctx.moveTo(0, -3 * u);
  ctx.bezierCurveTo(3 * u, 0, 2.5 * u, 4 * u, 0.5 * u, 5.5 * u);
  ctx.bezierCurveTo(1.5 * u, 3 * u, -1.5 * u, 3 * u, -0.5 * u, 5.5 * u);
  ctx.bezierCurveTo(-2.5 * u, 3.5 * u, -2 * u, 0, 0, -3 * u);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// slow — snowflake: 6 spokes with small V branch-ticks.
function glyphSnowflake(ctx: CanvasRenderingContext2D, u: number) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.6 * u;
  const R = 8 * u;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const ex = Math.cos(a) * R;
    const ey = Math.sin(a) * R;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // branch ticks at ~65% out
    const bx = Math.cos(a) * R * 0.6;
    const by = Math.sin(a) * R * 0.6;
    const t = 2.6 * u;
    for (const sgn of [-1, 1]) {
      const ba = a + sgn * (Math.PI / 3.5);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(ba) * t, by + Math.sin(ba) * t);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// stun — dizzy stars: three small 4-point stars along a shallow arc.
function glyphStars(ctx: CanvasRenderingContext2D, u: number) {
  const star = (cx: number, cy: number, rad: number) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? rad : rad * 0.4;
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };
  star(-5.5 * u, 1 * u, 3 * u);
  star(0, -4 * u, 3.6 * u);
  star(5.5 * u, 1 * u, 3 * u);
}

// atkUp/atkDown — a thick chevron/arrow pointing up or down.
function glyphChevron(ctx: CanvasRenderingContext2D, u: number, up: boolean) {
  const s = up ? 1 : -1;
  ctx.beginPath();
  // outer chevron
  ctx.moveTo(0, -7 * u * s);
  ctx.lineTo(7 * u, 0);
  ctx.lineTo(4 * u, 0);
  ctx.lineTo(4 * u, 6.5 * u * s);
  ctx.lineTo(-4 * u, 6.5 * u * s);
  ctx.lineTo(-4 * u, 0);
  ctx.lineTo(-7 * u, 0);
  ctx.closePath();
  ctx.fill();
}

// defUp/defDown — a heraldic shield; defDown adds a jagged crack.
function glyphShield(ctx: CanvasRenderingContext2D, u: number, cracked: boolean) {
  ctx.beginPath();
  ctx.moveTo(-6.5 * u, -6 * u);
  ctx.quadraticCurveTo(0, -8 * u, 6.5 * u, -6 * u); // rounded top
  ctx.lineTo(6.5 * u, 1 * u);
  ctx.quadraticCurveTo(6.5 * u, 6 * u, 0, 8.5 * u); // pointed bottom
  ctx.quadraticCurveTo(-6.5 * u, 6 * u, -6.5 * u, 1 * u);
  ctx.closePath();
  ctx.fill();
  if (cracked) {
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(30,20,20,0.9)';
    ctx.lineWidth = 1.6 * u;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.5 * u, -6.5 * u);
    ctx.lineTo(1.5 * u, -2 * u);
    ctx.lineTo(-1.5 * u, 1.5 * u);
    ctx.lineTo(1 * u, 5 * u);
    ctx.lineTo(0, 8 * u);
    ctx.stroke();
    ctx.restore();
  }
}

// dodge — a motion swoosh: a double-chevron afterimage.
function glyphSwoosh(ctx: CanvasRenderingContext2D, u: number) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = ctx.strokeStyle;
  for (let i = 0; i < 2; i++) {
    const dx = i * 4 * u - 2 * u;
    ctx.globalAlpha = i === 0 ? 0.55 : 1; // trailing afterimage
    ctx.beginPath();
    ctx.moveTo(dx - 4 * u, -6 * u);
    ctx.lineTo(dx + 3.5 * u, 0);
    ctx.lineTo(dx - 4 * u, 6 * u);
    ctx.lineWidth = 2.4 * u;
    ctx.stroke();
  }
  ctx.restore();
}

// blind — an eye (almond outline + pupil) with a diagonal slash.
function glyphEyeSlashed(ctx: CanvasRenderingContext2D, u: number) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.6 * u;
  // almond eye outline
  ctx.beginPath();
  ctx.moveTo(-8 * u, 0);
  ctx.quadraticCurveTo(0, -6.5 * u, 8 * u, 0);
  ctx.quadraticCurveTo(0, 6.5 * u, -8 * u, 0);
  ctx.closePath();
  ctx.stroke();
  // pupil
  ctx.beginPath();
  ctx.arc(0, 0, 2.6 * u, 0, Math.PI * 2);
  ctx.fill();
  // diagonal slash (dark, then white to pop)
  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(30,20,20,0.9)';
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.moveTo(-8 * u, 7 * u);
  ctx.lineTo(8 * u, -7 * u);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 1.4 * u;
  ctx.beginPath();
  ctx.moveTo(-8 * u, 7 * u);
  ctx.lineTo(8 * u, -7 * u);
  ctx.stroke();
  ctx.restore();
}

// statPercent/statFlat — a triangle up (buff) / down (debuff) already tinted by
// the fill colour; a tiny '%' mark for percent vs a +/− bar for flat.
function glyphStatTriangle(ctx: CanvasRenderingContext2D, u: number, up: boolean, mode: 'percent' | 'flat') {
  const s = up ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(0, -7 * u * s);
  ctx.lineTo(6.5 * u, 5 * u * s);
  ctx.lineTo(-6.5 * u, 5 * u * s);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(25,20,20,0.9)';
  ctx.strokeStyle = 'rgba(25,20,20,0.9)';
  if (mode === 'percent') {
    // tiny percent: two dots + a slash, centered in the triangle body
    const cy = 1 * u * s;
    ctx.beginPath();
    ctx.arc(-2 * u, cy - 1.5 * u, 1 * u, 0, Math.PI * 2);
    ctx.arc(2 * u, cy + 1.5 * u, 1 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.1 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2.4 * u, cy - 2.6 * u);
    ctx.lineTo(-2.4 * u, cy + 2.6 * u);
    ctx.stroke();
  } else {
    // flat: a +/− bar inside the triangle
    const cy = 1 * u * s;
    ctx.lineWidth = 1.4 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2.6 * u, cy);
    ctx.lineTo(2.6 * u, cy);
    ctx.stroke();
    if (up) {
      ctx.beginPath();
      ctx.moveTo(0, cy - 2.6 * u);
      ctx.lineTo(0, cy + 2.6 * u);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ×N stack count in the bottom-right corner: near-white digits, dark outline.
function drawCount(ctx: CanvasRenderingContext2D, count: number, s: number) {
  const label = `×${count}`;
  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.font = `700 ${Math.round(s * 0.34)}px "Press Start 2P", monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  const x = s - s * 0.06;
  const y = s - s * 0.02;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, s * 0.1);
  ctx.strokeStyle = 'rgba(10,12,18,0.95)';
  ctx.strokeText(label, x, y);
  ctx.fillStyle = GLYPH;
  ctx.fillText(label, x, y);
  ctx.restore();
}

// Offscreen canvas for a group at a size — the Pixi texture path builds a
// Texture.from(this canvas) once per distinct appearance and caches it.
export function renderBadgeCanvas(group: StatusBadgeGroup, size: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;
  drawStatusBadge(ctx, group, size);
  return cv;
}

// The neutral overflow "…" badge shown in the world when an enemy carries more
// groups than the world cap. Not a StatusKind, so it has its own tiny renderer.
export function renderOverflowBadgeCanvas(size: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;
  const pad = Math.max(1, size * 0.06);
  const r = size * 0.22;
  roundRectPath(ctx, pad, pad, size - pad * 2, size - pad * 2, r);
  ctx.fillStyle = '#2a3038';
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.strokeStyle = 'rgba(230,197,131,0.55)';
  ctx.stroke();
  ctx.fillStyle = GLYPH;
  const dot = size * 0.07;
  for (const dx of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.arc(size / 2 + dx * size * 0.2, size / 2, dot, 0, Math.PI * 2);
    ctx.fill();
  }
  return cv;
}
