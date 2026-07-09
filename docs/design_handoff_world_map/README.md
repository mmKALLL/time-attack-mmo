# Handoff: World Map — Suomela

A hand-inked, thatched-parchment overworld map for the RPG, styled as an antique cartograph and based on the shape of Finland. Rendered at **1440 × 1860** (portrait). English labels with Finnish place names and a few Finnish hints.

---

## What's in this bundle
- **World Map.dc.html** — the source. A self-contained component that draws the whole map as SVG procedurally (coastline, sea, lakes, forests, hills, a mountain range, roads, region/sea labels, town + POI icons, cartouche, compass, scale bar, legend). Open in a browser to view/edit. Keep `support.js` beside it.
- **World Map.svg** — the exact rendered map as a standalone, **scalable** SVG (best asset for the game — crisp at any zoom). Loads the map fonts via an `@import` when opened in a browser.
- **screenshots/world_map.png** — 2880 × 3720 raster (2× of native), transparent-free, parchment background baked in.
- **screenshots/world_map.jpg** — same image as JPEG (~0.5 MB) for lighter embedding.
- **support.js** — the small runtime the `.dc.html` loads (only needed to open the source in a browser).

## Fidelity
High-fidelity, final art direction. The map is **vector** — prefer `World Map.svg` in-engine and scale it freely; use the PNG/JPG where a flat raster is easier. If recreating in another stack, the `.dc.html` logic is the source of truth for every coordinate.

---

## Style
- **Medium:** aged parchment — warm radial vignette (`#efe6c8`→`#d8c69a`), faint noise/stain overlays, a soft inner deckle-edge shadow.
- **Ink palette:** `#493523` (ink), `#6e563a` (mid ink), `#9c8560` (light ink / region + sea labels), `#eee2c2` (halo behind icons & labels), water `#cdd2bf` w/ shore `#6e563a`, forest green `#5f6a3f`, accent ochre `#a8552b`.
- **Discipline accents:** Warrior `#3f6690`, Archer `#3f7a4e`, Magician `#6b4e94`, Thief `#8a5030`.
- **Type:** IM Fell English (italic for POIs, small-caps "SC" for town names/titles), Cinzel available for display. Region & sea names are spaced, faded italic caps.
- **Line-work:** everything is thin ink strokes; icons are little pictographs with a parchment-colored fill so they sit on top of terrain cleanly.

## The map's content
**Job locations** (each an ink landmark icon + label; the four disciplines are keyed by color in the legend):
- **Townships — 1st job:** Savonlinna (castle, Warrior), Kuopio (tower, Archer), Jyväskylä (ridge, Magician), Varkaus (canal locks, Thief).
- **Great Cities — 2nd job:** Turku (castle+cathedral, Warrior), Tampere (old-town cityscape, Archer), Helsinki (cathedral, Magician), Oulu (market port, Thief).

**Points of interest** (icon + name): Kokkola, Mäntyharju, Lahti, Seinäjoki, Vaasa, Lappajärvi, Rovaniemi, Pori, Kotka, Ruka, Lieksa, Kajaani, Sodankylä, Utsjoki, Inari, Saana, Pallas, Salla, **Sudenpesä** (the Wolf's Nest wilderness park).

**Terrain & furniture:** recognizable Finland coastline (double-inked), Gulf coasts with aligned hachure ticks, the major lakes (Saimaa, Päijänne, Oulujärvi, Pielinen, Inarijärvi + smaller), forest stipple, Lapland hill hachure, a subtle **vertical Pallas mountain range** guarding the NW arm, a dotted **road network** linking the towns (roads stop short of town icons and skirt around lakes), faded region labels (Lappi, Pohjanmaa, Kainuu, Karjala, Uusimaa) and sea labels (Bothnia, Suomenlahti), a decorative cog-ship and sea-serpent, the **SUOMELA** title cartouche, an 8-point compass rose, a scale bar (leagues), and a full legend (symbols + the four class disciplines with their 1st/2nd-job towns).

## Regenerating the raster
The PNG/JPG were produced by rendering `World Map.svg` to a canvas at 2× and baking the `#e8dcbe` parchment background. Re-export at any size from the SVG for higher resolution.

> To view the source: open `World Map.dc.html` in a browser with `support.js` beside it. For engine use, prefer `World Map.svg`.
