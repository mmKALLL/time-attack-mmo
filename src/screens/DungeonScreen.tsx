import { useEffect } from 'react';
import type { Direction } from '../types';
import { useGame } from '../state/store';
import { startGameLoop } from '../app/GameLoop';
import { PixiStage } from '../render/PixiStage';
import { Hud } from '../render/hud/Hud';
import { DeathOverlay } from '../render/hud/DeathOverlay';

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export function DungeonScreen() {
  useEffect(() => startGameLoop(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return; // one cell per physical press; no auto-repeat spam
      const dir = KEY_TO_DIR[e.key];
      if (dir) {
        e.preventDefault();
        useGame.getState().enqueue({ type: 'move', dir });
        return;
      }
      if (e.key >= '1' && e.key <= '9') {
        useGame.getState().enqueue({ type: 'selectSkill', slot: Number(e.key) - 1 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <PixiStage />
      <Hud />
      <DeathOverlay />
    </>
  );
}
