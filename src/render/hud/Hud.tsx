import { useEffect, useRef, useState } from 'react';
import type { Entity, Offset } from '../../types';
import { JOBS } from '../../data';
import { getSkill, describeSkill } from '../../data-skills';
import { MAPS } from '../../data-map';
import { xpToNext } from '../../config';
import { shapeFor } from '../../engine/shapes';
import { learnedIndexes } from '../../engine/skills';
import { useGame } from '../../state/store';
import { Sprites } from '../sprites';
import { PLAYER_TILE_SRC, keyedSheet, playerTile } from '../player-art';
import { drawStatusBadge, groupStatuses } from '../statusBadge';
import type { StatusBadgeGroup } from '../statusBadge';
import './hud.css';

function SpriteCanvas({ name, size }: { name: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    Sprites.draw(ctx, name, 0, 0, 0, 'A', { cell: size, shadow: false });
  }, [name, size]);
  return <canvas ref={ref} width={size} height={size} style={{ imageRendering: 'pixelated' }} />;
}

// Portrait drawn from the keyed class art (matches the world sprite). Falls back
// to the procedural sprite when a job has no portrait.
function ClassPortrait({ jobId, size }: { jobId: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const tile = playerTile(jobId);
    const canvas = ref.current;
    if (!tile || !canvas) return;
    let cancelled = false;
    void keyedSheet(tile.filename).then((sheet) => {
      if (cancelled || !sheet) return;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(sheet, tile.sx, tile.sy, PLAYER_TILE_SRC, PLAYER_TILE_SRC, 0, 0, size, size);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId, size]);
  return <canvas ref={ref} width={size} height={size} />;
}

function Portrait({ entity, size }: { entity: Entity; size: number }) {
  return playerTile(entity.jobId) ? <ClassPortrait jobId={entity.jobId} size={size} /> : <SpriteCanvas name={entity.sprite} size={size} />;
}

function Bar({ kind, cur, max, label }: { kind: 'hp' | 'mp' | 'xp'; cur: number; max: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, cur / max));
  const text = label ?? `${Math.round(cur)} / ${max}`;
  return (
    <div className={`bar ${kind}`}>
      <span style={{ transform: `scaleX(${pct})` }} />
      <span className="label">{text}</span>
      {/* second copy clipped to the filled width, so the label splits colors at the fill edge */}
      <span className="label clip" style={{ clipPath: `inset(0 ${(1 - pct) * 100}% 0 0)` }} aria-hidden="true">
        {text}
      </span>
    </div>
  );
}

function ShapeGrid({ shape }: { shape: Offset[] }) {
  // Caster at (1,2) facing right, matching the skill-assignment preview: leaves 3
  // tiles of forward room so ahead-projected shapes (offset/arc) aren't clipped.
  const cx = 1;
  const cy = 2;
  const set = new Set(shape.map((o) => `${cx + o.dx},${cy + o.dy}`));
  const cells = [];
  for (let gy = 0; gy < 5; gy++)
    for (let gx = 0; gx < 5; gx++) {
      const self = gx === cx && gy === cy;
      const on = set.has(`${gx},${gy}`);
      cells.push(<i key={`${gx},${gy}`} className={self ? 'self' : on ? 'on' : ''} />);
    }
  return <div className="shape">{cells}</div>;
}

function heroes(entities: Record<string, Entity>): Entity[] {
  // party = player + allies only; town NPCs share the non-enemy space but must NOT
  // render as party members (they have no procedural sprite -> Sprites.draw throws).
  return Object.values(entities).filter((e) => e.faction === 'player' || e.faction === 'ally');
}

// Display names for the status-badge tooltips.
const STATUS_LABEL: Record<StatusBadgeGroup['kind'], string> = {
  poison: 'Poison',
  bleed: 'Bleed',
  burn: 'Burn',
  slow: 'Slow',
  stun: 'Stun',
  atkUp: 'Attack Up',
  atkDown: 'Attack Down',
  defUp: 'Defense Up',
  defDown: 'Defense Down',
  dodge: 'Dodge Up',
  blind: 'Blind',
  critUp: 'Crit Up',
  critDmgUp: 'Crit Damage Up',
  statPercent: 'Stat %',
  statFlat: 'Stat +',
};
function badgeTitle(g: StatusBadgeGroup): string {
  const stat = g.stat ? ` ${g.stat.toUpperCase()}` : '';
  const dir = (g.kind === 'statPercent' || g.kind === 'statFlat') && !g.up ? ' (down)' : '';
  const count = g.count > 1 ? ` ×${g.count}` : '';
  return `${STATUS_LABEL[g.kind]}${stat}${dir}${count}`;
}

