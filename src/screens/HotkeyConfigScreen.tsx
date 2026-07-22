import { StubScreen } from '../ui/StubScreen';
import { translate, useLocale } from '../locales/i18n';
import { useGame } from '../state/store';

// The Settings screen (still a stub for hotkeys) hosts the UI-language selector.
export function HotkeyConfigScreen() {
  const locale = useLocale();
  const setLocale = useGame((s) => s.setLocale);
  return (
    <StubScreen title={translate('ui.settings.title', locale)}>
      <div style={{ marginTop: 28 }}>
        {/* Static bilingual label so it reads for speakers of either language. */}
        <div style={{ fontFamily: 'var(--font-header)', color: 'var(--gold-bright)', fontSize: 14, letterSpacing: 1, marginBottom: 10 }}>言語 · Language</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['en', 'ja'] as const).map((lc) => (
            <button
              key={lc}
              onClick={() => setLocale(lc)}
              style={{
                fontFamily: 'var(--font-header)',
                fontSize: 14,
                padding: '6px 16px',
                cursor: 'pointer',
                borderRadius: 5,
                border: '1px solid var(--panel-edge)',
                background: locale === lc ? 'linear-gradient(#3a3020, #241c12)' : 'rgba(15,13,10,0.7)',
                color: locale === lc ? 'var(--gold-bright)' : 'var(--ink-dim)',
                letterSpacing: 1,
              }}
            >
              {lc === 'en' ? 'English' : '日本語'}
            </button>
          ))}
        </div>
      </div>
    </StubScreen>
  );
}
