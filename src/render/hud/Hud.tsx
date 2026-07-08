import { useEffect, useRef } from 'react';
import type { Entity, Offset } from '../../types';
import { JOBS, getSkill, describeSkill } from '../../data';
import { MAPS } from '../../data-map';
import { COMBAT_TICK_MS, xpToNext } from '../../config';
import { shapeFor } from '../../engine/shapes';
import { useGame } from '../../state/store';
import { Sprites } from '../sprites';
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

function Bar({ kind, cur, max, label }: { kind: 'hp' | 'mp' | 'xp'; cur: number; max: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, cur / max));
  return (
    <div className={`bar ${kind}`}>
      <span style={{ transform: `scaleX(${pct})` }} />
      <span className="label">{label ?? `${Math.round(cur)} / ${max}`}</span>
    </div>
  );
}

function ShapeGrid({ shape }: { shape: Offset[] }) {
  const set = new Set(shape.map((o) => `${o.dx},${o.dy}`));
  const cells = [];
  for (let gy = -2; gy <= 2; gy++)
    for (let gx = -2; gx <= 2; gx++) {
      const self = gx === 0 && gy === 0;
      const on = set.has(`${gx},${gy}`);
      cells.push(<i key={`${gx},${gy}`} className={self ? 'self' : on ? 'on' : ''} />);
    }
  return <div className="shape">{cells}</div>;
}

function heroes(entities: Record<string, Entity>): Entity[] {
  return Object.values(entities).filter((e) => e.faction !== 'enemy');
}

function ZoneBanner() {
  const world = useGame((s) => s.world);
  const def = MAPS[world.mapId];
  if (!def) return null;
  return (
    <div className="panel zone-banner">
      <div className="title">{def.name}</div>
      <div className="sub">
        RECOMMENDED LV {def.recommended[0]}–{def.recommended[1]}
      </div>
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
            <div className="portrait">
              <SpriteCanvas name={e.sprite} size={44} />
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
  return (
    <div className="panel hotbar">
      {player.skills.map((rt, i) => {
        const skill = getSkill(rt.skillId);
        const active = i === player.activeSkillIndex;
        const cooling = rt.cooldownLeftMs > 0;
        return (
          <div
            key={rt.skillId + i}
            className={`slot${active ? ' active' : ''}${cooling ? ' cooling' : ''}`}
            title={`${skill.name} (Lv${rt.level})\n${describeSkill(skill, rt.level, player.stats.maxDmg)}`}
          >
            <span className="digit">{i + 1}</span>
            <span className="lvl">L{rt.level}</span>
            {cooling && <span className="cd">{Math.ceil(rt.cooldownLeftMs / 1000)}</span>}
            <ShapeGrid shape={shapeFor(skill, rt.level)} />
            <span className="lbl">{skill.name}</span>
            {rt.usesLeft >= 0 && skill.uses ? (
              <div className="pips">
                {Array.from({ length: skill.uses }).map((_, k) => (
                  <i key={k} className={k < rt.usesLeft ? 'on' : ''} />
                ))}
              </div>
            ) : null}
            {skill.cooldownType === 'passive' && skill.cooldownMs > 0 ? <span className="tag">P</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function AutoCast() {
  const world = useGame((s) => s.world);
  const group = Object.values(world.groups).find((g) => g.memberIds.includes(world.playerId));
  const frac = group ? group.timerMs / COMBAT_TICK_MS : 0;
  const remaining = (1 - frac) * 100;
  return (
    <>
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
          Moving block (stuck together)
        </div>
      </div>
      <div className="panel autocast">
        <div className="sq">
          <i style={{ height: `${remaining}%` }} />
        </div>
        <div className="txt">
          <b>AUTO-CAST</b>
          <br />
          Both sides act every 1.5s
        </div>
      </div>
    </>
  );
}

export function Hud() {
  return (
    <div className="hud">
      <ZoneBanner />
      <FocusTarget />
      <PartyFrames />
      <Hotbar />
      <AutoCast />
    </div>
  );
}
