import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../state/store';
import { computeWorldMapLayout, DESIGN_W, DESIGN_H, type WorldNode } from '../engine';
import './worldmap.css';

// World Map screen — the Claude Design illustrated parchment map of Finland. The
// hand-inked art already draws every location's icon and name, so the overlay adds
// NO markers of its own — only invisible click targets on discovered towns (with a
// hover glow + "Fast Travel" tooltip when travel is available) and a pulsing ring
// on the party's current map. The map renders at full width inside a scrollable
// stage (it's a large portrait chart) and opens pre-scrolled to the party's row.
// The game loop only runs on the dungeon scene, so this screen is off the sim
// clock and dispatches actions directly.

// The parchment background asset. Loaded the same way as the enemy/player sheets
// (Vite serves assets/ URLs via import.meta.glob) so we follow one convention.
const ASSET_URLS = import.meta.glob('../../assets/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const MAP_SVG_URL = Object.entries(ASSET_URLS).find(([k]) => k.endsWith('/world-map.svg'))?.[1];

// Palette accents used inline (the rest of the palette lives in worldmap.css):
// mid-ink for the "total" stat, ochre for the "discovered" stat.
const MID_INK = '#6e563a';
const OCHRE = '#a8552b';

export function WorldMapScreen() {
  const setScene = useGame((s) => s.setScene);
  const dispatch = useGame((s) => s.dispatch);
  const mapId = useGame((s) => s.world.mapId);
  const discovered = useGame((s) => s.world.discovered);

  const stageRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // The layout is static (derived from MAPS design coords); compute once.
  const layout = useMemo(() => computeWorldMapLayout(), []);
  const disc = useMemo(() => new Set(discovered), [discovered]);

  // Quick-travel to a discovered town, then drop back into the dungeon view where
  // the sim loop runs. Only towns are travelable in v1.
  const travel = (n: WorldNode) => {
    if (!n.isTown || !disc.has(n.id)) return;
    if (n.id !== mapId) dispatch({ type: 'travelToMap', mapId: n.id });
    setScene('dungeon');
  };

  const discoveredCount = layout.nodes.filter((n) => disc.has(n.id)).length;
  const current = layout.nodes.find((n) => n.id === mapId);

  // Open pre-scrolled to the party's vertical position — centred if there's room,
  // otherwise clamped to the very bottom (the browser clamps scrollTop for us).
  useEffect(() => {
    const stage = stageRef.current,
      map = mapRef.current;
    if (!stage || !map || !current) return;
    stage.scrollTop = (current.y / DESIGN_H) * map.clientHeight - stage.clientHeight / 2;
    stage.scrollLeft = (current.x / DESIGN_W) * map.clientWidth - stage.clientWidth / 2;
  }, [current]);

  // The "Fast Travel" tooltip shows only when the hovered node is a discovered town
  // we can travel to (i.e. not the one we're already on).
  const hoveredNode = hovered ? layout.nodes.find((n) => n.id === hovered) : undefined;
  const showTip = !!hoveredNode && hoveredNode.isTown && disc.has(hoveredNode.id) && hoveredNode.id !== mapId;

  return (
    <div className="wm-fit">
      <div className="wm-root">
        {/* HEADER (chrome bar above the scrollable map). */}
        <div className="wm-header">
          <div className="wm-title">Suomela · World Map</div>
          <div className="wm-subtitle">Click a visited town to fast travel.</div>
          <div className="wm-spacer" />
          <div className="wm-stat">
            <div className="wm-stat-num" style={{ color: OCHRE }}>
              {discoveredCount}
            </div>
            <div className="wm-stat-label">DISCOVERED</div>
          </div>
          <div className="wm-stat">
            <div className="wm-stat-num" style={{ color: MID_INK }}>
              {layout.nodes.length}
            </div>
            <div className="wm-stat-label">TOTAL</div>
          </div>
          <div className="wm-return" onClick={() => setScene('dungeon')}>
            Return
          </div>
        </div>

        {/* MAP: full-width parchment art + a coordinate-locked marker overlay,
            inside a scrollable stage. */}
        <div className="wm-stage" ref={stageRef}>
          <div className="wm-map" ref={mapRef}>
            {MAP_SVG_URL && <img className="wm-bg" src={MAP_SVG_URL} alt="World map of Suomela" draggable={false} />}

            {/* Overlay in the art's own design space — 1:1 with the painting. */}
            <svg className="wm-overlay" viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`} preserveAspectRatio="xMidYMid meet">
              <defs>
                <filter id="wmGlow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="7" />
                </filter>
              </defs>

              {layout.nodes.map((n) => {
                const known = disc.has(n.id);
                const here = n.id === mapId;

                // The parchment already shows every location, so we draw no marker.
                // The party's current map gets only a "you are here" ring — no
                // fast-travel glow or click, since you can't travel to where you are.
                if (here) {
                  return <HereRing key={n.id} x={n.x} y={n.y} r={n.isTown ? 22 : 20} />;
                }
                // Everything else: only discovered towns are interactive (invisible
                // click target + hover glow); undiscovered / field maps add nothing.
                if (!n.isTown || !known) return null;

                return (
                  <g key={n.id} className="wm-town" onClick={() => travel(n)} onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered((h) => (h === n.id ? null : h))}>
                    {hovered === n.id && <circle className="wm-town-glow" cx={n.x} cy={n.y} r={24} />}
                    <circle className="wm-town-hit" cx={n.x} cy={n.y} r={30} />
                  </g>
                );
              })}

              {/* Fast-travel tooltip for the hovered, travelable town — drawn last
                  so it sits above every marker. */}
              {showTip && hoveredNode && <FastTravelTip node={hoveredNode} />}

              {/* TODO: quest markers — layout.questMarkers is an empty typed stub
                  until a quest system exists. */}
            </svg>
          </div>
        </div>

        {/* CURRENT-LOCATION readout (bottom-left chrome, floats over the map). */}
        <div className="wm-footer">
          <div className="wm-footer-label">Current location</div>
          <div className="wm-footer-name">{current?.name ?? mapId}</div>
          <div className="wm-footer-sub">{current ? (current.isTown ? 'Safe town' : `Recommended Lv ${current.recommended[0]}–${current.recommended[1]}`) : ''}</div>
          <div className="wm-footer-note">Walk the fields and forests to uncover more of mysterious Suomela.</div>
        </div>
      </div>
    </div>
  );
}

// A pulsing halo ring that marks the party's current map — reads even mid-chain.
function HereRing({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <circle cx={x} cy={y} r={r} className="wm-here-ring" fill="none">
      <animate attributeName="r" values={`${r - 3};${r + 3};${r - 3}`} dur="1.8s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.9;0.35;0.9" dur="1.8s" repeatCount="indefinite" />
    </circle>
  );
}

// "Fast Travel to / <Town>" bubble, drawn above the hovered town's icon.
function FastTravelTip({ node }: { node: WorldNode }) {
  const w = 240,
    h = 68;
  const x = node.x;
  const top = node.y - 44 - h; // float above the painted icon
  return (
    <g pointerEvents="none">
      <rect className="wm-tip-box" x={x - w / 2} y={top} width={w} height={h} rx={7} />
      <text className="wm-tip-line1" x={x} y={top + 27}>
        Fast Travel to
      </text>
      <text className="wm-tip-line2" x={x} y={top + 54}>
        {node.name}
      </text>
    </g>
  );
}
