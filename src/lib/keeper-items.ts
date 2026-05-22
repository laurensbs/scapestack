// "Don't even think about flagging these as junk" — the community-curated
// list of OSRS items that are cheap or untradeable but absolutely must be
// kept. Sources cited in junk.ts; the actual data is centralised here so
// junk detection AND bucket routing can both reference the same canon.
//
// Three levels of protection:
//   1. KEEPER_IDS         — exact item id matches (most reliable)
//   2. KEEPER_PATTERNS    — regex matches on lowercased item name
//   3. NAME_STARTS_WITH   — prefix patterns for entire families (e.g. "Pet ")
//
// If any of these matches an item, it is NEVER flagged as junk and routing
// MUST respect its semantic category (Slayer gear → PvM Gear, herbs →
// Skilling, pets → Drops, etc.).

import type { OrganizedItem } from "./organizer";

// ─── Pets ────────────────────────────────────────────────────────────────────
// Every untradeable OSRS pet. The wiki Pet_list is the source of truth; new
// pets get added with each Jagex content drop, so the pattern below catches
// common prefixes too.
export const PET_NAMES = new Set([
  // Skilling
  "Beaver", "Heron", "Rock golem", "Rocky", "Tangleroot", "Rift guardian",
  "Giant squirrel", "Baby chinchompa", "Chompy chick", "Phoenix", "Herbi",
  "Tiny tempor", "Bran", "Quetzin", "Wisp",
  // Bosses
  "Baby mole", "Prince black dragon", "Kalphite princess", "Pet smoke devil",
  "Pet kraken", "Pet dark core", "Pet snakeling", "Pet chaos elemental",
  "Pet dagannoth supreme", "Pet dagannoth prime", "Pet dagannoth rex",
  "Pet penance queen", "Pet kree'arra", "Pet general graardor",
  "Pet zilyana", "Pet k'ril tsutsaroth", "Venenatis spiderling",
  "Callisto cub", "Vet'ion jr.", "Scorpia's offspring", "Tzrek-jad",
  "Hellpuppy", "Abyssal orphan", "Bloodhound", "Olmlet", "Skotos",
  "Jal-nib-rek", "Noon", "Vorki", "Lil' zik", "Ikkle hydra", "Sraracha",
  "Youngllef", "Smolcano", "Little nightmare", "Lil' creator", "Nexling",
  "Abyssal protector", "Tumeken's guardian", "Muphin", "Butch", "Lil'viathan",
  "Baron", "Scurry", "Smol heredit", "Nid", "Huberte", "Moxi", "Yami",
  "Dom", "Soup", "Gull", "Beef"
]);

// ─── Diary reward families (all tiers 1-4) ──────────────────────────────────
export const DIARY_REWARD_FAMILIES = [
  "Explorer's ring", "Ardougne cloak", "Karamja gloves",
  "Fremennik sea boots", "Kandarin headgear", "Falador shield",
  "Varrock armour", "Wilderness sword", "Desert amulet",
  "Rada's blessing", "Morytania legs", "Western banner"
];

// ─── Slayer equipment (untradeable utility) ─────────────────────────────────
// Drops table for tasks; players never want to lose these.
export const SLAYER_EQUIPMENT_NAMES = new Set([
  "Slayer's staff", "Slayer's staff (e)",
  "Witchwood icon",
  "Rock hammer", "Rock thrownhammer",
  "Brittle key", "Slayer ring", "Slayer ring (eternal)", "Enchanted gem",
  "Earmuffs", "Spiny helmet", "Nose peg", "Reinforced goggles",
  "Insulated boots", "Facemask", "Gas mask", "Fungicide", "Fungicide spray",
  "Bag of salt", "Swamp paste", "Holy symbol", "Holy water", "Mirror shield",
  "Boots of stone", "Boots of brimstone", "Ice cooler", "Unlit bug lantern",
  "Slayer bell", "Crystal chime", "Tortugan shield",
  // Black mask family
  "Black mask", "Black mask (10)", "Black mask (5)", "Black mask (1)",
  // Slayer helm + every imbued color variant
  "Slayer helmet", "Slayer helmet (i)",
  "Black slayer helmet", "Black slayer helmet (i)",
  "Green slayer helmet", "Green slayer helmet (i)",
  "Red slayer helmet", "Red slayer helmet (i)",
  "Purple slayer helmet", "Purple slayer helmet (i)",
  "Hydra slayer helmet", "Hydra slayer helmet (i)",
  "Twisted slayer helmet", "Twisted slayer helmet (i)",
  "Tztok slayer helmet", "Tztok slayer helmet (i)",
  "Tzkal slayer helmet", "Tzkal slayer helmet (i)",
  "Vampyric slayer helmet", "Vampyric slayer helmet (i)",
  "Turquoise slayer helmet", "Turquoise slayer helmet (i)"
]);

