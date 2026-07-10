import type { CooldownType, ParamName, Skill, SkillElement, SkillKind, SkillParamFunction, SkillParams, ShapeKind } from './types';

// ============================================================================
// Per-level param formulas. dmg/heal are MULTIPLIERS on the normal damage calc;
// the rest are literal per-level values (see design §"skill leveling").
// ============================================================================
const lin =
  (base: number, step: number): SkillParamFunction =>
  (lv) =>
    base + step * (lv - 1 + (lv >= 10 ? 1 : 0)); // Recover the -1 penalty on the 10th level, as reward for mastery
const flat =
  (v: number): SkillParamFunction =>
  () =>
    v;

// Cooldown/trigger are authored in SECONDS. `cooldown` may be a fixed number or a
// per-level function (level -> seconds, e.g. `lin(18, -2)` to shave 2s/level) and is
// folded into params.cooldown, so it can show in descriptions via {cooldown}. Legacy
// cooldownMs/triggerMs (in ms) still work for un-migrated calls.
function sk(s: {
  id: string;
  name: string;
  description: string;
  kind: SkillKind;
  target: string;
  element: SkillElement;
  shapeKind: ShapeKind;
  params?: SkillParams;
  mpCost?: number; // MP spent per cast (heroes only)
  trigger?: number; // auto-cast interval, in seconds
  triggerMs?: number; // legacy: same, in ms
  telegraphMs?: number;
  uses?: number;
  cooldown?: number | SkillParamFunction; // seconds — number = fixed, function = per-level
  cooldownMs?: number; // legacy: fixed cooldown in ms
  cooldownType?: CooldownType;
}): Skill {
  const { cooldown, cooldownMs, trigger, triggerMs, params = {}, ...rest } = s;
  // Precedence: the `cooldown` shorthand > an explicit params.cooldown > legacy cooldownMs.
  const cooldownParam = cooldown != null ? (typeof cooldown === 'function' ? cooldown : flat(cooldown)) : (params.cooldown ?? (cooldownMs != null ? flat(cooldownMs / 1000) : undefined));
  const trgMs = trigger != null ? Math.round(trigger * 1000) : triggerMs;
  return {
    cooldownType: 'passive',
    ...rest,
    description: rest.mpCost ? `${rest.mpCost} MP: ${rest.description}` : rest.description,
    params: cooldownParam ? { ...params, cooldown: cooldownParam } : params,
    cooldownMs: cooldownParam ? Math.round(cooldownParam(1) * 1000) : 0, // level-1 value backs the Hud passive-tag read
    ...(trgMs != null ? { triggerMs: trgMs } : {}),
  };
}

