// @ts-nocheck
/* eslint-disable */
// Vendored from docs/design_handoff_combat_and_classes/sprites.js — unwrapped
// from the browser IIFE into an ES module. Procedural 32x32 pixel-art.
/* ============================================================
   Pixel sprite engine for the RPG design drafts.
   32x32 authored grids, integer 2x -> 64px cells. Auto-outline,
   contact shadow, per-direction tint/saturation. No external deps.
   Exposes window.Sprites
   ============================================================ */

  const N = 32; // grid size

  // ---- grid helpers ----
  function G() { return Array.from({ length: N }, () => Array(N).fill(null)); }
  function s(g, x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= N || y >= N) return; g[y][x] = c; }
  function hs(g, y, x0, x1, c) { for (let x = x0; x <= x1; x++) s(g, x, y, c); }
  function rct(g, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) hs(g, y, x0, x1, c); }
  function ell(g, cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1.02) s(g, cx + x, cy + y, c);
    }
  }
  // top half dome (mushroom cap etc.)
  function dome(g, cx, cy, rx, ry, c) {
    for (let y = -ry; y <= 0; y++) for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1.02) s(g, cx + x, cy + y, c);
    }
  }
  // filled triangle (hat)
  function tri(g, cx, apexY, halfBase, baseY, c) {
    const h = baseY - apexY;
    for (let y = apexY; y <= baseY; y++) {
      const t = (y - apexY) / h; const w = Math.round(halfBase * t);
      hs(g, y, cx - w, cx + w, c);
    }
  }
  function legs(g, x0, x1, y0, y1, c) { rct(g, x0, y0, x0 + 1, y1, c); rct(g, x1 - 1, y0, x1, y1, c); }

  // ---- palettes ----
  const P = {
    dark: '#12100e', skin: '#e0b48c', skinS: '#c08e68',
    // slime
    slime: '#3fb7a2', slimeL: '#7fe6d2', slimeD: '#238073', slimeEye: '#0d1f26',
    // bat
    bat: '#5b4a7a', batL: '#7a67a0', batD: '#3a2f52', batEye: '#ff5a5a',
    // spider
    spider: '#4a3d5c', spiderL: '#63527a', spiderD: '#2e2540', spiderEye: '#ff5a5a', spiderMark: '#c96a4a',
    // mushroom
    cap: '#c8443f', capL: '#e56b5f', capD: '#8f2b2c', spot: '#f0e2c4', stem: '#e8d8b8', stemD: '#c3ad86', mushEye: '#3a2b24',
    // golem
    rock: '#6d7079', rockL: '#8f939c', rockD: '#4a4d55', rockCore: '#67d4e0', moss: '#5a7a4a',
    // ranger (ember archer)
    cloak: '#7a4a34', cloakL: '#a06848', cloakD: '#54301f', hood: '#63392a', bow: '#8a5a30', bowL: '#c69152', ember: '#f0873a', emberL: '#ffce6b', string: '#d8cbb0', boot: '#3a2a20',
    // knight (steel-blue duelist)
    steel: '#4d6f96', steelL: '#82a9cc', steelD: '#324a68', hair: '#3a2c24', scarf: '#43c7c0', blade: '#cfe0ec', bladeD: '#8fa6b8', hilt: '#c8923f', pant: '#2c3a4a',
    // wizard (violet ember caster)
    robe: '#5f4a8f', robeL: '#8069b0', robeD: '#3e3060', hat: '#4a3872', trim: '#f0873a', trimL: '#ffce6b', staff: '#7a5230', orb: '#ff9a3c', orbL: '#ffe08a',
    // props
    wood: '#7a5334', woodL: '#a0764a', woodD: '#543722', hoop: '#4a4a52', metalL: '#9aa0aa',
    flame: '#ff9a3c', flameL: '#ffe08a', flameC: '#fff4c8',
  };

  // =================== SPRITE BUILDERS ===================
  // Each returns a 32x32 grid. Feet ~ y=30. Called (frame)=>grid.
  const B = {};

  B.slime = function (f) {
    const g = G();
    const dy = f ? 2 : 0; const rx = f ? 12 : 10; const ry = f ? 7 : 9;
    const cy = 23 + (f ? 1 : 0);
    ell(g, 15.5, cy, rx, ry, P.slime);
    ell(g, 15.5, cy + 1, rx - 1, ry - 1, P.slime);
    // shading
    ell(g, 13.5, cy - ry + 3, rx - 5, ry - 4, P.slimeL);
    for (let x = 6; x < 26; x++) { s(g, x, cy + ry - 1, P.slimeD); s(g, x, cy + ry - 2, P.slimeD); }
    // eyes
    ell(g, 12, cy - 1 + (f ? 1 : 0), 1, 2, P.slimeEye);
    ell(g, 19, cy - 1 + (f ? 1 : 0), 1, 2, P.slimeEye);
    s(g, 12, cy - 2 + (f ? 1 : 0), '#ffffff'); s(g, 19, cy - 2 + (f ? 1 : 0), '#ffffff');
    // mouth
    hs(g, cy + 2 + (f ? 1 : 0), 14, 17, P.slimeD);
    return g;
  };

  B.bat = function (f) {
    const g = G();
    const wy = f ? 4 : -2; // wing vertical
    // body
    ell(g, 16, 16, 3, 5, P.bat);
    ell(g, 15, 14, 2, 2, P.batL);
    // ears
    s(g, 13, 9, P.bat); s(g, 14, 10, P.bat); s(g, 19, 9, P.bat); s(g, 18, 10, P.bat);
    // eyes
    s(g, 14, 14, P.batEye); s(g, 18, 14, P.batEye);
    // fangs
    s(g, 15, 20, '#fff'); s(g, 17, 20, '#fff');
    // wings (triangular membranes)
    for (let i = 0; i < 10; i++) {
      const top = 12 + wy + Math.round(i * 0.3);
      const bot = 12 + wy + 6 - Math.round(Math.abs(i - 5) * 0.6);
      // left
      hs(g, top, 12 - i, 12 - i, P.batD);
      for (let y = top; y <= bot; y++) s(g, 12 - i, y, i % 3 === 0 ? P.batD : P.bat);
      // right
      for (let y = top; y <= bot; y++) s(g, 20 + i, y, i % 3 === 0 ? P.batD : P.bat);
    }
    // wing struts
    for (let i = 0; i < 10; i++) { s(g, 12 - i, 12 + wy, P.batD); s(g, 20 + i, 12 + wy, P.batD); }
    return g;
  };

  B.spider = function (f) {
    const g = G();
    // legs
    const off = f ? 1 : 0;
    const legY = 18;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) {
        const bx = 16 + side * 4;
        const ang = (i - 1.5) * 0.5;
        const len = 8;
        for (let t = 0; t <= len; t++) {
          const x = bx + side * Math.round(t * 0.9);
          const y = legY - 2 + Math.round(Math.sin(ang) * 3) + Math.round((t > len / 2 ? (t - len / 2) : -t * 0.2)) + (i % 2 ? off : -off);
          s(g, x, y, P.spiderD);
        }
      }
    }
    // abdomen + head
    ell(g, 16, 18, 6, 5, P.spider);
    ell(g, 16, 14, 4, 3, P.spiderD);
    ell(g, 15, 16, 3, 2, P.spiderL);
    // marking
    s(g, 16, 18, P.spiderMark); s(g, 16, 20, P.spiderMark); s(g, 15, 19, P.spiderMark); s(g, 17, 19, P.spiderMark);
    // eyes cluster
    s(g, 14, 13, P.spiderEye); s(g, 18, 13, P.spiderEye); s(g, 15, 12, P.spiderEye); s(g, 17, 12, P.spiderEye);
    return g;
  };

  B.mushroom = function (f) {
    const g = G();
    // cap
    dome(g, 16, 15, 11, 8, P.cap);
    dome(g, 16, 15, 11, 8, P.cap);
    hs(g, 15, 5, 27, P.cap); hs(g, 16, 5, 27, P.capD);
    dome(g, 14, 13, 6, 4, P.capL);
    // spots
    [[10, 12], [21, 11], [16, 9], [24, 14], [7, 14]].forEach(p => ell(g, p[0], p[1], 1, 1, P.spot));
    // gills line
    hs(g, 16, 6, 26, P.capD);
    // stem
    rct(g, 12, 16, 20, 26, P.stem);
    rct(g, 18, 16, 20, 26, P.stemD);
    // eyes + smile
    ell(g, 14, 20, 1, 2, P.mushEye); ell(g, 18, 20, 1, 2, P.mushEye);
    hs(g, 23, 14, 18, P.mushEye); s(g, 13, 22, P.mushEye); s(g, 19, 22, P.mushEye);
    // feet
    const fo = f ? 1 : 0;
    rct(g, 12, 27, 14, 29 - fo, P.stemD); rct(g, 18, 27, 20, 29 + fo - fo, P.stemD);
    return g;
  };

  B.golem = function (f) {
    const g = G();
    const ao = f ? 1 : 0;
    // legs
    rct(g, 10, 24, 14, 30, P.rockD); rct(g, 18, 24, 22, 30, P.rockD);
    rct(g, 10, 24, 12, 30, P.rock); rct(g, 18, 24, 20, 30, P.rock);
    // body
    rct(g, 8, 12, 24, 25, P.rock);
    rct(g, 8, 12, 24, 14, P.rockL);
    rct(g, 21, 12, 24, 25, P.rockD);
    // chest core
    ell(g, 16, 19, 3, 3, P.rockD); ell(g, 16, 19, 2, 2, P.rockCore); s(g, 16, 19, '#dffcff');
    // cracks
    [[12, 16], [13, 17], [14, 18], [20, 20], [19, 21]].forEach(p => s(g, p[0], p[1], P.rockD));
    // moss
    s(g, 9, 13, P.moss); s(g, 10, 13, P.moss); s(g, 23, 22, P.moss);
    // head
    rct(g, 11, 5, 21, 12, P.rock); rct(g, 11, 5, 21, 6, P.rockL); rct(g, 19, 6, 21, 12, P.rockD);
    // eyes
    hs(g, 9, 13, 14, P.rockCore); hs(g, 9, 18, 19, P.rockCore);
    s(g, 13, 9, '#dffcff'); s(g, 18, 9, '#dffcff');
    // arms
    rct(g, 4, 13 + ao, 7, 23 + ao, P.rock); rct(g, 4, 13 + ao, 5, 23 + ao, P.rockL);
    rct(g, 25, 13 - ao, 28, 23 - ao, P.rock); rct(g, 27, 13 - ao, 28, 23 - ao, P.rockD);
    // fists
    ell(g, 5, 24 + ao, 2, 2, P.rockD); ell(g, 27, 24 - ao, 2, 2, P.rockD);
    return g;
  };

  // ---- players ----
  B.ranger = function (f) {
    const g = G();
    // legs / boots
    rct(g, 12, 24, 14, 29, P.cloakD); rct(g, 17, 24, 19, 29, P.cloakD);
    rct(g, 12, 28, 14, 30, P.boot); rct(g, 17, 28, 19, 30, P.boot);
    // cloak body (trapezoid)
    for (let y = 14; y <= 25; y++) { const w = 4 + Math.round((y - 14) * 0.45); hs(g, y, 16 - w, 16 + w, P.cloak); }
    for (let y = 14; y <= 25; y++) { const w = 4 + Math.round((y - 14) * 0.45); s(g, 16 - w, y, P.cloakD); s(g, 16 + w, y, P.cloakD); }
    hs(g, 18, 10, 22, P.cloakL);
    // ember trim hem
    hs(g, 25, 8, 24, P.ember);
    // hood + face
    dome(g, 16, 12, 7, 8, P.hood);
    rct(g, 13, 9, 19, 16, P.hood);
    ell(g, 16, 12, 4, 4, P.skin);
    rct(g, 12, 8, 20, 10, P.hood); dome(g, 16, 10, 7, 6, P.hood);
    // shade face top
    hs(g, 10, 14, 18, P.hood); hs(g, 11, 13, 19, P.hood);
    // eyes glow
    s(g, 14, 12, P.emberL); s(g, 18, 12, P.emberL);
    // bow (right side, curved)
    const draw = f ? 1 : 0;
    for (let y = 6; y <= 24; y++) {
      const dx = Math.round(4 * Math.sin((y - 6) / 18 * Math.PI));
      s(g, 22 + dx, y, P.bow); s(g, 22 + dx + 1, y, P.bowL);
    }
    // string
    for (let y = 6; y <= 24; y++) { const bx = 22 + Math.round(4 * Math.sin((y - 6) / 18 * Math.PI)); s(g, bx - 3 - draw, y, P.string); }
    // arrow nocked (ember tip) when drawing
    if (f) { hs(g, 15, 19, 24, P.bowL); s(g, 24, 15, P.emberL); s(g, 25, 15, P.emberL); }
    // ember spark
    s(g, 24, 4, P.emberL); s(g, 25, 5, P.ember);
    return g;
  };

  B.knight = function (f) {
    const g = G();
    const sl = f ? 1 : 0;
    // legs
    rct(g, 12, 24, 14, 30, P.pant); rct(g, 17, 24, 19, 30, P.pant);
    rct(g, 12, 28, 14, 30, P.steelD); rct(g, 17, 28, 19, 30, P.steelD);
    // body armor
    rct(g, 11, 14, 20, 25, P.steel);
    rct(g, 11, 14, 20, 15, P.steelL);
    rct(g, 18, 14, 20, 25, P.steelD);
    // belt + chest line
    hs(g, 22, 11, 20, P.steelD); s(g, 15, 18, P.steelL); s(g, 16, 19, P.steelL); s(g, 15, 20, P.steelL);
    // pauldrons
    ell(g, 10, 15, 2, 2, P.steelL); ell(g, 21, 15, 2, 2, P.steelD);
    // scarf
    hs(g, 13, 12, 19, P.scarf); s(g, 20, 14, P.scarf); s(g, 21, 15, P.scarf); s(g, 22, 16, P.scarf);
    // head
    ell(g, 16, 9, 4, 4, P.skin);
    dome(g, 16, 8, 5, 4, P.hair); hs(g, 6, 13, 19, P.hair);
    s(g, 14, 9, P.dark); s(g, 18, 9, P.dark);
    // daggers
    // left (down) / right (raised on slash)
    rct(g, 7, 18, 8, 25, P.blade); rct(g, 7, 18, 7, 25, P.bladeD); rct(g, 6, 25, 9, 26, P.hilt);
    const ry0 = f ? 6 : 16; const ry1 = f ? 14 : 24;
    rct(g, 24, ry0, 25, ry1, P.blade); rct(g, 25, ry0, 25, ry1, P.bladeD); rct(g, 23, ry1, 26, ry1 + 1, P.hilt);
    return g;
  };

  B.wizard = function (f) {
    const g = G();
    // robe
    for (let y = 13; y <= 28; y++) { const w = 4 + Math.round((y - 13) * 0.5); hs(g, y, 16 - w, 16 + w, P.robe); }
    for (let y = 13; y <= 28; y++) { const w = 4 + Math.round((y - 13) * 0.5); s(g, 16 - w, y, P.robeD); s(g, 16 + w, y, P.robeD); }
    rct(g, 12, 15, 20, 24, P.robe); rct(g, 12, 15, 14, 24, P.robeL);
    // ember trim + belt
    hs(g, 28, 8, 24, P.trim); hs(g, 27, 8, 24, P.trimL); hs(g, 21, 12, 20, P.trim);
    // face
    ell(g, 16, 11, 4, 4, P.skin);
    hs(g, 12, 13, 19, P.skinS);
    s(g, 14, 11, P.dark); s(g, 18, 11, P.dark);
    // beard
    hs(g, 14, 13, 19, '#d8d8d8'); hs(g, 15, 14, 18, '#c4c4c4'); s(g, 16, 16, '#c4c4c4');
    // hat (wide brim + point)
    hs(g, 8, 9, 23, P.hat); hs(g, 7, 10, 22, P.hat);
    tri(g, 16, 0, 7, 8, P.hat);
    hs(g, 6, 9, 23, P.trim); s(g, 8, 3, P.trimL); // band + fold
    // staff (right)
    rct(g, 24, 6, 25, 27, P.staff);
    const glow = f ? 4 : 3;
    ell(g, 24, 6, glow, glow, P.orb); ell(g, 24, 6, glow - 1, glow - 1, P.orbL); s(g, 24, 6, '#fff');
    if (f) { s(g, 20, 8, P.orbL); s(g, 28, 9, P.orb); s(g, 22, 4, P.orb); }
    return g;
  };

  // ---- props ----
  B.barrel = function () {
    const g = G();
    rct(g, 10, 12, 22, 29, P.wood);
    rct(g, 10, 12, 12, 29, P.woodL); rct(g, 20, 12, 22, 29, P.woodD);
    hs(g, 12, 10, 22, P.woodD); hs(g, 29, 10, 22, P.woodD);
    rct(g, 9, 14, 23, 15, P.hoop); rct(g, 9, 26, 23, 27, P.hoop);
    for (let y = 13; y <= 28; y += 3) hs(g, y, 10, 22, P.woodD);
    ell(g, 16, 12, 6, 2, P.woodL);
    return g;
  };
  B.crate = function () {
    const g = G();
    rct(g, 8, 12, 24, 28, P.wood);
    rct(g, 8, 12, 24, 13, P.woodL); rct(g, 8, 12, 9, 28, P.woodL);
    rct(g, 23, 12, 24, 28, P.woodD); rct(g, 8, 27, 24, 28, P.woodD);
    // X
    for (let i = 0; i <= 16; i++) { s(g, 8 + i, 12 + i, P.woodD); s(g, 24 - i, 12 + i, P.woodD); }
    rct(g, 8, 19, 24, 20, P.woodD);
    return g;
  };
  B.torch = function (f) {
    const g = G();
    // bracket
    rct(g, 14, 18, 18, 30, P.woodD); rct(g, 14, 18, 15, 30, P.wood);
    rct(g, 12, 18, 20, 19, P.hoop);
    // flame
    const h = f ? 0 : 1;
    ell(g, 16, 12 + h, 4, 6 - h, P.flame);
    ell(g, 16, 13 + h, 3, 4 - h, P.flameL);
    ell(g, 16, 14 + h, 1, 2, P.flameC);
    s(g, 16, 6 + h, P.flame); s(g, 17, 8 + h, P.flameL);
    return g;
  };
  B.chest = function (f) {
    const g = G();
    const open = f ? 3 : 0;
    // base
    rct(g, 7, 18, 25, 29, P.wood);
    rct(g, 7, 18, 9, 29, P.woodL); rct(g, 23, 18, 25, 29, P.woodD); rct(g, 7, 28, 25, 29, P.woodD);
    // bands
    rct(g, 11, 18, 12, 29, P.hoop); rct(g, 20, 18, 21, 29, P.hoop);
    // lid
    dome(g, 16, 18 - open, 9, 6, P.woodL);
    rct(g, 7, 15 - open, 25, 18 - open, P.wood);
    rct(g, 11, 12 - open, 12, 18 - open, P.hoop); rct(g, 20, 12 - open, 21, 18 - open, P.hoop);
    // lock + glow when open
    ell(g, 16, 20, 2, 2, P.metalL); s(g, 16, 20, '#c8923f');
    if (f) { ell(g, 16, 16, 4, 3, P.flameL); ell(g, 16, 16, 2, 2, '#fff'); s(g, 12, 12, P.flame); s(g, 20, 11, P.flameL); }
    return g;
  };
  // small skull decor
  B.skull = function () {
    const g = G();
    ell(g, 16, 20, 5, 5, '#d8d2c0');
    rct(g, 12, 22, 20, 26, '#d8d2c0');
    s(g, 14, 20, P.dark); s(g, 18, 20, P.dark); ell(g, 14, 20, 1, 1, P.dark); ell(g, 18, 20, 1, 1, P.dark);
    hs(g, 24, 13, 19, '#b8b2a0'); s(g, 15, 24, P.dark); s(g, 17, 24, P.dark);
    s(g, 16, 23, '#b8b2a0');
    return g;
  };

  // =================== RENDER ===================
  function hexToRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function adj([r, gg, b], sat, bri) {
    const l = 0.3 * r + 0.59 * gg + 0.11 * b;
    r = l + (r - l) * sat; gg = l + (gg - l) * sat; b = l + (b - l) * sat;
    r *= bri; gg *= bri; b *= bri;
    return [Math.max(0, Math.min(255, r)) | 0, Math.max(0, Math.min(255, gg)) | 0, Math.max(0, Math.min(255, b)) | 0];
  }

  const cache = new Map();
  function build(name, frame, dir) {
    const key = name + frame + dir.id;
    if (cache.has(key)) return cache.get(key);
    const g = B[name](frame);
    // outline pass
    const oc = dir.outline; const th = dir.thick || 1;
    for (let pass = 0; pass < th; pass++) {
      const add = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (g[y][x]) continue;
        let near = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < N && ny < N && g[ny][nx] && g[ny][nx] !== oc) { near = true; break; }
        }
        if (near) add.push([x, y]);
      }
      add.forEach(([x, y]) => g[y][x] = oc);
    }
    // paint to offscreen with sat/bri
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const ctx = cv.getContext('2d'); const img = ctx.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const c = g[y][x]; if (!c) continue;
      let rgb = hexToRgb(c);
      if (c !== oc) rgb = adj(rgb, dir.sat, dir.bri);
      const i = (y * N + x) * 4; img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    cache.set(key, cv); return cv;
  }

  const DIRS = {
    A: { id: 'A', outline: '#140f0c', thick: 1, sat: 1.06, bri: 1.0 },   // Emberdeep - warm, crisp
    B: { id: 'B', outline: '#0a1017', thick: 2, sat: 1.18, bri: 1.12 },  // Brightsteel - chunky, bright
    C: { id: 'C', outline: '#181425', thick: 1, sat: 0.72, bri: 0.9 },   // Gloomlight - moody, desat
  };

  // draw sprite; px,py = top-left of the 64px cell, cell = display cell px (default 64)
  function draw(ctx, name, frame, px, py, dirId, opts) {
    opts = opts || {};
    const dir = DIRS[dirId] || DIRS.A;
    const cell = opts.cell || 64;
    const cv = build(name, frame, dir);
    const scale = cell / N; // 64/32 = 2
    // contact shadow
    if (opts.shadow !== false) {
      ctx.save();
      ctx.globalAlpha = 0.32; ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(px + cell / 2, py + cell - 7, cell * 0.32, cell * 0.12, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.restore();
    }
    ctx.imageSmoothingEnabled = false;
    const bob = opts.bob || 0;
    ctx.drawImage(cv, px, py + bob, N * scale, N * scale);
  }

  export const Sprites = { draw, build, DIRS, list: Object.keys(B), N };

