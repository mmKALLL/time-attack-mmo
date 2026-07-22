import type { JobNode, Locale, Skill } from '../types';
import { useGame } from '../state/store';
import { STRINGS } from './strings';
import { describeSkill, describeSkillParts, type DescPart } from '../data-skills';

// Look up a UI/data string for a locale. Falls back to English when the locale's value
// is missing/empty, then to the key itself if there's no entry at all. Non-reactive —
// pass an explicit locale (React components should use useT/useLocale below).
export function translate(key: string, locale: Locale): string {
  const e = STRINGS[key];
  return e ? e[locale] || e.en : key;
}

// Reactive current locale (subscribes the calling component to locale changes).
export function useLocale(): Locale {
  return useGame((s) => s.locale);
}

// A `t(key)` bound to the current locale, for components: `const t = useT(); t('ui.…')`.
export function useT(): (key: string) => string {
  const locale = useLocale();
  return (key: string) => translate(key, locale);
}

// --- Skills: name + templated description, with English-source fallback ---
// Untranslated skills (e.g. under-design 2nd-job skills with no entry) render their
// live English source, so nothing shows a raw key.

export function skillName(skill: Skill, locale: Locale): string {
  const key = `skill.${skill.id}.name`;
  return STRINGS[key] ? translate(key, locale) : skill.name;
}

// Localized class/job name, with English-source fallback (untranslated 2nd-job classes
// render their live JOBS[id].name).
export function jobName(job: JobNode, locale: Locale): string {
  const key = `job.${job.id}.name`;
  return STRINGS[key] ? translate(key, locale) : job.name;
}

// The localized description TEMPLATE (still holding {param} placeholders).
function skillTemplate(skill: Skill, locale: Locale): string {
  const key = `skill.${skill.id}.desc`;
  return STRINGS[key] ? translate(key, locale) : skill.description;
}

// Localized description with its {param} values substituted at `level` (atk scales dmg/heal).
export function skillDescription(skill: Skill, level: number, atk: number | undefined, locale: Locale): string {
  return describeSkill(skill, level, atk, skillTemplate(skill, locale));
}

// Same, split into literal/value parts so the UI can style the numbers distinctly.
export function skillDescriptionParts(skill: Skill, level: number, atk: number | undefined, locale: Locale): DescPart[] {
  return describeSkillParts(skill, level, atk, skillTemplate(skill, locale));
}