// Slayer items the classifier may falsely tag with a weapon slot (Rock
// hammer contains the word "hammer"; Rock thrownhammer likewise). These are
// inventory-only consumable tools — they don't go in the gear tab. Used by
// keeperCategory() to short-circuit before the slot-based routing fires.
export const INVENTORY_ONLY_SLAYER_NAMES = new Set([
  "Rock hammer", "Rock thrownhammer",
  "Bag of salt", "Fungicide", "Fungicide spray",
  "Swamp paste", "Holy water", "Holy symbol", "Unholy symbol",
  "Witchwood icon", "Ice cooler", "Unlit bug lantern", "Slayer bell",
  "Brittle key", "Enchanted gem"
]);

// ─── Demonbane / vampyre / undead-slayer weapons ────────────────────────────
export const SPECIAL_SLAYER_WEAPONS = new Set([
  "Arclight", "Darklight", "Emberlight", "Silverlight",
  "Silverlight (dyed)", "Silverlight (orange)", "Silverlight (red)",
  "Blisterwood flail", "Blisterwood sickle", "Blisterwood staff",
  "Ivandis flail", "Rod of ivandis", "Wolfbane",
  "Leaf-bladed spear", "Leaf-bladed sword", "Leaf-bladed battleaxe",
  "Broad arrows", "Broad bolts", "Broad arrowheads", "Unfinished broad bolts",
  "Holy water grenade", "Holy water",
  // Salve amulet variants
  "Salve amulet", "Salve amulet (e)", "Salve amulet(i)", "Salve amulet(ei)"
]);

// ─── Cannon parts ───────────────────────────────────────────────────────────
export const CANNON_PARTS = new Set([
  "Cannon base", "Cannon stand", "Cannon furnace", "Cannon barrels",
  "Cannonball", "Granite cannonball",
  // Ornamented variants from Holiday hiscores etc.
  "Royale cannon base", "Royale cannon stand", "Royale cannon furnace", "Royale cannon barrels"
]);

// ─── Crystal / Prifddinas items (untradeable, often quest-bound) ────────────
export const CRYSTAL_NAMES = new Set([
  "Crystal key", "Enhanced crystal key", "Tooth half of key", "Loop half of key",
  "Crystal seed", "Crystal teleport seed", "Crystal armour seed",
  "Crystal weapon seed", "Crystal tool seed", "Enhanced crystal teleport seed",
  "Eternal crystal", "Crystal grail", "Crystal saw", "Crystal chime",
  "Crystal axe", "Crystal pickaxe", "Crystal harpoon",
  "Crystal halberd", "Crystal bow", "Crystal helm", "Crystal body", "Crystal legs",
  "Blade of saeldor", "Blade of saeldor (c)", "Bow of faerdhinen", "Bow of faerdhinen (c)"
]);

