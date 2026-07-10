import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/store';
import { JOBS } from '../data';
import { PLAYER_TILE_SRC, keyedSheet, playerTile } from '../render/player-art';
import './mainmenu.css';

const W = 1920;
const H = 1080;
const HORIZON = 650;

// deterministic value noise for star/spruce/mote placement (from the handoff's hash)
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >> 13)) * 1274126177) >>> 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

type Star = { x: number; y: number; r: number; t: number };
type Spruce = { x: number; h: number };

// Procedural wizard hero (violet ember caster) — a compact port of sprites.js'
// B.wizard, drawn straight to the scene canvas as filled pixel rects (2px cells).
const WIZ = {
  robe: '#5f4a8f',
  robeL: '#8069b0',
  robeD: '#3e3060',
  hat: '#4a3872',
  trim: '#f0873a',
  trimL: '#ffce6b',
  skin: '#e0b48c',
  skinS: '#c08e68',
  staff: '#7a5230',
  orb: '#ff9a3c',
  orbL: '#ffe08a',
  dark: '#12100e',
  beard: '#d8d8d8',
  beardD: '#c4c4c4',
};

// Draw the wizard at (ox,oy) top-left, `cell` px per 32-grid unit is s=cell/32.
// `frame` toggles the staff-orb glow size; kept small and additive-free (opaque).
function drawWizard(ctx: CanvasRenderingContext2D, ox: number, oy: number, s: number, frame: number): void {
  const px = (gx: number, gy: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(ox + gx * s, oy + gy * s, w * s, h * s);
  };
  // robe (flared trapezoid, y 13..28)
  for (let y = 13; y <= 28; y++) {
    const w = 4 + Math.round((y - 13) * 0.5);
    px(16 - w, y, w * 2 + 1, 1, WIZ.robe);
    px(16 - w, y, 1, 1, WIZ.robeD);
    px(16 + w, y, 1, 1, WIZ.robeD);
  }
  px(12, 15, 9, 10, WIZ.robe);
  px(12, 15, 3, 10, WIZ.robeL);
  // ember trim + belt
  px(8, 28, 17, 1, WIZ.trim);
  px(8, 27, 17, 1, WIZ.trimL);
  px(12, 21, 9, 1, WIZ.trim);
  // face
  px(12, 7, 9, 8, WIZ.skin);
  px(13, 12, 7, 1, WIZ.skinS);
  px(14, 11, 1, 1, WIZ.dark);
  px(18, 11, 1, 1, WIZ.dark);
  // beard
  px(13, 14, 7, 1, WIZ.beard);
  px(14, 15, 5, 1, WIZ.beardD);
  px(16, 16, 1, 1, WIZ.beardD);
  // hat (wide brim + point)
  px(9, 8, 15, 1, WIZ.hat);
  px(10, 7, 13, 1, WIZ.hat);
  for (let y = 0; y <= 8; y++) {
    const w = Math.round(7 * (y / 8));
    px(16 - w, y, w * 2 + 1, 1, WIZ.hat);
  }
  px(9, 6, 15, 1, WIZ.trim); // band
  // staff (right)
  px(24, 6, 2, 22, WIZ.staff);
  const glow = frame ? 4 : 3;
  px(24 - glow, 6 - glow, glow * 2 + 1, glow * 2 + 1, WIZ.orb);
  px(25 - glow, 7 - glow, glow * 2 - 1, glow * 2 - 1, WIZ.orbL);
  px(24, 6, 1, 1, '#ffffff');
}

// Fit a 1920x1080 stage to the viewport (matches SkillAllocationScreen).
function useFitScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return scale;
}

