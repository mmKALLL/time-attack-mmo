# Handoff: Shop screen

A full-screen (1920×1080) Diablo II-style town merchant — buy / sell / equip, hover-inspect, class-fit highlighting.

## Files
- **src/** — the readable, un-minified source (edit these; infer structure from here):
  - `Shop.dc.html` — the screen: formatted HTML template + a `class Component` logic class (item model, buy/sell/equip, requirement checks, procedural item-icon renderer).
  - `sprites.js` — pixel-sprite engine (merchant + paperdoll character portraits).
  - `support.js` — the small template runtime the `.dc.html` loads.
  - To run: open `src/Shop.dc.html` in a browser with the two `.js` files beside it.
- **Shop.html** — bundled, offline, standalone build (inlined + minified). Quick-look only; NOT the source.

## Item model (as implemented)
- **Slots:** Weapon, Helmet, Armor, Gloves, Boots, Ring, Amulet.
- **Rarity:** Common / Uncommon / Rare / Epic / Legendary — affix count grows with rarity; drives border color + glow.
- **Affixes:** flat primary stats (+INT/STR/DEX/VIT), on-hit procs (e.g. "10% to Ignite"), elemental affinity/resist (+% fire dmg, resist ice). Color-coded in the tooltip (green stat / blue affinity / orange proc).
- **Requirements:** level, primary-stat (e.g. INT 40), class-gated weapons (Magician-only…), and a faction **rank** gate (e.g. "Embers: Honored") on rare+ items — rank is a requirement, not a cost. Shown only when the item actually has requirements; each line marked ✓ (met) / ✕ (unmet, red). Items you can't use are dimmed in the stock grid.
- **Currency:** Gold only. Sell price = 40% of buy price.
- **Consumables:** stack by qty (HP/MP potions tiered, stat/skill reset); gear is unique instances.

## Interactions
- **Hover** a cell → inspect it in the center tooltip.
- **Click** a stock item → buy; **click** a backpack item → sell; sold items become **re-buyable at the same price** (added back to the merchant stock) until the shop is closed.
- Tooltip also has explicit Buy / Sell / Equip / Unequip buttons; **Equip** appears only when the selected backpack item is usable.
- **Paperdoll** is a 3×3 group: (–)/helmet/amulet · weapon(large)/armor/gloves · (–)/boots/ring.
- Category tabs: All / Weapons / Armor / Goods.

## Style
- Skeuomorphic warm-dark: panels `#221d17→#15110c`, gold hairline `rgba(184,146,90,.32)`, Cinzel headings / Spectral body / Press Start 2P numerics.
- Rarity colors: Common `#b8b0a0` · Uncommon `#6fce8f` · Rare `#6f9ad0` · Epic `#b78fe0` · Legendary `#e0a53a`.
- Item icons are procedurally drawn to canvas (see `icon(kind, rarityColor, size)` in `Shop.dc.html`), tinted by rarity.
- Items are Finnish-folklore flavored across all four classes (Väinö's Rune Staff, Ukko's Warhammer, Tapio's Longbow, Näkki's Fang, Ring of the Aurora, Sampo Shard Pendant, Lingonberry Draughts…).

This is a **design reference** — reimplement the logic against your React + TS + Pixi scaffold; use the source for layout, palette, copy, the item schema, and the requirement/affix rules.
