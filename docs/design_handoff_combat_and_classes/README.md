# Handoff: Combat Screen & Class System

A single-player desktop RPG in an old-school MMO style (Ragnarok-Online-flavored dungeons, MapleStory-pace, D&D-Online build flexibility). Target resolution **1920×1080**, extensible into a real MMO later. This package covers **two** designs only:

1. **Dungeon Combat Screen** — the signature grid + "stuck-combat" gameplay HUD.
2. **Class Advancement doc** — the class/role/fusion system reference.

---

## About the design files

The `.dc.html` files in this bundle are **design references built in HTML** — high-fidelity prototypes that show the intended look and behavior. They are **not production code to copy verbatim**. The task is to **recreate these designs in the target codebase** using its own environment and patterns.

The developer has stated they are scaffolding **React + TypeScript + Pixi.js**. That is the right target for the combat screen (a scrolling tile/sprite world + DOM/overlay HUD): render the grid, sprites, attack-radius tinting, floating damage, and lighting in a **Pixi** stage; build the skeuomorphic HUD panels as **React** components layered over the canvas. The class-graph doc is a static reference — reproduce it as a React page (or just mine it for the data tables in this README).

To *open* the prototypes as-is: keep `support.js` (the tiny runtime the `.dc.html` files load) and `sprites.js` next to them and open the `.html` in a browser. `Dungeon Gameplay.dc.html` shows the combat screen in three lighting directions side by side; **the chosen direction is "A" (Emberdeep)** — warm torch-lit, crisp outlines. `CombatScreen.dc.html` is the reusable screen (prop `direction: "A" | "B" | "C"`, default A).

## Fidelity

**High-fidelity.** Final colors, typography, spacing, sprite art, and interactions. Recreate pixel-accurately using the values in the Design Tokens section. The pixel-art sprites in `sprites.js` are production-usable reference art (32×32, drawn procedurally) — you can port the generators or bake them to PNG spritesheets.

---

# SCREEN 1 — Dungeon Combat

## Purpose
The core gameplay view. The player walks a 64px tile grid; touching an enemy starts combat with **no screen transition**. Fighters "stick" into a single moving **block**; both sides auto-cast every 1.5s. The player manages an active skill, dodges telegraphed hits by walking, and grinds/quests.

## Canvas & grid
- Stage is a fixed **1920×1080** area. Tile size **64×64px** → a 30 × 16.875 grid.
- Two layers: **(a) the world** (tiles, sprites, attack-radius tint, block outline, floating damage, lighting) rendered on a canvas/Pixi stage that fills the stage; **(b) the HUD** — skeuomorphic panels absolutely positioned over the world.
- Cell → pixel: `x = col*64`, `y = row*64`. A 32×32 sprite is drawn at 2× (64px), anchored to the bottom of its cell with a soft contact-shadow ellipse.

