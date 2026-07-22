import type { Locale } from '../types';

// One translatable string: its English SOURCE (kept as a cross-check reference) plus
// each locale's translation. A missing/empty translation falls back to `en` (see
// i18n.translate). Every entry carries `en`, so this file is self-documenting AND a
// test (locales/__tests__/i18n.test.ts) can assert that data-derived `en` values still
// equal their live source (e.g. getSkill(id).name) — catching drift when skills are
// retuned. That is the card's "references to the original values, easy to cross-check".
export type Entry = Record<Locale, string>; // { en: string; ja: string }

// Namespaced keys: 'ui.<screen>.<id>', 'skill.<id>.name', 'skill.<id>.desc',
// 'stat.<key>.name', 'job.<id>.name', … Skill DESCRIPTIONS keep their {dmg}/{cooldown}
// placeholders — the translated template is substituted at render (see i18n.skillDescription).
// Content is filled alongside each screen's wiring (main menu + reachable skills first);
// untranslated strings (e.g. 2nd-job skills) simply fall back to their English source.
//
// COVERAGE: reachable-job skills (beginner/fighter/archer/magician/rogue) + those class
// names. `en` is copied VERBATIM from the live source (getSkill(id).name/.description,
// JOBS[id].name), INCLUDING the "N MP:" prefix the sk() helper prepends. `ja` keeps every
// {param} placeholder byte-for-byte so the render-time substitution still resolves.
export const STRINGS: Record<string, Entry> = {
  // --- Classes / jobs shown in the lineage + group headers ---
  'job.beginner.name': { en: 'Beginner', ja: 'ビギナー' },
  'job.fighter.name': { en: 'Fighter', ja: 'ファイター' },
  'job.archer.name': { en: 'Archer', ja: 'アーチャー' },
  'job.magician.name': { en: 'Magician', ja: '魔法使い' },
  'job.rogue.name': { en: 'Rogue', ja: 'ローグ' },

  // --- Primary stats (name + role blurb) ---
  'stat.str.name': { en: 'Strength', ja: '筋力' },
  'stat.str.role': { en: 'Physical power', ja: '物理攻撃力' },
  'stat.dex.name': { en: 'Dexterity', ja: '器用さ' },
  'stat.dex.role': { en: 'Speed · accuracy · crit', ja: '速度・命中・会心' },
  'stat.vit.name': { en: 'Vitality', ja: '体力' },
  'stat.vit.role': { en: 'HP · resistance', ja: 'HP・耐性' },
  'stat.int.name': { en: 'Intelligence', ja: '知力' },
  'stat.int.role': { en: 'Magic power · MP', ja: '魔法攻撃力・MP' },

  // --- Skill Allocation screen chrome ---
  'ui.skills.header': { en: 'Skill Allocation', ja: 'スキル割り振り' },
  'ui.skills.level': { en: 'LEVEL', ja: 'レベル' },
  'ui.skills.experience': { en: 'Experience', ja: '経験値' },
  'ui.skills.xpToNext': { en: 'XP to next', ja: '次のレベルまで' },
  'ui.skills.attribute': { en: 'ATTRIBUTE', ja: 'ステータス' },
  'ui.skills.skill': { en: 'SKILL', ja: 'スキル' },
  'ui.skills.confirm': { en: 'Confirm', ja: '確定' },
  'ui.skills.reset': { en: 'Reset', ja: 'リセット' },
  'ui.skills.return': { en: 'Return', ja: '戻る' },
  'ui.skills.attributesLeft': { en: 'Attributes ({n} left)', ja: 'ステータス（残り{n}）' },
  'ui.skills.skillsLeft': { en: 'Skills ({n} left)', ja: 'スキル（残り{n}）' },
  'ui.skills.ptsToSpend': { en: '{n} PTS TO SPEND', ja: '割り振り可能 {n}' },
  'ui.skills.unsaved': { en: 'Unsaved: {n} point{s} allocated.', ja: '未確定: {n}ポイント割り振り済み。' },
  'ui.skills.damageMix': { en: 'Damage mix', ja: 'ダメージ比率' },
  'ui.skills.classInnate': { en: 'class innate', ja: 'クラス固有' },
  'ui.skills.physicalLong': { en: 'PHYSICAL', ja: '物理' },
  'ui.skills.physicalShort': { en: 'PHYS', ja: '物理' },
  'ui.skills.magic': { en: 'MAGIC', ja: '魔法' },
  'ui.skills.derived': { en: 'Derived', ja: '派生ステータス' },
  'ui.skills.statsNote': { en: 'Every stat pays off for any class, but lead to different playstyles.', ja: 'どのステータスもどのクラスで役立ちますが、プレイスタイルが変わります。' },
  'ui.skills.attackArea': { en: 'Attack Area', ja: '攻撃範囲' },
  'ui.skills.unlearned': { en: 'Unlearned', ja: '未習得' },
  'ui.skills.unlearnedBadge': { en: 'UNLEARNED', ja: '未習得' },
  'ui.skills.you': { en: 'You', ja: '自分' },
  'ui.skills.self': { en: 'Self', ja: '自身' },
  'ui.skills.affected': { en: 'Affected', ja: '対象' },
  'ui.skills.nextLv': { en: 'NEXT LV ▸', ja: '次のLv ▸' },
  'ui.skills.raisesEffect': { en: "Raises the skill's effect.", ja: 'スキルの効果が上昇します。' },
  'ui.skills.mastered': { en: '✦ MASTERED · level {n} reached', ja: '✦ マスター済み · レベル{n}到達' },
  'ui.skills.lv': { en: 'Lv {n}', ja: 'Lv {n}' },

  // Derived-stat row labels
  'ui.skills.derived.minDmg': { en: 'Min damage', ja: '最小ダメージ' },
  'ui.skills.derived.maxDmg': { en: 'Max damage', ja: '最大ダメージ' },
  'ui.skills.derived.maxHp': { en: 'Max HP', ja: '最大HP' },
  'ui.skills.derived.maxMp': { en: 'Max MP', ja: '最大MP' },
  'ui.skills.derived.def': { en: 'Defense', ja: '防御力' },
  'ui.skills.derived.crit': { en: 'Crit rate', ja: '会心率' },
  'ui.skills.derived.accuracy': { en: 'Accuracy', ja: '命中率' },
  'ui.skills.derived.dodge': { en: 'Dodge', ja: '回避率' },
  'ui.skills.derived.statusResist': { en: 'Status Resist', ja: '状態異常耐性' },
  'ui.skills.derived.attackSpeed': { en: 'Attack Speed', ja: '攻撃速度' },

  // Skill-detail param labels (power headline + NEXT LV deltas)
  'ui.skills.param.maxDmg': { en: 'Max damage', ja: '最大ダメージ' },
  'ui.skills.param.healing': { en: 'Healing', ja: '回復量' },
  'ui.skills.param.burn': { en: 'Burn', ja: '燃焼' },
  'ui.skills.param.effect': { en: 'Effect', ja: '効果' },
  'ui.skills.param.duration': { en: 'Duration', ja: '持続時間' },
  'ui.skills.param.tiles': { en: 'Tiles', ja: 'マス数' },
  'ui.skills.param.hits': { en: 'Hits', ja: 'ヒット数' },
  'ui.skills.param.cooldown': { en: 'Cooldown', ja: 'クールダウン' },
  'ui.skills.param.critRate': { en: 'Crit rate', ja: '会心率' },
  'ui.skills.param.critDmg': { en: 'Crit damage', ja: '会心ダメージ' },
  'ui.skills.power.damage': { en: 'Damage', ja: 'ダメージ' },
  'ui.skills.power.healing': { en: 'Healing', ja: '回復量' },
  'ui.skills.power.burnPerRound': { en: 'Burn / round', ja: '燃焼／ラウンド' },
  'ui.skills.power.effect': { en: 'Effect', ja: '効果' },
  'ui.skills.power.noDamage': { en: '(no damage)', ja: '（ダメージなし）' },
  'ui.skills.note.physMix': { en: '{phys}/{mag} phys/mag mix', ja: '物理/魔法 {phys}/{mag}' },
  'ui.skills.note.restoresHp': { en: 'restores HP', ja: 'HPを回復' },
  'ui.skills.note.burnDur': { en: 'of max HP for {dur}s', ja: '最大HPの割合、{dur}秒間' },
  'ui.skills.note.burnFlat': { en: 'of max HP', ja: '最大HPの割合' },
  'ui.skills.note.effectDur': { en: 'for {dur}s', ja: '{dur}秒間' },

  // --- Beginner skills ---
  'skill.strike.name': { en: 'Stab', ja: 'スタブ' },
  'skill.strike.desc': { en: 'Strike two foes in a line for {dmg} damage.', ja: '前方2体の敵に{dmg}ダメージを与える。' },
  'skill.cleave.name': { en: 'Cleave', ja: 'クリーブ' },
  'skill.cleave.desc': { en: '4 MP: Slash three foes in a line for {dmg} damage.', ja: 'MP4: 前方3体の敵に{dmg}ダメージを与える。' },
  'skill.recover.name': { en: 'Recover', ja: 'リカバー' },
  'skill.recover.desc': { en: '20 MP: Restore {healPercentage} of max HP (cooldown: {cooldown}).', ja: 'MP20: 最大HPの{healPercentage}を回復する（クールダウン: {cooldown}）。' },

  // --- Fighter skills ---
  'skill.powerStrike.name': { en: 'Power Strike', ja: 'パワーストライク' },
  'skill.powerStrike.desc': { en: '6 MP: Strike one foe for {dmg} damage.', ja: 'MP6: 敵1体に{dmg}ダメージを与える。' },
  'skill.stab.name': { en: 'Power Stab', ja: 'パワースタブ' },
  'skill.stab.desc': { en: 'Stab {tiles} tiles in front for {dmg} damage (uses: {uses}, cooldown: {cooldown}).', ja: '前方{tiles}マスを突き、{dmg}ダメージを与える（使用回数: {uses}、クールダウン: {cooldown}）。' },
  'skill.spinSlash.name': { en: 'Spin Slash', ja: 'スピンスラッシュ' },
  'skill.spinSlash.desc': { en: '14 MP: Whirl, hitting {tiles} surrounding tiles for {dmg} damage.', ja: 'MP14: 回転し、周囲{tiles}マスに{dmg}ダメージを与える。' },
  'skill.bracingGuard.name': { en: 'Bracing Guard', ja: 'ブレイスガード' },
  'skill.bracingGuard.desc': { en: 'Reduce incoming damage taken by {pct}% for 10s (cooldown: {cooldown}).', ja: '10秒間、受けるダメージを{pct}%軽減する（クールダウン: {cooldown}）。' },

  // --- Archer skills ---
  'skill.piercingShot.name': { en: 'Arrow Blow', ja: 'アローブロー' },
  'skill.piercingShot.desc': { en: '6 MP: Strike closest enemy within {tiles} tiles for {dmg} damage.', ja: 'MP6: {tiles}マス以内の最も近い敵に{dmg}ダメージを与える。' },
  'skill.scatterShot.name': { en: 'Scatter Shot', ja: 'スキャッターショット' },
  'skill.scatterShot.desc': { en: '16 MP: Scatter arrows over {tiles} tiles for {dmg} damage.', ja: 'MP16: {tiles}マスに矢を散らし、{dmg}ダメージを与える。' },
  'skill.powerKnockback.name': { en: 'Power Knockback', ja: 'パワーノックバック' },
  'skill.powerKnockback.desc': { en: 'Knock back one foe 3 tiles, dealing {dmg} damage (uses: {uses}, cooldown: {cooldown}).', ja: '敵1体を3マスノックバックさせ、{dmg}ダメージを与える（使用回数: {uses}、クールダウン: {cooldown}）。' },
  'skill.improvedCritical.name': { en: 'Improved Critical', ja: 'インプルーブドクリティカル' },
  'skill.improvedCritical.desc': { en: '45 MP: +{crit}% crit and +{critDmg}% crit damage for {dur}s.', ja: 'MP45: {dur}秒間、会心率+{crit}%・会心ダメージ+{critDmg}%。' },

  // --- Magician skills ---
  'skill.magicClaw.name': { en: 'Magic Claw', ja: 'マジッククロー' },
  'skill.magicClaw.desc': { en: '12 MP: Strike closest enemy within {tiles} tiles for {hits} hits with {dmg} damage each.', ja: 'MP12: {tiles}マス以内の最も近い敵に{hits}回、それぞれ{dmg}ダメージを与える。' },
  'skill.crossBlast.name': { en: 'Cross Blast', ja: 'クロスブラスト' },
  'skill.crossBlast.desc': { en: '16 MP: Blast the diagonal tiles for {dmg} damage (uses: {uses}, cooldown: {cooldown}).', ja: 'MP16: 斜め方向のマスを爆撃し、{dmg}ダメージを与える（使用回数: {uses}、クールダウン: {cooldown}）。' },
  'skill.arcaneArc.name': { en: 'Arcane Arc', ja: 'アーケインアーク' },
  'skill.arcaneArc.desc': { en: '22 MP: Detonate {tiles} tiles for {dmg} damage after a delay.', ja: 'MP22: 遅延後、{tiles}マスを爆発させ{dmg}ダメージを与える。' },
  'skill.shockingGrasp.name': { en: 'Shocking Grasp', ja: 'ショッキンググラスプ' },
  'skill.shockingGrasp.desc': { en: '8 MP: Shock one foe for {dmg}, slowing it {pct}% (uses: {uses}, cooldown: {cooldown}).', ja: 'MP8: 敵1体に{dmg}ダメージを与え、{pct}%スロウにする（使用回数: {uses}、クールダウン: {cooldown}）。' },

  // --- Rogue skills ---
  'skill.doubleStrike.name': { en: 'Double Strike', ja: 'ダブルストライク' },
  'skill.doubleStrike.desc': { en: '6 MP: Stab one foe {hits} times for {dmg} damage each.', ja: 'MP6: 敵1体を{hits}回突き、それぞれ{dmg}ダメージを与える。' },
  'skill.venomSlash.name': { en: 'Venom Slash', ja: 'ベノムスラッシュ' },
  'skill.venomSlash.desc': { en: 'Slash {tiles} tiles, poisoning foes for {pct}% max HP every 2s over 10s (cooldown: {cooldown}).', ja: '{tiles}マスを斬り、10秒間2秒ごとに最大HPの{pct}%の毒を与える（クールダウン: {cooldown}）。' },
  'skill.hamstring.name': { en: 'Hamstring', ja: 'ハムストリング' },
  'skill.hamstring.desc': { en: '16 MP: Cut {tiles} tiles for {dmg}, slowing foes {pct}%.', ja: 'MP16: {tiles}マスを斬り{dmg}ダメージを与え、敵を{pct}%スロウにする。' },
  'skill.lifeOrDeath.name': { en: 'Life and Death', ja: 'ライフアンドデス' },
  'skill.lifeOrDeath.desc': { en: 'Deal and take +{pct}% damage for 10s (cooldown: {cooldown}).', ja: '10秒間、与えるダメージと受けるダメージが+{pct}%になる（クールダウン: {cooldown}）。' },
};
