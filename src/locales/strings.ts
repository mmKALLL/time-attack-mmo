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

  // --- Main menu (SUOMELA, HELSINKI, Studio Esagames, version = proper nouns, left untranslated) ---
  'ui.mainMenu.eyebrow': { en: 'THE NORTHERN REALM', ja: '北方の領域' },
  'ui.mainMenu.tagline': { en: 'A land of endless forests, frozen fells, and old magic that stirs beneath the snow.', ja: '果てなき森と凍てつく丘、そして雪の下に息づく古の魔法の地。' },
  'ui.mainMenu.enterRealm': { en: 'Enter the Realm', ja: '領域へ入る' },
  'ui.mainMenu.continue': { en: 'Continue', ja: '続きから' },
  'ui.mainMenu.newCharacter': { en: 'New Character', ja: '新規キャラクター' },
  'ui.mainMenu.settings': { en: 'Settings', ja: '設定' },
  'ui.mainMenu.credits': { en: 'Credits', ja: 'クレジット' },
  'ui.mainMenu.quit': { en: 'Quit', ja: '終了' },
  'ui.mainMenu.full': { en: 'FULL', ja: '満員' },
  'ui.mainMenu.lastPlayed': { en: 'LAST PLAYED', ja: '前回のプレイ' },
  'ui.mainMenu.realmStatus': { en: 'Realm status', ja: '領域の状況' },
  'ui.mainMenu.onlineStatus': { en: '◆ Online · 2,418 adventurers', ja: '◆ オンライン · 2,418人の冒険者' },
  'ui.mainMenu.serversOnline': { en: 'SERVERS ONLINE', ja: 'サーバー稼働中' },

  // --- Towns (DATA strings: en MUST equal MAPS[id].name / .description verbatim; ja = translation).
  // Town NAMES → katakana of the real Finnish place name. DESCRIPTIONS → natural JP of the flavor line. ---
  'map.mantyharju.name': { en: 'Mäntyharju', ja: 'マンティハルユ' },
  'map.mantyharju.desc': { en: "Where the old pines hush and every wanderer's tale first draws breath.", ja: '老いた松がざわめき、あらゆる旅人の物語が最初の息吹をあげる地。' },
  'map.savonlinna.name': { en: 'Savonlinna', ja: 'サヴォンリンナ' },
  'map.savonlinna.desc': { en: 'A black-water fortress isle where oaths are sworn in steel and stone.', ja: '黒き水に囲まれた要塞の島、鋼と石にかけて誓いが交わされる場所。' },
  'map.varkaus.name': { en: 'Varkaus', ja: 'ヴァルカウス' },
  'map.varkaus.desc': { en: 'A town of shifting locks and whispered bargains, where the current keeps its secrets.', ja: '移ろう水門とささやかれる取引の町、流れが秘密を守り続ける。' },
  'map.jyvaskyla.name': { en: 'Jyväskylä', ja: 'ユヴァスキュラ' },
  'map.jyvaskyla.desc': { en: 'A ridge of scholars where the very air crackles with half-spoken spells.', ja: '学者たちの尾根、空気そのものが半ば唱えられた呪文で弾ける。' },
  'map.kuopio.name': { en: 'Kuopio', ja: 'クオピオ' },
  'map.kuopio.desc': { en: 'A mirror-lake town beneath a lonely tower, watched by the keenest eyes in the north.', ja: '孤高の塔の下、鏡のような湖の町、北方で最も鋭き目に見守られる。' },
  'map.kajaani.name': { en: 'Kajaani', ja: 'カヤーニ' },
  'map.kajaani.desc': { en: 'The last warm hearth before the deep north swallows the road whole.', ja: '深き北が道を丸ごと呑み込む前の、最後の暖かき炉辺。' },
  'map.lieksa.name': { en: 'Lieksa', ja: 'リエクサ' },
  'map.lieksa.desc': { en: "A moss-drowned waystation at the deepwood's edge, where the road ends and the old dark begins.", ja: '深き森の縁にある苔に沈んだ宿場、道が尽き、古き闇が始まる場所。' },

  // --- HUD status-effect badge labels (status.<kind>) ---
  'status.poison': { en: 'Poison', ja: '毒' },
  'status.bleed': { en: 'Bleed', ja: '出血' },
  'status.burn': { en: 'Burn', ja: '燃焼' },
  'status.slow': { en: 'Slow', ja: '鈍足' },
  'status.stun': { en: 'Stun', ja: 'スタン' },
  'status.atkUp': { en: 'Attack Up', ja: '攻撃力上昇' },
  'status.atkDown': { en: 'Attack Down', ja: '攻撃力低下' },
  'status.defUp': { en: 'Defense Up', ja: '防御力上昇' },
  'status.defDown': { en: 'Defense Down', ja: '防御力低下' },
  'status.dodge': { en: 'Dodge Up', ja: '回避上昇' },
  'status.blind': { en: 'Blind', ja: '盲目' },
  'status.critUp': { en: 'Crit Up', ja: '会心率上昇' },
  'status.critDmgUp': { en: 'Crit Damage Up', ja: '会心ダメージ上昇' },
  'status.statPercent': { en: 'Stat %', ja: 'ステータス%' },
  'status.statFlat': { en: 'Stat +', ja: 'ステータス+' },

  // --- HUD chrome (ZoneBanner / FocusTarget / status badge suffix) ---
  'ui.hud.down': { en: ' (down)', ja: '（低下）' },
  'ui.hud.recommendedLv': { en: 'RECOMMENDED LV', ja: '推奨レベル' },
  'ui.hud.elite': { en: 'ELITE', ja: 'エリート' },
  'ui.hud.lv': { en: 'LV', ja: 'Lv' },

  // --- Death overlay ---
  'ui.death.youDied': { en: 'YOU DIED', ja: '死亡' },
  'ui.death.respawn': { en: 'Respawn', ja: '復活' },

  // --- Job advancement (AdvancementPanel + OfferPanel chrome) ---
  'ui.advance.requiresLv': { en: 'Requires Lv {n}', ja: 'Lv {n}が必要' },
  'ui.advance.advance': { en: 'Advance', ja: '転職' },
  'ui.advance.decline': { en: 'Decline', ja: '断る' },
  'ui.advance.close': { en: 'Close', ja: '閉じる' },
  'ui.advance.accept': { en: 'Accept', ja: '承諾' },
  'ui.advance.greeting': { en: 'What path will you walk?', ja: 'どの道を歩むのだ？' },
  'ui.advance.pathOffer': { en: 'I can set you on the path of the {job}.', ja: '{job}の道へと導いてやろう。' },
  'ui.advance.noPath': { en: 'No path lies open to you here — this is not your road to walk.', ja: 'ここにお前の進む道は開かれていない――これはお前の歩むべき道ではない。' },
  'ui.advance.confirmHint': { en: 'CLICK TO CONFIRM · ENTER / ESC TO CLOSE', ja: 'クリックで確定 · Enter / Escで閉じる' },

  // --- NPC dialog chrome (dialogue LINES are NOT translated here) ---
  'ui.npc.ok': { en: 'OK', ja: 'OK' },
  'ui.npc.close': { en: 'Close', ja: '閉じる' },
  'ui.npc.continueHint': { en: 'SPACE / ENTER', ja: 'スペース / Enter' },

  // --- Character / save-slot screen ---
  'ui.chars.title': { en: 'Characters', ja: 'キャラクター' },
  'ui.chars.intro': { en: 'Each save slot holds one character.', ja: '各セーブスロットには1人のキャラクターが入ります。' },
  'ui.chars.backToMenu': { en: '← Back to Menu', ja: '← メニューへ戻る' },
  'ui.chars.slot': { en: 'Slot {n}', ja: 'スロット {n}' },
  'ui.chars.active': { en: 'ACTIVE', ja: '使用中' },
  'ui.chars.empty': { en: 'Empty', ja: '空き' },
  'ui.chars.create': { en: 'Create', ja: '作成' },
  'ui.chars.play': { en: 'Play', ja: 'プレイ' },
  'ui.chars.export': { en: 'Export', ja: 'エクスポート' },
  'ui.chars.import': { en: 'Import', ja: 'インポート' },
  'ui.chars.delete': { en: 'Delete', ja: '削除' },
  'ui.chars.createCharacter': { en: 'Create Character', ja: 'キャラクター作成' },
  'ui.chars.cancel': { en: 'Cancel', ja: 'キャンセル' },
  'ui.chars.pastePlaceholder': { en: 'Paste exported save JSON here…', ja: 'エクスポートしたセーブJSONをここに貼り付け…' },
  'ui.chars.namePlaceholder': { en: 'Character name…', ja: 'キャラクター名…' },
  'ui.chars.loadIntoSlot': { en: 'Load into Slot {n}', ja: 'スロット {n} に読み込む' },
  'ui.chars.deleteConfirm': { en: 'Delete the save in slot {n}? This cannot be undone.', ja: 'スロット {n} のセーブを削除しますか？この操作は取り消せません。' },

  // --- Stub screens (Shop / Settings / NPC Chat) ---
  'ui.stub.backToGame': { en: '← Back to Game', ja: '← ゲームへ戻る' },
  'ui.stub.placeholder': { en: 'Placeholder screen — the engine, state store, and design tokens are all in place. Awaiting the Claude Design layout for this screen.', ja: 'プレースホルダー画面――エンジン、状態ストア、デザイントークンはすべて揃っています。この画面のClaude Designレイアウトを待機中です。' },
  'ui.shop.title': { en: 'Shop', ja: 'ショップ' },
  'ui.settings.title': { en: 'Hotkey Configuration', ja: 'ホットキー設定' },
  'ui.npcChat.title': { en: 'NPC Chat & Quest', ja: 'NPC会話とクエスト' },
};