// ─── DT2 boss components ────────────────────────────────────────────────────
export const DT2_NAMES = new Set([
  "Awakener's orb", "Ancient remnant",
  "Chromium ingot",
  "Ultor vestige", "Magus vestige", "Bellator vestige", "Venator vestige",
  "Voidwaker hilt", "Voidwaker blade", "Voidwaker gem", "Voidwaker",
  "Executioner's axe head", "Soulreaper axe",
  "Ring of shadows", "Ancient blood ornament kit",
  "Blood quartz", "Ice quartz", "Smoke quartz", "Shadow quartz",
  "Virtus mask", "Virtus robe top", "Virtus robe bottom",
  "Frozen tablet", "Strangled tablet", "Sirenic tablet", "Awakened tablet"
]);

// ─── Quest-locked weapons / utility items ───────────────────────────────────
export const QUEST_REUSE_NAMES = new Set([
  "Excalibur", "Enhanced excalibur",
  "Iban's staff", "Iban's staff (u)",
  "Dramen staff", "Lunar staff",
  "Ghostspeak amulet", "Cramulet", "Camulet", "Catspeak amulet",
  "Catspeak amulet (e)", "Monkeyspeak amulet",
  "Lockpick", "Magic secateurs", "Bonecrusher", "Bonecrusher necklace",
  "Hunter's loot sack", "Hunter's sack",
  "Holy book", "Unholy book", "Book of balance", "Book of war",
  "Book of law", "Book of darkness", "Damaged book",
  "Tome of fire", "Tome of water", "Tome of earth", "Tome of frost",
  "Tome of fire (empty)", "Tome of water (empty)", "Tome of earth (empty)",
  "Strange device", "Ring of charos", "Ring of charos (a)",
  "Boots of lightness", "Spiked manacles", "Bone dagger", "Bone shield",
  "Helm of raedwald", "Mythical cape",
  "Vorkath's head", "Skull of vorkath",
  "Climbing boots", "Climbing boots (g)",
  "Spotted cape", "Spottier cape", "Gloves of silence"
]);

// ─── Recipe / upgrade components ────────────────────────────────────────────
export const RECIPE_NAMES = new Set([
  "Bandos hilt", "Saradomin hilt", "Armadyl hilt", "Zamorak hilt",
  "Godsword shard 1", "Godsword shard 2", "Godsword shard 3", "Godsword blade",
  "Spectral sigil", "Arcane sigil", "Elysian sigil", "Divine sigil",
  "Tormented synapse", "Wyvern visage", "Draconic visage", "Skeletal visage",
  "Smouldering stone",
  "Hydra's claw", "Hydra's eye", "Hydra's heart", "Hydra tail",
  "Magma mutagen", "Tanzanite mutagen",
  "Mossy key", "Ecumenical key",
  // Champion scrolls (all 13)
  "Earth warrior champion scroll", "Ghoul champion scroll",
  "Giant champion scroll", "Goblin champion scroll",
  "Hobgoblin champion scroll", "Imp champion scroll",
  "Jogre champion scroll", "Lesser demon champion scroll",
  "Skeleton champion scroll", "Zombie champion scroll",
  "Mummy champion scroll", "Ork champion scroll",
  "Leon d'cour champion scroll"
]);

// ─── Holiday rares ──────────────────────────────────────────────────────────
export const HOLIDAY_NAMES = new Set([
  "Red partyhat", "Yellow partyhat", "Blue partyhat", "Green partyhat",
  "Purple partyhat", "White partyhat", "Rainbow partyhat",
  "Red halloween mask", "Blue halloween mask", "Green halloween mask",
  "Black halloween mask",
  "Santa hat", "Inverted santa hat", "Rainbow santa hat",
  "Easter egg", "Easter ring", "Pumpkin", "Bunny ears",
  "Disk of returning", "Yo-yo", "Reindeer hat", "Chicken hat",
  "H'ween mask", "Pumpkin lantern", "Cabbage cape", "Jester cap",
  "Gnome scarf"
]);

