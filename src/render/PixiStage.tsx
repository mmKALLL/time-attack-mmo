import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { DESIGN_W, DESIGN_H, COLORS } from '../config';
import { useGame } from '../state/store';
import { WorldRenderer } from './WorldRenderer';

// Mounts one Pixi Application, scales the 1920x1080 stage to the viewport,
// and redraws from the live engine state every animation frame.
export function PixiStage() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current!;
    const app = new Application();
    let renderer: WorldRenderer | null = null;
    let raf = 0;
    let disposed = false;
    let start = 0;

    const fit = () => {
      const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
      const c = app.canvas;
      c.style.transformOrigin = 'top left';
      c.style.transform = `scale(${scale})`;
      c.style.position = 'absolute';
      c.style.left = `${(window.innerWidth - DESIGN_W * scale) / 2}px`;
      c.style.top = `${(window.innerHeight - DESIGN_H * scale) / 2}px`;
    };

    (async () => {
      await app.init({ width: DESIGN_W, height: DESIGN_H, background: COLORS.stageBg, antialias: true });
      if (disposed) {
        app.destroy(true);
        return;
      }
      host.appendChild(app.canvas);
      fit();
      window.addEventListener('resize', fit);
      renderer = new WorldRenderer(app);

      const loop = (t: number) => {
        if (start === 0) start = t;
        renderer!.render(useGame.getState().world, t - start);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      renderer?.destroy();
      app.destroy(true);
    };
  }, []);

  return <div ref={hostRef} style={{ position: 'fixed', inset: 0 }} />;
}
