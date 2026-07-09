# Handoff: Main Menu — Suomela MMO

A full-screen (1920×1080) animated title screen with a Finnish dusk-and-aurora scene.

## Files
- **src/** — the readable, un-minified source (edit these; infer structure from here):
  - `Main Menu.dc.html` — the screen: HTML template (title, menu, last-played panel, footer) + a `class Component` logic class that paints the animated background scene to `<canvas>`.
  - `sprites.js` — pixel-sprite engine (the hero on the dock, drawn to canvas).
  - `support.js` — the small template runtime the `.dc.html` loads.
  - To run: open `src/Main Menu.dc.html` in a browser with the two `.js` files beside it.
- **Main Menu.html** — bundled, offline, standalone build (inlined + minified). Quick-look only; NOT the source.

## The scene (all procedural, animated via requestAnimationFrame on a 1920×1080 canvas)
- Night sky gradient + twinkling star field.
- **Aurora** — three layered ribbons (green / cyan / violet) waving via stacked sines, with faint vertical curtains, additive-blended.
- Two **fell** (mountain) silhouette ranges with snow-cap flecks on the nearer one.
- **Moon** with soft radial glow + a shimmering reflection column on the water.
- Spruce **forest** treeline silhouette.
- **Lake** with drifting aurora/sky shimmer reflections.
- **Dock** with a hero (wizard sprite, idle bob) beside a flickering **campfire** casting warm additive light.
- Drifting **mist** bands and floating **spirit-motes** (fireflies).

## Overlay (HTML)
- Title **SUOMELA** (Cinzel 900, glow) + gold **MMO** + "THE NORTHERN REALM" eyebrow + tagline.
- Menu: Enter the Realm / Continue / Characters / World Map / Settings / Credits / Quit — hover reveals a diamond bullet + underline sweep (click handlers are stubs: wire to your router).
- **Last-played** panel: character portrait, name/class/level, faction + home-city badges, live realm-status line.
- Footer: copyright, version/build string, "servers online" indicator.

## Style
- Palette: night sky `#0b1020→#4a5f70`, aurora `#3ad89a`/`#7fd0e0`/`#b78fe0`, water `#2a4358→#101f2e`, gold `#e6c583`, ember `#f0873a`.
- Fonts: Cinzel (title/headings), Spectral (body/italics), Press Start 2P (small pixel labels).
- The hero portrait/sprite is drawn procedurally by `sprites.js`.

This is a **design reference** — reimplement against your React + TS + Pixi scaffold; the canvas draw loop in `Main Menu.dc.html` (`start()`) is the source of truth for the scene composition and animation.
