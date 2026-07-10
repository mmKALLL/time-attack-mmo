import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Entity, Primaries, PrimaryKey, Skill } from '../types';
import { useGame } from '../state/store';
import { JOBS } from '../data';
import { SKILLS, describeSkillParts, getSkill } from '../data-skills';
import { CLASS_COMBAT, deriveStats } from '../config-stats';
import { xpToNext } from '../config';
import { shapeFor } from '../engine/shapes';
import { skillCap } from '../engine/progression';
import { PLAYER_TILE_SRC, keyedSheet, playerTile } from '../render/player-art';
import './skills.css';

const STAT_META: { key: PrimaryKey; abbr: string; name: string; role: string; color: string; tint: string }[] = [
  { key: 'str', abbr: 'STR', name: 'Strength', role: 'Physical power', color: '#6f9ad0', tint: 'rgba(63,102,144,.10)' },
  { key: 'dex', abbr: 'DEX', name: 'Dexterity', role: 'Speed · accuracy · crit', color: '#6fce8f', tint: 'rgba(63,122,78,.10)' },
  { key: 'vit', abbr: 'VIT', name: 'Vitality', role: 'HP · resistance', color: '#d8896a', tint: 'rgba(176,90,60,.10)' },
  { key: 'int', abbr: 'INT', name: 'Intelligence', role: 'Magic power · MP', color: '#b78fe0', tint: 'rgba(107,78,148,.12)' },
];
const ELEM: Record<string, string> = {
  physical: '#c8ccd4',
  light: '#e6c583',
  dark: '#8f7ad6',
  arcane: '#a78fe0',
  fire: '#f0873a',
  ice: '#7fc8e0',
  air: '#9fd8cf',
  earth: '#b8925a',
};
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const elemOf = (s: Skill) => ELEM[s.element] ?? '#e6c583';

// icon "kind" for a skill (drives the little glyph)
function iconKind(s: Skill): string {
  if (s.kind === 'heal') return 'heal';
  if (s.kind === 'buff') return 'buff';
  if (s.kind === 'dot') return 'dot';
  if (s.shapeKind === 'line') return 'line';
  if (s.shapeKind === 'area' || s.shapeKind === 'cross') return 'area';
  return 'single';
}

// The job's advancement lineage, e.g. ["Beginner", "Magician", "Fire Wizard"].
function lineage(jobId: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = jobId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    names.unshift(JOBS[cur]?.name ?? cur);
    cur = JOBS[cur]?.requires?.[0];
  }
  return names;
}

function jobOfSkill(skillId: string): string {
  for (const [job, list] of Object.entries(SKILLS)) if (list.some((s) => s.id === skillId)) return job;
  return 'beginner';
}
const GROUP_ORDER = Object.keys(SKILLS);

