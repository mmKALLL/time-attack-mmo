import { SIM_TICK_MS } from '../config';
import { useGame } from '../state/store';

// Fixed-timestep accumulator driven by requestAnimationFrame.
// Movement inputs are queued elsewhere; each sim step drains them.
export function startGameLoop(): () => void {
  let raf = 0;
  let last = 0;
  let acc = 0;
  let running = true;

  const frame = (t: number) => {
    if (!running) return;
    if (last === 0) last = t;
    acc = Math.min(acc + (t - last), SIM_TICK_MS * 5); // clamp to avoid spiral of death
    last = t;
    while (acc >= SIM_TICK_MS) {
      useGame.getState().advance(SIM_TICK_MS);
      acc -= SIM_TICK_MS;
    }
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}
