import { useGame } from '../../state/store';
import { advancementOptions } from '../../engine/progression';
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
// rendered off world.pendingNpc in place of the chat NpcDialog. Lists every job the
// player could advance into (enabled/disabled per advancementOptions). Accepting a
// job dispatches advanceJob then closeNpc; declining just closes.
export function AdvancementPanel() {
  const world = useGame((s) => s.world);
  const dispatch = useGame((s) => s.dispatch);
  const npc = world.pendingNpc ? world.entities[world.pendingNpc] : undefined;
  const player = world.entities[world.playerId];

  if (!npc || !player) return null;

  const opts = advancementOptions(player);
  const options: OfferOption[] = opts.map((o) => ({
    key: o.jobId,
    label: o.name,
    sublabel: `Requires Lv ${o.levelReq}`,
    disabled: !o.ok,
    disabledReason: o.reason,
  }));

  const greeting = npc.dialogue?.[0] ?? 'What path will you walk?';
  // Dynamic line naming the classes currently on offer (from the option names).
  const pathLine = opts.length ? `I can set you on the path of the ${orList(opts.map((o) => o.name))}.` : 'No path lies open to you yet — return when you are ready.';

  const body = (
    <>
      <p style={{ margin: '0 0 8px' }}>{greeting}</p>
      <p style={{ margin: 0, fontStyle: opts.length ? 'italic' : 'normal', color: opts.length ? 'var(--ink)' : 'var(--ink-dim)' }}>{pathLine}</p>
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
      acceptLabel="Advance"
      declineLabel={opts.length ? 'Decline' : 'Close'}
      onAccept={accept}
      onDecline={close}
    />
  );
}
