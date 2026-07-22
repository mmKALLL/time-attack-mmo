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

// Data-derived string (skill/job/town/enemy names, NPC lines, …): English is ALWAYS the
// live source — the DATA FILE is the single English source of truth. Other locales use
// the STRINGS translation, falling back to the source when missing. So STRINGS[key].en is
// only a synced cross-check REFERENCE (guarded by the drift test), never rendered.
// (Contrast translate()/useT() for pure-UI strings, where STRINGS[key].en IS the source.)
export function tData(key: string, source: string, locale: Locale): string {
  if (locale === 'en') return source;
  return STRINGS[key]?.[locale] || source;
}

export function skillName(skill: Skill, locale: Locale): string {
  return tData(`skill.${skill.id}.name`, skill.name, locale);
}

// Localized class/job name (untranslated 2nd-job classes render their live JOBS[id].name).
export function jobName(job: JobNode, locale: Locale): string {
  return tData(`job.${job.id}.name`, job.name, locale);
}

// The localized description TEMPLATE (still holding {param} placeholders).
function skillTemplate(skill: Skill, locale: Locale): string {
  return tData(`skill.${skill.id}.desc`, skill.description, locale);
}

// Localized description with its {param} values substituted at `level` (atk scales dmg/heal).
export function skillDescription(skill: Skill, level: number, atk: number | undefined, locale: Locale): string {
  return describeSkill(skill, level, atk, skillTemplate(skill, locale));
}

// Same, split into literal/value parts so the UI can style the numbers distinctly.
export function skillDescriptionParts(skill: Skill, level: number, atk: number | undefined, locale: Locale): DescPart[] {
  return describeSkillParts(skill, level, atk, skillTemplate(skill, locale));
}
