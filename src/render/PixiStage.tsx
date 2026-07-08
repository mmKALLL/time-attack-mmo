import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { DESIGN_W, DESIGN_H, COLORS } from '../config';
import { useGame } from '../state/store';
import { WorldRenderer } from './WorldRenderer';

// Mounts one Pixi Application that fills the viewport at the device's real pixel
// resolution, then scales the 1920x1080 design space onto the Pixi stage (not the
// canvas via CSS) so high-res art is downscaled directly — no blocky re-upscaling.
export function PixiStage() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current!;
    const app = new Application();
    let renderer: WorldRenderer | null = null;
    let raf = 0;
    let disposed = false;
    let initialized = false; // Pixi's resize system only exists post-init()
    let start = 0;

    // Map the 1920x1080 design onto the (letterboxed, centered) viewport.
    const fit = () => {
      const { width, height } = app.screen; // CSS px = viewport size (autoDensity)
      const scale = Math.min(width / DESIGN_W, height / DESIGN_H);
      app.stage.scale.set(scale);
      app.stage.position.set((width - DESIGN_W * scale) / 2, (height - DESIGN_H * scale) / 2);
    };

    (async () => {
      await app.init({ resizeTo: window, resolution: window.devicePixelRatio || 1, autoDensity: true, background: COLORS.stageBg, antialias: true });
      initialized = true;
      if (disposed) {
        // Unmounted (e.g. StrictMode double-invoke) before init resolved.
        app.destroy(true);
        return;
      }
      host.appendChild(app.canvas);
      fit();
      app.renderer.on('resize', fit); // resizeTo:window resizes the buffer; re-fit the stage
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
      renderer?.destroy();
      // Only destroy once init() has finished wiring up the app; otherwise the
      // pending init() branch above tears it down after it resolves.
      if (initialized) app.destroy(true);
    };
  }, []);

  return <div ref={hostRef} style={{ position: 'fixed', inset: 0 }} />;
}
