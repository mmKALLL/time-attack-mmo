import { describe, it, expect } from 'vitest';
import { STRINGS } from '../strings';
import { SKILLS, getSkill } from '../../data-skills';
import { JOBS } from '../../data';
import { MAPS } from '../../data-map';
import { TOWN_DIALOGUE, NPC_THEMES } from '../../data-npc';
import { TOWN_DIALOGUE_JA } from '../dialogue-ja';
import { npcLine } from '../i18n';

// The 7 towns whose names + flavor descriptions the ZoneBanner localizes (via
// mapName/mapDescription). Field maps intentionally fall back to their English source.
const TOWN_IDS = ['mantyharju', 'savonlinna', 'varkaus', 'jyvaskyla', 'kuopio', 'kajaani', 'lieksa'] as const;

// The reachable (1st-tier) jobs whose skills the Skill Allocation screen localizes.
// 2nd-job skills intentionally fall back to their English source, so they are NOT
// required to have STRINGS entries.
const REACHABLE_JOBS = ['beginner', 'fighter', 'archer', 'magician', 'rogue'] as const;
const REACHABLE_SKILL_IDS = REACHABLE_JOBS.flatMap((job) => SKILLS[job].map((s) => s.id));

// The set of {param} placeholders in a template, e.g. "for {dmg}" -> ["dmg"].
const placeholders = (s: string): string[] => (s.match(/\{(\w+)\}/g) ?? []).sort();

describe('i18n STRINGS coverage + drift guard', () => {
  it('has name + desc entries for every reachable-job skill, with .en matching live source', () => {
    for (const id of REACHABLE_SKILL_IDS) {
      const live = getSkill(id);
      const nameEntry = STRINGS[`skill.${id}.name`];
      const descEntry = STRINGS[`skill.${id}.desc`];
      expect(nameEntry, `missing skill.${id}.name`).toBeDefined();
      expect(descEntry, `missing skill.${id}.desc`).toBeDefined();
      // Drift guard: the recorded English source must still equal the live value.
      expect(nameEntry.en, `skill.${id}.name.en drifted from getSkill(${id}).name`).toBe(live.name);
      expect(descEntry.en, `skill.${id}.desc.en drifted from getSkill(${id}).description`).toBe(live.description);
    }
  });

  it('records the correct English source for every job.name entry', () => {
    for (const key of Object.keys(STRINGS)) {
      const m = /^job\.(\w+)\.name$/.exec(key);
      if (!m) continue;
      const jobId = m[1];
      expect(JOBS[jobId], `job.${jobId}.name entry has no matching JOBS[${jobId}]`).toBeDefined();
      expect(STRINGS[key].en, `job.${jobId}.name.en drifted from JOBS[${jobId}].name`).toBe(JOBS[jobId].name);
    }
  });

  it('covers job.name for every reachable class', () => {
    for (const job of REACHABLE_JOBS) {
      expect(STRINGS[`job.${job}.name`], `missing job.${job}.name`).toBeDefined();
    }
  });

  it('every entry carries a non-empty ja translation', () => {
    for (const [key, entry] of Object.entries(STRINGS)) {
      expect(entry.ja, `${key}.ja is empty`).toBeTruthy();
      expect(entry.ja.trim().length, `${key}.ja is blank`).toBeGreaterThan(0);
    }
  });

  it('ja skill descriptions preserve the exact {param} placeholder set of their en source', () => {
    for (const id of REACHABLE_SKILL_IDS) {
      const entry = STRINGS[`skill.${id}.desc`];
      expect(placeholders(entry.ja), `skill.${id}.desc.ja placeholders differ from en`).toEqual(placeholders(entry.en));
    }
  });

  it('records the correct English source for every town name + description (drift guard)', () => {
    for (const id of TOWN_IDS) {
      const map = MAPS[id];
      expect(map, `MAPS[${id}] is missing`).toBeDefined();
      const nameEntry = STRINGS[`map.${id}.name`];
      expect(nameEntry, `missing map.${id}.name`).toBeDefined();
      expect(nameEntry.en, `map.${id}.name.en drifted from MAPS[${id}].name`).toBe(map.name);
      if (map.description) {
        const descEntry = STRINGS[`map.${id}.desc`];
        expect(descEntry, `missing map.${id}.desc`).toBeDefined();
        expect(descEntry.en, `map.${id}.desc.en drifted from MAPS[${id}].description`).toBe(map.description);
      }
    }
  });
});

describe('town NPC dialogue localization (TOWN_DIALOGUE ↔ TOWN_DIALOGUE_JA)', () => {
  it('TOWN_DIALOGUE_JA mirrors the exact structure of TOWN_DIALOGUE', () => {
    // Same set of map ids.
    expect(Object.keys(TOWN_DIALOGUE_JA).sort(), 'map id set differs').toEqual(Object.keys(TOWN_DIALOGUE).sort());
    for (const [mapId, enThemes] of Object.entries(TOWN_DIALOGUE)) {
      const jaThemes = TOWN_DIALOGUE_JA[mapId];
      expect(jaThemes, `TOWN_DIALOGUE_JA[${mapId}] is missing`).toBeDefined();
      // Same set of themes per map.
      expect(Object.keys(jaThemes!).sort(), `theme set differs for ${mapId}`).toEqual(Object.keys(enThemes!).sort());
      for (const theme of NPC_THEMES) {
        const enLines = enThemes![theme];
        if (!enLines) continue;
        const jaLines = jaThemes![theme];
        expect(jaLines, `TOWN_DIALOGUE_JA[${mapId}].${theme} is missing`).toBeDefined();
        // Same array length per (map, theme).
        expect(jaLines!.length, `line count differs for ${mapId}.${theme}`).toBe(enLines.length);
      }
    }
  });

  it('every English line maps to a non-empty, distinct Japanese string', () => {
    const seen = new Set<string>();
    for (const [mapId, enThemes] of Object.entries(TOWN_DIALOGUE)) {
      for (const theme of NPC_THEMES) {
        const enLines = enThemes![theme];
        if (!enLines) continue;
        enLines.forEach((en, i) => {
          const ja = npcLine(en, 'ja');
          // The flat map must cover every source line — a miss falls back to the English line.
          expect(ja, `no ja translation for ${mapId}.${theme}[${i}]: "${en}"`).not.toBe(en);
          expect(ja.trim().length, `ja for ${mapId}.${theme}[${i}] is blank`).toBeGreaterThan(0);
          // Each Japanese line is distinct (no accidental copy/paste duplication).
          expect(seen.has(ja), `duplicate ja line for ${mapId}.${theme}[${i}]: "${ja}"`).toBe(false);
          seen.add(ja);
        });
      }
    }
  });

  it('npcLine returns the English source unchanged for the en locale', () => {
    const first = TOWN_DIALOGUE.mantyharju!.workEthic![0];
    expect(npcLine(first, 'en')).toBe(first);
  });
});