## Core combat model (behavior)
- **Movement**: arrow keys, **exactly one cell per keypress**, no speed limit. Players may pass through each other; **enemies never overlap**.
- **Stick combat**: touching an enemy locks it to you — you become a rigid multi-cell block and drag stuck enemies as you move. More enemies (and allied players) can stick on, growing an **arbitrary-shaped block**. In the mock the block is a 9-unit irregular shape (3 players + 6 enemies).
- **Auto-cast**: every **1.5s** every combatant fires its active skill. A **square timer** on each unit (top-right of the cell) drains top→down over the 1.5s and flashes white at 0. Both sides are synced in the mock (per-unit desync is allowed).
- **Attack shapes / radii** (this is the key visual vocabulary — red/orange is reserved exclusively for attack radii):
  - **Current attack radius** (firing now) = **solid orange fill + bright orange border**, gently pulsing. Mock shows a **3×1** row (Ember Volley).
  - **Previewed / selected attack radius** (the skill you'd fire next) = **orange dashed outline**, dimmer, marching-ants animated. Mock shows a **2×2** (Fireball) footprint, including empty cells to show the area extends past current enemies.
- **Moving block outline** = a **dim white/grey** outline (`rgba(226,231,240,~0.4)`, 2px, faint white glow) tracing the union-perimeter of every stuck cell. This is the whole area that moves together. It is NOT orange.
- **Skill uses / cooldowns**: some skills have N uses before a cooldown; some cooldowns tick passively, others only while the skill is the selected active. Hotbar shows these states.
- **Hotkeys 1–9** switch the active skill.
- **Enemy targeting**: outside telegraphs, an enemy keeps hitting the nearest player it first engaged, from any of 8 adjacent directions.
- **Telegraphed AoE**: enemy area attacks warn **1–3 rounds** ahead. Movement is free (not turn-bound) so the player dodges by walking out — unless too many foes are stuck to them.
- **Ranged openers**: enemies own invisible "approach" tiles between themselves and the player (collision-checked against walls, not against other units); archers can strike while foes spend turns closing in.
- **Rogues** fire multiple attacks per round (2 at first job, 3 from second job on).
- **Status effects are brutal**: e.g. poison ≈ 10% max-HP/round; each active status raises the target's incoming crit chance (stacking spirals).
- **Balance**: enemy stats are symmetric to players — a same-level fight is ~50/50 (roguelite tension). Players typically hunt enemies ~5 levels below for fun grinding.
- **Roaming (non-combat) enemies** wander the room: they step **tile-to-tile in 3 discrete frames** (position lerps in thirds: 0, 1/3, 2/3, 1), then pause and pick a new orthogonal target. Their idle sprite animation is independent and unchanged by movement. They avoid walls, props, the combat block, and each other (no overlap).

## Floating combat text
- Numbers rise ~62px over ~1150ms and fade in the last 25%.
- White = normal hit, **orange + "!"** = critical (larger, e.g. `588!`), **green `+NNN`** = heal.
- Rendered in **Press Start 2P** with a 4px black stroke.

## HUD panels (skeuomorphic dark wood/metal + gold trim)
All panels share: background `linear-gradient(#232833, #151a22)`, 1px `#0a0d12` border, radius 5px, `box-shadow: inset 0 1px 0 #3d4757, inset 0 0 0 1px #2a3140, 0 8px 22px rgba(0,0,0,.62)`, an inner gold hairline `inset:3px; border:1px solid rgba(184,146,90,.32)`, and small `#c2a06a` corner studs.

| Panel | Position | Contents |
|---|---|---|
| **Zone banner** | top-center | "Whisperstone Caverns" (Cinzel 21px `#e6c583`) + "DEPTH III · RECOMMENDED LV 22–26" (12.5px `#a99a7c`, 2px tracking) |
| **Focus target** | top-center, below banner | 340px plaque: target name (Cinzel 15px) + "◆ ELITE" `#c96a4a` + "LV 25"; a 12px HP bar `linear-gradient(#e0574a,#9c2f28)` with `18,240 / 29,400`; status chips ("Stone Skin −20% phys" teal, "Enraged" amber) |
| **Party frames** | top-left, 322px | 3 members. Each: 44px portrait (sprite on `#0d1016`, gold border, level badge), name (Spectral 13.5px `#f2e8d2`) + class (10px, class-accent), HP bar (red) w/ `1490/1910`, MP bar (blue) + buff icon squares. Members: **Ravyn / Flame Ranger / Lv24** (ember), **Sable / Nimble Knight / Lv23** (cyan `#43c7c0`), **Orrin / Cinder Sage / Lv24** (violet `#a07ad0`). Active member row has an ember left-glow. |
| **Minimap** | top-right, 252×196 | Dark grid box with room rectangles + corridors, red enemy dots (glowing), a gold "!" quest marker, a rotating teal party diamond (pulses). Legend: "◆ You / ● Foe / ! Quest". |
| **Combat roster** | right, under minimap | "In Combat · 9-UNIT BLOCK". A 5×4 mini-grid diagram of the block shape (blue cells = players, red = enemies, gold = elite) + caption "Enemies are locked to your block. Allies may stick in." Then a list of enemy rows with red dot, name, level, mini HP bar. |
| **Combat log** | bottom-left, 440×184 | Tabs ALL/PARTY/COMBAT/SYSTEM (active tab raised). Lines with colored `[Combat]`/`[Party]`/`[System]` prefixes and highlighted numbers. A "Say ▸" input strip at the bottom. |
| **Skill hotbar** | bottom-center | 9 slots (62×62). Slot 1 active-selected (2px ember border + glow + a square auto-cast timer in the corner). Icons *are* the attack shape where relevant: slot 1 shows a 3×1 footprint on a 3×3 mini-grid, slot 6 a 2×2. States shown across the bar: uses pips (slot 2 = ●●○), cooldown (slot 3 dimmed w/ conic sweep + "4"), passive (slot 5 tagged "P"), an ultimate that's charging (slot 9, separated, 74% charge bar). Hotkey digit 1–9 in each slot's corner (Press Start 2P). Labels under slots (Cinzel 9px). |
| **Auto-cast + legend** | bottom-right, 236px | A big square timer (drains over 1.5s) + "AUTO-CAST · Both sides act every 1.5s". Legend swatches: orange fill = "Current attack radius", orange dashed = "Previewed / selected skill", grey outline = "Moving block (stuck together)". |

## Sprites in the mock
- Players: `ranger` (Flame Ranger, hooded ember archer w/ bow), `knight` (Nimble Knight, steel-blue duelist w/ twin daggers), `wizard` (Cinder Sage, violet robe + ember staff).
- Enemies: `slime`, `bat`, `spider`, `mushroom`, `golem` (elite). Props: `barrel`, `crate`, `chest`, `skull`, `torch` (animated flame).
- Each sprite has 2 animation frames. See the **Sprite system** section for the engine.

---

# SCREEN 2 — Class Advancement & Fusion Web

## Purpose
Reference for the class/role/skill system. Not an in-game screen; a design doc. Reproduce as a static React page or use it as the data source.

## The system (rules)
- **4 base jobs**, each branching into **3 second classes** that shift into distinct MMO roles → **12 second classes**.
- A character **levels two complete Beginner → 1st → 2nd paths**, then **fuses their two second classes into a 4th class layer**. **Any two** second classes can combine → **66 combinations**.
- A merged class carries each parent's **2–3 guaranteed skills** plus the duo's **2–3 specialized skills** (unique to that pair) = a **6–9 skill core** — *and keeps every skill earned along both full paths* (Beginner + both first jobs). Nothing is lost.
- Ascended ("High") forms extend the same rule later.
- Skill names are evocative and do **not** encode size/shape in the name.

## The 12 second classes (base → name · role · 3 guaranteed skills)

**Swordsman** (tanky, easy melee; 1v1 + adjacent 4/8-tile hits)
- **Knight** · Tank · Aegis Bastion, Undying Provocation, Earthshatter Bash
- **Paladin** · Healer · Radiant Smite, Hand of Dawn, Hallowed Ground
- **Duelist** · DPS · Mirror Riposte, Viper's Lunge, Crimson Disarm

**Archer** (nimble ranged; straight-line attacks only; opens at range)
- **Hunter** · DPS · Tempest Volley, Hobbling Shot, Relentless Barrage  *(fast attack, higher miss)*
- **Sniper** · DPS · Deadeye Mark, Heaven-Piercer, Killshot  *(slow, accurate crits)*
- **Ranger** · Support · Ward of the Wild, Quarry's Mark, Grasping Thorns  *(nature / buffs / arcane)*

**Magician** (slow mobber; big directional hitboxes; cooldown-heavy)
- **Arcane Mage** · Control · Arcane Cataclysm, Sundering Silence, Chronostasis
- **Fire Wizard** · DPS · Cinderstorm, Ember Lance, Immolation
- **Druid** · Healer · Verdant Wellspring, Avalanche, Ironbark Aegis

**Rogue** (glass cannon; close+far; stacks 2–3 attacks/round)
- **Assassin** · DPS · Venom Kiss, Mortal Ambush, Exposing Rupture
- **Shadower** · Bruiser · Nightshroud, Umbral Flurry, Ghostwalk
- **Ninja** · Control · Thousand Stars, Ensnaring Web, Blinding Ash

## Fusion matrix
A 12×12 grid; each upper-triangle cell = the merged class of that pair, a two-tone color blend of the two parents, labeled with its specialized-skill count (**+2** or **+3**). Diagonal = the pure second class (hatched). 66 fusions total.

## Anatomy example — Flame Ranger = Fire Wizard ✦ Ranger (9-skill core)
- **Guaranteed · Fire Wizard**: Cinderstorm (area·DPS), Ember Lance (DPS), Immolation (burn ·10%/rd)
- **Guaranteed · Ranger**: Ward of the Wild (party buff), Quarry's Mark (debuff·+crit taken), Grasping Thorns (snare)
- **Specialized · Flame Ranger only**: Phoenix Fusillade (signature), Wildfire Bloom (telegraphed), Scorched Heavens (crit·leaves burn)
- …plus everything carried from Beginner and both first jobs.

---

# Design Tokens

## Typography
- **Cinzel** (500/600/700) — headers, plaque titles, class names, hotbar labels.
- **Spectral** (400/500/600, +italic) — body, party names, log, quest copy.
- **Press Start 2P** — pixel numerics only: floating damage, hotkey digits, small timers.
- Google Fonts import used in the mock:
  `https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=Press+Start+2P&display=swap`

## Color — UI chrome
| Token | Hex |
|---|---|
| Panel top / bottom | `#232833` / `#151a22` (graph uses `#141922`) |
| Panel edge | `#0a0d12` |
| Bevel highlight | `#3d4757` / `#39414f` |
| Gold trim | `rgba(184,146,90,.32)` · studs `#c2a06a` |
| Gold text | `#e6c583` (bright), `#cca96b`, `#c2a06a`, `#b89a63` |
| Ink / dim ink | `#e9ddc4` / `#a99a7c`, `#9c927a`, `#8a8168` |
| HP bar | `#d8524a → #8f2b26`; enemy `#c9463c`; elite `#e0574a → #9c2f28` |
| MP bar | `#4a8fe0 → #2a5aa0` |
| Stage / void bg | `#07080b` |

## Color — combat world (Direction A "Emberdeep", the chosen look)
| Token | Value |
|---|---|
| Floor | `#4a4640` / `#524d45` (noise), grid line `#2e2b27` |
| Wall | top `#6b5f50`, bottom `#463d31` |
| Void | `#16130f` |
| Sprite outline | `#140f0c`, saturation ×1.06, brightness ×1.0 |
| Vignette strength / warmth / tint | 0.66 / 1.0 / `rgba(180,110,50,0.06)` |
| Current attack radius | fill `rgba(232,124,44,0.20–0.32)`, border `#f4922e` |
| Previewed attack radius | dashed `rgba(240,150,70,0.45–0.65)`, dash `[7,5]` |
| Moving-block outline | `rgba(226,231,240,0.40–0.54)`, 2px, white glow |
| Skill-timer square | player `#e08a3a` / enemy `#c9463c`, border `#e6c583` / `#e08a8a` |
| Ember accent family | `#e08a3a`, `#f0873a`, `#ffce6b` |

(The other two directions, for reference: **B "Brightsteel"** = brighter/more saturated, thicker 2px outlines, lighter floors; **C "Gloomlight"** = desaturated, heavier vignette, cool violet ambient. All three share one HUD.)

## Color — class roles (chip bg / text)
Tank `#16302c`/`#7fd0c0` · Healer `#16301c`/`#8fe0a0` · DPS `#3a1c1c`/`#e88a7a` · Support `#1c2340`/`#8fa8e0` · Control `#241a38`/`#b78fe0` · Bruiser `#2b2410`/`#e6c583`

## Color — class accents
swordsman `#7fa8cc` · archer `#6fce8f` · magician `#b78fe0` · rogue `#8f7ad6` · knight `#7fa8cc` · paladin `#d8c06a` · duelist `#b8925a` · hunter `#6fce8f` · sniper `#52b878` · ranger `#43b0a0` · arcane `#b78fe0` · fire wizard `#e08a3a` · druid `#8fbf6f` · assassin `#8f7ad6` · shadower `#6a5aa0` · ninja `#5aa0c0` · beginner/neutral gold `#c2a06a`

## Geometry
- Tile 64px; sprite grid 32×32 → drawn 2×. Slot 62px; portrait 44px; radius 4–7px on panels, 2–4px on cells/bars.
- 1.5s auto-cast cadence; 3-frame (thirds) tile-step for roamers; damage float ~1150ms.

---

# Sprite system (`sprites.js`)
Self-contained, no deps, exposes `window.Sprites`.
- Sprites are authored on a **32×32** grid via primitive fills (rects, ellipses, spans), then an **auto-outline** pass (1–2px, direction-dependent color) and a per-direction **saturation/brightness** post-process; results are cached per `name+frame+direction`.
- `Sprites.draw(ctx, name, frame, px, py, dirId, opts)` — blits nearest-neighbor at 2×, with a contact-shadow ellipse (`opts.shadow`, `opts.bob`, `opts.cell`).
- `Sprites.build(name, frame, dir)` returns the 32×32 offscreen canvas (use to bake PNG spritesheets).
- `Sprites.DIRS` = `{ A: {outline:'#140f0c',thick:1,sat:1.06,bri:1.0}, B: {outline:'#0a1017',thick:2,sat:1.18,bri:1.12}, C: {outline:'#181425',thick:1,sat:0.72,bri:0.9} }`.
- Builders: `slime, bat, spider, mushroom, golem, ranger, knight, wizard, barrel, crate, torch, chest, skull`. Each takes a frame index (0/1).
- Tile/wall helpers are inline in `CombatScreen.dc.html` (`buildBG`), not in `sprites.js`.

For Pixi: either port the generators to draw into RenderTextures once at load, or run `Sprites.build(...)` for every name/frame/direction and pack the canvases into a spritesheet/atlas.

---

# State (for a real implementation)
- **World**: player party (positions, stats, class, skills, active-skill index, HP/MP), enemy entities (position, stats, HP, status stacks, AI target, telegraph timers), the current **block** (set of stuck cells that move as one), roaming entities (tile, target-tile, step, next-move time).
- **Combat clock**: global 1.5s cadence driving auto-casts + the square timers.
- **Skills**: per-skill uses-remaining, cooldown remaining, cooldown mode (passive vs active-only), shape footprint, targeting.
- **Statuses**: stacks with per-round ticks (poison %HP) and a crit-taken modifier.
- **UI**: selected active skill (hotkeys 1–9), focus target, log buffer, minimap entities.

---

# Assets
- **Fonts**: Cinzel, Spectral, Press Start 2P (Google Fonts) — swap for the codebase's equivalents if it has a type system.
- **Sprite art**: procedural in `sprites.js` (no external images). Bake to PNG atlas or port generators.
- **`reference_battlemap.jpeg`**: the top-down stone-dungeon battle map the tile/prop art direction was based on (variable-size rooms, grey stone grid, scattered props). Reference only.
- No third-party brand assets are used.

# Screenshots (`screenshots/`)
- `combat_screen.png` — the full 1920×1080 combat screen (Direction A / Emberdeep).
- `class_graph_overview.png` — the whole class doc at a glance.
- `class_graph_tree.png` — advancement tree + second-class kits (readable).
- `class_graph_matrix_and_notes.png` — the 66-way fusion matrix, the Flame Ranger anatomy card, and the combat-rules notes (readable).

# Files in this bundle
- `CombatScreen.dc.html` — the combat screen (one instance; prop `direction`). **Primary reference.**
- `Dungeon Gameplay.dc.html` — presenter showing the combat screen in directions A/B/C side by side. Direction **A** is chosen.
- `Class Graph.dc.html` — the class/role/fusion reference doc.
- `sprites.js` — the pixel-sprite engine (`window.Sprites`).
- `support.js` — the tiny runtime the `.dc.html` files load (only needed to open the prototypes in a browser).
- `reference_battlemap.jpeg` — art-direction reference for the dungeon tiles.

> To view a prototype: open the `.html` file in a browser (all four files above must sit in the same folder). To implement: recreate in React + TypeScript + Pixi.js per the specs above; do not ship the HTML.