// ============================================================================
// Skills grouped by the job that grants them (see kitOf in engine/jobs).
// Buffs/debuffs/DoTs are data-only this pass; their mechanics land in Phase 2.
// ============================================================================
// prettier-ignore
export const SKILLS: Record<string, Skill[]> = {
  // --- Tier 0 ---
  beginner: [
    sk({ id: 'strike', name: 'Strike', description: 'Strike one adjacent foe for {dmg} damage.', kind: 'attack', target: 'melee', element: 'physical', shapeKind: 'point', params: { dmg: lin(1.0, 0.1) } }),
    sk({ id: 'stab', name: 'Stab', description: 'Stab two foes in a line for {dmg} damage.', kind: 'attack', target: 'melee', element: 'physical', shapeKind: 'line', params: { tiles: () => 2, dmg: lin(0.6, 0.08) }, mpCost: 4 }),
    sk({ id: 'recover', name: 'Recover', description: 'Restore {healPercentage} of max HP (cooldown: {cooldown}).', kind: 'heal', target: 'self', element: 'physical', shapeKind: 'self', params: { healPercentage: flat(0.5) }, uses: 1, cooldown: lin(150, -15), mpCost: 20 }),
  ],

  // --- Fighter ---
  fighter: [
    sk({ id: 'powerStrike', name: 'Power Strike', description: 'Strike one foe for {dmg} damage (cooldown: {cooldown}).', kind: 'attack', target: 'melee', element: 'earth', shapeKind: 'point', params: { dmg: lin(1.5, 0.25) }, uses: 3, cooldown: 15 }),
    sk({ id: 'cleave', name: 'Cleave', description: 'Sweep {tiles} tiles in front for {dmg} damage.', kind: 'attack', target: 'adjacent-arc', element: 'earth', shapeKind: 'arc', params: { dmg: lin(0.8, 0.12), tiles: flat(3) }, mpCost: 6 }),
    sk({ id: 'spinSlash', name: 'Spin Slash', description: 'Whirl, hitting {tiles} surrounding tiles for {dmg} damage.', kind: 'attack', target: 'area', element: 'earth', shapeKind: 'area', params: { dmg: lin(1.1, 0.15), tiles: flat(8) }, mpCost: 14 }), // TODO: 8-adjacent (surround) shape
    sk({ id: 'bracingGuard', name: 'Bracing Guard', description: 'Brace, blocking physical damage for {dur}s (cooldown: {cooldown}).', kind: 'buff', target: 'self', element: 'earth', shapeKind: 'self', params: { dur: flat(5) }, cooldown: lin(20, -1), cooldownType: 'active' }), // TODO: block physical damage components for the duration
  ],
  knight: [
    sk({ id: 'aegisBastion', name: 'Aegis Bastion', description: 'Shield the block, absorbing {dmg} for {dur}s.', kind: 'buff', target: 'block', element: 'light', shapeKind: 'party', params: { dmg: lin(1.0, 0.25), dur: lin(4, 1) }, cooldownMs: 8000, cooldownType: 'active' }),
    sk({ id: 'provocation', name: 'Provocation', description: 'Force {targets} foes to target you for {dur}s.', kind: 'debuff', target: 'area', element: 'light', shapeKind: 'area', params: { targets: lin(2, 1), dur: lin(3, 1) }, cooldownMs: 5000 }),
    sk({ id: 'earthsmash', name: 'Earthsmash', description: 'Smash {tiles} tiles for {dmg}, stunning for {dur}s.', kind: 'attack', target: 'adjacent-arc', element: 'light', shapeKind: 'arc', params: { tiles: lin(3, 0.5), dmg: lin(1.1, 0.2), dur: lin(1, 0.25) }, cooldownMs: 4000 }),
  ],
  paladin: [
    sk({ id: 'radiantSmite', name: 'Radiant Smite', description: 'Holy strike across {tiles} tiles for {dmg}.', kind: 'attack', target: 'area (cross)', element: 'light', shapeKind: 'cross', params: { tiles: lin(3, 1), dmg: lin(1.0, 0.2) } }),
    sk({ id: 'swordRain', name: 'Sword Rain', description: 'Strike two tiles ahead for {dmg}.', kind: 'attack', target: 'area', element: 'light', shapeKind: 'area', params: { dmg: lin(0.9, 0.15), tiles: flat(4) } }),
    sk({ id: 'hallowedGround', name: 'Hallowed Ground', description: 'Bless {tiles} tiles: allies on them heal {heal}/round for {dur}s.', kind: 'buff', target: 'area', element: 'light', shapeKind: 'party', params: { tiles: lin(3, 1), heal: lin(0.4, 0.1), dur: lin(4, 1) }, cooldownMs: 8000, cooldownType: 'active' }),
  ],
  duelist: [
    sk({ id: 'mirrorRiposte', name: 'Mirror Riposte', description: 'Counter the next hit and retaliate for {dmg}.', kind: 'attack', target: 'melee (reactive)', element: 'physical', shapeKind: 'melee', params: { dmg: lin(1.3, 0.25) } }),
    sk({ id: 'vipersLunge', name: "Viper's Lunge", description: 'Dash to a foe and strike for {dmg}.', kind: 'attack', target: 'melee-dash', element: 'physical', shapeKind: 'line', params: { dmg: lin(1.1, 0.2) } }),
    sk({ id: 'crimsonSlash', name: 'Crimson Slash', description: 'Wound a foe for {dmg} and cut its damage {pct}% for {dur}s.', kind: 'debuff', target: 'melee', element: 'physical', shapeKind: 'melee', params: { dmg: lin(1.0, 0.15), pct: lin(15, 4), dur: lin(3, 1) } }),
  ],

  // --- Archer ---
  archer: [
    sk({ id: 'piercingShot', name: 'Piercing Shot', description: 'Pierce {tiles} tiles in a line for {dmg} damage.', kind: 'attack', target: 'line', element: 'air', shapeKind: 'line', params: { dmg: lin(0.8, 0.15), tiles: flat(4) }, mpCost: 10 }),
    sk({ id: 'scatterShot', name: 'Scatter Shot', description: 'Scatter arrows over {tiles} tiles for {dmg} damage.', kind: 'attack', target: 'arc', element: 'air', shapeKind: 'arc', params: { dmg: lin(1.2, 0.2), tiles: flat(3) }, mpCost: 16 }), // TODO: offset 2 tiles out
    sk({ id: 'powerKnockback', name: 'Power Knockback', description: 'Blast one foe for {dmg} damage (cooldown: {cooldown}).', kind: 'attack', target: 'ranged', element: 'air', shapeKind: 'point', params: { dmg: lin(1.4, 0.2) }, uses: 2, cooldown: lin(30, -1) }), // TODO: knockback (push foe up to 3 tiles)
    sk({ id: 'improvedCritical', name: 'Improved Critical', description: 'Passive: +{crit} crit chance, +{critDmg} crit damage.', kind: 'buff', target: 'self (passive)', element: 'air', shapeKind: 'self', params: { crit: lin(5, 2), critDmg: lin(10, 4) } }), // TODO: passive crit boost (unwired)
  ],
  hunter: [
    sk({ id: 'arrowRain', name: 'Arrow Rain', description: 'Rain arrows in a 2x3 shape for {dmg} damage.', kind: 'attack', target: 'line', element: 'air', shapeKind: 'area', params: { dmg: lin(0.8, 0.15), tiles: flat(6) }, triggerMs: 1250 }),
    sk({ id: 'hobblingShot', name: 'Hobbling Shot', description: 'Cripple a foe, slowing it {pct}% for {dur}s.', kind: 'debuff', target: 'ranged', element: 'air', shapeKind: 'point', params: { pct: lin(20, 5), dur: lin(3, 1) } }),
    sk({ id: 'strafe', name: 'Strafe', description: 'Fire {uses} arrows in a line, {dmg} per shot.', kind: 'attack', target: 'ranged', element: 'air', shapeKind: 'line', params: { uses: lin(3, 0.5), dmg: lin(0.6, 0.1) }, triggerMs: 1000 }),
  ],
  sniper: [
    sk({ id: 'deadeyeMark', name: 'Deadeye Mark', description: 'Mark a foe; crit rate on it +{pct}%.', kind: 'debuff', target: 'ranged', element: 'air', shapeKind: 'point', params: { pct: lin(20, 5) } }),
    sk({ id: 'heavenPierce', name: 'Heaven Pierce', description: 'A slow shot piercing an entire line for {dmg}.', kind: 'attack', target: 'line', element: 'air', shapeKind: 'line', params: { dmg: lin(1.4, 0.3), tiles: lin(4, 1) }, triggerMs: 2250 }),
    sk({ id: 'finishingBlow', name: 'Finishing Blow', description: 'Massive shot for {dmg}; +{pct}% versus low-HP foes.', kind: 'attack', target: 'ranged', element: 'air', shapeKind: 'point', params: { dmg: lin(2.0, 0.4), pct: lin(20, 5) }, uses: 1, cooldownMs: 7000, cooldownType: 'active' }),
  ],
  ranger: [
    sk({ id: 'wardOfTheWild', name: 'Ward of the Wild', description: 'Shield the party for {dmg} over {dur}s.', kind: 'buff', target: 'party', element: 'earth', shapeKind: 'party', params: { dmg: lin(0.5, 0.1), dur: lin(4, 1) }, cooldownMs: 7000, cooldownType: 'active' }),
    sk({ id: 'quarrysMark', name: "Quarry's Mark", description: 'Mark a foe; it takes +{pct}% crit for {dur}s.', kind: 'debuff', target: 'ranged', element: 'earth', shapeKind: 'point', params: { pct: lin(15, 4), dur: lin(4, 1) } }),
    sk({ id: 'graspingThorns', name: 'Grasping Thorns', description: 'Root every foe on {tiles} tiles for {dur}s.', kind: 'debuff', target: 'area', element: 'earth', shapeKind: 'area', params: { tiles: lin(3, 1), dur: lin(2, 0.5) }, cooldownMs: 5000 }),
  ],

  // --- Magician ---
  magician: [
    sk({ id: 'magicClaw', name: 'Magic Claw', description: 'Claw {tiles} tiles {hits} times for {dmg} damage each.', kind: 'attack', target: 'adjacent-arc', element: 'arcane', shapeKind: 'arc', params: { dmg: lin(0.6, 0.08), tiles: flat(3), hits: flat(2) }, mpCost: 12 }), // TODO: non-piercing + multi-hit
    sk({ id: 'crossBlast', name: 'Cross Blast', description: 'Blast the diagonal tiles for {dmg} damage (cooldown: {cooldown}).', kind: 'attack', target: 'area (cross)', element: 'arcane', shapeKind: 'cross', params: { dmg: lin(1.0, 0.15) }, mpCost: 16, uses: 4, cooldown: lin(20, -1) }), // TODO: diagonal cross (hits diagonals, not orthogonals)
    sk({ id: 'arcaneArc', name: 'Arcane Arc', description: 'Detonate {tiles} tiles for {dmg} damage after a delay.', kind: 'attack', target: 'arc', element: 'arcane', shapeKind: 'arc', params: { dmg: lin(1.6, 0.2), tiles: flat(5) }, mpCost: 22, telegraphMs: 5000 }), // TODO: player-side AoE telegraph (5s delay); offset 3 tiles out
    sk({ id: 'shockingGrasp', name: 'Shocking Grasp', description: 'Shock one foe for {dmg}, slowing it {pct}% for {dur}s (cooldown: {cooldown}).', kind: 'attack', target: 'melee', element: 'arcane', shapeKind: 'point', params: { dmg: lin(1.4, 0.2), pct: lin(25, 5), dur: lin(4, 0.4) }, mpCost: 8, cooldown: lin(30, -1) }), // TODO: slow status (pct% for dur s)
  ],
  arcanist: [
    sk({ id: 'arcaneCataclysm', name: 'Arcane Cataclysm', description: 'Detonate {tiles} tiles for {dmg} after {delay}s.', kind: 'attack', target: 'area', element: 'arcane', shapeKind: 'area', params: { tiles: lin(3, 1), dmg: lin(1.2, 0.25), delay: lin(1, 0.1) }, cooldownMs: 5000 }),
    sk({ id: 'catsGrace', name: "Cat's Grace", description: 'Grant an ally +{pct}% dexterity.', kind: 'buff', target: 'area', element: 'arcane', shapeKind: 'party', params: { pct: lin(15, 4) }, cooldownMs: 6000, cooldownType: 'active' }),
    sk({ id: 'chronostasis', name: 'Chronostasis', description: "Freeze a foe's cast timer for {dur}s.", kind: 'debuff', target: 'single', element: 'arcane', shapeKind: 'point', params: { dur: lin(2, 0.5) }, cooldownMs: 8000, cooldownType: 'active' }),
  ],
  wizard: [
    sk({ id: 'cinderstorm', name: 'Cinderstorm', description: 'Burn {tiles} tiles for {dmg} and apply Ignite.', kind: 'attack', target: 'area', element: 'fire', shapeKind: 'area', params: { tiles: lin(3, 0.5), dmg: lin(1.1, 0.2) }, triggerMs: 1750 }),
    sk({ id: 'emberLance', name: 'Ember Lance', description: 'Spear a line of foes for {dmg}.', kind: 'attack', target: 'line', element: 'fire', shapeKind: 'line', params: { dmg: lin(1.2, 0.2), tiles: lin(3, 0.5) } }),
    sk({ id: 'immolation', name: 'Immolation', description: 'Ignite a foe for {pct}% max HP/round over {dur}s.', kind: 'dot', target: 'single', element: 'fire', shapeKind: 'point', params: { pct: lin(10, 2), dur: lin(3, 1) } }),
  ],
  druid: [
    sk({ id: 'verdantWellspring', name: 'Verdant Wellspring', description: 'Heal all allies on {tiles} tiles for {heal}.', kind: 'heal', target: 'area', element: 'earth', shapeKind: 'party', params: { tiles: lin(3, 1), heal: lin(0.5, 0.1) }, triggerMs: 2000 }),
    sk({ id: 'avalanche', name: 'Avalanche', description: 'Crush {tiles} tiles for {dmg} after {delay}s.', kind: 'attack', target: 'area', element: 'earth', shapeKind: 'area', params: { tiles: lin(3, 1), dmg: lin(1.3, 0.25), delay: lin(1, 0.1) }, cooldownMs: 4000 }),
    sk({ id: 'blessing', name: 'Blessing', description: 'Grant all allies +{pct}% damage for {dur}s.', kind: 'buff', target: 'ally', element: 'earth', shapeKind: 'party', params: { pct: lin(15, 4), dur: lin(4, 1) }, cooldownMs: 7000, cooldownType: 'active' }),
  ],

  // --- Rogue ---
  rogue: [
    sk({ id: 'doubleStrike', name: 'Double Strike', description: 'Stab one foe {hits} times for {dmg} damage each.', kind: 'attack', target: 'melee', element: 'dark', shapeKind: 'point', params: { dmg: lin(0.6, 0.04), hits: flat(2) }, mpCost: 6, trigger: 1 }), // TODO: multi-hit
    sk({ id: 'venomSlash', name: 'Venom Slash', description: 'Slash {tiles} tiles for {dmg} damage, {pct}% to poison (cooldown: {cooldown}).', kind: 'attack', target: 'adjacent-arc', element: 'dark', shapeKind: 'arc', params: { dmg: lin(1.0, 0.08), tiles: flat(3), pct: flat(75) }, mpCost: 10, trigger: 1, uses: 2, cooldown: lin(30, -1) }), // TODO: poison status (pct% chance)
    sk({ id: 'hamstring', name: 'Hamstring', description: 'Cut {tiles} tiles for {dmg}, slowing {pct}% for {dur}s.', kind: 'attack', target: 'adjacent-arc', element: 'dark', shapeKind: 'arc', params: { dmg: lin(0.8, 0.1), tiles: flat(3), pct: lin(40, 2), dur: flat(5) }, mpCost: 16 }), // TODO: non-piercing + slow status
    sk({ id: 'lifeOrDeath', name: 'Life and Death', description: 'Deal and take +50% damage for {dur}s (cooldown: {cooldown}).', kind: 'buff', target: 'self', element: 'dark', shapeKind: 'self', params: { dur: lin(4, 0.04) }, cooldown: lin(20, -0.5), cooldownType: 'active' }), // TODO: +50% damage dealt AND received for the duration
  ],
  assassin: [
    sk({ id: 'venom', name: 'Venom', description: 'Poison a foe for {pct}% max HP/round over {dur}s.', kind: 'dot', target: 'melee', element: 'dark', shapeKind: 'melee', params: { pct: lin(10, 2), dur: lin(3, 1) } }),
    sk({ id: 'assassinate', name: 'Assassinate', description: 'Strike for {dmg}; +{pct}% per affliction on the foe.', kind: 'attack', target: 'melee', element: 'dark', shapeKind: 'melee', params: { dmg: lin(1.5, 0.3), pct: lin(15, 4) }, uses: 2, cooldownMs: 4000 }),
    sk({ id: 'expose', name: 'Expose', description: 'Rupture a foe, raising damage it takes {pct}% for {dur}s.', kind: 'debuff', target: 'melee', element: 'dark', shapeKind: 'melee', params: { pct: lin(20, 5), dur: lin(3, 1) } }),
  ],
  shadower: [
    sk({ id: 'nightshroud', name: 'Nightshroud', description: 'Gain {pct}% dodge for {dur}s.', kind: 'buff', target: 'self', element: 'dark', shapeKind: 'self', params: { pct: lin(20, 5), dur: lin(3, 1) }, cooldownMs: 6000, cooldownType: 'active' }),
    sk({ id: 'umbralFlurry', name: 'Umbral Flurry', description: 'Land {hits} shadow strikes for {dmg} each.', kind: 'attack', target: 'melee', element: 'dark', shapeKind: 'melee', params: { hits: lin(3, 0.5), dmg: lin(0.7, 0.1) }, triggerMs: 1000 }),
    sk({ id: 'smokeBomb', name: 'Smoke Bomb', description: 'Blast {tiles} area for {dmg} damage, {pct}% miss chance for {dur}s.', kind: 'attack', target: 'area', element: 'dark', shapeKind: 'area', params: { tiles: lin(3, 0.5), dmg: lin(0.9, 0.15), pct: lin(15, 4), dur: lin(2, 0.5) }, cooldownMs: 5000 }),
  ],
  ninja: [
    sk({ id: 'thousandStars', name: 'Thousand Stars', description: 'Scatter stars over {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'dark', shapeKind: 'area', params: { tiles: lin(3, 0.5), dmg: lin(0.7, 0.1) }, triggerMs: 750 }),
    sk({ id: 'ensnaringWeb', name: 'Ensnaring Web', description: 'Snare {tiles} tiles, slowing foes {pct}% for {dur}s.', kind: 'debuff', target: 'area', element: 'dark', shapeKind: 'area', params: { tiles: lin(3, 0.5), pct: lin(20, 5), dur: lin(3, 1) }, cooldownMs: 5000 }),
    sk({ id: 'blindingAsh', name: 'Blinding Ash', description: 'Blind {targets} foes, {pct}% miss chance for {dur}s.', kind: 'debuff', target: 'area', element: 'dark', shapeKind: 'area', params: { targets: lin(2, 1), pct: lin(20, 5), dur: lin(2, 0.5) }, cooldownMs: 6000 }),
  ],

  // --- Enemy skills ---
  slime: [sk({ id: 'dissolve', name: 'Dissolve', description: 'Dissolve a foe for {dmg} damage.', kind: 'attack', target: 'melee', element: 'physical', shapeKind: 'melee', params: { dmg: lin(1.0, 0.1) } })],
  bat: [sk({ id: 'sonicBite', name: 'Sonic Bite', description: 'Bite for {dmg} damage.', kind: 'attack', target: 'melee', element: 'physical', shapeKind: 'melee', params: { dmg: lin(1.1, 0.1) }, triggerMs: 1250 })],
  spider: [sk({ id: 'venomFang', name: 'Venom Fang', description: 'Fang strike for {dmg} damage.', kind: 'attack', target: 'melee', element: 'dark', shapeKind: 'melee', params: { dmg: lin(0.95, 0.1) } })],
  mushroom: [sk({ id: 'sporeBurst', name: 'Spore Burst', description: 'Burst spores over an area for {dmg}.', kind: 'attack', target: 'area', element: 'earth', shapeKind: 'area', params: { dmg: lin(1.2, 0.15), tiles: flat(4) } })],
  golem: [sk({ id: 'boulderSmash', name: 'Boulder Smash', description: 'Smash the ground for {dmg} after {delay}s.', kind: 'attack', target: 'area', element: 'earth', shapeKind: 'area', params: { dmg: lin(1.4, 0.2), tiles: flat(4), delay: lin(1, 0.1) }, cooldownMs: 4000 })],

  // --- Generic enemy skills by class (fighter/archer/mage/rogue/leader) ---
  enemyClass: [
    sk({ id: 'enemyStrike', name: 'Strike', description: 'Strike a foe for {dmg} damage.', kind: 'attack', target: 'melee', element: 'physical', shapeKind: 'melee', params: { dmg: lin(1.0, 0.1) } }),
    sk({ id: 'enemyShot', name: 'Shot', description: 'Loose a shot at a foe for {dmg}.', kind: 'attack', target: 'ranged', element: 'physical', shapeKind: 'point', params: { dmg: lin(0.9, 0.1) } }),
    sk({ id: 'enemyHex', name: 'Hex', description: 'Blast {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'arcane', shapeKind: 'area', params: { dmg: lin(1.4, 0.12), tiles: flat(6) }, uses: 1, triggerMs: 1750, telegraphMs: 4000 }),
    sk({ id: 'enemyGouge', name: 'Gouge', description: 'Gouge {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'dark', shapeKind: 'area', params: { dmg: lin(1.4, 0.12), tiles: flat(3) }, uses: 2, triggerMs: 1000, cooldownMs: 5000, telegraphMs: 3000 }),
    sk({ id: 'enemyRuin', name: 'Ruin', description: 'Devastate {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'earth', shapeKind: 'area', params: { dmg: lin(1.8, 0.2), tiles: flat(12) }, uses: 2, cooldownMs: 10000, telegraphMs: 5000 }),
  ],

  // --- Biome-themed enemy skills: same structure as enemyClass, re-themed element+name per biome ---
  // forest → earth (roots/thorns/bramble/vines/grove)
  enemyForest: [
    sk({ id: 'forestStrike', name: 'Root Strike', description: 'Lash a foe with roots for {dmg} damage.', kind: 'attack', target: 'melee', element: 'earth', shapeKind: 'melee', params: { dmg: lin(1.0, 0.1) } }),
    sk({ id: 'forestShot', name: 'Thorn Shot', description: 'Loose a thorn at a foe for {dmg}.', kind: 'attack', target: 'ranged', element: 'earth', shapeKind: 'point', params: { dmg: lin(0.9, 0.1) } }),
    sk({ id: 'forestHex', name: 'Bramble Snare', description: 'Ensnare {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'earth', shapeKind: 'area', params: { dmg: lin(1.4, 0.12), tiles: flat(6) }, uses: 1, triggerMs: 1750, telegraphMs: 4000 }),
    sk({ id: 'forestGouge', name: 'Vine Lash', description: 'Whip {tiles} tiles with vines for {dmg}.', kind: 'attack', target: 'area', element: 'earth', shapeKind: 'area', params: { dmg: lin(1.3, 0.12), tiles: flat(3) }, uses: 2, triggerMs: 1000, cooldownMs: 5000, telegraphMs: 3000 }),
    sk({ id: 'forestRuin', name: 'Grovewrath', description: 'Erupt {tiles} tiles of grove for {dmg}.', kind: 'attack', target: 'area', element: 'earth', shapeKind: 'area', params: { dmg: lin(1.8, 0.2), tiles: flat(12) }, uses: 2, cooldownMs: 10000, telegraphMs: 5000 }),
  ],
  // lake → ice (frost/mist/tide/chill)
  enemyLake: [
    sk({ id: 'lakeStrike', name: 'Frost Strike', description: 'Strike a foe with frost for {dmg} damage.', kind: 'attack', target: 'melee', element: 'ice', shapeKind: 'melee', params: { dmg: lin(1.0, 0.1) } }),
    sk({ id: 'lakeShot', name: 'Icicle Shot', description: 'Hurl an icicle at a foe for {dmg}.', kind: 'attack', target: 'ranged', element: 'ice', shapeKind: 'point', params: { dmg: lin(0.95, 0.1) } }),
    sk({ id: 'lakeHex', name: 'Mist Veil', description: 'Chill {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'ice', shapeKind: 'area', params: { dmg: lin(1.4, 0.12), tiles: flat(6) }, uses: 1, triggerMs: 1750, telegraphMs: 4000 }),
    sk({ id: 'lakeGouge', name: 'Chill Rend', description: 'Rend {tiles} tiles with frost for {dmg}.', kind: 'attack', target: 'area', element: 'ice', shapeKind: 'area', params: { dmg: lin(1.4, 0.12), tiles: flat(3) }, uses: 2, triggerMs: 1000, cooldownMs: 5000, telegraphMs: 3000 }),
    sk({ id: 'lakeRuin', name: 'Deluge', description: 'Flood {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'ice', shapeKind: 'area', params: { dmg: lin(1.9, 0.2), tiles: flat(12) }, uses: 2, cooldownMs: 10000, telegraphMs: 5000 }),
  ],
  // deepForest → dark (shadow/gloom/dread/umbra)
  enemyDeep: [
    sk({ id: 'deepStrike', name: 'Shadow Strike', description: 'Strike a foe from shadow for {dmg} damage.', kind: 'attack', target: 'melee', element: 'dark', shapeKind: 'melee', params: { dmg: lin(1.05, 0.1) } }),
    sk({ id: 'deepShot', name: 'Gloom Bolt', description: 'Loose a gloom bolt at a foe for {dmg}.', kind: 'attack', target: 'ranged', element: 'dark', shapeKind: 'point', params: { dmg: lin(0.9, 0.1) } }),
    sk({ id: 'deepHex', name: 'Dread Hex', description: 'Curse {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'dark', shapeKind: 'area', params: { dmg: lin(1.5, 0.12), tiles: flat(6) }, uses: 1, triggerMs: 1750, telegraphMs: 4000 }),
    sk({ id: 'deepGouge', name: 'Umbra Rend', description: 'Rend {tiles} tiles with shadow for {dmg}.', kind: 'attack', target: 'area', element: 'dark', shapeKind: 'area', params: { dmg: lin(1.4, 0.12), tiles: flat(3) }, uses: 2, triggerMs: 1000, cooldownMs: 5000, telegraphMs: 3000 }),
    sk({ id: 'deepRuin', name: 'Witherstorm', description: 'Wither {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'dark', shapeKind: 'area', params: { dmg: lin(1.9, 0.2), tiles: flat(12) }, uses: 2, cooldownMs: 10000, telegraphMs: 5000 }),
  ],
};

// Flat id -> Skill lookup for the engine (runtime stores skill ids, not objects).
export const SKILL_INDEX: Record<string, Skill> = Object.fromEntries(
  Object.values(SKILLS)
    .flat()
    .map((s) => [s.id, s]),
);
export function getSkill(id: string): Skill {
  const s = SKILL_INDEX[id];
  if (!s) throw new Error(`Unknown skill: ${id}`);
  return s;
}

// Format one resolved param value. dmg/heal render as a computed number when
// `atk` is supplied, else as a ×multiplier.
function formatParam(name: ParamName, v: number, atk?: number): string {
  if (name === 'dmg' || name === 'heal') return atk != null ? String(Math.round(atk * v)) : `×${v.toFixed(2)}`;
  if (name === 'healPercentage') return `${Math.round(v * 100)}%`; // fraction of max HP -> "50%"
  if (name === 'cooldown') return `${+v.toFixed(1)}s`; // seconds -> "18s" / "1.4s"
  if (name === 'crit' || name === 'critDmg') return `${Math.round(v)}%`;
  if (name === 'dur' || name === 'delay') return String(Math.round(v * 10) / 10);
  return String(Math.round(v));
}

// A description split into literal text (t) and formatted value (name + v) parts.
export type DescPart = { t: string } | { name: ParamName; v: string };

// Interpolate a description at a level into parts, so callers can render values distinctly.
export function describeSkillParts(skill: Skill, level: number, atk?: number): DescPart[] {
  const parts: DescPart[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(skill.description))) {
    if (m.index > last) parts.push({ t: skill.description.slice(last, m.index) });
    const name = m[1] as ParamName;
    const fn = skill.params[name];
    if (fn) parts.push({ name, v: formatParam(name, fn(level), atk) });
    else parts.push({ t: `{${name}}` });
    last = m.index + m[0].length;
  }
  if (last < skill.description.length) parts.push({ t: skill.description.slice(last) });
  return parts;
}

// Interpolate a description at a level to a plain string (parts joined).
export function describeSkill(skill: Skill, level: number, atk?: number): string {
  return describeSkillParts(skill, level, atk)
    .map((p) => ('t' in p ? p.t : p.v))
    .join('');
}