// ─── Skilling outfit families (every piece) ─────────────────────────────────
// Match by family prefix in NAME_STARTS_WITH below.
export const SKILLING_OUTFIT_FAMILIES = [
  "Angler ", "Spirit angler ", "Pyromancer ", "Lumberjack ", "Forestry ",
  "Prospector ", "Golden prospector ", "Farmer's ", "Smiths ",
  "Carpenter's ", "Zealot's ", "Rogue ", "Raiments of the eye",
  "Hat of the eye", "Top of the eye", "Boots of the eye", "Bottoms of the eye",
  "Graceful ", "Hunter's hood", "Hunter's top", "Hunter's poncho",
  "Camo ", "Larupia ", "Spotted ", "Spottier ", "Polar camo ",
  "Wood camo ", "Snakeskin ", "Desert camo ", "Jungle camo "
];

// ─── Untradeable combat capes ───────────────────────────────────────────────
export const PROTECTED_CAPE_NAMES = new Set([
  "Fire cape", "Infernal cape",
  "Music cape", "Music cape (t)",
  "Quest point cape", "Quest point cape (t)",
  "Champion's cape",
  "Achievement diary cape", "Achievement diary cape (t)",
  "Max cape", "Imbued max cape", "Fire max cape", "Infernal max cape",
  "Saradomin max cape", "Zamorak max cape", "Guthix max cape",
  "Ardougne max cape", "Accumulator max cape", "Assembler max cape",
  "Mythical cape",
  "Imbued saradomin cape", "Imbued zamorak cape", "Imbued guthix cape",
  "Saradomin cape", "Zamorak cape", "Guthix cape"
]);

// ─── Quest / boss / diary / random-event keepers reported by users ─────────
// Items that historically tripped junk-detection because they're cheap or
// have no GE price but are 100% keepers (quest req, boss key, utility tool,
// holiday item). When in doubt, err toward "keep" — false-positive flagging
// of a quest cape costs the player a quest grind to replace.
export const QUEST_LOCKED_NAMES = new Set([
  // Quest tools (kept forever, often one-shot to grind back)
  "Barbarian rod", "Holy wrench", "Lyre", "Enchanted lyre", "Sled",
  "Charged ice", "Seal of passage", "Ogre bellows", "Ogre bellows (1)",
  "Ogre bellows (2)", "Ogre bellows (3)", "Double ammo mould",
  "Strange teleorb", "Strange device",
  // Slayer drop keys (quest/task locked items)
  "Dark claw", "Dark totem base", "Dark totem middle", "Dark totem top",
  "Dark totem", "Brittle key", "Larran's key", "Wilderness key",
  // ToA / boss tablets
  "Remnant of akkha", "Remnant of zebak", "Remnant of ba-ba",
  "Remnant of kephri", "Ancient remnant",
  "Breach of the scarab", "Frozen tablet", "Strangled tablet",
  "Sirenic tablet", "Awakened tablet",
  // ToA cosmetic + ornament kits
  "Menaphite ornament kit", "Masori crafting kit", "Tumeken's guardian",
  // Halloween / event rewards
  "Cursed phalanx", "Halloween cape", "Werewolf claws",
  // Tempoross / Wintertodt / Volcanic Mine
  "Soul bearer", "Tome of fire (empty)", "Tome of water (empty)",
  "Tome of earth (empty)", "Bruma torch", "Fossilised dung",
  "Volcanic ash", "Imcando hammer",
  // Vampyre / Morytania
  "Vyre noble shoes", "Vyre noble top", "Vyre noble legs",
  "Vyre noble hood", "Vyre noble robe", "Drakan's medallion",
  // Quest gear that doubles as combat
  "Keris partisan of the sun", "Keris partisan of breaching",
  "Keris partisan of corruption", "Keris partisan",
  // Misc quest items
  "Blackstone fragment", "Bloody key", "Stainless key",
  "Mossy key", "Ecumenical key"
]);