// One 32×32 status badge: paints a canvas via the shared drawStatusBadge routine.
// Redraws whenever the group's appearance changes (kind/stat/count/up).
function StatusBadge({ group, size = 32 }: { group: StatusBadgeGroup; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawStatusBadge(ctx, group, size);
  }, [group.kind, group.stat, group.count, group.up, size]);
  return <canvas ref={ref} width={size} height={size} className="status-badge" style={{ imageRendering: 'pixelated' }} title={badgeTitle(group)} />;
}

// The row of status badges for a party member, top-right of the portrait card.
function StatusBadges({ entity }: { entity: Entity }) {
  const groups = groupStatuses(entity.statuses);
  if (!groups.length) return null;
  return (
    <div className="status-badges">
      {groups.map((g) => (
        <StatusBadge key={`${g.kind}:${g.stat ?? ''}`} group={g} />
      ))}
    </div>
  );
}

function ZoneBanner() {
  const world = useGame((s) => s.world);
  const def = MAPS[world.mapId];
  if (!def) return null;
  return (
    <div className="panel zone-banner">
      <div className="title">{def.name}</div>
      {def.description ? (
        <div className="sub flavor">{def.description}</div>
      ) : (
        <div className="sub">
          RECOMMENDED LV {def.recommended[0]}–{def.recommended[1]}
        </div>
      )}
    </div>
  );
}

function FocusTarget() {
  const world = useGame((s) => s.world);
  const group = Object.values(world.groups).find((g) => g.memberIds.includes(world.playerId));
  const target = group && group.memberIds.map((id) => world.entities[id]).find((e) => e?.faction === 'enemy');
  if (!target) return null;
  return (
    <div className="panel focus-target">
      <div className="row">
        <span className="name">{target.name}</span>
        <span>
          {target.elite && <span className="elite">◆ ELITE </span>}LV {target.level}
        </span>
      </div>
      <Bar kind="hp" cur={target.hp} max={target.stats.maxHp} />
    </div>
  );
}