// Portrait for the last-played panel: the character's actual class sprite.
function HeroPortrait({ jobId }: { jobId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const tile = playerTile(jobId);
    const canvas = ref.current;
    if (!tile || !canvas) return;
    let cancelled = false;
    void keyedSheet(tile.filename).then((sheet) => {
      if (cancelled || !sheet) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, 96, 96);
      ctx.imageSmoothingEnabled = false;
      // Zoom in: crop a square, centered horizontally but anchored to the tile top.
      const z = 0.71;
      const src = PLAYER_TILE_SRC * z;
      const offX = (PLAYER_TILE_SRC - src) / 2 + 48;
      ctx.drawImage(sheet, tile.sx + offX, tile.sy, src, src, 0, 0, 96, 96);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);
  return <canvas ref={ref} width={96} height={96} />;
}

export function MainMenuScreen() {
  const scale = useFitScale();
  const setScene = useGame((s) => s.setScene);
  const world = useGame((s) => s.world);
  const newGame = useGame((s) => s.newGame);
  const loadGame = useGame((s) => s.loadGame);
  const getActiveSlot = useGame((s) => s.getActiveSlot);
  const hasSave = useGame((s) => s.hasSave);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeSlot = getActiveSlot();
  const saveExists = hasSave(activeSlot);

  // New game: warn before clobbering an existing save in the active slot.
  const onNewGame = () => {
    if (saveExists && !window.confirm('Starting a new game overwrites your current save. Continue?')) return;
    newGame();
    setScene('dungeon');
  };
  // Continue the active slot's save (only offered when one exists).
  const onContinue = () => {
    if (!saveExists) return;
    loadGame(activeSlot);
    setScene('dungeon');
  };

  // Animated scene: one rAF loop; scene constants precomputed once per mount.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // static star field
    const stars: Star[] = [];
    for (let i = 0; i < 140; i++) stars.push({ x: hash(i, 1) * W, y: hash(i, 2) * 520, r: hash(i, 3) * 1.4 + 0.3, t: hash(i, 4) * 6.28 });
    // two fell (mountain) silhouette ranges
    const fell = (seed: number, base: number, amp: number): [number, number][] => {
      const pts: [number, number][] = [];
      for (let x = 0; x <= W; x += 40) pts.push([x, base + Math.sin(x * 0.004 + seed) * amp + Math.sin(x * 0.011 + seed * 2) * amp * 0.4]);
      return pts;
    };
    const fellA = fell(1, 470, 60);
    const fellB = fell(4, 540, 90);
    // spruce treeline
    const spruce: Spruce[] = [];
    for (let x = -20; x < W + 20; x += Math.floor(18 + hash(x, 9) * 20)) spruce.push({ x, h: 60 + hash(x, 10) * 90 });

    let raf = 0;
    const loop = (t: number) => {
      // ---- sky ----
      const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
      sky.addColorStop(0, '#0b1020');
      sky.addColorStop(0.45, '#12203a');
      sky.addColorStop(0.8, '#28405a');
      sky.addColorStop(1, '#4a5f70');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, HORIZON);

      // ---- stars ----
      for (const st of stars) {
        const tw = 0.5 + 0.5 * Math.sin(t / 700 + st.t);
        ctx.globalAlpha = tw * 0.9;
        ctx.fillStyle = '#dfe8f0';
        ctx.fillRect(st.x | 0, st.y | 0, Math.ceil(st.r), Math.ceil(st.r));
      }
      ctx.globalAlpha = 1;

      // ---- aurora ribbons (green/cyan/violet, additive) ----
      const AUR: [string, string][] = [
        ['#3ad89a', '#1f7a6a'],
        ['#7fd0e0', '#2a6a90'],
        ['#b78fe0', '#5a3a8a'],
      ];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 3; b++) {
        const cols = AUR[b];
        const baseY = 150 + b * 46;
        const grad = ctx.createLinearGradient(0, baseY - 70, 0, baseY + 90);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.5, cols[0]);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t / 1300 + b);
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        for (let x = 0; x <= W; x += 24) ctx.lineTo(x, baseY + Math.sin(x * 0.006 + t / 1600 + b * 1.3) * 40 + Math.sin(x * 0.017 + t / 900) * 16);
        ctx.lineTo(W, baseY + 150);
        ctx.lineTo(0, baseY + 150);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        // faint vertical curtains
        ctx.globalAlpha = 0.05;
        ctx.strokeStyle = cols[0];
        ctx.lineWidth = 2;
        for (let x = 0; x <= W; x += 26) {
          const y = baseY + Math.sin(x * 0.006 + t / 1600 + b * 1.3) * 40;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.sin(t / 1000 + x) * 6, y + 120);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // ---- distant fells ----
      const drawFell = (pts: [number, number][], col: string) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, pts[0][1]);
        for (const p of pts) ctx.lineTo(p[0], p[1]);
        ctx.lineTo(W, HORIZON);
        ctx.lineTo(0, HORIZON);
        ctx.closePath();
        ctx.fill();
      };
      drawFell(fellB, '#243447');
      drawFell(fellA, '#1b2836');
      // snow-cap flecks on the nearer fell
      ctx.fillStyle = 'rgba(200,214,228,0.5)';
      for (const p of fellA) if (p[1] < 475) ctx.fillRect(p[0] - 3, p[1], 6, 6);

      // ---- spruce forest silhouette ----
      ctx.fillStyle = '#0e1a16';
      for (const sp of spruce) {
        const bx = sp.x;
        const by = HORIZON + 6;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        for (let seg = 0; seg < 3; seg++) {
          const w = 8 - seg * 2;
          const yy = by - (sp.h * (seg + 1)) / 3;
          ctx.lineTo(bx - w, by - (sp.h * seg) / 3 - 6);
          ctx.lineTo(bx, yy);
          ctx.lineTo(bx + w, by - (sp.h * seg) / 3 - 6);
          ctx.lineTo(bx, by);
        }
        ctx.moveTo(bx - 9, by);
        ctx.lineTo(bx, by - sp.h * 0.5);
        ctx.lineTo(bx + 9, by);
        ctx.closePath();
        ctx.fill();
      }

      // ---- lake ----
      const lake = ctx.createLinearGradient(0, HORIZON, 0, H);
      lake.addColorStop(0, '#2a4358');
      lake.addColorStop(0.5, '#1a2f42');
      lake.addColorStop(1, '#101f2e');
      ctx.fillStyle = lake;
      ctx.fillRect(0, HORIZON, W, H - HORIZON);
      // drifting aurora/sky shimmer
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 40; i++) {
        const y = HORIZON + 10 + i * 10;
        const w = Math.sin(t / 800 + i) * 30;
        ctx.fillStyle = i % 3 ? '#3ad89a' : '#7fbfe0';
        ctx.fillRect(W * 0.1 + w, y, W * 0.8, 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      // moon reflection column
      const moonX = 566; // nudged right to sit under the title's M
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createLinearGradient(0, HORIZON, 0, H);
      rg.addColorStop(0, 'rgba(150,190,210,0.22)');
      rg.addColorStop(1, 'rgba(150,190,210,0)');
      ctx.fillStyle = rg;
      for (let y = HORIZON; y < H; y += 4) {
        const w = 40 + (y - HORIZON) * 0.5 + Math.sin(t / 500 + y) * 6;
        ctx.fillRect(moonX - w / 2, y, w, 2);
      }
      ctx.restore();

      // ---- moon ----
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const mg = ctx.createRadialGradient(moonX, 180, 4, moonX, 180, 90);
      mg.addColorStop(0, 'rgba(220,232,240,0.5)');
      mg.addColorStop(1, 'rgba(220,232,240,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(moonX - 130, 50, 260, 260);
      ctx.restore();
      ctx.fillStyle = '#e8eef2';
      ctx.beginPath();
      ctx.arc(moonX, 180, 26, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#c8d4dc';
      ctx.beginPath();
      ctx.arc(moonX - 8, 174, 5, 0, 6.3);
      ctx.arc(moonX + 8, 188, 4, 0, 6.3);
      ctx.fill();

      // ---- dock + hero + campfire (shifted flush to the left screen edge) ----
      const dockY = 760;
      ctx.save();
      ctx.translate(-120, 0);
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(120, dockY, 150, 10);
      for (let x = 120; x < 270; x += 22) {
        ctx.fillStyle = '#2a1e12';
        ctx.fillRect(x, dockY + 10, 6, 44);
      }
      ctx.fillStyle = '#4a3524';
      ctx.fillRect(120, dockY, 150, 3);
      // hero (idle bob), 64px cell -> s=2
      const bob = Math.sin(t / 500) * 3;
      ctx.imageSmoothingEnabled = false;
      drawWizard(ctx, 176, dockY - 58 + bob, 2, Math.floor(t / 450) % 2);
      // campfire warm additive light
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const fg = ctx.createRadialGradient(240, dockY - 6, 2, 240, dockY - 6, 60);
      fg.addColorStop(0, 'rgba(255,150,60,0.4)');
      fg.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(180, dockY - 66, 120, 120);
      ctx.restore();
      const ff = Math.floor(t / 120) % 2;
      ctx.fillStyle = ff ? '#f0873a' : '#ffce6b';
      ctx.beginPath();
      ctx.moveTo(240, dockY - 18);
      ctx.lineTo(235, dockY - 4);
      ctx.lineTo(245, dockY - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5a3a1c';
      ctx.fillRect(232, dockY - 3, 16, 4);
      ctx.restore();

      // ---- drifting mist bands ----
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const y = HORIZON - 30 + i * 70;
        const off = ((t * (0.006 + i * 0.004)) % (W + 400)) - 200;
        ctx.globalAlpha = 0.05 + i * 0.015;
        ctx.fillStyle = '#aebccb';
        for (let k = 0; k < 3; k++) {
          const x = ((off + k * 720) % (W + 400)) - 200;
          ctx.beginPath();
          ctx.ellipse(x, y, 240, 26, 0, 0, 6.3);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // ---- fireflies / spirit motes ----
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 24; i++) {
        const px = (hash(i, 20) * W + t * (0.01 + hash(i, 21) * 0.02) * 60) % W;
        const py = HORIZON - 40 - hash(i, 22) * 260 + Math.sin(t / 900 + i) * 20;
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t / 500 + i * 2);
        ctx.fillStyle = hash(i, 23) > 0.5 ? '#8fe0b0' : '#e6c583';
        ctx.beginPath();
        ctx.arc(px, py, 1.6, 0, 6.3);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Last-played panel pulls from the current player rather than hard-coding.
  const player = world.entities[world.playerId];
  const job = player ? JOBS[player.jobId] : undefined;
  const heroName = player?.name ?? 'Aino Tuulikki';
  const heroSub = `${job?.name ?? 'Fire Wizard'} · Lv ${player?.level ?? 24}`;

  // The seven menu items; click routing chosen by the user (boot-to-mainMenu).
  const items: { label: string; size: number; dim?: boolean; tag?: string; onClick: () => void }[] = [
    { label: 'Enter the Realm', size: 30, onClick: onNewGame },
    { label: 'Continue', size: 23, dim: !saveExists, tag: saveExists ? `LV${player?.level ?? 1}` : undefined, onClick: onContinue },
    { label: 'Characters', size: 22, onClick: () => setScene('charCreate') },
    // { label: 'World Map', size: 22, onClick: () => setScene('worldMap') },
    { label: 'Settings', size: 22, onClick: () => setScene('hotkeys') }, // closest existing config screen
    { label: 'Credits', size: 18, dim: true, onClick: () => {} }, // stub: no credits screen yet
    { label: 'Quit', size: 18, dim: true, onClick: () => {} }, // stub: no shell to quit to on web
  ];

  return (
    <div className="mm-fit">
      <div className="mm-root" style={{ transform: `scale(${scale})` }}>
        <canvas ref={canvasRef} width={W} height={H} className="mm-canvas" />

        {/* vignettes */}
        <div className="mm-vignette radial" />
        <div className="mm-vignette linear" />

        {/* TITLE */}
        <div className="mm-title">
          <div className="mm-eyebrow">THE NORTHERN REALM</div>
          <div className="mm-titlewrap">
            <div className="mm-suomela">SUOMELA</div>
            <div className="mm-mmo">MMO</div>
          </div>
          <div className="mm-tagline">
            A land of endless forests, frozen fells,
            <br />
            and old magic that stirs beneath the snow.
          </div>
        </div>

        {/* MENU */}
        <div className="mm-menu">
          {items.map((m) => (
            <div key={m.label} className={`mmbtn${m.dim ? ' dim' : ''}`} onClick={m.onClick} style={{ fontSize: m.size }}>
              <span className="mmb-ic">◆</span>
              <span>{m.label}</span>
              {m.tag && <span className="mmb-tag">{m.tag}</span>}
              <span className="mmb-line" />
            </div>
          ))}
        </div>

        {/* LAST-PLAYED PANEL */}
        <div className="mm-panel">
          <div className="mm-panel-gold" />
          <div className="mm-panel-label">LAST PLAYED</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
            <div className="mm-portrait">
              <HeroPortrait jobId={player?.jobId ?? 'beginner'} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="mm-hero-name">{heroName}</div>
              <div className="mm-hero-sub">{heroSub}</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 7 }}>
                <span className="mm-badge faction">EMBERS</span>
                <span className="mm-badge city">HELSINKI</span>
              </div>
            </div>
          </div>
          <div className="mm-divider" />
          <div className="mm-status">
            <span>Realm status</span>
            <span style={{ color: '#8fe0a0' }}>◆ Online · 2,418 adventurers</span>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mm-copyright">© 2026 Studio Esagames</div>
        <div className="mm-build">v0.4.1 · BUILD 2026.07.09</div>
        <div className="mm-servers">
          <span className="mm-servers-dot" />
          SERVERS ONLINE
        </div>
      </div>
    </div>
  );
}