// ─── Other confirmed keepers (skilling enablers, essence, herblore tools) ──
export const MISC_KEEPERS = new Set([
  "Blood essence", "Blood essence (active)",
  "Dark essence fragments", "Daeyalt essence", "Guardian essence",
  "Pure essence", "Rune essence", "Elemental essence", "Catalytic essence",
  "Herb sack", "Gem bag", "Coal bag", "Looting bag", "Open looting bag",
  "Closed looting bag", "Seed box", "Plank sack", "Fish barrel", "Log basket",
  "Tackle box", "Bottomless compost bucket", "Bottomless bucket",
  "Rune pouch", "Divine rune pouch", "Moonclan rune pouch", "Eternal rune pouch",
  "Small pouch", "Medium pouch", "Large pouch", "Giant pouch", "Colossal pouch",
  "Massive pouch",
  "Pestle and mortar", "Lit bug lantern", "Bullseye lantern", "Oil lantern",
  "Tinderbox", "Bruma torch",
  "Compost", "Supercompost", "Ultracompost",
  "Strange device",
  "Mark of grace", "Hallowed mark"
  // Bird nest deliberately NOT here — community convention puts it in the
  // Skilling tab (Woodcutting / birdhouse byproduct). It gets routed via
  // the classifier's Skilling rule below, no keeper override needed.
  // Crushed nest also NOT here — it's a Herblore secondary (Saradomin brew
  // + Stamina potion ingredient), listed in HERBLORE_SECONDARY_NAMES
  // instead and routed to the Potions tab.
]);

// ─── Herb names (all grimy + clean variants are keepers) ────────────────────
export const HERB_TYPES = [
  "guam", "marrentill", "tarromin", "harralander", "ranarr", "ranarr weed",
  "toadflax", "spirit weed", "irit", "wergali", "avantoe", "kwuarm", "huasca",
  "snapdragon", "cadantine", "lantadyme", "dwarf weed", "torstol",
  "ardrigal", "rogue's purse", "sito foil", "snake weed", "volencia moss",
  "golpar", "buchu leaf", "noxifer"
];

// ─── Herblore secondaries that are cheap but stockpiled ─────────────────────
export const HERBLORE_SECONDARY_NAMES = new Set([
  "Eye of newt", "Limpwurt root", "Red spiders' eggs", "Red spider's eggs",
  "White berries", "Snape grass", "Dragon scale dust", "Wine of zamorak",
  "Mort myre fungus", "Crushed nest", "Goat horn dust", "Potato cactus",
  "Jangerberries", "Cactus spine", "Nihil dust", "Crystal dust",
  "Volcanic ash", "Aldarium", "Amylase crystal", "Mort myre stem",
  "Mort myre pear", "Chocolate dust", "Phoenix feather",
  "Stranger plant", "Lava scale shard", "Crushed superior dragon bones",
  "Coconut milk", "Bittercap mushroom", "Morchella mushroom",
  "Araxyte venom sack"
]);

// ─── Prefix patterns ────────────────────────────────────────────────────────
// Items whose names start with one of these are keepers regardless of value.
export const KEEPER_NAME_STARTS_WITH = [
  "Pet ", "Lil' ", "Baby ",
  ...SKILLING_OUTFIT_FAMILIES,
  // Champion scrolls — there are 13, just check the suffix.
];

