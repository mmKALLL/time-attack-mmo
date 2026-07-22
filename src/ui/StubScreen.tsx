import type { ReactNode } from 'react';
import { useGame } from '../state/store';
import { translate, useLocale } from '../locales/i18n';

export function StubScreen({ title, children }: { title: string; children?: ReactNode }) {
  const setScene = useGame((s) => s.setScene);
  const locale = useLocale();
  const t = (key: string) => translate(key, locale);
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
        {t('ui.stub.backToGame')}
      </button>
      <h1 style={{ fontFamily: 'var(--font-header)', color: 'var(--gold-bright)', marginTop: 24 }}>{title}</h1>
      <p style={{ color: 'var(--ink-dim)', maxWidth: 560 }}>{t('ui.stub.placeholder')}</p>
      {children}
    </div>
  );
}
