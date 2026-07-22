// ============================================================================
// Japanese translations for TOWN_DIALOGUE (src/data-npc.ts). PARALLEL structure:
// same MapId keys, same NpcTheme keys, and the SAME array length/index as the
// English source — so the two files cross-check line-by-line side by side, and
// i18n.ts can zip them into a content-keyed lookup (see NPC_LINE_JA). The English
// source in data-npc.ts stays the single source of truth; this file localizes at
// render only. Kalevala/folklore proper nouns use the standard Japanese katakana
// renderings; the tutorial lines (Mäntyharju/Savonlinna) translate the MECHANIC.
// ============================================================================
import type { MapId } from '../types';
import type { NpcTheme } from '../data-npc';

export const TOWN_DIALOGUE_JA: Partial<Record<MapId, Partial<Record<NpcTheme, string[]>>>> = {
  mantyharju: {
    workEthic: [
      // "Start small and steady — one point in a skill, one step at a time. Sisu is patience wearing boots."
      '小さく着実に始めるがいい――スキルには一度に一点、歩みは一歩ずつ。シス（不屈の精神）とは、靴を履いた忍耐のことよ。',
      // "No rush out here; the pines took a hundred years, and you'll grow soon enough."
      'ここでは急ぐことはない。松とて育つのに百年かかったのだ、お前もじきに大きくなるさ。',
      // "Press S to open your skills — every level grants points to spend. Nothing is wasted, but nothing's given back."
      'Sを押せばスキルが開く――レベルが上がるたびに割り振る点がもらえる。無駄になるものは何もないが、返ってくるものも何もない。',
    ],
    culture: [
      // "You look lost. First rule of these lands: don't chase your foes — walk into them and they clump together, and you fight the whole knot at once."
      '道に迷ったような顔だな。この地の第一の掟――敵を追いかけるな。こちらから踏み込めば奴らはひと塊に寄り集まり、その群れごと一度に相手取ることになる。',
      // "Combat here isn't kiting. You drag enemies into a block and reshape it with your skills — a line here, a sweep there. Old habits from other realms will only trip you."
      'ここの戦いは逃げ撃ちではない。敵を引きずって一つの塊に固め、スキルでその形を作り変えるのだ――ここに一列、あそこに一薙ぎ。他の世界の古い癖はお前を躓かせるだけよ。',
      // "Rest in any town and your mana comes back full. Out in the wilds, you're on your own."
      'どの町でも休めばマナは満ちて戻る。だが荒野に出れば、頼れるのは己だけだ。',
    ],
    history: [
      // "Mäntyharju is the first hush on the road — every wanderer's tale draws its first breath under these pines."
      'マンティハルユは道のりで最初の静寂――あらゆる旅人の物語は、この松の下で初めての息をつくのだ。',
      // "The old ridge was carved by ice a world ago; we only build our cabins on what it left behind."
      '古い尾根は一つの世界の昔、氷が削り出したもの。我らはただ、それが遺したものの上に小屋を建てているにすぎん。',
    ],
    folklore: [
      // "Knock on a pine before you fell it, and thank the haltija within — the forest remembers rudeness."
      '松を切り倒す前には幹を叩き、内に宿るハルティヤに礼を言うのだ――森は無礼を忘れはせぬ。',
      // "If you hear your name called from the trees at dusk, don't answer. It isn't kin."
      '黄昏どき、木々の間から名を呼ばれても答えてはならぬ。それは身内ではない。',
    ],
  },
  savonlinna: {
    workEthic: [
      // "Steel doesn't forgive a lazy arm. Swing until the swing is you."
      '鋼は怠けた腕を許さぬ。振ることがお前自身になるまで振り続けよ。',
      // "We rebuilt these walls stone by stone after every siege. Complaining never laid a single course."
      '包囲のたびに我らはこの城壁を石一つずつ積み直してきた。愚痴がひと積みでも積んだためしはない。',
    ],
    culture: [
      // "An oath here is sworn in steel and stone — we don't break them, and we don't forget them."
      'ここでの誓いは鋼と石にかけて交わされる――我らは誓いを破らず、そして忘れもせぬ。',
      // "The castle folk speak little and mean all of it; loud men don't last on a fortress isle."
      '城の者は口数少なく、口にしたことはすべて本気だ。声の大きい男は、要塞の島では長くは保たぬ。',
      // "Come of age and the Guildmaster within will set you on a warrior's path — a fighter's steel begins here in Savonlinna. Other roads keep their own towns."
      '一人前になれば、奥にいるキルタメスタリがお前を戦士の道へ導いてくれる――ファイターの鋼はここサヴォンリンナで始まるのだ。他の道はそれぞれの町に控えておる。',
    ],
    history: [
      // "Olavinlinna was raised on this black-water isle to watch the eastern road. It has never truly fallen."
      'オラヴィンリンナは東の道を見張るため、この黒き水の島に築かれた。真に落ちたことは一度もない。',
      // "Three sieges these walls have seen, and three times the ice on the strait did half the defending."
      'この城壁は三度の包囲を見てきたが、三度とも海峡の氷が守りの半分を担ってくれた。',
    ],
    folklore: [
      // "They say Iku-Turso stirs beneath the strait on the coldest nights. Best keep your boat ashore."
      'もっとも冷え込む夜には、海峡の底でイク＝トゥルソが身じろぎするという。舟は岸に上げておくがよかろう。',
      // "A black ram was walled into the keep for luck, the elders swear — knock twice and it answers."
      '幸運を願って黒い雄羊が天守の壁に塗り込められたと、古老たちは断言する――二度叩けば、それが応えるとな。',
    ],
  },
  varkaus: {
    workEthic: [
      // "In Varkaus a good lock and a quiet hand feed a family. Learn both."
      'ヴァルカウスでは、よき錠前と静かな手さばきが家族を養う。その両方を身につけよ。',
      // "The mills never sleep and neither do the locksmen. Idle hands here just get caught."
      '製材所は眠らず、錠前番も眠らぬ。ここでは遊んでいる手は、ただ捕まるだけよ。',
    ],
    culture: [
      // "Everything's a bargain in Varkaus, and the current keeps every secret it's told."
      'ヴァルカウスでは何もかもが取引の種、そして流れは打ち明けられた秘密をすべて守り通す。',
      // "Watch your purse and your tongue — both slip easy where the water runs fast."
      '財布と舌には気をつけろ――水の流れが速いところでは、どちらも滑りやすい。',
    ],
    history: [
      // "The canal locks were cut to lift boats past the rapids; a town grew up around the levers and never left."
      '運河の水門は、急流を越えて舟を持ち上げるために掘られた。てこの周りに町が育ち、そのまま離れなかったのだ。',
      // "A whole barge of silver went down at the lower lock, they say. Divers still come. None come back rich."
      '銀を積んだ艀が丸ごと下の水門で沈んだという。今も潜り手はやって来る。だが誰も豊かになって戻りはせぬ。',
    ],
    folklore: [
      // "Näkki lives under the lock gates — pay it a coin, or it pulls under whoever crosses last."
      'ネッキは水門の扉の下に棲んでいる――硬貨を一枚捧げよ。さもなくば、最後に渡った者を水底へ引きずり込む。',
      // "Whistle on the water and Ahti hears you. Whistle twice and he answers with a storm."
      '水の上で口笛を吹けばアハティが聞きつける。二度吹けば、嵐となって応えるぞ。',
    ],
  },
  jyvaskyla: {
    workEthic: [
      // "A spell half-learned is worse than none. Read it twice, then read it again."
      '中途半端に覚えた呪文は、覚えていないより悪い。二度読み、そしてもう一度読むのだ。',
      // "The scholars here rise before the sun to catch the quiet — magic favours the diligent, not the clever."
      'ここの学者たちは静けさを摑まえるため陽の昇る前に起きる――魔法が味方するのは勤勉な者であって、才ある者ではない。',
    ],
    culture: [
      // "On this ridge the very air crackles; mind your words, for half of them here are spells waiting to be finished."
      'この尾根では空気そのものが弾ける。言葉には気をつけよ、ここでは言葉の半分が、仕上げられるのを待つ呪文なのだから。',
      // "We argue theory over coffee until the cups go cold. It's how the ridge stays warm."
      '我らはカップが冷めるまでコーヒー片手に理論を論じ合う。それこそが、この尾根が暖かくあり続ける術よ。',
    ],
    history: [
      // "The great library was raised on the ridge so its towers could catch the first and last light for reading."
      '大図書館は、その塔が読書のための最初と最後の光を捉えられるよう、尾根の上に建てられた。',
      // "A fire took the east wing a lifetime ago — a rune gone wrong, they say. We copy every scroll twice now."
      '一生ほど昔、火が東棟を呑んだ――ルーンの一つが狂ったせいだという。それ以来、我らはどの巻物も二度ずつ写している。',
    ],
    folklore: [
      // "Väinämöinen sang the world into shape; every mage here is only trying to hum along."
      'ヴァイナモイネンは歌によって世界を形づくった。ここの魔法使いは皆、ただその調べに口ずさもうとしているにすぎん。',
      // "Leave a candle for the reading-haltija and it keeps your place; snuff one carelessly and it loses it for spite."
      '読書のハルティヤに蝋燭を一本供えれば、読みかけの頁を守ってくれる。不注意に吹き消せば、当てつけにその頁を見失わせるぞ。',
    ],
  },
  kuopio: {
    workEthic: [
      // "A steady eye is a made thing, not a born one. Loose a hundred arrows before you trust the first."
      '揺るがぬ目は生まれつきではなく、作り上げるものだ。最初の一射を信じる前に、矢を百本放て。',
      // "We climb the tower at dawn to watch the far shore. Patience is the archer's whole craft."
      '我らは夜明けに塔へ登り、遠い岸を見張る。忍耐こそが射手の技のすべてよ。',
    ],
    culture: [
      // "Beneath the lonely tower the lake keeps the sky like a mirror; folk here read weather and strangers alike."
      '孤高の塔の下、湖は鏡のように空を映す。ここの者は天候も余所者も、同じように読み取るのだ。',
      // "Keenest eyes in the north, they call us — and the sharpest tongues to match."
      '北方で最も鋭き目、と我らは呼ばれる――そしてそれに見合う、最も鋭い舌もな。',
    ],
    history: [
      // "The watchtower was raised on Puijo hill to spot fires and raiders across Kallavesi — it has guarded the town ever since."
      '物見の塔は、カッラヴェシの向こうの火事や襲撃者を見つけるためプイヨの丘に築かれた――以来ずっと町を守り続けている。',
      // "One still autumn the whole lake froze mirror-smooth, and they swear you could see the drowned church steeple beneath."
      'ある静かな秋、湖はまるごと鏡のように凍りつき、水底に沈んだ教会の尖塔が透けて見えたと、皆が断言するのだ。',
    ],
    folklore: [
      // "A loon's cry over the mirror-lake foretells a death. Two, and it's a lie to frighten children — mostly."
      '鏡のような湖に響くアビの鳴き声は死を告げる。二声なら、子どもを怖がらせるための嘘さ――たいていはな。',
      // "Tapio grants the keen-eyed a clear shot, but only to those who take no more game than they need."
      'タピオは鋭き目を持つ者に狙いの通る一射を授ける。だが、それは入り用な以上の獲物を獲らぬ者に限ってのことだ。',
    ],
  },
  kajaani: {
    workEthic: [
      // "Last warm hearth before the deep north — stock your strength here, for the road gives nothing back."
      '深き北の前にある最後の暖かき炉辺だ――ここで力を蓄えておけ、道は何も返してはくれぬのだから。',
      // "We split wood against a winter that always comes early. Softness doesn't survive the season."
      '我らはいつも早く訪れる冬に備えて薪を割る。甘さでは、この季節を越せはしない。',
    ],
    culture: [
      // "Kajaani is where the road pauses to gather courage. Share a fire and a story before you go on."
      'カヤーニは、道が勇気を奮い起こすため立ち止まる場所だ。先へ進む前に、火と物語を分かち合っていけ。',
      // "The rapids here once carried tar to the sea; a hard trade bred a hard, generous people."
      'ここの急流はかつてタールを海へ運んだ。厳しい生業が、厳しくも気前のよい人々を育てたのだ。',
    ],
    history: [
      // "The old castle guards the rapids still, though its roof is long gone and the north has crept closer."
      '古い城は今なお急流を守っている。屋根はとうに失せ、北はいっそう近くまで忍び寄っているがな。',
      // "A learned doctor once gathered the old songs here, they say, and bound them into one great tale."
      'かつて学識ある医師がここで古き歌の数々を集め、一つの大いなる物語へと束ねたという。',
    ],
    folklore: [
      // "North of here, Louhi of Pohjola rules the cold. Speak her name softly, if at all."
      'ここより北では、ポホヨラのロウヒが寒さを支配している。その名は――口にするなら、静かに唱えよ。',
      // "The Sampo is said to grind somewhere under the northern ice — riches, salt, and sorrow, all at once."
      'サンポは北の氷の下のどこかで挽き続けているという――富と、塩と、そして悲しみを、いちどきに。',
    ],
  },
  lieksa: {
    workEthic: [
      // "The road ends here; past it, only what you carry keeps you. Pack twice, complain never."
      '道はここで尽きる。その先では、己が背負ったものだけがお前を生かす。荷は二度確かめ、愚痴は決して言うな。',
      // "Moss grows over the idle in Lieksa. Keep moving, or the deepwood claims you."
      'リエクサでは怠け者の上に苔が生す。動き続けよ、さもなくば深き森がお前を我がものにするぞ。',
    ],
    culture: [
      // "This is the last waystation before the old dark; folk here trade in warnings more than coin."
      'ここは古き闇の前にある最後の宿場だ。ここの者は硬貨よりも警告を商う。',
      // "We speak the deepwood's names in whispers. It listens closer than any neighbour."
      '我らは深き森の名を囁き声で口にする。森はどんな隣人よりも耳を近づけて聞いているのだ。',
    ],
    history: [
      // "Lieksa was a tar-burner's camp at the wood's edge; the forest has been taking it back ever since."
      'リエクサは森の縁にあるタール焼きの野営地だった。それ以来ずっと、森はそれを取り返し続けている。',
      // "The great hill to the north has watched over these woods since before the first song was sung."
      '北にそびえる大いなる丘は、最初の歌が歌われるより前から、この森を見守り続けている。',
    ],
    folklore: [
      // "Bow to the bear — metsän kuningas, king of the forest. Never speak his true name aloud in his hall."
      '熊には頭を垂れよ――メツァン・クニンガス、森の王だ。その真の名を、彼の広間で声に出して口にしてはならぬ。',
      // "Follow a virvatuli into the marsh and it leads you to old gold, or to the bottom. Rarely the first."
      'ヴィルヴァトゥリ（鬼火）を追って沼へ入れば、古き黄金へ導かれるか、あるいは底へ沈むか。前者であることは稀だがな。',
    ],
  },
};
