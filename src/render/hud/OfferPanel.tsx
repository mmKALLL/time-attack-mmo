import { useEffect, useState } from 'react';
import { translate, useLocale } from '../../locales/i18n';

// A selectable choice in an OfferPanel (e.g. a job to advance into, a quest to take).
export type OfferOption = {
  key: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  disabledReason?: string;
};

// A reusable dark-HUD accept/decline overlay (gold trim, dark wood — matching the
// NpcDialog panel tokens). Shows a title, body text, an optional list of selectable
// options, and Accept / Decline buttons. Meant to back the job-advancement panel and
// future quest offers. Keyboard is trapped capture-phase while open (like NpcDialog):
// Enter accepts the selected option, Escape declines, arrows move the selection, and
// movement/skill hotkeys are swallowed so they don't leak to the game underneath.
//
// - `onAccept(selectedKey)` fires with the currently-selected option's key (or
//   undefined when there are no options — a plain "confirm"). It is NOT called when
//   the selected option is disabled.
// - `onDecline` fires on the Decline/Close button or Escape.
export function OfferPanel({
  title,
  body,
  options = [],
  acceptLabel = 'Accept',
  declineLabel = 'Decline',
  onAccept,
  onDecline,
}: {
  title: string;
  body: React.ReactNode;
  options?: OfferOption[];
  acceptLabel?: string;
  declineLabel?: string;
  onAccept: (selectedKey?: string) => void;
  onDecline: () => void;
}) {
  const locale = useLocale();
  // Start on the first ENABLED option so Enter accepts something valid by default.
  const firstEnabled = options.findIndex((o) => !o.disabled);
  const [selected, setSelected] = useState(firstEnabled >= 0 ? firstEnabled : 0);

  const selectable = options.length > 0;
  const selectedOption = selectable ? options[selected] : undefined;
  const canAccept = !selectable || (!!selectedOption && !selectedOption.disabled);

  const accept = () => {
    if (!canAccept) return;
    onAccept(selectedOption?.key);
  };

  // Capture-phase key trap. Accepting is CLICK-ONLY (the Accept button): no key ever
  // triggers it, so a spammed Space/Enter can't cause an accidental, irreversible
  // choice (e.g. a job advancement). Enter, Space, AND Escape all DECLINE/close.
  // Up/Down still move the selection highlight; movement/skill keys are swallowed so
  // the game underneath is inert. Registered before DungeonScreen's window handler.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        e.stopPropagation();
        onDecline(); // no keyboard accept — decline/close only
        return;
      }
      if (selectable && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        e.stopPropagation();
        setSelected((s) => {
          const dir = e.key === 'ArrowUp' ? -1 : 1;
          return (s + dir + options.length) % options.length;
        });
        return;
      }
      // Swallow the remaining movement + skill hotkeys so they don't drive the game.
      if (e.key.startsWith('Arrow') || (e.key >= '1' && e.key <= '9')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true); // capture phase: before DungeonScreen
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selectable, options.length, selected, canAccept]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 46, // above NpcDialog (45)
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(6,8,12,0.55)',
        pointerEvents: 'auto',
      }}
      onClick={onDecline} // click the dim backdrop to decline
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 90vw)',
          maxHeight: '86vh',
          overflowY: 'auto',
          padding: '20px 24px 18px',
          borderRadius: 6,
          border: '1px solid var(--panel-edge)',
          boxShadow: 'inset 0 1px 0 var(--bevel-hi), 0 10px 30px rgba(0,0,0,0.75)',
          background: 'linear-gradient(var(--panel-top), var(--panel-bottom))',
          color: 'var(--ink)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* title + gold trim */}
        <div style={{ borderBottom: '1px solid var(--gold-trim)', paddingBottom: 10, marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--font-header)', fontWeight: 700, fontSize: 20, color: 'var(--gold-bright)', letterSpacing: 0.5 }}>{title}</span>
        </div>

        <div style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--ink)' }}>{body}</div>

        {selectable && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {options.map((o, i) => {
              const isSel = i === selected;
              return (
                <div
                  key={o.key}
                  onClick={() => setSelected(i)}
                  onDoubleClick={() => !o.disabled && onAccept(o.key)}
                  title={o.disabled ? o.disabledReason : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '9px 12px',
                    borderRadius: 5,
                    cursor: o.disabled ? 'not-allowed' : 'pointer',
                    border: `1px solid ${isSel ? 'var(--gold-trim)' : 'var(--panel-edge)'}`,
                    background: isSel ? 'rgba(240,135,58,0.14)' : '#12151c',
                    opacity: o.disabled ? 0.55 : 1,
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-header)', fontSize: 15, color: isSel ? 'var(--gold-bright)' : 'var(--ink)' }}>{o.label}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-dim)', textAlign: 'right' }}>{o.disabled ? (o.disabledReason ?? o.sublabel) : o.sublabel}</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button
            onClick={onDecline}
            style={{
              fontFamily: 'var(--font-header)',
              fontSize: 13,
              color: '#b3a888',
              background: '#1a1e26',
              border: '1px solid var(--panel-edge)',
              borderRadius: 5,
              padding: '7px 20px',
              cursor: 'pointer',
            }}
          >
            {declineLabel}
          </button>
          {canAccept && (
            <button
              onClick={accept}
              style={{
                fontFamily: 'var(--font-header)',
                fontSize: 13,
                color: '#12140c',
                background: 'linear-gradient(#e6c583, #c8a24a)',
                border: '1px solid var(--panel-edge)',
                borderRadius: 5,
                padding: '7px 24px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.4)',
              }}
            >
              {acceptLabel}
            </button>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-dim-2)', textAlign: 'right', letterSpacing: 1 }}>{translate('ui.advance.confirmHint', locale)}</div>
      </div>
    </div>
  );
}