function SkillIcon({ skill, size }: { skill: Skill; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const color = elemOf(skill);
  const kind = iconKind(skill);
  useEffect(() => {
    const x = ref.current?.getContext('2d');
    if (!x) return;
    x.clearRect(0, 0, 48, 48);
    x.save();
    x.imageSmoothingEnabled = false;
    x.shadowColor = color;
    x.shadowBlur = 7;
    x.fillStyle = color;
    x.strokeStyle = color;
    x.lineWidth = 3;
    const cx = 24;
    const cy = 24;
    if (kind === 'line') x.fillRect(8, 21, 32, 6);
    else if (kind === 'area')
      [
        [13, 13],
        [26, 13],
        [13, 26],
        [26, 26],
      ].forEach(([px, py]) => x.fillRect(px, py, 9, 9));
    else if (kind === 'single') {
      x.beginPath();
      x.moveTo(cx, 10);
      x.lineTo(38, cy);
      x.lineTo(cx, 38);
      x.lineTo(10, cy);
      x.closePath();
      x.fill();
    } else if (kind === 'buff') {
      x.beginPath();
      x.arc(cx, cy, 13, 0, 6.3);
      x.stroke();
      x.globalAlpha = 0.4;
      x.beginPath();
      x.arc(cx, cy, 7, 0, 6.3);
      x.fill();
    } else if (kind === 'heal') {
      x.fillRect(cx - 4, 12, 8, 24);
      x.fillRect(12, cy - 4, 24, 8);
    } else if (kind === 'dot') {
      x.beginPath();
      x.moveTo(cx, 9);
      x.quadraticCurveTo(37, 27, cx, 39);
      x.quadraticCurveTo(11, 27, cx, 9);
      x.fill();
    }
    x.restore();
  }, [color, kind]);
  return <canvas ref={ref} width={48} height={48} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}

// Skill description with highlighted pixel-font numbers; on preview, changed numbers show cur → next.
function SkillDesc({ skill, curLv, previewing, atk, ecol }: { skill: Skill; curLv: number; previewing: boolean; atk: number; ecol: string }) {
  const base = describeSkillParts(skill, curLv, atk);
  const next = previewing ? describeSkillParts(skill, curLv + 1, atk) : null;
  const numStyle: CSSProperties = { fontFamily: "'Press Start 2P', monospace", fontSize: 10, position: 'relative', top: 2, lineHeight: 1, display: 'inline-block' };
  return (
    <span>
      {base.map((part, i) => {
        if ('t' in part) return <span key={i}>{part.t}</span>;
        const nextPart = next?.[i];
        const changed = nextPart && 'v' in nextPart && nextPart.v !== part.v;
        if (changed) {
          return (
            <b key={i} style={{ ...numStyle, color: ecol }}>
              {/* <span style={{ ...numStyle, color: ecol }}> */}
              {/* <b style={{ ...numStyle, color: ecol }}> */}
              {part.v} &gt; {nextPart.v}
              {/* </b> */}
              {/* </span>
              <span style={{ ...numStyle, color: ecol }}> &gt; </span>
              <span style={{ ...numStyle, color: ecol }}></span> */}
            </b>
          );
        }
        return (
          <b key={i} style={{ ...numStyle, color: ecol }}>
            {part.v}
          </b>
        );
      })}
    </span>
  );
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
  return <canvas ref={ref} width={128} height={128} style={{ width: 76, height: 76, imageRendering: 'pixelated' }} />;
}

export function SkillAllocationScreen() {
  const world = useGame((s) => s.world);
  const setScene = useGame((s) => s.setScene);
  const dispatch = useGame((s) => s.dispatch);
  const p: Entity | undefined = world.entities[world.playerId];

  const [pendStat, setPendStat] = useState<Record<PrimaryKey, number>>({ str: 0, dex: 0, int: 0, vit: 0 });
  const [pendSkill, setPendSkill] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState(0);
  const [hover, setHover] = useState<{ type: 'stat' | 'skill' | null; key: string | number | null }>({ type: null, key: null });
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // stable skill groups (indices into p.skills), beginner-first
  const groups = useMemo(() => {
    if (!p) return [] as { job: string; idxs: number[] }[];
    const byJob: Record<string, number[]> = {};
    p.skills.forEach((rt, i) => (byJob[jobOfSkill(rt.skillId)] ??= []).push(i));
    return Object.keys(byJob)
      .sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
      .map((job) => ({ job, idxs: byJob[job] }));
  }, [p]);

  if (!p) return <div className="sa-fit" />;

  const cc = CLASS_COMBAT[p.combatClass];
  const pendAttrTotal = pendStat.str + pendStat.dex + pendStat.int + pendStat.vit;
  const pendSkillTotal = Object.values(pendSkill).reduce((a, b) => a + b, 0);
  const attrPool = p.attrPoints - pendAttrTotal;
  const skillPool = p.skillPoints - pendSkillTotal;
  const pending = pendAttrTotal + pendSkillTotal;

  const effPrimaries: Primaries = { str: p.primaries.str + pendStat.str, dex: p.primaries.dex + pendStat.dex, int: p.primaries.int + pendStat.int, vit: p.primaries.vit + pendStat.vit };
  const statHover = hover.type === 'stat' && attrPool > 0 ? (hover.key as PrimaryKey) : null;
  const de = deriveStats(effPrimaries, p.level, p.combatClass);
  const dBase = deriveStats(p.primaries, p.level, p.combatClass);
  const dPrev = statHover ? deriveStats({ ...effPrimaries, [statHover]: effPrimaries[statHover] + 1 }, p.level, p.combatClass) : de;

  const incStat = (k: PrimaryKey) => attrPool > 0 && setPendStat((s) => ({ ...s, [k]: s[k] + 1 }));
  const decStat = (k: PrimaryKey) => pendStat[k] > 0 && setPendStat((s) => ({ ...s, [k]: s[k] - 1 }));
  const effSkillLv = (i: number) => p.skills[i].level + (pendSkill[i] ?? 0);
  const incSkill = (i: number) => skillPool > 0 && effSkillLv(i) < skillCap(p.skills[i].skillId) && setPendSkill((s) => ({ ...s, [i]: (s[i] ?? 0) + 1 }));
  const decSkill = (i: number) => (pendSkill[i] ?? 0) > 0 && setPendSkill((s) => ({ ...s, [i]: s[i] - 1 }));
  const confirm = () => {
    if (pending <= 0) return;
    (Object.keys(pendStat) as PrimaryKey[]).forEach((k) => {
      for (let n = 0; n < pendStat[k]; n++) dispatch({ type: 'spendAttr', key: k });
    });
    Object.entries(pendSkill).forEach(([i, n]) => {
      for (let j = 0; j < n; j++) dispatch({ type: 'levelUpSkill', index: Number(i) });
    });
    setPendStat({ str: 0, dex: 0, int: 0, vit: 0 });
    setPendSkill({});
  };
  const reset = () => {
    setPendStat({ str: 0, dex: 0, int: 0, vit: 0 });
    setPendSkill({});
  };

  // derived-stat rows (with hover preview old → next)
  const statNumChange = (get: (s: typeof de) => number, dec?: boolean, pct?: boolean) => {
    const cur = get(de);
    const next = get(dPrev);
    const f = (v: number) => (dec ? v.toFixed(1) : fmt(v)) + (pct ? '%' : '');
    const changed = !!statHover && f(cur) !== f(next); // highlight only when the DISPLAYED (rounded) value changes
    return { cur, next, changed, f };
  };
  const DERIVED: { label: string; get: (s: typeof de) => number; dec?: boolean; pct?: boolean }[] = [
    { label: 'Min damage', get: (s) => s.minDmg },
    { label: 'Max damage', get: (s) => s.maxDmg },
    { label: 'Max HP', get: (s) => s.maxHp },
    { label: 'Max MP', get: (s) => s.maxMp },
    { label: 'Defense', get: (s) => s.def },
    { label: 'Crit rate', get: (s) => s.crit, dec: true },
    { label: 'Accuracy', get: (s) => s.accuracy },
    { label: 'Dodge', get: (s) => s.dodge, dec: true },
    { label: 'Status Resist', get: (s) => s.statusResist, pct: true },
    { label: 'Attack Speed', get: (s) => s.attackSpeed, pct: true },
  ];

  const line = lineage(p.jobId);
  const job = JOBS[p.jobId];

  // ---- selected-skill attack-area preview ----
  const selRt = p.skills[selected] ?? p.skills[0];
  const selSkill = selRt ? getSkill(selRt.skillId) : undefined;
  const selCap = selRt ? skillCap(selRt.skillId) : 10;
  const selHoverPreview = hover.type === 'skill' && hover.key === selected && skillPool > 0 && effSkillLv(selected) < selCap;
  const selLv = selRt ? effSkillLv(selected) + (selHoverPreview ? 1 : 0) : 1; // bumped on hover: drives the attack-area shape preview
  const curLv = selRt ? effSkillLv(selected) : 1; // committed/effective level; powVal + deltas compare curLv -> curLv+1
  const power = de.maxDmg;
  const elem = selSkill ? elemOf(selSkill) : '#e6c583';

  // 5x5 grid, caster at (col1,row2) facing right
  const gridCells = () => {
    const cx = 1;
    const cy = 2;
    const hits = selSkill ? new Set(shapeFor(selSkill, selLv, 'right').map((o) => `${cx + o.dx},${cy + o.dy}`)) : new Set<string>();
    const cells: { bg: string; border: string; glow: string; mark: string; markColor: string }[] = [];
    for (let gy = 0; gy < 5; gy++)
      for (let gx = 0; gx < 5; gx++) {
        const self = gx === cx && gy === cy;
        if (self && hits.has(`${cx},${cy}`)) cells.push({ bg: elem, border: `2px solid #e6c583`, glow: `0 0 12px ${elem}88`, mark: '◆', markColor: '#12140c' });
        else if (self) cells.push({ bg: '#2a3140', border: '1px solid #e6c583', glow: '0 0 8px rgba(230,197,131,.4)', mark: '◆', markColor: '#e6c583' });
        else if (hits.has(`${gx},${gy}`)) cells.push({ bg: elem, border: `2px solid ${elem}`, glow: `0 0 10px ${elem}66`, mark: '', markColor: elem });
        else cells.push({ bg: '#12151c', border: '1px solid #232a36', glow: 'none', mark: '', markColor: '#232a36' });
      }
    return cells;
  };

  // power headline + NEXT LV deltas from the skill's param functions
  const paramLabel = (k: string, s: Skill) =>
    k === 'dmg' ? 'Max damage' : k === 'heal' ? 'Healing' : k === 'pct' ? (s.kind === 'dot' ? 'Burn' : 'Effect') : k === 'dur' ? 'Duration' : k === 'tiles' ? 'Tiles' : k === 'hits' ? 'Hits' : k === 'cooldown' ? 'Cooldown' : k === 'crit' ? 'Crit rate' : k === 'critDmg' ? 'Crit damage' : k;
  const paramVal = (k: string, s: Skill, lv: number) => {
    const fn = s.params[k as keyof typeof s.params];
    if (!fn) return '';
    const v = fn(lv);
    if (k === 'dmg' || k === 'heal') return `${Math.round(power * v)}`;
    if (k === 'cooldown') return `${+v.toFixed(1)}s`; // seconds, e.g. per-level "15.0s -> 13.8s"
    const unit = k === 'pct' || k === 'crit' || k === 'critDmg' ? '%' : k === 'dur' ? 's' : '';
    return `${Math.round(v)}${unit}`;
  };
  let powLabel = 'Effect';
  let powVal = '(no damage)';
  let note = '';
  if (selSkill) {
    if (selSkill.params.dmg) {
      const dmgAt = (lv: number) => `${Math.round(de.minDmg * selSkill.params.dmg!(lv))}–${Math.round(de.maxDmg * selSkill.params.dmg!(lv))}`;
      powLabel = 'Damage';
      powVal = `${dmgAt(curLv)}${selHoverPreview ? ` > ${dmgAt(curLv + 1)}` : ''}`;
      note = `${Math.round(cc.phys * 100)}/${Math.round((1 - cc.phys) * 100)} phys/mag mix`;
    } else if (selSkill.params.heal) {
      powLabel = 'Healing';
      powVal = `${Math.round(power * selSkill.params.heal(curLv))}${selHoverPreview ? ` > ${Math.round(power * selSkill.params.heal(curLv + 1))}` : ''}`;
      note = 'restores HP';
    } else if (selSkill.kind === 'dot' && selSkill.params.pct) {
      powLabel = 'Burn / round';
      powVal = `${Math.round(selSkill.params.pct(curLv))}%`;
      note = selSkill.params.dur ? `of max HP for ${Math.round(selSkill.params.dur(curLv))}s` : 'of max HP';
    } else if (selSkill.params.pct) {
      powLabel = 'Effect';
      powVal = `${Math.round(selSkill.params.pct(curLv))}%`;
      note = selSkill.params.dur ? `for ${Math.round(selSkill.params.dur(curLv))}s` : '';
    }
  }
  const hasNext = curLv < selCap;
  const deltas =
    hasNext && selSkill
      ? Object.keys(selSkill.params)
          .map((k) => ({ label: paramLabel(k, selSkill), cur: paramVal(k, selSkill, curLv), next: paramVal(k, selSkill, curLv + 1) }))
          .filter((d) => d.cur !== d.next)
      : [];

  return (
    <div className="sa-fit">
      <div className="sa-root" style={{ transform: `scale(${scale})` }}>
        {/* HEADER */}
        <div className="sa-panel" style={{ top: 22, left: 24, width: 1212, height: 108, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 18 }}>
          <div className="sa-gold" />
          <div style={{ width: 76, height: 76, borderRadius: 6, background: '#0d1016', border: '1px solid #b8925a55', overflow: 'hidden', flex: 'none' }}>
            <Portrait jobId={p.jobId} />
          </div>
          <div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 27, color: '#f2e8d2' }}>{p.name}</div>
            <div style={{ fontSize: 14, color: job?.accent ?? '#e0906a', marginTop: 2 }}>
              {job?.name ?? p.jobId} <span style={{ color: '#7a7360' }}>· {line.join(' → ')}</span>
            </div>
          </div>
          <div style={{ marginLeft: 24, textAlign: 'center' }}>
            <div className="sa-px" style={{ fontSize: 9, color: '#c2a06a' }}>
              LEVEL
            </div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 44, color: '#e6c583', lineHeight: 1 }}>{p.level}</div>
          </div>
          <div style={{ width: 220, marginLeft: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#a99a7c' }}>
              <span>Experience</span>
              <span className="sa-px" style={{ fontSize: 8, color: '#c2a06a' }}>
                {Math.round((p.xp / xpToNext(p.level)) * 100)}%
              </span>
            </div>
            <div style={{ height: 9, borderRadius: 2, background: '#0c0f14', boxShadow: 'inset 0 1px 2px #000', overflow: 'hidden', marginTop: 4 }}>
              <div style={{ width: `${Math.min(100, (p.xp / xpToNext(p.level)) * 100)}%`, height: '100%', background: 'linear-gradient(var(--gold-bright), var(--gold-dim))' }} />
            </div>
            <div style={{ fontSize: 11, color: '#8f8674', marginTop: 4 }}>
              {fmt(p.xp)} / {fmt(xpToNext(p.level))} <span style={{ color: '#5f5a4a' }}>XP to next</span>
            </div>
          </div>
        </div>

        {/* POINTS + ACTIONS */}
        <div className="sa-panel" style={{ top: 22, left: 1254, right: 24, height: 108, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16 }}>
          <div className="sa-gold" />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ textAlign: 'center', background: '#0c0f14', border: '1px solid #2a3f56', borderRadius: 6, padding: '13px 16px' }}>
              <div className="sa-px" style={{ fontSize: 22, color: attrPool > 0 ? '#8fe0a0' : '#6f6753' }}>
                {attrPool}
              </div>
              <div style={{ fontSize: 10, color: '#8fa8cc', marginTop: 5, letterSpacing: 0.5 }}>ATTRIBUTE</div>
            </div>
            <div style={{ textAlign: 'center', background: '#0c0f14', border: '1px solid #513524', borderRadius: 6, padding: '13px 16px' }}>
              <div className="sa-px" style={{ fontSize: 22, color: skillPool > 0 ? '#e0906a' : '#6f6753' }}>
                {skillPool}
              </div>
              <div style={{ fontSize: 10, color: '#e0906a', marginTop: 5, letterSpacing: 0.5 }}>SKILL</div>
            </div>
          </div>
          <div style={{ flex: 1, fontSize: 12, color: '#8f8674', fontStyle: 'italic', lineHeight: 1.4 }}>{pending > 0 ? `Unsaved: ${pending} point${pending > 1 ? 's' : ''} allocated.` : 'Spend your points here. No cashbacks.'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              className={`sa-btn${pending > 0 ? '' : ' dis'}`}
              onClick={confirm}
              style={{ padding: '8px 22px', fontSize: 14, color: '#12140c', background: 'linear-gradient(#e6c583,#c8a24a)', boxShadow: '0 2px 6px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.4)' }}
            >
              Confirm
            </div>
            <div className="sa-btn" onClick={pending > 0 ? reset : () => setScene('dungeon')} style={{ padding: '5px 22px', fontSize: 12, color: '#b3a888', background: '#1a1e26', border: '1px solid #3a4152' }}>
              {pending > 0 ? 'Reset' : 'Return'}
            </div>
          </div>
        </div>

        {/* COLUMN A: ATTRIBUTES */}
        <div className="sa-panel" style={{ top: 146, left: 24, width: 452, bottom: 24, padding: '18px 20px' }}>
          <div className="sa-gold" />
          <div className="sa-hd" style={{ fontSize: 14 }}>
            Attributes ({attrPool} left)
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {STAT_META.map((m) => {
              const committed = p.primaries[m.key];
              const pend = pendStat[m.key];
              const previewing = statHover === m.key;
              return (
                <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 12, background: `linear-gradient(90deg, ${m.tint}, transparent)`, border: '1px solid #232a36', borderRadius: 6, padding: '7px 12px' }}>
                  <div
                    style={{ width: 38, height: 38, borderRadius: 6, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: 13, color: '#10131a', flex: 'none' }}
                  >
                    {m.abbr}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: '#f2e8d2' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: '#8f8674' }}>{m.role}</div>
                  </div>
                  <div className={`sa-step${pend > 0 ? '' : ' dis'}`} onClick={() => decStat(m.key)}>
                    −
                  </div>
                  <div style={{ minWidth: 46, textAlign: 'center' }}>
                    {previewing ? (
                      <span className="sa-px" style={{ fontSize: 19, color: '#ffd27a' }}>
                        {committed + pend + 1}
                      </span>
                    ) : (
                      <span>
                        <span className="sa-px" style={pend ? { fontSize: 19, color: '#ffd27a' } : { fontSize: 16, color: '#f2e8d2' }}>
                          {committed + pend}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className={`sa-step${attrPool > 0 ? '' : ' dis'}`} onClick={() => incStat(m.key)} onMouseEnter={() => setHover({ type: 'stat', key: m.key })} onMouseLeave={() => setHover({ type: null, key: null })}>
                    +
                  </div>
                </div>
              );
            })}
          </div>

          {/* damage mix */}
          <div style={{ marginTop: 15, background: '#0c0f14', border: '1px solid #2a3140', borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
              <span style={{ color: '#a99a7c' }}>
                Damage mix <span style={{ color: '#7a7360' }}>· class innate</span>
              </span>
              <span className="sa-px" style={{ fontSize: 8, color: '#8f8674' }}>
                {job?.name ?? p.jobId}
              </span>
            </div>
            <div style={{ display: 'flex', height: 12, borderRadius: 3, overflow: 'hidden', marginTop: 7, boxShadow: 'inset 0 1px 2px #000' }}>
              <div style={{ width: `${cc.phys * 100}%`, background: 'linear-gradient(#6f9ad0,#3f6690)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#0c0f14', fontFamily: "'Press Start 2P'" }}>
                {Math.round(cc.phys * 100)}% {cc.phys >= 40 ? 'PHYSICAL' : 'PHYS'}
              </div>
              <div style={{ width: `${(1 - cc.phys) * 100}%`, background: 'linear-gradient(#b78fe0,#6b4e94)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#0c0f14', fontFamily: "'Press Start 2P'" }}>
                {Math.round((1 - cc.phys) * 100)}% MAGIC
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,#b8925a44,transparent)', margin: '15px 0 12px' }} />
          <div className="sa-hd" style={{ fontSize: 12, color: '#b89a63' }}>
            Derived
          </div>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
            {DERIVED.map((d) => {
              const { cur, next, changed, f } = statNumChange(d.get, d.dec, d.pct);
              return (
                <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 20, borderBottom: '1px dotted #2f3846', paddingBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#a99a7c' }}>{d.label}</span>
                  {changed ? (
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <span className="sa-px" style={{ fontSize: 10, color: '#8f8674' }}>
                        {f(cur)}
                      </span>
                      <span style={{ color: '#7a7360', margin: '0 4px', fontSize: 12 }}>→</span>
                      <span className="sa-px" style={{ fontSize: 14, color: '#ffd27a' }}>
                        {f(next)}
                      </span>
                    </span>
                  ) : (
                    <span className="sa-px" style={{ fontSize: 11, color: cur > d.get(dBase) + 0.01 ? '#8fe0a0' : '#d8cdb2' }}>
                      {f(cur)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, fontSize: 11.5, color: '#7a7360', fontStyle: 'italic', lineHeight: 1.4 }}>Every stat pays off for any class, but lead to different playstyles.</div>
        </div>

        {/* COLUMN B: SKILLS */}
        <div className="sa-panel" style={{ top: 146, left: 494, width: 742, bottom: 24, padding: '18px 20px' }}>
          <div className="sa-gold" />
          <div className="sa-hd" style={{ fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            Skills ({skillPool} left)
            <span className="sa-px" style={{ fontSize: 9, color: '#8fe0a0' }}>
              {p.skillPoints > 0 ? `${p.skillPoints} PTS TO SPEND` : ''}
            </span>
          </div>
          <div className="sa-scroll" style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 15, overflow: 'auto', height: 'calc(100% - 44px)', paddingRight: 6 }}>
            {groups.map(({ job: gjob, idxs }) => {
              const accent = JOBS[gjob]?.accent ?? '#c2a06a';
              return (
                <div key={gjob}>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: 12, letterSpacing: 1, color: accent, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    {JOBS[gjob]?.name ?? gjob}
                    <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${accent}55, transparent)` }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {idxs.map((i) => {
                      const rt = p.skills[i];
                      const sk = getSkill(rt.skillId);
                      const cap = skillCap(rt.skillId);
                      const committed = rt.level;
                      const canInc = skillPool > 0 && effSkillLv(i) < cap;
                      const previewing = hover.type === 'skill' && hover.key === i && canInc;
                      const lvl = effSkillLv(i) + (previewing ? 1 : 0);
                      const sel = selected === i;
                      const ecol = elemOf(sk);
                      // Level-0 = owned but UNLEARNED (granted by a job advancement, not yet
                      // castable): dim the row until the first point "learns" it (0 -> 1).
                      const unlearned = effSkillLv(i) === 0;
                      return (
                        <div
                          key={rt.skillId + i}
                          className="sa-skillrow"
                          onClick={() => setSelected(i)}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, border: `1px solid ${sel ? ecol : '#262b34'}`, borderRadius: 7, padding: '10px 12px', background: sel ? 'rgba(240,135,58,.12)' : '#12151c', opacity: unlearned ? 0.62 : 1 }}
                        >
                          <div style={{ width: 48, height: 48, borderRadius: 6, background: '#0d1016', border: `1px solid ${ecol}66`, flex: 'none' }}>
                            <SkillIcon skill={sk} size={48} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                              <span style={{ fontSize: 15, color: '#f2e8d2' }}>{sk.name}</span>
                              <span className="sa-px" style={{ fontSize: 7, color: ecol }}>
                                {sk.shapeKind.toUpperCase()}
                              </span>
                              {unlearned && (
                                <span className="sa-px" style={{ fontSize: 7, color: '#8fa8cc', border: '1px solid #3a4f66', borderRadius: 3, padding: '2px 4px' }}>
                                  UNLEARNED
                                </span>
                              )}
                              <span style={{ fontSize: 11, color: '#7a7360', marginLeft: 'auto' }}>
                                {sk.kind} · {sk.element}
                              </span>
                            </div>
                            <div style={{ fontSize: 13.5, lineHeight: '19px', color: '#cdc3aa', marginTop: 4 }}>
                              <SkillDesc skill={sk} curLv={effSkillLv(i)} previewing={previewing} atk={power} ecol={ecol} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                              {Array.from({ length: cap }).map((_, k) => {
                                const filled = k < lvl;
                                const accentPip = (k >= committed && k < effSkillLv(i)) || (previewing && k === effSkillLv(i));
                                return <span key={k} style={{ width: 18, height: 9, borderRadius: 2, background: filled ? ecol : '#242b36', border: `1px solid ${accentPip ? '#e6c583' : filled ? ecol : '#1a1e26'}` }} />;
                              })}
                              <span style={{ fontSize: 11, color: '#8f8674', marginLeft: 6 }}>
                                {unlearned && !previewing ? <span style={{ color: '#8fa8cc' }}>Unlearned</span> : <>Lv {effSkillLv(i)}</>}
                                {previewing ? <span style={{ color: '#ffd27a' }}> → {effSkillLv(i) + 1}</span> : unlearned ? null : <span>/{cap}</span>}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignSelf: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <div className={`sa-step${(pendSkill[i] ?? 0) > 0 ? '' : ' dis'}`} onClick={() => decSkill(i)}>
                              −
                            </div>
                            <div className={`sa-step${canInc ? '' : ' dis'}`} onClick={() => incSkill(i)} onMouseEnter={() => setHover({ type: 'skill', key: i })} onMouseLeave={() => setHover({ type: null, key: null })}>
                              +
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN C: SKILL DETAILS AND ATTACK AREA */}
        <div className="sa-panel" style={{ top: 146, left: 1254, right: 24, bottom: 24, padding: 20 }}>
          <div className="sa-gold" />
          <div className="sa-hd" style={{ fontSize: 13, color: '#b89a63', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            Attack Area
          </div>
          {selSkill && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 8, background: '#0d1016', border: `2px solid ${elem}`, flex: 'none', boxShadow: `0 0 16px ${elem}44, inset 0 0 0 1px #000` }}>
                  <SkillIcon skill={selSkill} size={56} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: 21, color: '#f2e8d2' }}>{selSkill.name}</div>
                  <div style={{ fontSize: 12.5, color: elem }}>
                    {selSkill.shapeKind} · Lv {effSkillLv(selected)}/{selCap}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5,44px)',
                    gridTemplateRows: 'repeat(5,44px)',
                    gap: 5,
                    padding: 12,
                    background: '#0c0f14',
                    border: '1px solid #2a3140',
                    borderRadius: 8,
                    boxShadow: 'inset 0 0 26px rgba(0,0,0,.6)',
                  }}
                >
                  {gridCells().map((c, i) => (
                    <div
                      key={i}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 4,
                        background: c.bg,
                        border: c.border,
                        boxShadow: c.glow,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Press Start 2P'",
                        fontSize: 9,
                        color: c.markColor,
                      }}
                    >
                      {c.mark}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 12, fontSize: 12, color: '#a99a7c' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: '#2a3140', border: '1px solid #e6c583' }} /> You
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: elem }} /> {selSkill.kind === 'heal' || selSkill.kind === 'buff' ? 'Self' : 'Affected'}
                </span>
              </div>

              <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,#b8925a44,transparent)', margin: '18px 0 14px' }} />

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#8f8674' }}>{powLabel}</div>
                  <div className="sa-px" style={{ fontSize: 26, color: elem, marginTop: 6, lineHeight: '34px', height: 34 }}>
                    {powVal}
                  </div>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ textAlign: 'right', fontSize: 11.5, color: '#7a7360', lineHeight: 1.5, maxWidth: 160 }}>{note}</div>
              </div>

              {hasNext ? (
                <div style={{ marginTop: 16, background: 'linear-gradient(90deg,rgba(111,143,106,.10),transparent)', border: '1px solid #2f3d33', borderRadius: 6, padding: '11px 13px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: 1, color: '#7fb07a', fontFamily: 'Cinzel', paddingTop: 3, whiteSpace: 'nowrap' }}>NEXT LV ▸</div>
                  <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '9px 24px' }}>
                    {deltas.length ? (
                      deltas.map((d) => (
                        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          <span style={{ color: '#a99a7c' }}>{d.label}</span>
                          <span className="sa-px" style={{ fontSize: 10, color: '#8f8674', position: 'relative', top: 2 }}>
                            {d.cur}
                          </span>
                          <span style={{ color: '#7a7360', fontSize: 12 }}> &gt; </span>
                          <span className="sa-px" style={{ fontSize: 12, color: '#8fe0a0', position: 'relative', top: 2 }}>
                            {d.next}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: '#7a7360' }}>Raises the skill's effect.</span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 16, fontFamily: 'Cinzel', fontSize: 14, color: '#e6c583', letterSpacing: 1 }}>✦ MASTERED · level {selCap} reached</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
