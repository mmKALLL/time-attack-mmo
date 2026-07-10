import type { ReactNode } from 'react';
import { useGame } from '../state/store';

export function StubScreen({ title, children }: { title: string; children?: ReactNode }) {
  const setScene = useGame((s) => s.setScene);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        color: 'var(--ink)',
        fontFamily: 'var(--font-body)',
        padding: 48,
        background: 'radial-gradient(circle at 50% 30%, #14131a, #07080b 70%)',
      }}
    >
      <button
        onClick={() => setScene('dungeon')}
        style={{
          fontFamily: 'var(--font-header)',
          background: 'linear-gradient(#232833, #151a22)',
          color: 'var(--gold-bright)',
          border: '1px solid var(--panel-edge)',
          borderRadius: 5,
          padding: '6px 14px',
          cursor: 'pointer',
        }}
      >
        ← Back to Game
      </button>
      <h1 style={{ fontFamily: 'var(--font-header)', color: 'var(--gold-bright)', marginTop: 24 }}>{title}</h1>
      <p style={{ color: 'var(--ink-dim)', maxWidth: 560 }}>Placeholder screen — the engine, state store, and design tokens are all in place. Awaiting the Claude Design layout for this screen.</p>
      {children}
    </div>
  );
}
