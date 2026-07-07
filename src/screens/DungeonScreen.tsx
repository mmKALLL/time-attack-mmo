import { useEffect } from 'react';
import type { Direction } from '../types';
import { MOVE_REPEAT_DELAY_MS, MOVE_REPEAT_MS } from '../config';
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
    // Held arrow keys: an immediate step, then after MOVE_REPEAT_DELAY_MS the
    // move auto-repeats at MOVE_REPEAT_MS; the newest held direction wins. We
    // drive our own timers instead of the OS key-repeat for a consistent feel.
    const held: Direction[] = [];
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let repeatTimer: ReturnType<typeof setInterval> | undefined;
    const step = () => {
      const dir = held[held.length - 1];
      if (dir) useGame.getState().enqueue({ type: 'move', dir });
    };
    const clearTimers = () => {
      if (delayTimer !== undefined) clearTimeout(delayTimer);
      if (repeatTimer !== undefined) clearInterval(repeatTimer);
      delayTimer = undefined;
      repeatTimer = undefined;
    };
    const scheduleRepeat = () => {
      clearTimers();
      delayTimer = setTimeout(() => {
        delayTimer = undefined;
        repeatTimer = setInterval(step, MOVE_REPEAT_MS);
      }, MOVE_REPEAT_DELAY_MS);
    };
    const onDown = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIR[e.key];
      if (dir) {
        e.preventDefault();
        if (e.repeat) return; // ignore OS repeat — our timers handle it
        if (!held.includes(dir)) held.push(dir);
        useGame.getState().enqueue({ type: 'move', dir }); // immediate step
        scheduleRepeat(); // ...then delay, then auto-repeat
        return;
      }
      if (e.key >= '1' && e.key <= '9') {
        useGame.getState().enqueue({ type: 'selectSkill', slot: Number(e.key) - 1 });
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIR[e.key];
      if (!dir) return;
      const i = held.indexOf(dir);
      if (i >= 0) held.splice(i, 1);
      if (held.length === 0) clearTimers();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      clearTimers();
    };
  }, []);

  return (
    <>
      <PixiStage />
      <Hud />
      <DeathOverlay />
    </>
  );
}
