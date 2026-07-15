// ============================================================================
// Town NPCs — non-combatant townsfolk that spawn in towns and can be talked to.
// On town entry spawnNpcs (engine/maps.ts) places ONE fixed NPC per topic the
// town defines in TOWN_DIALOGUE, each carrying that topic's location-specific
// lines (cycled one per interaction). Art comes from town-npc.png quadrant 3
// (tiles q3-1..q3-8). All data is plain + serializable so it threads through
// the pure engine.
// ============================================================================
import type { MapId } from './types';

export type NpcTheme = 'workEthic' | 'culture' | 'history' | 'folklore';
export const NPC_THEMES: NpcTheme[] = ['workEthic', 'culture', 'history', 'folklore'];

export const MAX_TOWN_NPCS = 4; // hard cap on townsfolk per town (one per theme)
export const NPC_ASSET_FILE = 'town-npc.png'; // shared townsfolk spritesheet
// Townsfolk tiles split by gender presentation (an NPC's tile matches its name's gender).
export const NPC_TILES_FEMALE = ['q3-2', 'q2-1']; // weaver + maid — the usable female-presenting townsfolk
export const NPC_TILES_MALE = ['q3-1', 'q3-3', 'q3-4', 'q3-5', 'q3-6', 'q3-7', 'q3-8', 'q4-4', 'q4-8'];
export const NPC_TILES = [...NPC_TILES_MALE, ...NPC_TILES_FEMALE]; // combined pool (backward-compat)

// Job-advancement NPC (the "Guildmaster"): one per town, a 2x2 sprite from
// quadrant 4. Talking to it opens the advancement panel (later UI pass).
export const JOB_NPC_TILES = ['q4-9', 'q4-10', 'q4-13', 'q4-14']; // 2x2 sprite (bottom row swapped so it reads 12,13 under the facing flip)
export const JOB_NPC_NAME = 'Kiltamestari'; // Finnish: "the guild's master" (Guildmaster)
export const JOB_NPC_GREETING = "Show me your skill, and I'll show you a new path.";

// Finnish townsfolk name pools by gender (seeded pick per NPC); the NPC's tile is
// then chosen from the matching gender's tile pool.
export const NPC_NAMES_MALE = ['Aatos', 'Onni', 'Väinö', 'Urho', 'Toivo', 'Elias', 'Reijo', 'Eino', 'Veikko'];
export const NPC_NAMES_FEMALE = ['Helmi', 'Sisko', 'Kerttu', 'Saima', 'Impi', 'Aili', 'Hilja'];
export const NPC_NAMES = [...NPC_NAMES_MALE, ...NPC_NAMES_FEMALE];
export function genderOfName(name: string): 'male' | 'female' {
  return NPC_NAMES_FEMALE.includes(name) ? 'female' : 'male';
}

