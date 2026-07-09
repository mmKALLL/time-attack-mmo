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
  const cooldownParam =
    cooldown != null ? (typeof cooldown === 'function' ? cooldown : flat(cooldown)) : (params.cooldown ?? (cooldownMs != null ? flat(cooldownMs / 1000) : undefined));
  const trgMs = trigger != null ? Math.round(trigger * 1000) : triggerMs;
  return {
    cooldownType: 'passive',
    ...rest,
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
    sk({ id: 'strike', name: 'Strike', description: 'Strike one adjacent foe for {dmg} damage.', kind: 'attack', target: 'melee', element: 'neutral', shapeKind: 'point', params: { dmg: lin(1.0, 0.1) } }),
    sk({ id: 'stab', name: 'Stab', description: 'Stab two foes in a line for {dmg} damage.', kind: 'attack', target: 'melee', element: 'neutral', shapeKind: 'line', params: { tiles: () => 2, dmg: lin(0.6, 0.08) } }),
    sk({ id: 'recover', name: 'Recover', description: 'Restore {healPercentage} of max HP (cooldown: {cooldown}s).', kind: 'heal', target: 'self', element: 'neutral', shapeKind: 'self', params: { healPercentage: flat(0.5) }, uses: 1, cooldown: lin(180, -12) }),
  ],

  // --- Fighter ---
  fighter: [
    sk({ id: 'powerStab', name: 'Power Stab', description: 'Strike one adjacent foe for {dmg} damage.', kind: 'attack', target: 'melee', element: 'steel', shapeKind: 'melee', params: { dmg: lin(1.4, 0.3) } }),
    sk({ id: 'cleave', name: 'Cleave', description: 'Sweep all {tiles} tiles in front for {dmg} damage.', kind: 'attack', target: 'adjacent-arc', element: 'steel', shapeKind: 'arc', params: { dmg: lin(0.9, 0.15), tiles: lin(3, 0.5) } }),
    sk({ id: 'bracingGuard', name: 'Bracing Guard', description: 'Raise defense by {pct}% for {dur}s.', kind: 'buff', target: 'self', element: 'steel', shapeKind: 'self', params: { pct: lin(15, 4), dur: lin(4, 1) }, cooldownMs: 6000, cooldownType: 'active' }),
  ],
  knight: [
    sk({ id: 'aegisBastion', name: 'Aegis Bastion', description: 'Shield the block, absorbing {dmg} for {dur}s.', kind: 'buff', target: 'block', element: 'guardian', shapeKind: 'party', params: { dmg: lin(1.0, 0.25), dur: lin(4, 1) }, cooldownMs: 8000, cooldownType: 'active' }),
    sk({ id: 'provocation', name: 'Provocation', description: 'Force {targets} foes to target you for {dur}s.', kind: 'debuff', target: 'area', element: 'guardian', shapeKind: 'area', params: { targets: lin(2, 1), dur: lin(3, 1) }, cooldownMs: 5000 }),
    sk({ id: 'earthsmash', name: 'Earthsmash', description: 'Smash {tiles} tiles for {dmg}, stunning for {dur}s.', kind: 'attack', target: 'adjacent-arc', element: 'guardian', shapeKind: 'arc', params: { tiles: lin(3, 0.5), dmg: lin(1.1, 0.2), dur: lin(1, 0.25) }, cooldownMs: 4000 }),
  ],
  paladin: [
    sk({ id: 'radiantSmite', name: 'Radiant Smite', description: 'Holy strike across {tiles} tiles for {dmg}.', kind: 'attack', target: 'area (cross)', element: 'holy', shapeKind: 'cross', params: { tiles: lin(3, 1), dmg: lin(1.0, 0.2) } }),
    sk({ id: 'swordRain', name: 'Sword Rain', description: 'Strike two tiles ahead for {dmg}.', kind: 'attack', target: 'area', element: 'holy', shapeKind: 'area', params: { dmg: lin(0.9, 0.15), tiles: flat(4) } }),
    sk({ id: 'hallowedGround', name: 'Hallowed Ground', description: 'Bless {tiles} tiles: allies on them heal {heal}/round for {dur}s.', kind: 'buff', target: 'area', element: 'holy', shapeKind: 'party', params: { tiles: lin(3, 1), heal: lin(0.4, 0.1), dur: lin(4, 1) }, cooldownMs: 8000, cooldownType: 'active' }),
  ],
  duelist: [
    sk({ id: 'mirrorRiposte', name: 'Mirror Riposte', description: 'Counter the next hit and retaliate for {dmg}.', kind: 'attack', target: 'melee (reactive)', element: 'blade', shapeKind: 'melee', params: { dmg: lin(1.3, 0.25) } }),
    sk({ id: 'vipersLunge', name: "Viper's Lunge", description: 'Dash to a foe and strike for {dmg}.', kind: 'attack', target: 'melee-dash', element: 'blade', shapeKind: 'line', params: { dmg: lin(1.1, 0.2) } }),
    sk({ id: 'crimsonSlash', name: 'Crimson Slash', description: 'Wound a foe for {dmg} and cut its damage {pct}% for {dur}s.', kind: 'debuff', target: 'melee', element: 'blade', shapeKind: 'melee', params: { dmg: lin(1.0, 0.15), pct: lin(15, 4), dur: lin(3, 1) } }),
  ],

  // --- Archer ---
  archer: [
    sk({ id: 'pierceShot', name: 'Pierce Shot', description: 'Fire a bolt in a straight line for {dmg} damage.', kind: 'attack', target: 'line', element: 'precision', shapeKind: 'line', params: { dmg: lin(1.0, 0.2) } }),
    sk({ id: 'doubleNock', name: 'Double Nock', description: 'Loose {hits} arrows at one target for {dmg} each.', kind: 'attack', target: 'ranged', element: 'precision', shapeKind: 'point', params: { hits: lin(2, 0.5), dmg: lin(0.7, 0.1) }, triggerMs: 1000 }),
    sk({ id: 'nimbleStep', name: 'Nimble Step', description: 'Gain {pct}% dodge for {dur}s.', kind: 'buff', target: 'self', element: 'precision', shapeKind: 'self', params: { pct: lin(15, 4), dur: lin(3, 1) }, cooldownMs: 6000, cooldownType: 'active' }),
  ],
  hunter: [
    sk({ id: 'arrowRain', name: 'Arrow Rain', description: 'Rain arrows in a 2x3 shape for {dmg} damage.', kind: 'attack', target: 'line', element: 'volley', shapeKind: 'area', params: { dmg: lin(0.8, 0.15), tiles: flat(6) }, triggerMs: 1250 }),
    sk({ id: 'hobblingShot', name: 'Hobbling Shot', description: 'Cripple a foe, slowing it {pct}% for {dur}s.', kind: 'debuff', target: 'ranged', element: 'volley', shapeKind: 'point', params: { pct: lin(20, 5), dur: lin(3, 1) } }),
    sk({ id: 'strafe', name: 'Strafe', description: 'Fire {uses} arrows in a line, {dmg} per shot.', kind: 'attack', target: 'ranged', element: 'volley', shapeKind: 'line', params: { uses: lin(3, 0.5), dmg: lin(0.6, 0.1) }, triggerMs: 1000 }),
  ],
  sniper: [
    sk({ id: 'deadeyeMark', name: 'Deadeye Mark', description: 'Mark a foe; crit rate on it +{pct}%.', kind: 'debuff', target: 'ranged', element: 'precision', shapeKind: 'point', params: { pct: lin(20, 5) } }),
    sk({ id: 'heavenPierce', name: 'Heaven Pierce', description: 'A slow shot piercing an entire line for {dmg}.', kind: 'attack', target: 'line', element: 'precision', shapeKind: 'line', params: { dmg: lin(1.4, 0.3), tiles: lin(4, 1) }, triggerMs: 2250 }),
    sk({ id: 'finishingBlow', name: 'Finishing Blow', description: 'Massive shot for {dmg}; +{pct}% versus low-HP foes.', kind: 'attack', target: 'ranged', element: 'precision', shapeKind: 'point', params: { dmg: lin(2.0, 0.4), pct: lin(20, 5) }, uses: 1, cooldownMs: 7000, cooldownType: 'active' }),
  ],
  ranger: [
    sk({ id: 'wardOfTheWild', name: 'Ward of the Wild', description: 'Shield the party for {dmg} over {dur}s.', kind: 'buff', target: 'party', element: 'nature', shapeKind: 'party', params: { dmg: lin(0.5, 0.1), dur: lin(4, 1) }, cooldownMs: 7000, cooldownType: 'active' }),
    sk({ id: 'quarrysMark', name: "Quarry's Mark", description: 'Mark a foe; it takes +{pct}% crit for {dur}s.', kind: 'debuff', target: 'ranged', element: 'nature', shapeKind: 'point', params: { pct: lin(15, 4), dur: lin(4, 1) } }),
    sk({ id: 'graspingThorns', name: 'Grasping Thorns', description: 'Root every foe on {tiles} tiles for {dur}s.', kind: 'debuff', target: 'area', element: 'nature', shapeKind: 'area', params: { tiles: lin(3, 1), dur: lin(2, 0.5) }, cooldownMs: 5000 }),
  ],

  // --- Magician ---
  magician: [
    sk({ id: 'energyBolt', name: 'Energy Bolt', description: 'Blast a line of tiles for {dmg} damage.', kind: 'attack', target: 'line', element: 'arcane', shapeKind: 'line', params: { dmg: lin(1.0, 0.2), tiles: lin(3, 0.5) } }),
    sk({ id: 'frostbite', name: 'Frostbite', description: 'Chill the target, slowing it {pct}% for {dur}s.', kind: 'debuff', target: 'ranged', element: 'arcane', shapeKind: 'point', params: { pct: lin(20, 5), dur: lin(3, 1) } }),
    sk({ id: 'manaShield', name: 'Mana Shield', description: 'Absorb the next {dmg} damage using MP.', kind: 'buff', target: 'self', element: 'arcane', shapeKind: 'self', params: { dmg: lin(1.0, 0.3) }, cooldownMs: 6000, cooldownType: 'active' }),
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
    sk({ id: 'verdantWellspring', name: 'Verdant Wellspring', description: 'Heal all allies on {tiles} tiles for {heal}.', kind: 'heal', target: 'area', element: 'primal', shapeKind: 'party', params: { tiles: lin(3, 1), heal: lin(0.5, 0.1) }, triggerMs: 2000 }),
    sk({ id: 'avalanche', name: 'Avalanche', description: 'Crush {tiles} tiles for {dmg} after {delay}s.', kind: 'attack', target: 'area', element: 'primal', shapeKind: 'area', params: { tiles: lin(3, 1), dmg: lin(1.3, 0.25), delay: lin(1, 0.1) }, cooldownMs: 4000 }),
    sk({ id: 'blessing', name: 'Blessing', description: 'Grant all allies +{pct}% damage for {dur}s.', kind: 'buff', target: 'ally', element: 'primal', shapeKind: 'party', params: { pct: lin(15, 4), dur: lin(4, 1) }, cooldownMs: 7000, cooldownType: 'active' }),
  ],

  // --- Rogue ---
  rogue: [
    sk({ id: 'fangs', name: 'Fangs', description: 'Hit one foe {hits} times for {dmg} each.', kind: 'attack', target: 'melee', element: 'guile', shapeKind: 'melee', params: { hits: lin(2, 0.5), dmg: lin(0.7, 0.1) } }),
    sk({ id: 'daggerFling', name: 'Dagger Fling', description: 'Throw a blade down a line for {dmg} damage.', kind: 'attack', target: 'line', element: 'guile', shapeKind: 'line', params: { dmg: lin(1.0, 0.2) } }),
    sk({ id: 'lifeOrDeath', name: 'Life or Death', description: 'Both the user and enemies deal +{pct}% damage for {dur}s.', kind: 'buff', target: 'self', element: 'guile', shapeKind: 'self', params: { pct: lin(20, 5), dur: lin(4, 1) }, cooldownMs: 8000, cooldownType: 'active' }),
  ],
  assassin: [
    sk({ id: 'venom', name: 'Venom', description: 'Poison a foe for {pct}% max HP/round over {dur}s.', kind: 'dot', target: 'melee', element: 'poison', shapeKind: 'melee', params: { pct: lin(10, 2), dur: lin(3, 1) } }),
    sk({ id: 'assassinate', name: 'Assassinate', description: 'Strike for {dmg}; +{pct}% per affliction on the foe.', kind: 'attack', target: 'melee', element: 'poison', shapeKind: 'melee', params: { dmg: lin(1.5, 0.3), pct: lin(15, 4) }, uses: 2, cooldownMs: 4000 }),
    sk({ id: 'expose', name: 'Expose', description: 'Rupture a foe, raising damage it takes {pct}% for {dur}s.', kind: 'debuff', target: 'melee', element: 'poison', shapeKind: 'melee', params: { pct: lin(20, 5), dur: lin(3, 1) } }),
  ],
  shadower: [
    sk({ id: 'nightshroud', name: 'Nightshroud', description: 'Gain {pct}% dodge for {dur}s.', kind: 'buff', target: 'self', element: 'shadow', shapeKind: 'self', params: { pct: lin(20, 5), dur: lin(3, 1) }, cooldownMs: 6000, cooldownType: 'active' }),
    sk({ id: 'umbralFlurry', name: 'Umbral Flurry', description: 'Land {hits} shadow strikes for {dmg} each.', kind: 'attack', target: 'melee', element: 'shadow', shapeKind: 'melee', params: { hits: lin(3, 0.5), dmg: lin(0.7, 0.1) }, triggerMs: 1000 }),
    sk({ id: 'smokeBomb', name: 'Smoke Bomb', description: 'Blast {tiles} area for {dmg} damage, {pct}% miss chance for {dur}s.', kind: 'attack', target: 'area', element: 'shadow', shapeKind: 'area', params: { tiles: lin(3, 0.5), dmg: lin(0.9, 0.15), pct: lin(15, 4), dur: lin(2, 0.5) }, cooldownMs: 5000 }),
  ],
  ninja: [
    sk({ id: 'thousandStars', name: 'Thousand Stars', description: 'Scatter stars over {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'trap', shapeKind: 'area', params: { tiles: lin(3, 0.5), dmg: lin(0.7, 0.1) }, triggerMs: 750 }),
    sk({ id: 'ensnaringWeb', name: 'Ensnaring Web', description: 'Snare {tiles} tiles, slowing foes {pct}% for {dur}s.', kind: 'debuff', target: 'area', element: 'trap', shapeKind: 'area', params: { tiles: lin(3, 0.5), pct: lin(20, 5), dur: lin(3, 1) }, cooldownMs: 5000 }),
    sk({ id: 'blindingAsh', name: 'Blinding Ash', description: 'Blind {targets} foes, {pct}% miss chance for {dur}s.', kind: 'debuff', target: 'area', element: 'trap', shapeKind: 'area', params: { targets: lin(2, 1), pct: lin(20, 5), dur: lin(2, 0.5) }, cooldownMs: 6000 }),
  ],

  // --- Enemy skills ---
  slime: [sk({ id: 'dissolve', name: 'Dissolve', description: 'Dissolve a foe for {dmg} damage.', kind: 'attack', target: 'melee', element: 'neutral', shapeKind: 'melee', params: { dmg: lin(1.0, 0.1) } })],
  bat: [sk({ id: 'sonicBite', name: 'Sonic Bite', description: 'Bite for {dmg} damage.', kind: 'attack', target: 'melee', element: 'neutral', shapeKind: 'melee', params: { dmg: lin(1.1, 0.1) }, triggerMs: 1250 })],
  spider: [sk({ id: 'venomFang', name: 'Venom Fang', description: 'Fang strike for {dmg} damage.', kind: 'attack', target: 'melee', element: 'poison', shapeKind: 'melee', params: { dmg: lin(0.95, 0.1) } })],
  mushroom: [sk({ id: 'sporeBurst', name: 'Spore Burst', description: 'Burst spores over an area for {dmg}.', kind: 'attack', target: 'area', element: 'nature', shapeKind: 'area', params: { dmg: lin(1.2, 0.15), tiles: flat(4) } })],
  golem: [sk({ id: 'boulderSmash', name: 'Boulder Smash', description: 'Smash the ground for {dmg} after {delay}s.', kind: 'attack', target: 'area', element: 'steel', shapeKind: 'area', params: { dmg: lin(1.4, 0.2), tiles: flat(4), delay: lin(1, 0.1) }, cooldownMs: 4000 })],

  // --- Generic enemy skills by class (fighter/archer/mage/rogue/leader) ---
  enemyClass: [
    sk({ id: 'enemyStrike', name: 'Strike', description: 'Strike a foe for {dmg} damage.', kind: 'attack', target: 'melee', element: 'neutral', shapeKind: 'melee', params: { dmg: lin(1.0, 0.1) } }),
    sk({ id: 'enemyShot', name: 'Shot', description: 'Loose a shot at a foe for {dmg}.', kind: 'attack', target: 'ranged', element: 'neutral', shapeKind: 'point', params: { dmg: lin(0.9, 0.1) } }),
    sk({ id: 'enemyHex', name: 'Hex', description: 'Blast {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'arcane', shapeKind: 'area', params: { dmg: lin(1.4, 0.12), tiles: flat(6) }, uses: 1, triggerMs: 1750, telegraphMs: 4000 }),
    sk({ id: 'enemyGouge', name: 'Gouge', description: 'Gouge {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'poison', shapeKind: 'area', params: { dmg: lin(1.4, 0.12), tiles: flat(3) }, uses: 2, triggerMs: 1000, cooldownMs: 5000, telegraphMs: 3000 }),
    sk({ id: 'enemyRuin', name: 'Ruin', description: 'Devastate {tiles} tiles for {dmg}.', kind: 'attack', target: 'area', element: 'steel', shapeKind: 'area', params: { dmg: lin(1.8, 0.2), tiles: flat(12) }, uses: 2, cooldownMs: 10000, telegraphMs: 5000 }),
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

// Interpolate a description at a level. dmg/heal render as a computed number when
// `atk` is supplied, else as a ×multiplier.
export function describeSkill(skill: Skill, level: number, atk?: number): string {
  return skill.description.replace(/\{(\w+)\}/g, (_, name: string) => {
    const fn = skill.params[name as ParamName];
    if (!fn) return `{${name}}`;
    const v = fn(level);
    if (name === 'dmg' || name === 'heal') return atk != null ? String(Math.round(atk * v)) : `×${v.toFixed(2)}`;
    if (name === 'healPercentage') return `${Math.round(v * 100)}%`; // fraction of max HP -> "50%"
    if (name === 'cooldown') return `${+v.toFixed(1)}s`; // seconds -> "18s" / "1.4s"
    if (name === 'dur' || name === 'delay') return String(Math.round(v * 10) / 10);
    return String(Math.round(v));
  });
}
