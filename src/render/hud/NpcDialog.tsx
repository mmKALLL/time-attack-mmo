import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../state/store';

// Dismissible dialog box for a bumped town NPC (WorldState.pendingNpc). Townsfolk
// speak ONE line per interaction: we feed this box just the NPC's current line
// (dialogue[dialogueIndex]); Space / Enter / clicking OK closes it (dispatch closeNpc),
// and closeNpc advances that NPC's pointer so the next chat shows its next line.
// The box keeps its generic "advance through an N-line array, show n/N, close past
// the last" behaviour so future multi-line callers still work — it just gets a
// single-line array here. Keyboard is captured while open so those keys drive the
// dialog instead of moving the player.
export function NpcDialog() {
  const world = useGame((s) => s.world);
  const dispatch = useGame((s) => s.dispatch);
  const npc = world.pendingNpc ? world.entities[world.pendingNpc] : undefined;
  // Only the NPC's current line — the engine cycles dialogueIndex on closeNpc.
  const all = npc?.dialogue ?? [];
  const lines = all.length ? [all[(npc?.dialogueIndex ?? 0) % all.length]] : [];
  const [line, setLine] = useState(0);

  // Reset to the first line whenever a different NPC is opened.
  const openedId = useRef<string | undefined>(undefined);
  const activeId = npc?.id;
  if (activeId !== openedId.current) {
    openedId.current = activeId;
    if (line !== 0) setLine(0);
  }

  // Advance a line; past the last line, close the dialog.
  const advance = () => {
    if (line + 1 < lines.length) setLine(line + 1);
    else dispatch({ type: 'closeNpc' });
  };

  // Capture-phase key handler: intercept Space/Enter (advance) and swallow the
  // movement/skill keys so the game doesn't act (or immediately re-bump the NPC)
  // while the dialog is open.
  useEffect(() => {
    if (!npc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') {
        e.preventDefault();
        e.stopPropagation();
        advance();
        return;
      }
      // Block movement + skill hotkeys from reaching the game while chatting.
      if (e.key.startsWith('Arrow') || (e.key >= '1' && e.key <= '9')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true); // capture phase: before DungeonScreen
    return () => window.removeEventListener('keydown', onKey, true);
  }, [npc?.id, line, lines.length]);

  if (!npc) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 45,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        onClick={advance}
        style={{
          pointerEvents: 'auto',
          width: 'min(640px, 88vw)',
          margin: '0 0 40px',
          padding: '18px 22px 16px',
          cursor: 'pointer',
          borderRadius: 6,
          border: '1px solid var(--panel-edge)',
          boxShadow: 'inset 0 1px 0 var(--bevel-hi), 0 8px 24px rgba(0,0,0,0.7)',
          background: 'linear-gradient(var(--panel-top), var(--panel-bottom))',
          color: 'var(--ink)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* gold trim */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--gold-trim)',
            paddingBottom: 8,
            marginBottom: 10,
          }}
        >
          <span style={{ fontFamily: 'var(--font-header)', fontWeight: 700, fontSize: 18, color: 'var(--gold-bright)', letterSpacing: 0.5 }}>{npc.name}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-dim)', letterSpacing: 1 }}>
            {line + 1}/{lines.length}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, minHeight: 48 }}>{lines[line]}</p>
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              advance();
            }}
            style={{
              fontFamily: 'var(--font-header)',
              fontSize: 14,
              color: 'var(--gold-bright)',
              background: 'linear-gradient(#232833, #151a22)',
              border: '1px solid var(--panel-edge)',
              borderRadius: 5,
              padding: '6px 20px',
              cursor: 'pointer',
            }}
          >
            {line + 1 < lines.length ? 'OK' : 'Close'}
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ink-dim-2)', textAlign: 'right', letterSpacing: 1 }}>SPACE / ENTER</div>
      </div>
    </div>
  );
}