// ─── Regex patterns (last-resort matchers) ──────────────────────────────────
export const KEEPER_PATTERNS: RegExp[] = [
  // Diary reward families with tier suffix.
  new RegExp(`^(${DIARY_REWARD_FAMILIES.map(escapeRegex).join("|")}) ?[1-4]$`, "i"),
  // Champion scroll suffix.
  /champion scroll/i,
  // Herb (grimy + clean).
  new RegExp(`^(grimy |clean )(${HERB_TYPES.join("|")})$`, "i"),
  /^(grimy|clean) [a-z' ]+(weed|leaf|moss|foil|purse)$/i,
  // Jars (everything Jar of …).
  /^jar of /i,
  // Sigil pieces + spirit shields.
  /(spectral|arcane|elysian|divine) sigil/i,
  // Hilts.
  /\b(bandos|saradomin|armadyl|zamorak) hilt\b/i,
  // Pet name suffix.
  /\bpet$/i,
  // Recipe scrolls / unique drops the player needs to assemble something.
  /(crystal|dragon|coconut|magic|yew|maple) seed$/i,
  // Achievement scrolls / charters.
  /achievement scroll/i,
  // Ironman-protected: anything labelled "(active)" usually = consumed charge.
  /\(active\)$/i,
  // Quest-unique book-shaped items.
  /book of (the dead|knowledge|spell|arcane knowledge)/i,
  // ─ Broad quest/boss/diary patterns (catch-all for cheap-but-keepable items)
  /^remnant of /i,                              // ToA tablet drops
  /^breach of /i,                               // ToA boss-key items
  /^seal of /i,                                 // quest passes (Lunar etc.)
  /\bornament kit\b/i,                          // cosmetic ornament kits
  /\bteleorb\b/i,                               // random event teleport
  /\bteleport orb\b/i,
  /\b(totem|totem base|totem middle|totem top)$/i, // dark totem family
  /^charged ice/i,                              // Some Like It Cold
  /\bfossilised\b/i,                            // fossil island
  /\bvyre (noble|corpse)\b/i,                   // Morytania disguise
  /^(stainless|bloody|brittle|gilded|crystal|mossy|ecumenical|brimstone|larran's|wilderness) key/i,
  /^keris (partisan|dagger)/i,                  // ToA upgrades + base
  /^(blackstone|crystal|menaphite|akhenaten)/i, // quest fragments
  /\bbellows\s?\(\d?\)?$/i,                     // ogre bellows (1/2/3)
  /^.*champion scroll$/i,                       // already covered but redundant
  /^.*\((empty|inactive|uncharged|broken)\)$/i, // any item with these suffixes — likely combat gear in storage form
  /^soul bearer$/i, /^bruma torch$/i, /^pyromancer/i,
  /\bmould$/i,                                  // crafting moulds (cannonball, ammo, etc.)
  /\bgreaves \(\d\)$/i,                         // shayzien armour tiers
  /\bsled$/i, /\blyre\b/i
];

// ─── Lookup helpers ─────────────────────────────────────────────────────────

const ALL_NAME_SETS: Set<string>[] = [
  PET_NAMES, SLAYER_EQUIPMENT_NAMES, SPECIAL_SLAYER_WEAPONS,
  CANNON_PARTS, CRYSTAL_NAMES, DT2_NAMES, QUEST_REUSE_NAMES,
  RECIPE_NAMES, HOLIDAY_NAMES, PROTECTED_CAPE_NAMES,
  MISC_KEEPERS, HERBLORE_SECONDARY_NAMES, QUEST_LOCKED_NAMES
];

/**
 * Returns true if the item is in any keeper category and must never be
 * flagged as junk. Pure name-based — no GE-value or quantity input needed.
 */
export function isKeeper(it: { name: string }): boolean {
  const name = it.name;
  for (const set of ALL_NAME_SETS) if (set.has(name)) return true;
  for (const prefix of KEEPER_NAME_STARTS_WITH) {
    if (name.startsWith(prefix)) return true;
  }
  for (const re of KEEPER_PATTERNS) if (re.test(name)) return true;
  return false;
}

/**
 * Classify a keeper into a coarse semantic group, so the bucket router can
 * send it to the right tab even when the regex/classifier missed it.
 */
export type KeeperCategory =
  | "pet"           // → Drops
  | "slayer-gear"   // → PvM Gear
  | "slayer-util"   // → PvM Gear
  | "demonbane"     // → PvM Gear
  | "cannon"        // → PvM Gear
  | "crystal"       // → PvM Gear (if equippable) else Quest
  | "dt2-drop"      // → Drops (unfinished) or PvM Gear (assembled)
  | "quest-item"    // → Quest
  | "recipe"        // → Drops
  | "holiday"       // → Cosmetic
  | "outfit"        // → Cosmetic / Skilling
  | "cape"          // → Quest (collection) or PvM Gear (combat capes)
  | "carrier"       // → Teleports / Skilling
  | "herb"          // → Potions
  | "secondary"     // → Potions
  | "essence"       // → Skilling
  | "diary"         // → Teleports (most diary rewards are utility)
  | "other-keeper";

export function keeperCategory(it: OrganizedItem): KeeperCategory | null {
  const name = it.name;
  if (PET_NAMES.has(name)) return "pet";
  if (name.startsWith("Pet ") || name.startsWith("Lil' ") || name.startsWith("Baby ")) return "pet";
  if (/\bpet$/i.test(name)) return "pet";
  if (SLAYER_EQUIPMENT_NAMES.has(name)) {
    // Some slayer items the classifier mislabels as weapons (Rock hammer
    // matches the `hammer` regex; Rock thrownhammer likewise). These are
    // inventory-only consumables, not worn weapons, so they belong in Misc.
    if (INVENTORY_ONLY_SLAYER_NAMES.has(name)) return "slayer-util";
    // Anything with an actual worn-slot is gear (Slayer helmet, Slayer's
    // staff, Boots of stone, Mirror shield, etc.).
    if (it.slot) return "slayer-gear";
    return /\b(helm|helmet|mask|amulet|ring|necklace|boots|shield|armour|guard|robe)\b/i.test(name)
      ? "slayer-gear" : "slayer-util";
  }
  if (SPECIAL_SLAYER_WEAPONS.has(name)) return "demonbane";
  if (CANNON_PARTS.has(name)) return "cannon";
  if (CRYSTAL_NAMES.has(name)) return "crystal";
  if (DT2_NAMES.has(name)) {
    // Assembled items (Voidwaker, Soulreaper axe, Virtus) are gear, not loot.
    if (/^(voidwaker|soulreaper axe|ring of shadows|virtus )/i.test(name)) return "dt2-drop";
    return "dt2-drop";
  }
  if (QUEST_REUSE_NAMES.has(name)) return "quest-item";
  if (QUEST_LOCKED_NAMES.has(name)) {
    // Sub-routing for the broad "quest-locked" set: Keris partisan family
    // and Vyre noble combat gear count as PvM gear; ToA remnants/tablets
    // and DT2 components are Drops; the rest defaults to Quest.
    if (/^keris partisan/i.test(name)) return "dt2-drop";  // routed to Drops
    if (/^vyre noble (top|legs|robe|hood)/i.test(name)) return "quest-item";
    if (/^remnant of |^breach of |^awakener|^ancient remnant|^.*tablet$|^chromium /i.test(name)) return "dt2-drop";
    if (/^holy wrench$|^lyre$|^enchanted lyre$|^sled$|^strange teleorb$|^drakan's medallion$/i.test(name)) return "diary";
    return "quest-item";
  }
  if (RECIPE_NAMES.has(name)) return "recipe";
  if (HOLIDAY_NAMES.has(name)) return "holiday";
  if (PROTECTED_CAPE_NAMES.has(name)) return "cape";
  if (MISC_KEEPERS.has(name)) {
    if (/essence$/i.test(name)) return "essence";
    if (/(bag|sack|barrel|basket|box|pouch|bucket)/i.test(name)) return "carrier";
    return "other-keeper";
  }
  if (HERBLORE_SECONDARY_NAMES.has(name)) return "secondary";
  // Herbs.
  if (KEEPER_PATTERNS[2].test(name) || KEEPER_PATTERNS[3].test(name)) return "herb";
  // Champion scroll.
  if (/champion scroll/i.test(name)) return "recipe";
  // Diary reward family.
  if (KEEPER_PATTERNS[0].test(name)) return "diary";
  // Jar.
  if (/^jar of /i.test(name)) return "dt2-drop";
  // Sigil/hilt.
  if (/(spectral|arcane|elysian|divine) sigil/i.test(name)) return "recipe";
  if (/\b(bandos|saradomin|armadyl|zamorak) hilt\b/i.test(name)) return "recipe";
  // Skilling outfit family.
  for (const prefix of SKILLING_OUTFIT_FAMILIES) {
    if (name.startsWith(prefix)) return "outfit";
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
