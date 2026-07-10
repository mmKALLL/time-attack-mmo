// ============================================================================
// Town NPCs — non-combatant townsfolk that spawn in towns and can be talked to.
// On town entry spawnNpcs (engine/maps.ts) places up to MAX_TOWN_NPCS of them,
// one per distinct theme, each carrying that theme's Finnish dialogue lines.
// Art comes from town-npc.png quadrant 3 (tiles q3-1..q3-8). All data is plain
// + serializable so it threads through the pure engine.
// ============================================================================

export type NpcTheme = 'workEthic' | 'culture' | 'history' | 'folklore';
export const NPC_THEMES: NpcTheme[] = ['workEthic', 'culture', 'history', 'folklore'];

export const MAX_TOWN_NPCS = 4; // hard cap on townsfolk per town (one per theme)
export const NPC_ASSET_FILE = 'town-npc.png'; // shared townsfolk spritesheet
export const NPC_TILES = ['q3-1', 'q3-2', 'q3-3', 'q3-4', 'q3-5', 'q3-6', 'q3-7', 'q3-8', 'q4-4', 'q4-8']; // generic NPC single-tile portraits

// Job-advancement NPC (the "Guildmaster"): one per town, a 2x2 sprite from
// quadrant 4. Talking to it opens the advancement panel (later UI pass).
export const JOB_NPC_TILES = ['q4-9', 'q4-10', 'q4-13', 'q4-14']; // 2x2 sprite (bottom row swapped so it reads 12,13 under the facing flip)
export const JOB_NPC_NAME = 'Kiltamestari'; // Finnish: "the guild's master" (Guildmaster)
export const JOB_NPC_GREETING = "Show me your skill, and I'll show you a new path.";

// Finnish townsfolk name pool (seeded pick per NPC).
export const NPC_NAMES: string[] = ['Aatos', 'Onni', 'Helmi', 'Väinö', 'Sisko', 'Urho', 'Kerttu', 'Toivo', 'Elias', 'Saima', 'Reijo', 'Impi', 'Eino', 'Aili', 'Veikko', 'Hilja'];

