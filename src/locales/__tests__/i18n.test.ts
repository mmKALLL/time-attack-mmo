import { describe, it, expect } from 'vitest';
import { STRINGS } from '../strings';
import { SKILLS, getSkill } from '../../data-skills';
import { JOBS } from '../../data';

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
});
