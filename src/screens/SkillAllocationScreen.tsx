import { useEffect, useRef, useState } from 'react';
import type { Entity, PrimaryKey, Skill, Stats } from '../types';
import { useGame } from '../state/store';
import { JOBS, SKILLS, describeSkill, getSkill } from '../data';
import { deriveStats, xpToNext } from '../config';
import { shapeFor } from '../engine/shapes';
import { skillCap } from '../engine/progression';
import { PLAYER_TILE_SRC, keyedSheet, playerTile } from '../render/player-art';
import './skills.css';

const PRIMARIES: { key: PrimaryKey; label: string; accent: string }[] = [
  { key: 'str', label: 'STR', accent: '#6f9ad0' },
  { key: 'dex', label: 'DEX', accent: '#6fce8f' },
  { key: 'vit', label: 'VIT', accent: '#d8896a' },
  { key: 'int', label: 'INT', accent: '#b78fe0' },
];

// The derived stats shown, in order, with a formatter.
const DERIVED: { label: string; get: (s: Stats) => string }[] = [
  { label: 'Max HP', get: (s) => `${s.maxHp}` },
  { label: 'Max MP', get: (s) => `${s.maxMp}` },
  { label: 'Damage', get: (s) => `${s.minDmg}–${s.maxDmg}` },
  { label: 'Defense', get: (s) => `${s.def}` },
  { label: 'Accuracy', get: (s) => `${s.accuracy}` },
  { label: 'Dodge', get: (s) => `${Math.round(s.dodge)}` },
  { label: 'Crit', get: (s) => `${s.crit.toFixed(1)}%` },
];

// Which job's kit a skill belongs to (for grouping); beginner first, then bases.
function jobOfSkill(skillId: string): string {
  for (const [job, list] of Object.entries(SKILLS)) if (list.some((s) => s.id === skillId)) return job;
  return 'beginner';
}

function Portrait({ jobId }: { jobId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const tile = playerTile(jobId);
    const canvas = ref.current;
    if (!tile || !canvas) return;
    let cancelled = false;
    void keyedSheet(tile.filename).then((sheet) => {
      if (cancelled || !sheet) return;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 128, 128);
      ctx.drawImage(sheet, tile.sx, tile.sy, PLAYER_TILE_SRC, PLAYER_TILE_SRC, 0, 0, 128, 128);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);
  return <canvas className="portrait" ref={ref} width={128} height={128} />;
}

function ShapeGrid({ skill, level }: { skill: Skill; level: number }) {
  const on = new Set(shapeFor(skill, level, 'right').map((o) => `${o.dx},${o.dy}`));
  const cells = [];
  for (let gy = -2; gy <= 2; gy++)
    for (let gx = -2; gx <= 2; gx++) cells.push(<i key={`${gx},${gy}`} className={gx === 0 && gy === 0 ? 'self' : on.has(`${gx},${gy}`) ? 'on' : ''} />);
  return <div className="shape">{cells}</div>;
}

export function SkillAllocationScreen() {
  const world = useGame((s) => s.world);
  const setScene = useGame((s) => s.setScene);
  const dispatch = useGame((s) => s.dispatch);
  const p: Entity | undefined = world.entities[world.playerId];
  const [hoverAttr, setHoverAttr] = useState<PrimaryKey | null>(null);
  if (!p) return <div className="char-screen" />;

  const job = JOBS[p.jobId];
  const power = p.stats.maxDmg;
  const preview = hoverAttr ? deriveStats({ ...p.primaries, [hoverAttr]: p.primaries[hoverAttr] + 1 }, p.level, p.combatClass) : null;

  // group skills by their source job, in kit order
  const groups: Record<string, number[]> = {};
  p.skills.forEach((rt, i) => {
    const g = jobOfSkill(rt.skillId);
    (groups[g] ??= []).push(i);
  });

  return (
    <div className="char-screen">
      <button className="back" onClick={() => setScene('dungeon')}>
        ← Back to Dungeon
      </button>

      <header className="hdr">
        <Portrait jobId={p.jobId} />
        <div className="who">
          <div className="name">{p.name}</div>
          <div className="cls" style={{ color: job?.accent ?? 'var(--gold)' }}>
            {job?.name ?? p.jobId} · Lv {p.level}
          </div>
          <div className="xp">
            <span style={{ transform: `scaleX(${Math.min(1, p.xp / xpToNext(p.level))})` }} />
            <b>XP {Math.round((p.xp / xpToNext(p.level)) * 100)}%</b>
          </div>
        </div>
        <div className="pools">
          <div className="pool">
            <b>{p.attrPoints}</b> attribute pts
          </div>
          <div className="pool">
            <b>{p.skillPoints}</b> skill pts
          </div>
        </div>
      </header>

      <div className="cols">
        <section className="panel attrs">
          <h2>Attributes</h2>
          {PRIMARIES.map(({ key, label, accent }) => (
            <div className="attr-row" key={key}>
              <span className="lbl" style={{ color: accent }}>
                {label}
              </span>
              <span className="val">{p.primaries[key]}</span>
              <button
                className="plus"
                disabled={p.attrPoints <= 0}
                onMouseEnter={() => setHoverAttr(key)}
                onMouseLeave={() => setHoverAttr(null)}
                onClick={() => dispatch({ type: 'spendAttr', key })}
              >
                +
              </button>
            </div>
          ))}

          <h2 className="sub">Derived</h2>
          {DERIVED.map(({ label, get }) => {
            const now = get(p.stats);
            const next = preview ? get(preview) : now;
            return (
              <div className="stat-row" key={label}>
                <span className="lbl">{label}</span>
                <span className="val">
                  {now}
                  {preview && next !== now && <span className="preview"> → {next}</span>}
                </span>
              </div>
            );
          })}
        </section>

        <section className="panel skills">
          <h2>Skills</h2>
          {Object.entries(groups).map(([g, idxs]) => (
            <div className="skill-group" key={g}>
              <div className="group-name">{JOBS[g]?.name ?? g}</div>
              {idxs.map((i) => {
                const rt = p.skills[i];
                const skill = getSkill(rt.skillId);
                const cap = skillCap(rt.skillId);
                const maxed = rt.level >= cap;
                return (
                  <div className="skill-row" key={rt.skillId + i}>
                    <ShapeGrid skill={skill} level={rt.level} />
                    <div className="skill-main">
                      <div className="skill-top">
                        <span className="skill-name">{skill.name}</span>
                        <span className="skill-lvl">
                          Lv {rt.level}/{cap}
                        </span>
                      </div>
                      <div className="skill-desc">{describeSkill(skill, rt.level, power)}</div>
                    </div>
                    <button className="plus" disabled={p.skillPoints <= 0 || maxed} onClick={() => dispatch({ type: 'levelUpSkill', index: i })}>
                      {maxed ? '✓' : '+'}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