// Themed dialogue, keyed by NpcTheme. Each theme is a pool of TRIPLETS; a townsperson
// draws ONE triplet (seeded, in spawnNpcs) and speaks its 3 lines one at a time across
// their looping interactions. Lines are short, dry, grounded, Finnish-flavored.
export const NPC_DIALOGUE: Record<NpcTheme, string[][]> = {
  workEthic: [
    [
      "Work first, talk later — that's how it's always been here. Sisu carries the rest.",
      'My grandfather cleared this land stump by stump. Complaining never felled a single tree.',
      'A job half-done sits heavier than a full sack of rye. Best finish what you start.',
    ],
    [
      'The forest gives if you rise before it does. I was splitting wood while you were still dreaming.',
      "A cold morning is just a warm afternoon that hasn't been earned yet.",
      "My hands ache, sure. That's how you know the day was worth something.",
    ],
    [
      'We patch the roof in summer, not in the rain. A man who plans ahead never has to hurry.',
      "The neighbours don't ask how I manage. I don't ask them. We just manage.",
      'Sisu is not shouting louder. It is standing there long after everyone else sat down.',
    ],
    [
      "I've thinned this stand of pine three times over. The trees know my axe by now.",
      'You do the boring part right and the hard part gets easy. Most folk do it backward.',
      'Rest is a tool like any other — sharpen it, then put it away and get back to work.',
    ],
    [
      'The field does not care if you are tired. So I stopped telling it.',
      'Grandmother said a full woodshed is worth more than a full purse come January. She was right.',
      "Praise embarrasses me. I'd rather you just looked at the fence and saw it held.",
    ],
    [
      "I fixed the plough before it broke. That's the whole secret, if you want it.",
      'A quiet man with dry hay fears no winter.',
      'Nobody handed my father this farm and nobody will hand me an excuse.',
    ],
    [
      'Two hours of good light left. Plenty of time to ruin, or to finish.',
      "I don't count the hours. I count the rows, and then there are no more rows.",
      "Complaining is just tiredness with a mouth. Feed it work instead and it goes quiet.",
    ],
    [
      "The berries won't pick themselves, though the bears would happily disagree.",
      'You learn to swing a scythe from someone who has swung a hundred thousand times. Then you swing it a hundred thousand more.',
      'A hard day is not a punishment. It is the rent you pay to sleep well.',
    ],
    [
      "I sharpen the saw on Sunday so Monday doesn't laugh at me.",
      "Half the village calls it stubbornness. I call it not leaving things undone.",
      'The stump I could not pull last spring is firewood now. Time and a straight back did it.',
    ],
    [
      'My father said: never let the barn see you idle. So I hide when I nap.',
      'Good work is its own reward, which is lucky, because it is often the only one.',
      "When the harvest is in and the shed is full, I don't celebrate. I just sit, and that is enough.",
    ],
  ],
  culture: [
    [
      'Fix the sauna before you fix your words — a good löyly settles most quarrels.',
      "We don't say much, and we mean all of it. Silence between friends is comfortable here.",
      "There's always room for more coffee. Sit, drink, and don't rush your leaving.",
    ],
    [
      "You'll know you're welcome when we stop talking and just sit. That's the warm part.",
      "An introvert here looks at his own shoes. An extrovert looks at yours.",
      'Small talk is exhausting. Ask me about the weather and I may need a week to recover.',
    ],
    [
      'At the bus stop we stand a good three metres apart. Two metres is practically a hug.',
      "If a stranger sits beside you on an empty bench, something is deeply wrong.",
      'We are not unfriendly. We are just fully booked on conversation until spring.',
    ],
    [
      "There is no such thing as bad weather, only unsuitable clothing. My uncle froze proving this.",
      'Midsummer, the sun forgets to set, and so, for once, do we.',
      "Coffee is not a drink here. It is a unit of time, and we are all very late.",
    ],
    [
      "Sauna first, honesty after. Nobody lies with steam in their lungs.",
      'A Finn tells you the truth even when a kinder man would tell you nothing.',
      "We don't hug hello. A firm nod carries all the same feeling, and no risk of touching.",
    ],
    [
      "How do you spot the sociable Finn? He's the one staring at YOUR shoes.",
      "We say 'no' by saying nothing, and 'yes' by saying nothing slightly warmer.",
      'The silence between us is not empty. It is full, and we are enjoying it together.',
    ],
    [
      'Winter teaches patience. By March even the patience is running low, but we manage.',
      'Each season has its own smell. Autumn smells of rain and closing up; I like it best.',
      "Rush a Finn and you'll get nowhere twice as slowly. Sit. The coffee is on.",
    ],
    [
      "My neighbour and I have been friends thirty years. We've spoken perhaps four times.",
      "A joke here is told with a straight face. If I smiled, you'd think I meant it.",
      "We queue politely, complain internally, and thank the driver. It's a whole religion.",
    ],
    [
      'The löyly must be right — too little and it sulks, too much and it bites. Like people.',
      'On the ice in winter we drill a hole, sit, and say nothing to the fish for hours. Bliss.',
      "Personal space is sacred. Yours starts about where mine ends, roughly a field away.",
    ],
    [
      'We have a word, kalsarikännit — drinking at home in your underwear, alone. We are proud of it.',
      "Compliment a Finn and watch him dissolve. We handle praise worse than we handle bears.",
      'Honesty, coffee, silence, sauna. Give us those four and you can keep the rest.',
    ],
  ],
  history: [
    [
      "You should've seen the spring flood last month — took the old mill wheel clean down the river.",
      'The market square was rebuilt only this summer, after the great storm cracked the old well.',
      "New folk keep arriving since the road opened. The town's near twice the size it was a year ago.",
    ],
    [
      'The old mill stood two hundred years, then last autumn a storm laid it flat in one night.',
      "We've dragged the good timbers up to rebuild it. Come the thaw, the wheel will turn again.",
      'My grandmother ground her first flour at that mill. Feels wrong to see it dark.',
    ],
    [
      'The well cracked in the frost this winter — you could hear it go, like a shot across the square.',
      "We've been hauling water from the lake since. Slow work, but it keeps the young ones humble.",
      'The mason says the new well will be deeper. Deeper is good, until the bucket rope runs short.',
    ],
    [
      "That road they cut through the forest last year — nobody's stopped talking about it.",
      'Newcomers every week now. Faces I have never seen, buying bread I used to buy first.',
      "It's good for trade, they say. I liked knowing every name, is all.",
    ],
    [
      'Last harvest was the best in a decade — barns so full we stacked rye in the church loft.',
      "The year before that, frost took half of everything. Nobody forgets a lean winter here.",
      "You store fat years against thin ones. That's the whole history of this town, really.",
    ],
    [
      'The spring flood came up over the low bridge and took two sheds with it.',
      'We watched the river carry off a whole hayrick, calm as you like, like it owned the thing.',
      'Higher ground for the new grain store, the elders decided. Costly wisdom, that.',
    ],
    [
      'This square was ash and mud after the storm. Look at it now — new stone, new stalls.',
      'Everyone lent a hand rebuilding, even the ones who never lend anything.',
      "The tavern went up first, of course. A town rebuilds its thirst before its roof.",
    ],
    [
      'The old spruce by the crossroads is older than the town. It has seen every flood come and go.',
      "They wanted to fell it for the new road. The whole village said no, quietly, and it stayed.",
      "As long as that tree stands, the elders say, so does the town. I don't argue with trees.",
    ],
    [
      'My father helped dig the first drainage ditches out east. Turned bog into barley in one generation.',
      'The land here was all marsh once. Every dry field you see was somebody\'s stubbornness.',
      "The old maps show a lake where the north pasture is. We drained it. The frogs never forgave us.",
    ],
    [
      "The church bell is the oldest thing we own — cast before anyone living can remember.",
      'It rang through the storm last autumn and never cracked. We took that as a sign.',
      'Weddings, funerals, floods — that bell has called this town to all of them, and will again.',
    ],
  ],
  folklore: [
    [
      "Don't whistle in the forest after dark — the Hiisi hear it, and they answer.",
      'Leave a coin at the old spruce for the haltija, and your cellar will never run dry.',
      "They say Väinämöinen's song still hums in the deep woods, if the wind sits right.",
    ],
    [
      'Never swim alone where the water goes still and dark — the näkki waits in the quiet places.',
      'It plays music under the surface, they say, to draw you down. Beautiful, and the last thing you hear.',
      'My grandmother spat in the lake before every crossing. Insult the näkki first, and it lets you pass.',
    ],
    [
      'We do not say the bear\'s name aloud in the woods. We call him "the honey-paw," the old one.',
      'The bear is metsän kuningas — king of the forest. You do not summon a king by shouting.',
      'Kill one, and there is a whole feast of apology to hold, so his spirit goes home unoffended.',
    ],
    [
      "Every old house has its haltija — the spirit that came with the first hearthfire.",
      'Sweep it a clean corner, spill a little of the first beer, and it keeps the rot and the mice away.',
      'Move houses and you must invite yours along, or you leave your luck behind on the doorstep.',
    ],
    [
      'On midsummer eve the virvatuli float over the marsh — pale lights, cold as coins.',
      'They mark where old treasure lies, the tales say. Chase one and it marks where you drown, instead.',
      "Follow a will-o'-wisp and you'll walk in circles till dawn. If dawn comes for you at all.",
    ],
    [
      'Väinämöinen sang this world into shape — mountains, lakes, the first iron, all of it in verse.',
      "The Kalevala keeps his songs. My grandfather could recite a whole night's worth and never repeat.",
      'They say the old singer sailed away but promised to return when the land has need of him. Not yet.',
    ],
    [
      'Louhi rules the cold north, the Pohjola — mistress of it, witch of a thousand teeth.',
      'She stole the sun and moon once and hid them in a hill of copper. It took heroes to get them back.',
      "When the winter bites too hard and too long, the old folk say Louhi is in a mood. Best stay in.",
    ],
    [
      'Hiisi is not one thing — a giant, a demon, an evil place, all of them, none of them.',
      "Where the ground is bad and nothing grows, we say the Hiisi has been there. Don't linger.",
      'Whistle at dusk and you call them. Then it is your own fool mouth that answers back.',
    ],
    [
      'Bind a red thread to the rowan by the gate — the rowan turns away the evil eye.',
      'The rowan and the spruce are guardian trees. Fell one thoughtlessly and the luck bleeds out of a place.',
      'We leave the first grain and the last sheaf for the spirits of the field. They were here before the plough.',
    ],
    [
      "The forest has a spirit, the metsänhaltija, and it watches whether you take more than you need.",
      'Ask its leave before you hunt, thank it when you leave, and it hides the good berries for you alone.',
      'Get lost in the deep woods and they say the haltija turned your coat — walk backward, and it lets you out.',
    ],
  ],
};
