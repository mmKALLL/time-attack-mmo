import type { Locale } from '../types';

// One translatable string: its English SOURCE (kept as a cross-check reference) plus
// each locale's translation. A missing/empty translation falls back to `en` (see
// i18n.translate). Every entry carries `en`, so this file is self-documenting AND a
// test (locales/__tests__/i18n.test.ts) can assert that data-derived `en` values still
// equal their live source (e.g. getSkill(id).name) — catching drift when skills are
// retuned. That is the card's "references to the original values, easy to cross-check".
export type Entry = Record<Locale, string>; // { en: string; ja: string }

// Namespaced keys: 'ui.<screen>.<id>', 'skill.<id>.name', 'skill.<id>.desc',
// 'stat.<key>.name', 'job.<id>.name', … Skill DESCRIPTIONS keep their {dmg}/{cooldown}
// placeholders — the translated template is substituted at render (see i18n.skillDescription).
// Content is filled alongside each screen's wiring (main menu + reachable skills first);
// untranslated strings (e.g. 2nd-job skills) simply fall back to their English source.
export const STRINGS: Record<string, Entry> = {};
