import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { computeWorldMapLayout, type WorldNode } from '../engine';
import './worldmap.css';

// World Map screen — the "discovered zones" node-link graph. Towns are click-to-
// travel (quick travel via the multi-map system); field/dungeon maps are shown for
// context but not travelable in v1. The party's current map is highlighted even
// when it's a field/dungeon between towns. The game loop only runs on the dungeon
// scene, so this screen is off the sim clock and dispatches actions directly.

// SVG drawing box. The layout is normalized 0..1; we map it into this box with a
// margin so labels never clip the panel edge.
const VIEW_W = 1180;
const VIEW_H = 812;
const PAD = 90;

const TOWN_COLOR = '#e6c583'; // towns: warm gold diamonds
const FIELD_COLOR = '#7fa06a'; // field/dungeon maps: mossy circles
const HERE_COLOR = '#8fd0e0'; // current-location ring

function nodeXY(n: WorldNode): { cx: number; cy: number } {
  return { cx: PAD + n.x * (VIEW_W - 2 * PAD), cy: PAD + n.y * (VIEW_H - 2 * PAD) };
}

export function WorldMapScreen() {
  const setScene = useGame((s) => s.setScene);
  const dispatch = useGame((s) => s.dispatch);
  const mapId = useGame((s) => s.world.mapId);
  const discovered = useGame((s) => s.world.discovered);

  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // The graph is static (derived from MAPS); compute once.
  const layout = useMemo(() => computeWorldMapLayout(), []);
  const disc = useMemo(() => new Set(discovered), [discovered]);
  const pos = useMemo(() => {
    const m = new Map<string, { cx: number; cy: number }>();
    for (const n of layout.nodes) m.set(n.id, nodeXY(n));
    return m;
  }, [layout]);

  // Quick-travel to a discovered town, then drop back into the dungeon view where
  // the sim loop runs. Only towns are travelable in v1.
  const travel = (n: WorldNode) => {
    if (!n.isTown || !disc.has(n.id)) return;
    if (n.id === mapId) {
      setScene('dungeon');
      return;
    }
    dispatch({ type: 'travelToMap', mapId: n.id });
    setScene('dungeon');
  };

  const discoveredCount = layout.nodes.filter((n) => disc.has(n.id)).length;

  return (
    <div className="wm-fit">
      <div className="wm-root" style={{ transform: `scale(${scale})` }}>
        {/* HEADER */}
        <div className="wm-panel" style={{ top: 22, left: 24, right: 24, height: 92, display: 'flex', alignItems: 'center', padding: '0 26px', gap: 20 }}>
          <div className="wm-gold" />
          <div className="wm-hd" style={{ fontSize: 26 }}>World Map</div>
          <div style={{ fontSize: 14, color: '#8f8674', fontStyle: 'italic' }}>Discovered zones · click a town to travel</div>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'center' }}>
            <div className="wm-px" style={{ fontSize: 20, color: '#8fe0a0' }}>{discoveredCount}</div>
            <div style={{ fontSize: 10, color: '#8fa8cc', marginTop: 5, letterSpacing: 0.5 }}>DISCOVERED</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="wm-px" style={{ fontSize: 20, color: '#c2a06a' }}>{layout.nodes.length}</div>
            <div style={{ fontSize: 10, color: '#a99a7c', marginTop: 5, letterSpacing: 0.5 }}>TOTAL</div>
          </div>
          <div
            className="wm-btn"
            onClick={() => setScene('dungeon')}
            style={{ marginLeft: 12, padding: '8px 26px', fontSize: 14, color: '#b3a888', background: '#1a1e26', border: '1px solid #3a4152' }}
          >
            Return
          </div>
        </div>

        {/* MAP GRAPH */}
        <div className="wm-panel" style={{ top: 130, left: 24, right: 336, bottom: 24, padding: 14 }}>
          <div className="wm-gold" />
          <div className="wm-map">
            <svg className="wm-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet">
              {/* edges */}
              {layout.edges.map((e) => {
                const a = pos.get(e.a)!;
                const b = pos.get(e.b)!;
                const known = disc.has(e.a) && disc.has(e.b);
                return <line key={`${e.a}|${e.b}`} className={`wm-edge${known ? '' : ' dim'}`} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} />;
              })}

              {/* nodes */}
              {layout.nodes.map((n) => {
                const { cx, cy } = pos.get(n.id)!;
                const known = disc.has(n.id);
                const here = n.id === mapId;
                const color = n.isTown ? TOWN_COLOR : FIELD_COLOR;
                const r = n.isTown ? 15 : 11;
                const cls = `wm-node${n.isTown ? ' town' : ' field'}${known ? ' discovered' : ''}`;

                return (
                  <g key={n.id} className={cls} onClick={() => travel(n)}>
                    {/* current-location marker (party): a pulsing ring around the node */}
                    {here && (
                      <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke={HERE_COLOR} strokeWidth={3}>
                        <animate attributeName="r" values={`${r + 7};${r + 13};${r + 7}`} dur="1.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.9;0.35;0.9" dur="1.8s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {!known ? (
                      // Undiscovered: a dim fogged silhouette, no name/level revealed.
                      <>
                        <circle cx={cx} cy={cy} r={r} fill="#1b1f18" stroke="#333a2c" strokeWidth={2} strokeDasharray="3 4" />
                        <text className="wm-sublabel" x={cx} y={cy + 4} style={{ fontSize: 12, fill: '#4a5240' }}>
                          ?
                        </text>
                      </>
                    ) : n.isTown ? (
                      // Town: gold diamond + name.
                      <>
                        <rect
                          x={cx - r}
                          y={cy - r}
                          width={r * 2}
                          height={r * 2}
                          rx={3}
                          transform={`rotate(45 ${cx} ${cy})`}
                          fill={color}
                          stroke="#12140c"
                          strokeWidth={2}
                        />
                        <text className="wm-label" x={cx} y={cy - r - 12} style={{ fontSize: 20 }}>
                          {n.name}
                        </text>
                        {here && (
                          <text className="wm-sublabel" x={cx} y={cy + r + 24} style={{ fontSize: 9, fill: HERE_COLOR }}>
                            YOU ARE HERE
                          </text>
                        )}
                      </>
                    ) : (
                      // Field / dungeon map: mossy circle + name + recommended level band.
                      <>
                        <circle cx={cx} cy={cy} r={r} fill={color} stroke="#12140c" strokeWidth={2} opacity={here ? 1 : 0.9} />
                        <text className="wm-label" x={cx} y={cy - r - 10} style={{ fontSize: 15 }}>
                          {n.name}
                        </text>
                        <text className="wm-sublabel" x={cx} y={cy + r + 20} style={{ fontSize: 9 }}>
                          {here ? 'YOU ARE HERE' : `LV ${n.recommended[0]}-${n.recommended[1]}`}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
              {/* TODO: quest markers — layout.questMarkers is an empty typed stub until a quest system exists. */}
            </svg>
          </div>
        </div>

        {/* LEGEND / SIDEBAR */}
        <div className="wm-panel" style={{ top: 130, right: 24, width: 288, bottom: 24, padding: '20px 22px' }}>
          <div className="wm-gold" />
          <div className="wm-hd" style={{ fontSize: 14 }}>Legend</div>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 13, fontSize: 14, color: '#cdc3aa' }}>
            <div>
              <span className="wm-swatch" style={{ background: TOWN_COLOR, transform: 'rotate(45deg)' }} /> Town — click to travel
            </div>
            <div>
              <span className="wm-swatch" style={{ background: FIELD_COLOR, borderRadius: '50%' }} /> Field / dungeon map
            </div>
            <div>
              <span className="wm-swatch" style={{ background: 'transparent', border: `2px solid ${HERE_COLOR}`, borderRadius: '50%' }} /> Your current location
            </div>
            <div>
              <span className="wm-swatch" style={{ background: '#1b1f18', border: '2px dashed #333a2c', borderRadius: '50%' }} /> Undiscovered
            </div>
          </div>

          <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,#b8925a44,transparent)', margin: '20px 0 16px' }} />

          <div className="wm-hd" style={{ fontSize: 12, color: '#b89a63' }}>Current</div>
          <div style={{ marginTop: 10, fontSize: 15, color: '#f2e8d2' }}>{layout.nodes.find((n) => n.id === mapId)?.name ?? mapId}</div>
          <div style={{ fontSize: 12, color: '#8f8674', marginTop: 4 }}>
            {(() => {
              const cur = layout.nodes.find((n) => n.id === mapId);
              if (!cur) return null;
              return cur.isTown ? 'Safe town' : `Recommended Lv ${cur.recommended[0]}-${cur.recommended[1]}`;
            })()}
          </div>

          <div style={{ marginTop: 18, fontSize: 11.5, color: '#7a7360', fontStyle: 'italic', lineHeight: 1.5 }}>
            Only towns are travelable for now. Walk field maps through their portals to discover the rest of the world.
          </div>
        </div>
      </div>
    </div>
  );
}