function PartyFrames() {
  const world = useGame((s) => s.world);
  return (
    <div className="panel party">
      {heroes(world.entities).map((e) => {
        const job = JOBS[e.jobId];
        return (
          <div key={e.id} className={`member${e.id === world.playerId ? ' active' : ''}`}>
            <StatusBadges entity={e} />
            <div className="portrait">
              <Portrait entity={e} size={44} />
              <span className="lvl">{e.level}</span>
            </div>
            <div>
              <div className="name">{e.name}</div>
              <div className="cls" style={{ color: job?.accent ?? '#c2a06a' }}>
                {job?.name ?? e.jobId}
              </div>
              <Bar kind="hp" cur={e.hp} max={e.stats.maxHp} />
              <Bar kind="mp" cur={e.mp} max={e.stats.maxMp} />
              <Bar kind="xp" cur={e.xp} max={xpToNext(e.level)} label={`XP ${Math.round((e.xp / xpToNext(e.level)) * 100)}%`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Hotbar() {
  const world = useGame((s) => s.world);
  const player = world.entities[world.playerId];
  if (!player) return null;
  // Only LEARNED skills (level >= 1) occupy the bar, in learnedIndexes order.
  // Rendered slot i addresses e.skills[learnedIndexes(player)[i]] and is labelled
  // hotkey i+1 — matching the engine's selectSkill mapping (slot N -> learnedIndexes[N]).
  const learned = learnedIndexes(player);
  return (
    <div className="panel hotbar">
      {learned.map((skillIdx, i) => {
        const rt = player.skills[skillIdx];
        const skill = getSkill(rt.skillId);
        const active = skillIdx === player.activeSkillIndex;
        const cooling = rt.cooldownLeftMs > 0;
        const totalCd = skill.params.cooldown ? Math.round(skill.params.cooldown(rt.level) * 1000) : skill.cooldownMs;
        const elapsedDeg = cooling && totalCd > 0 ? (1 - rt.cooldownLeftMs / totalCd) * 360 : 360; // dark arc shrinks (un-dims) as it cools
        return (
          <div key={rt.skillId + skillIdx} className={`slot${active ? ' active' : ''}${cooling ? ' cooling' : ''}`} title={`${skill.name} (Lv${rt.level})\n${describeSkill(skill, rt.level, player.stats.maxDmg)}`}>
            {cooling && <span className="cdmask" style={{ background: `conic-gradient(from 0deg, transparent ${elapsedDeg}deg, rgba(0, 0, 0, 0.72) ${elapsedDeg}deg)` }} />}
            <span className="digit">{i + 1}</span>
            <span className="lvl">L{rt.level}</span>
            {cooling && <span className="cd">{Math.ceil(rt.cooldownLeftMs / 1000)}</span>}
            <ShapeGrid shape={shapeFor(skill, rt.level)} />
            <span className="lbl">{skill.name}</span>
            {rt.usesLeft >= 0 && skill.uses && skill.uses > 1 ? (
              <div className="pips">
                {Array.from({ length: skill.uses }).map((_, k) => (
                  <i key={k} className={k < rt.usesLeft ? 'on' : ''} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// Color key for the world overlays. (The auto-cast box was removed; the per-
// combatant cast timers on the sprites carry that information.)
function Legend() {
  return (
    <div className="panel legend">
      <div className="sw">
        <span className="chip" style={{ background: 'rgba(232,124,44,0.3)', border: '1px solid #f4922e' }} />
        Current attack radius
      </div>
      <div className="sw">
        <span className="chip" style={{ border: '1px dashed rgba(240,150,70,0.7)' }} />
        Previewed / selected skill
      </div>
      <div className="sw">
        <span className="chip" style={{ border: '1px solid rgba(226,231,240,0.5)' }} />
        Combat block (stuck together)
      </div>
    </div>
  );
}

// Floating "+N XP" gains shown when enemies are defeated. Consumes the engine's
// per-tick `world.xpGains` stream (one entry per killed enemy) rather than diffing
// player.xp, so simultaneous kills each get their own float. Positioned just above
// the Legend HUD panel; simultaneous kills stagger vertically + in fade timing.
const XP_FLOAT_LIFETIME_MS = 3000; // hold ~3s before fading
const XP_FLOAT_STAGGER_MS = 100; // per-batch-index delay for fade-in/out
const XP_FLOAT_LINE_PX = 22; // vertical spacing between stacked simultaneous floats
const XP_FLOAT_GAP_ABOVE_LEGEND = 16; // float's bottom sits this far above the legend's top

type XpFloat = { id: number; amount: number; index: number };

function XpGainFloats() {
  // Batch (tickCount) + the gains produced on that tick. A tickCount-keyed effect
  // fires exactly once per tick, so re-renders never re-enqueue the same batch.
  const tickCount = useGame((s) => s.world.tickCount);
  const xpGains = useGame((s) => s.world.xpGains);
  const [floats, setFloats] = useState<XpFloat[]>([]);
  const seq = useRef(0);
  // Anchor: bottom-right, `GAP_ABOVE_LEGEND` above the Legend panel's top edge.
  // Falls back to a sensible bottom-right position if the legend isn't mounted.
  const [anchor, setAnchor] = useState({ right: 16, bottom: 48 });

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector('.legend');
      if (el) {
        const r = el.getBoundingClientRect();
        setAnchor({
          right: Math.max(0, window.innerWidth - r.right),
          bottom: Math.max(0, window.innerHeight - r.top + XP_FLOAT_GAP_ABOVE_LEGEND),
        });
      } else {
        setAnchor({ right: 16, bottom: 48 });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (xpGains.length === 0) return;
    const batch: XpFloat[] = xpGains.map((amount, index) => ({ id: seq.current++, amount, index }));
    setFloats((f) => [...f, ...batch]);
    const ids = new Set(batch.map((b) => b.id));
    const maxStagger = (xpGains.length - 1) * XP_FLOAT_STAGGER_MS;
    const timer = window.setTimeout(() => setFloats((f) => f.filter((x) => !ids.has(x.id))), XP_FLOAT_LIFETIME_MS + maxStagger);
    return () => window.clearTimeout(timer);
  }, [tickCount]); // fire once per tick; xpGains is snapshotted for this tickCount

  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  return (
    <div className="xpgain-layer" style={{ right: anchor.right, bottom: anchor.bottom }}>
      {floats.map((g) => (
        <span
          key={g.id}
          className="xpgain"
          style={{
            animationDelay: `${g.index * XP_FLOAT_STAGGER_MS}ms`,
            bottom: `${g.index * XP_FLOAT_LINE_PX}px`,
          }}
        >
          +{fmt(g.amount)} XP
        </span>
      ))}
    </div>
  );
}

// Screen-wide XP bar pinned to the very bottom (DDO-style): a gold fill with the
// "cur / need (pct%)" label split black-over-fill / white-over-track. The rising
// "+N XP" gains live in their own layer (XpGainFloats), positioned near the Legend.
function BottomXpBar() {
  const world = useGame((s) => s.world);
  const player = world.entities[world.playerId];
  if (!player) return null;
  const need = xpToNext(player.level);
  const pct = need > 0 ? Math.max(0, Math.min(1, player.xp / need)) : 0;
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const text = `${fmt(player.xp)} / ${fmt(need)} (${(pct * 100).toFixed(1)}%)`;
  return (
    <div className="xpbar-bottom">
      <span className="fill" style={{ width: `${pct * 100}%` }} />
      <span className="label">{text}</span>
      <span className="label clip" style={{ clipPath: `inset(0 ${(1 - pct) * 100}% 0 0)` }} aria-hidden="true">
        {text}
      </span>
    </div>
  );
}

export function Hud() {
  return (
    <div className="hud">
      <ZoneBanner />
      <FocusTarget />
      <PartyFrames />
      <Hotbar />
      <Legend />
      <BottomXpBar />
      <XpGainFloats />
    </div>
  );
}
