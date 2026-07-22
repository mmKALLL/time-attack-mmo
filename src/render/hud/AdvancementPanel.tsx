import { useGame } from '../../state/store';
import { canAdvanceTo, advancementLevelReq } from '../../engine/progression';
import { JOBS } from '../../data';
import { jobName, translate, useLocale } from '../../locales/i18n';
import { OfferPanel } from './OfferPanel';
import type { OfferOption } from './OfferPanel';

// Natural comma/"or" list: [] -> '', ['A'] -> 'A', ['A','B'] -> 'A or B',
// ['A','B','C'] -> 'A, B, or C' (Oxford "or").
export function orList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
}

// The Guildmaster (npcRole === 'jobAdvance') accept/decline advancement panel,
// rendered off world.pendingNpc in place of the chat NpcDialog. Each Guildmaster is
// DISTRIBUTED: it offers exactly ONE 1st-job class (the town's class, on the NPC's
// `advanceTo`). We present that single option, enabled/disabled per canAdvanceTo.
// Accepting dispatches advanceJob(advanceTo) then closeNpc; declining just closes.
export function AdvancementPanel() {
  const world = useGame((s) => s.world);
  const dispatch = useGame((s) => s.dispatch);
  const locale = useLocale();
  const t = (key: string) => translate(key, locale);
  const npc = world.pendingNpc ? world.entities[world.pendingNpc] : undefined;
  const player = world.entities[world.playerId];

  if (!npc || !player) return null;

  const advanceTo = npc.advanceTo;
  const job = advanceTo ? JOBS[advanceTo] : undefined;
  // The single option this Guildmaster offers (if any). A missing/unknown advanceTo
  // yields no option -> the empty-state body + "Close" (never crash). `name` is the
  // localized class name (jobName falls back to the live source for untranslated classes).
  const option = advanceTo && job ? { jobId: advanceTo, name: jobName(job, locale), levelReq: advancementLevelReq(advanceTo), ...canAdvanceTo(player, advanceTo) } : undefined;

  const options: OfferOption[] = option
    ? [
        {
          key: option.jobId,
          label: option.name,
          sublabel: t('ui.advance.requiresLv').replace('{n}', String(option.levelReq)),
          disabled: !option.ok,
          disabledReason: option.reason,
        },
      ]
    : [];

  // The greeting is a dialogue LINE (owned by a separate pass) — falls back to English.
  const greeting = npc.dialogue?.[0] ?? t('ui.advance.greeting');
  // Dynamic line naming the single class on offer (or an empty-state line when the
  // Guildmaster has no path for this player — e.g. already this class, or ineligible).
  const pathLine = option ? t('ui.advance.pathOffer').replace('{job}', option.name) : t('ui.advance.noPath');

  const body = (
    <>
      <p style={{ margin: '0 0 8px' }}>{greeting}</p>
      <p style={{ margin: 0, fontStyle: option ? 'italic' : 'normal', color: option ? 'var(--ink)' : 'var(--ink-dim)' }}>{pathLine}</p>
    </>
  );

  const close = () => dispatch({ type: 'closeNpc' });
  const accept = (jobId?: string) => {
    if (jobId) dispatch({ type: 'advanceJob', jobId });
    close();
  };

  return (
    <OfferPanel
      title={npc.name}
      body={body}
      options={options}
      acceptLabel={t('ui.advance.advance')}
      declineLabel={option ? t('ui.advance.decline') : t('ui.advance.close')}
      onAccept={accept}
      onDecline={close}
    />
  );
}
