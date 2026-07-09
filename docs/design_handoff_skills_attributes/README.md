# Handoff: Skills & Attributes screen

A self-contained, interactive 1920×1080 character screen for the RPG — stat allocation, per-skill leveling, live `describeSkill()` preview, and an attack-area shape preview.

## Files
- **src/** — the readable, un-minified source (edit these). This is the authoritative version to infer from:
  - `Skills and Attributes.dc.html` — the screen: a formatted HTML template + a `class Component` logic class (state, `deriveStats`, `describeSkill`, hover handlers). Read this, not the bundle.
  - `sprites.js` — procedural pixel-sprite engine (portrait + skill icons drawn to canvas).
  - `support.js` — the small template runtime the `.dc.html` loads.
  - To run: open `src/Skills and Attributes.dc.html` in a browser with the two `.js` files beside it (already are).
- **Skills and Attributes.html** — the bundled, offline, standalone build (all JS/fonts/art inlined and minified). Good for a quick look in a browser; NOT the source — don't infer structure from this file.

## What it demonstrates (behavior to port)
- **Primaries:** STR / DEX / VIT / INT, base 5 each. Spend from an **attribute pool** (+3/level).
- **Derived stats** computed exactly per the agreed `deriveStats(p, level, cls)`:
  - physical = str·4 + dex·2 ; magical = int·4 + dex·2
  - power = phys·physical + (1−phys)·magical ; maxDmg = round(power) ; minDmg = round(power·minDamageRatio)
  - maxHp = vit·30 + str·5 + level·10 + 15 ; maxMp = int·8 + level·2 − 2
  - def = vit·2 + str ; accuracy = dex·2 ; dodge = accuracy·0.25 ; crit = critCurve(dex·2 + int)
  - class combat mix (phys ratio + minDamageRatio) drives the damage split; sample class here is Fire Wizard (Magician: 20% phys / 80% mag, 0.6 floor).
- **Skills:** per-character level; Beginner caps at 5, later jobs cap at **10**. Respects `config.DEBUG` (skills start at Lv 2, labeled). Spend from a **skill pool** (+1/level). Grouped Beginner / 1st job / 2nd job, each row self-describing via templated `describeSkill()` (fills {dmg},{tiles},{pct},{dur}…).
- **Attack-area preview:** per-skill shape on a 5×5 grid, caster at (col 1, row 2) facing right; damage shown as a **range**; "NEXT LV ▸" before→after per-parameter scaling.
- **Hover preview:** hovering a stat's **+** previews affected derived stats as *old → new* (accent, no layout reflow); hovering a skill's **+** previews its next level.
- **XP:** `5·(level+5)^2.25`.

## Notes for reimplementation
- This is a **design reference**, not production code — it's a single bundled HTML with an inlined component runtime. Use it to read layout, spacing, palette, copy, and the exact number formulas; reimplement the logic against your React + TS + Pixi scaffold (`SkillRuntime`, `deriveStats`, `config.DEBUG`, etc.).
- Skeuomorphic dark palette: panels `#232833→#151a22`, gold hairline `rgba(184,146,90,.30)`, discipline accents STR `#6f9ad0` · DEX `#6fce8f` · VIT `#d8896a` · INT `#b78fe0`; skill element tints (fire `#f0873a`, arcane `#a78fe0`, ice `#7fc8e0`, holy/gold `#e6c583`).
- Fonts: Cinzel (headings), Spectral (body), Press Start 2P (numeric/pixel labels).
- Sprite art (portrait, skill icons) is procedurally drawn to canvas and inlined as data URLs.

To edit: change the source `Skills and Attributes.dc.html` in the project and re-export; do not hand-edit this bundled file.
