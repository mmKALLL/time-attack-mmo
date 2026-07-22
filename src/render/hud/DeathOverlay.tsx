import { useGame } from '../../state/store';
import { translate, useLocale } from '../../locales/i18n';

// Shows when the controlled player is dead; Respawn returns them to Mäntyharju.
export function DeathOverlay() {
  const world = useGame((s) => s.world);
  const dispatch = useGame((s) => s.dispatch);
  const locale = useLocale();
  const t = (key: string) => translate(key, locale);
  const p = world.entities[world.playerId];
  if (p && p.hp > 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10,6,6,0.72)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-header)',
          fontSize: 64,
          fontWeight: 700,
          color: '#c9463c',
          letterSpacing: 4,
          textShadow: '0 2px 10px #000',
        }}
      >
        {t('ui.death.youDied')}
      </div>
      <button
        onClick={() => dispatch({ type: 'respawn' })}
        style={{
          marginTop: 24,
          fontFamily: 'var(--font-header)',
          fontSize: 18,
          color: 'var(--gold-bright)',
          background: 'linear-gradient(#232833, #151a22)',
          border: '1px solid var(--panel-edge)',
          borderRadius: 6,
          padding: '10px 26px',
          cursor: 'pointer',
        }}
      >
        {t('ui.death.respawn')}
      </button>
    </div>
  );
}