// Per-town, location-specific dialogue, keyed by MapId then NpcTheme. Each town
// defines a line array per topic it hosts; spawnNpcs (engine/maps.ts) places ONE
// fixed NPC per defined topic (iterating NPC_THEMES for a deterministic order),
// and that NPC cycles its topic's lines one per interaction (looping, via the
// per-NPC dialogueIndex). Lines are grounded, Finnish-flavored, and tied to the
// town's real geography/lore.
export const TOWN_DIALOGUE: Partial<Record<MapId, Partial<Record<NpcTheme, string[]>>>> = {
  mantyharju: {
    workEthic: [
      "Start small and steady — one point in a skill, one step at a time. Sisu is patience wearing boots.",
      "No rush out here; the pines took a hundred years, and you'll grow soon enough.",
      "Press S to open your skills — every level grants points to spend. Nothing is wasted, but nothing's given back.",
    ],
    culture: [
      "You look lost. First rule of these lands: don't chase your foes — walk into them and they clump together, and you fight the whole knot at once.",
      "Combat here isn't kiting. You drag enemies into a block and reshape it with your skills — a line here, a sweep there. Old habits from other realms will only trip you.",
      "Rest in any town and your mana comes back full. Out in the wilds, you're on your own.",
    ],
    history: [
      "Mäntyharju is the first hush on the road — every wanderer's tale draws its first breath under these pines.",
      "The old ridge was carved by ice a world ago; we only build our cabins on what it left behind.",
    ],
    folklore: [
      "Knock on a pine before you fell it, and thank the haltija within — the forest remembers rudeness.",
      "If you hear your name called from the trees at dusk, don't answer. It isn't kin.",
    ],
  },
  savonlinna: {
    workEthic: [
      "Steel doesn't forgive a lazy arm. Swing until the swing is you.",
      "We rebuilt these walls stone by stone after every siege. Complaining never laid a single course.",
    ],
    culture: [
      "An oath here is sworn in steel and stone — we don't break them, and we don't forget them.",
      "The castle folk speak little and mean all of it; loud men don't last on a fortress isle.",
      "Come of age and the Guildmaster within will set you on a warrior's path — a fighter's steel begins here in Savonlinna. Other roads keep their own towns.",
    ],
    history: [
      "Olavinlinna was raised on this black-water isle to watch the eastern road. It has never truly fallen.",
      "Three sieges these walls have seen, and three times the ice on the strait did half the defending.",
    ],
    folklore: [
      "They say Iku-Turso stirs beneath the strait on the coldest nights. Best keep your boat ashore.",
      "A black ram was walled into the keep for luck, the elders swear — knock twice and it answers.",
    ],
  },
  varkaus: {
    workEthic: [
      "In Varkaus a good lock and a quiet hand feed a family. Learn both.",
      "The mills never sleep and neither do the locksmen. Idle hands here just get caught.",
    ],
    culture: [
      "Everything's a bargain in Varkaus, and the current keeps every secret it's told.",
      "Watch your purse and your tongue — both slip easy where the water runs fast.",
    ],
    history: [
      "The canal locks were cut to lift boats past the rapids; a town grew up around the levers and never left.",
      "A whole barge of silver went down at the lower lock, they say. Divers still come. None come back rich.",
    ],
    folklore: [
      "Näkki lives under the lock gates — pay it a coin, or it pulls under whoever crosses last.",
      "Whistle on the water and Ahti hears you. Whistle twice and he answers with a storm.",
    ],
  },
  jyvaskyla: {
    workEthic: [
      "A spell half-learned is worse than none. Read it twice, then read it again.",
      "The scholars here rise before the sun to catch the quiet — magic favours the diligent, not the clever.",
    ],
    culture: [
      "On this ridge the very air crackles; mind your words, for half of them here are spells waiting to be finished.",
      "We argue theory over coffee until the cups go cold. It's how the ridge stays warm.",
    ],
    history: [
      "The great library was raised on the ridge so its towers could catch the first and last light for reading.",
      "A fire took the east wing a lifetime ago — a rune gone wrong, they say. We copy every scroll twice now.",
    ],
    folklore: [
      "Väinämöinen sang the world into shape; every mage here is only trying to hum along.",
      "Leave a candle for the reading-haltija and it keeps your place; snuff one carelessly and it loses it for spite.",
    ],
  },
  kuopio: {
    workEthic: [
      "A steady eye is a made thing, not a born one. Loose a hundred arrows before you trust the first.",
      "We climb the tower at dawn to watch the far shore. Patience is the archer's whole craft.",
    ],
    culture: [
      "Beneath the lonely tower the lake keeps the sky like a mirror; folk here read weather and strangers alike.",
      "Keenest eyes in the north, they call us — and the sharpest tongues to match.",
    ],
    history: [
      "The watchtower was raised on Puijo hill to spot fires and raiders across Kallavesi — it has guarded the town ever since.",
      "One still autumn the whole lake froze mirror-smooth, and they swear you could see the drowned church steeple beneath.",
    ],
    folklore: [
      "A loon's cry over the mirror-lake foretells a death. Two, and it's a lie to frighten children — mostly.",
      "Tapio grants the keen-eyed a clear shot, but only to those who take no more game than they need.",
    ],
  },
  kajaani: {
    workEthic: [
      "Last warm hearth before the deep north — stock your strength here, for the road gives nothing back.",
      "We split wood against a winter that always comes early. Softness doesn't survive the season.",
    ],
    culture: [
      "Kajaani is where the road pauses to gather courage. Share a fire and a story before you go on.",
      "The rapids here once carried tar to the sea; a hard trade bred a hard, generous people.",
    ],
    history: [
      "The old castle guards the rapids still, though its roof is long gone and the north has crept closer.",
      "A learned doctor once gathered the old songs here, they say, and bound them into one great tale.",
    ],
    folklore: [
      "North of here, Louhi of Pohjola rules the cold. Speak her name softly, if at all.",
      "The Sampo is said to grind somewhere under the northern ice — riches, salt, and sorrow, all at once.",
    ],
  },
  lieksa: {
    workEthic: [
      "The road ends here; past it, only what you carry keeps you. Pack twice, complain never.",
      "Moss grows over the idle in Lieksa. Keep moving, or the deepwood claims you.",
    ],
    culture: [
      "This is the last waystation before the old dark; folk here trade in warnings more than coin.",
      "We speak the deepwood's names in whispers. It listens closer than any neighbour.",
    ],
    history: [
      "Lieksa was a tar-burner's camp at the wood's edge; the forest has been taking it back ever since.",
      "The great hill to the north has watched over these woods since before the first song was sung.",
    ],
    folklore: [
      "Bow to the bear — metsän kuningas, king of the forest. Never speak his true name aloud in his hall.",
      "Follow a virvatuli into the marsh and it leads you to old gold, or to the bottom. Rarely the first.",
    ],
  },
};
