import { useState } from 'react';
import { useGame } from '../state/store';
import { MAX_SLOTS } from '../state/persist';
import { JOBS } from '../data';

// Save-slot management screen (multi-slot scaffolding; slot 0 is populated by
// default, the rest are empty until the player exports/imports or starts fresh).
// Per-slot: Play, Export (clipboard + .json download), Import (paste JSON),
// Delete (with confirm). Styling uses the shared design tokens + inline styles,
// matching the StubScreen look so the user can polish visuals later.

const panelBtn: React.CSSProperties = {
  fontFamily: 'var(--font-header)',
  background: 'linear-gradient(#232833, #151a22)',
  color: 'var(--gold-bright)',
  border: '1px solid var(--panel-edge)',
  borderRadius: 5,
  padding: '5px 12px',
  cursor: 'pointer',
  fontSize: 13,
};

function jobName(jobId: string): string {
  return JOBS[jobId]?.name ?? jobId;
}

export function CharacterCreationScreen() {
  const setScene = useGame((s) => s.setScene);
  const loadGame = useGame((s) => s.loadGame);
  const deleteSave = useGame((s) => s.deleteSave);
  const exportSave = useGame((s) => s.exportSave);
  const importSave = useGame((s) => s.importSave);
  const listSlots = useGame((s) => s.listSlots);
  const getActiveSlot = useGame((s) => s.getActiveSlot);

  // Bump a counter to force a re-read of the (localStorage-backed) slot list
  // after any mutating action, since the store selectors are stable functions.
  const [rev, setRev] = useState(0);
  const refresh = () => setRev((r) => r + 1);
  void rev;

  const [importSlot, setImportSlot] = useState<number | null>(null);
  const [importText, setImportText] = useState('');

  const slots = listSlots();
  const activeSlot = getActiveSlot();

  const onPlay = (slot: number) => {
    loadGame(slot);
    setScene('dungeon');
  };

  const onExport = async (slot: number) => {
    const json = exportSave(slot);
    if (!json) return;
    // Copy to clipboard (best-effort) and trigger a .json download.
    try {
      await navigator.clipboard?.writeText(json);
    } catch {
      // clipboard unavailable — the download below still gives the user the data
    }
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tam-save-slot${slot}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // download unavailable — clipboard copy above is the fallback
    }
  };

  const onImportConfirm = () => {
    if (importSlot === null) return;
    importSave(importSlot, importText.trim());
    setImportSlot(null);
    setImportText('');
    refresh();
  };

  const onDelete = (slot: number) => {
    if (!window.confirm(`Delete the save in slot ${slot + 1}? This cannot be undone.`)) return;
    deleteSave(slot);
    refresh();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        color: 'var(--ink)',
        fontFamily: 'var(--font-body)',
        padding: 48,
        overflowY: 'auto',
        background: 'radial-gradient(circle at 50% 30%, #14131a, #07080b 70%)',
      }}
    >
      <button onClick={() => setScene('mainMenu')} style={{ ...panelBtn, padding: '6px 14px' }}>
        ← Back to Menu
      </button>
      <h1 style={{ fontFamily: 'var(--font-header)', color: 'var(--gold-bright)', marginTop: 24 }}>Characters</h1>
      <p style={{ color: 'var(--ink-dim)', maxWidth: 620 }}>Each save slot holds one character. Slot 1 is your active adventure; the rest are spare slots you can import saves into.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720, marginTop: 24 }}>
        {Array.from({ length: MAX_SLOTS }, (_, slot) => {
          const meta = slots[slot];
          const active = slot === activeSlot;
          return (
            <div
              key={slot}
              style={{
                border: `1px solid ${active ? 'var(--gold-stud)' : 'var(--panel-edge)'}`,
                borderRadius: 8,
                padding: 16,
                background: 'linear-gradient(#1a1e27, #12151c)',
                boxShadow: active ? '0 0 0 1px var(--gold-trim)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-header)', color: 'var(--gold-bright)', fontSize: 16 }}>
                    Slot {slot + 1}
                    {active && <span style={{ marginLeft: 10, fontSize: 10, color: 'var(--gold)', letterSpacing: 1 }}>ACTIVE</span>}
                  </div>
                  <div style={{ color: 'var(--ink-dim)', fontSize: 14, marginTop: 4 }}>
                    {meta ? `${meta.name} · LV ${meta.level} · ${jobName(meta.jobId)}` : 'Empty'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {meta && (
                    <button style={panelBtn} onClick={() => onPlay(slot)}>
                      Play
                    </button>
                  )}
                  {meta && (
                    <button style={panelBtn} onClick={() => void onExport(slot)}>
                      Export
                    </button>
                  )}
                  <button style={panelBtn} onClick={() => setImportSlot(importSlot === slot ? null : slot)}>
                    Import
                  </button>
                  {meta && (
                    <button style={{ ...panelBtn, color: '#d98a8a' }} onClick={() => onDelete(slot)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {importSlot === slot && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste exported save JSON here…"
                    style={{
                      width: '100%',
                      minHeight: 90,
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: 'var(--ink)',
                      background: '#0c0f15',
                      border: '1px solid var(--panel-edge)',
                      borderRadius: 5,
                      padding: 8,
                      boxSizing: 'border-box',
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button style={panelBtn} onClick={onImportConfirm} disabled={!importText.trim()}>
                      Load into Slot {slot + 1}
                    </button>
                    <button
                      style={{ ...panelBtn, color: 'var(--ink-dim)' }}
                      onClick={() => {
                        setImportSlot(null);
                        setImportText('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
