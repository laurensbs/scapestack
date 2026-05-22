// Classify an OSRS item by lowercased name into tab/subtab/slot/weight.
// First matching rule wins; rules are ordered most-specific first.

export type Tab =
  | "Jewellery" | "Combat" | "Range" | "Magic" | "Prayer" | "Food" | "Potions" | "Runes"
  | "Skilling" | "Resources" | "Tools" | "Quest" | "Clues" | "Trophy" | "Untradeables" | "Misc";

export type Slot =
  | "head" | "cape" | "neck" | "ammo" | "weapon" | "body" | "shield"
  | "legs" | "hands" | "feet" | "ring" | null;

export interface Classification {
  tab: Tab;
  subtab: string;
  slot: Slot;
  weight: number;
}

const TABS = {
  JEWELLERY: "Jewellery", COMBAT: "Combat", RANGE: "Range", MAGIC: "Magic", PRAYER: "Prayer",
  FOOD: "Food", POTIONS: "Potions", RUNES: "Runes",
  SKILLING: "Skilling", RESOURCES: "Resources", TOOLS: "Tools",
  QUEST: "Quest", CLUES: "Clues", TROPHY: "Trophy", UNTRADEABLE: "Untradeables", MISC: "Misc"
} as const satisfies Record<string, Tab>;

const SLOT_ORDER: Exclude<Slot, null>[] = [
  "head", "cape", "neck", "ammo", "weapon", "body", "shield", "legs",
  "hands", "feet", "ring"
];
const SLOT_WEIGHT = Object.fromEntries(SLOT_ORDER.map((s, i) => [s, i * 100])) as Record<string, number>;

const METAL_TIER = [
  "bronze", "iron", "steel", "black", "white", "mithril", "adamant", "rune",
  "granite", "dragon", "crystal", "barrows", "bandos", "armadyl", "ancestral",
  "torva", "virtus", "inquisitor", "justiciar", "obsidian"
];
const TIER_WEIGHT = Object.fromEntries(METAL_TIER.map((m, i) => [m, i]));

function tierWeight(name: string): number {
  for (const m of METAL_TIER) if (name.includes(m)) return TIER_WEIGHT[m];
  return METAL_TIER.length;
}

function detectSlot(name: string): Slot {
  if (/\b(full helm|coif|hood|hat|crown|halo|mask|helm|cowl|circlet|tiara|coif)\b/.test(name)) return "head";
  if (/\bcape|cloak\b/.test(name)) return "cape";
  if (/\b(amulet|necklace|pendant|symbol|torture|fury|glory|anguish|occult)\b/.test(name)) return "neck";
  if (/\b(arrow|bolt|dart|knife|javelin|throwing|chinchompa)s?\b/.test(name)) return "ammo";
  if (/\b(shield|defender|book|tome|ward|kiteshield|sq shield|dfs|elysian)\b/.test(name)) return "shield";
  if (/\b(boots|sandals|kinship|graceful boots|ranger boots)\b/.test(name)) return "feet";
  if (/\b(gloves|gauntlets|vambraces|bracers|mitts|ferocious gloves)\b/.test(name)) return "hands";
  // Legs — also catch barrows-style joined words like "leatherskirt", "chainskirt".
  if (/(platelegs|plateskirt|tassets|chaps|trousers|leggings|cuisse|robe bottom|skirt|chainskirt|leatherskirt)/.test(name)) return "legs";
  if (/\blegs\b/.test(name)) return "legs";
  // Body — joined words for Karil's "leathertop", Ahrim's "robetop" / "robe top".
  if (/(platebody|chestplate|chainbody|hauberk|cuirass|brassard|leathertop|robetop|robe top)/.test(name)) return "body";
  if (/\b(body|top)\b/.test(name)) return "body";
  if (/\b(ring of|seers ring|berserker ring|warrior ring|archers ring|treasonous|tyrannical|brimstone ring|ultor ring|venator ring|magus ring|lightbearer|ring$)\b/.test(name)) return "ring";
  // Weapon detection — match weapon keywords anywhere in name. `bow` and
  // `crossbow` use a suffix match (`bow$|crossbow$|bow\b`) so they catch both
  // standalone ("twisted bow") and joined forms ("magic shortbow", "rune
  // crossbow"). Without this, `\bbow\b` failed to match "shortbow" because
  // there's no word boundary between `t` and `b`.
  if (
    /\b(scimitar|sword|dagger|whip|mace|warhammer|hammer|battleaxe|axe|spear|hasta|halberd|godsword|claws|rapier|staff|wand|blowpipe|trident|tentacle|saeldor|inquisitor's mace|noxious|dharok|verac|guthan|torag|ahrim|scythe|fang|voidwaker|soulreaper|elder maul|shadow|sanguinesti|sang|nightmare staff|kodai|harmonised|volatile|eldritch|ancient sceptre|tumeken)\b/.test(name) ||
    /(?:^|[ -])(?:long|short|comp(?:osite)?|magic\s+)?bow$|(?:^|[ -])crossbow$|\bc'bow\b|\bbow\b/.test(name)
  ) return "weapon";
  return null;
}

type Partial = { tab: Tab; subtab?: string; weight?: number };
type Rule = [RegExp, Partial | ((name: string) => Partial | null)];

const RULES: Rule[] = [
  // ── Clues & treasure trail ────────────────────────────────────────────────
  // Clue scrolls + their bottles + caskets all live in one tab so you can
  // track progress and rewards together.
  [/^clue scroll \((beginner|easy|medium|hard|elite|master)\)$/,
    (name) => ({ tab: TABS.CLUES, subtab: "Clue scrolls", weight: clueWeight(name) })],
  [/^clue bottle \((beginner|easy|medium|hard|elite|master)\)$/,
    (name) => ({ tab: TABS.CLUES, subtab: "Clue bottles", weight: clueWeight(name) })],
  [/^(reward casket|sealed clue|challenge scroll|clue nest|key \(.*clue.*\))/,
    { tab: TABS.CLUES, subtab: "Caskets" }],

  // ── Marks of grace / agility ──────────────────────────────────────────────
  [/^mark of grace$/, { tab: TABS.SKILLING, subtab: "Agility" }],

  // ── Common food the generic regex missed ──────────────────────────────────
  [/^(kebab|baguette|premade.*pizza|chocolate bar|chocolate cake|wine of zamorak|jug of wine|purple sweets|toad's legs|garden pie|summer pie|fish pie|wild pie|admiral pie|botanical pie|dragonfruit pie|mushroom pie|chef's delight|gnomebowl|gnomecrunchies|equa leaves|raw beast meat|cooked beast meat)/,
    { tab: TABS.FOOD, subtab: "Baked" }],

  // ── Tab 1: Jewellery & Teleports (osrsadvice / luckycharmgold pattern) ────
  // R1 Currency, R2 Charged jewellery, R3 Teleport tablets,
  // R4 Teleport items, R5 Worn amulets, R6 Worn rings, R7 Diary rewards.
  [/^coins$/, { tab: TABS.JEWELLERY, subtab: "Currency", weight: -1000 }],
  [/^platinum token$/, { tab: TABS.JEWELLERY, subtab: "Currency", weight: -999 }],
  [/^(blood money|looting bag|rune pouch|divine rune pouch|herb sack|gem bag|coin pouch|seed box|fish barrel|log basket)$/,
    { tab: TABS.JEWELLERY, subtab: "Currency", weight: -500 }],
  [/^(ring of dueling|games necklace|amulet of glory|skills necklace|ring of wealth|combat bracelet|digsite pendant|enchanted lyre|burning amulet|necklace of passage|necklace of binding|slayer ring|amulet of chemistry|bracelet of slaughter|expeditious bracelet)(\s?\(\d+\))?$/,
    (name) => ({ tab: TABS.JEWELLERY, subtab: "Charged jewellery", weight: jewelleryWeight(name) })],
  [/^(ectophial|chronicle|royal seed pod|drakan's medallion|xeric's talisman|crystal teleport seed|enchanted lyre|spirit tree|fairy ring)/,
    { tab: TABS.JEWELLERY, subtab: "Teleport items" }],
  [/(scroll of redirection|teleport tablet|teleport to|house teleport|tablet$|teleport scroll|(teleport)(\s|$))/,
    { tab: TABS.JEWELLERY, subtab: "Teleport tablets" }],
  [/^(amulet of fury|amulet of torture|necklace of anguish|occult necklace|amulet of avarice|salve amulet|amulet of magic|amulet of strength|amulet of power|amulet of defence|berserker necklace|amulet of blood fury|amulet of rancour)(\(.*\))?$/,
    (name) => ({ tab: TABS.JEWELLERY, subtab: "Worn amulets", weight: tierWeight(name) })],
  [/^(berserker ring|archers ring|seers ring|warrior ring|brimstone ring|ring of suffering|tyrannical ring|treasonous ring|ultor ring|magus ring|venator ring|bellator ring|lightbearer)(\(.*\))?$/,
    (name) => ({ tab: TABS.JEWELLERY, subtab: "Worn rings", weight: tierWeight(name) })],
  [/(ardougne cloak|explorer's ring|karamja gloves|fremennik sea boots|wilderness sword|morytania legs|desert amulet|kandarin headgear|falador shield|varrock armour|western banner|kourend headgear)/,
    { tab: TABS.JEWELLERY, subtab: "Diary rewards" }],
  [/^(tome of fire|tome of water|book of darkness|book of law|book of balance|book of war)$/,
    { tab: TABS.MAGIC, subtab: "Off-hand", weight: 0 }],
  [/^(rune pouch|divine rune pouch|moonclan helmet)/, { tab: TABS.MAGIC, subtab: "Utility", weight: -10 }],

  // ── Trophy / unique collection ────────────────────────────────────────────
  // Pets, jars, untradeable boss uniques, holiday rares, third-age.
  // Players hate these getting buried in Misc.
  [/(^pet |pet ribbon|^baby |jar of |zulrah's scales jar)/, { tab: TABS.TROPHY, subtab: "Pets", weight: 0 }],
  [/(vorkath's head|kalphite princess|chompy chick|abyssal protector|cat\b|rock golem|olmlet|skotos|tzrek-jad|venenatis spiderling|callisto cub|prince black dragon|youngllef|chaos elemental jr)/,
    { tab: TABS.TROPHY, subtab: "Pets", weight: 1 }],
  [/^(jar of |skull of |head of |unsired)/, { tab: TABS.TROPHY, subtab: "Unique drops", weight: 5 }],
  [/(third-age|3rd age|gilded scimitar|gilded med helm|gilded full helm|gilded plate)/, { tab: TABS.TROPHY, subtab: "Rare cosmetics" }],
  [/(christmas cracker|partyhat|santa hat|halloween mask|disk of returning|cabbage cape|easter egg|h'ween mask)/, { tab: TABS.TROPHY, subtab: "Holiday rares", weight: 0 }],

  // ── Runecrafting essence / talismans / pouches → Skilling ────────────────
  [/^(pure essence|rune essence|daeyalt essence|guardian essence)$/, { tab: TABS.SKILLING, subtab: "Runecraft" }],
  [/talisman$/, { tab: TABS.SKILLING, subtab: "Runecraft" }],
  [/^(small pouch|medium pouch|large pouch|giant pouch|colossal pouch)$/, { tab: TABS.SKILLING, subtab: "Runecraft" }],
  [/^(binding necklace|tiara)$/, { tab: TABS.SKILLING, subtab: "Runecraft" }],

  // ── Standard runes (must come AFTER essence/talismans so 'rune talisman' wins) ─
  [/\brune$/, (name) => name.includes(" rune") && !name.startsWith("rune ") ? { tab: TABS.RUNES, subtab: "Runes" } : null],
  [/^(air|water|earth|fire|mind|body|cosmic|chaos|nature|law|death|blood|soul|astral|wrath|mist|dust|smoke|steam|mud|lava|elder) rune$/, { tab: TABS.RUNES, subtab: "Runes" }],
  [/\brune pack$/, { tab: TABS.RUNES, subtab: "Packs" }],

  // ── Plain (non-charged) jewellery: just bracelets/rings/amulets without a name we recognized → Jewellery / Worn rings ─
  [/^(emerald|ruby|diamond|dragonstone|onyx|sapphire|opal|jade|topaz|red topaz|zenyte) bracelet$/,
    { tab: TABS.JEWELLERY, subtab: "Worn amulets" }],
  [/^(emerald|ruby|diamond|dragonstone|onyx|sapphire|opal|jade) ring$/,
    { tab: TABS.JEWELLERY, subtab: "Worn rings" }],
  [/^(emerald|ruby|diamond|dragonstone|onyx|sapphire|opal|jade) necklace$/,
    { tab: TABS.JEWELLERY, subtab: "Worn amulets" }],
  [/^(emerald|ruby|diamond|dragonstone|onyx|sapphire|opal|jade) amulet$/,
    { tab: TABS.JEWELLERY, subtab: "Worn amulets" }],

  [/(anglerfish|manta ray|dark crab|sea turtle|shark|monkfish|swordfish|tuna|lobster|salmon|trout|bass|cod|herring|sardine|pike|karambwan|cooked karambwan)/, (name) => ({ tab: TABS.FOOD, subtab: "Fish", weight: foodWeight(name) })],
  [/(cake|chocolate cake|bread|pie|stew|pizza)/, { tab: TABS.FOOD, subtab: "Baked" }],
  [/(raw\s)/, { tab: TABS.SKILLING, subtab: "Raw fish" }],

  [/\bpotion\(\d\)$/, (name) => ({ tab: TABS.POTIONS, subtab: potionSubtab(name), weight: potionWeight(name) })],
  [/^(saradomin brew|super combat|stamina|prayer|super restore|sanfew|antifire|antidote|combat potion|attack potion|strength potion|defence potion|ranging potion|magic potion|super attack|super strength|super defence|super ranging|super magic|divine|bastion|battlemage|ancient brew|forgotten brew|zamorak brew|guthix rest)/, (name) => ({ tab: TABS.POTIONS, subtab: potionSubtab(name), weight: potionWeight(name) })],
  [/^vial( of water)?$/, { tab: TABS.POTIONS, subtab: "Vials" }],

  [/^bones to (peaches|bananas)/, { tab: TABS.JEWELLERY, subtab: "Teleport tablets" }],
  [/(^bones$|big bones|dragon bones|wyvern bones|ourg bones|superior dragon bones|dagannoth bones|babydragon bones|^fayrg bones|^raurg bones|zogre bones|jogre bones|wolf bones)/, { tab: TABS.PRAYER, subtab: "Bones" }],
  [/\bashes$/, { tab: TABS.PRAYER, subtab: "Ashes" }],
  [/^ensouled .* head$/, { tab: TABS.PRAYER, subtab: "Ensouled heads" }],

  // Herbs: grimy prefix, "clean " prefix, OR the bare clean-herb item names
  // (Guam leaf, Marrentill, Tarromin, Harralander, Ranarr weed, Toadflax,
  // Irit leaf, Avantoe, Kwuarm, Huasca, Snapdragon, Cadantine, Lantadyme,
  // Dwarf weed, Torstol). OSRS doesn't use a "Clean " prefix for these —
  // the cleaned herb just keeps the plant's bare name — so the regex needs
  // to match exactly those names too.
  [/^(grimy |clean )/, { tab: TABS.SKILLING, subtab: "Herbs" }],
  [/^(guam leaf|marrentill|tarromin|harralander|ranarr weed|toadflax|irit leaf|avantoe|kwuarm|huasca|snapdragon|cadantine|lantadyme|dwarf weed|torstol)$/, { tab: TABS.SKILLING, subtab: "Herbs" }],
  [/(unfinished potion|harralander potion|guam potion|marrentill potion|tarromin potion|ranarr potion|irit potion|avantoe potion|kwuarm potion|cadantine potion|lantadyme potion|dwarf weed potion|torstol potion)/, { tab: TABS.SKILLING, subtab: "Herblore" }],
  [/(seed|sapling|allotment seed|flower seed|herb seed|tree seed|fruit tree seed|hops seed)/, { tab: TABS.SKILLING, subtab: "Farming" }],
  [/(logs|pyre logs)$/, { tab: TABS.SKILLING, subtab: "Logs", weight: 0 }],
  [/(plank|wooden plank|oak plank|teak plank|mahogany plank)/, { tab: TABS.SKILLING, subtab: "Construction" }],
  [/(\bore$|coal$|ingot)/, { tab: TABS.SKILLING, subtab: "Ore" }],
  [/(\bbar$|gold bar|silver bar)/, { tab: TABS.SKILLING, subtab: "Bars" }],
  [/(uncut |^cut )/, { tab: TABS.SKILLING, subtab: "Gems" }],
  [/(feather|chinchompa|bird's egg|raw chicken|raw beef)/, { tab: TABS.SKILLING, subtab: "Hunter" }],

  // ── Farming produce (bare item names — not seeds, the actual fruit/veg) ──
  // OSRS doesn't tag these as anything skilling-related so the default tab
  // is Misc. They're crop output from Farming, so route them there.
  [/^(pineapple|cooking apple|apple|banana|orange|lemon|lime|watermelon|tomato|strawberry|potato|onion|cabbage|sweetcorn|jangerberries|cadava berries|whiteberries|white berries|dwellberries|redberries|poison ivy berries|wineberries|coconut|papaya fruit|papaya|dragonfruit|pineapple chunks|pineapple ring|orange chunks|orange slices|orange peel|banana peel|chocolate bar|chocolate dust)$/,
    { tab: TABS.SKILLING, subtab: "Farming" }],

  // ── Battlestaff orbs (Crafting input — combined with battlestaff to make
  // elemental battlestaves). Their primary use is skilling supply, not
  // boss-drop trophy, so route them to Skilling.
  [/^(unpowered orb|air orb|water orb|earth orb|fire orb|cosmic orb|chaos orb)$/,
    { tab: TABS.SKILLING, subtab: "Crafting" }],

  // ── Crafting raw materials and intermediates ─────────────────────────────
  // Flax + bowstring (Crafting), wool family (Crafting), glassblowing inputs
  // (Crafting), pottery/clay (Crafting). Without an explicit rule these all
  // fall to Misc.
  [/^(flax|bowstring|crossbow string|ball of wool|wool|spider silk|spider's silk|spider chitin|leather|hard leather|hardleather|red leather|black leather|snakeskin|snake hide|yak[ -]?hide|cow hide|cowhide|bear fur|polar kebbit fur|chinchompa fur|kebbit fur)$/,
    { tab: TABS.SKILLING, subtab: "Crafting" }],
  [/^(soft clay|hard clay|empty plant pot|plant pot|filled plant pot|bucket of sand|sand|molten glass|seaweed|edible seaweed|giant seaweed|soda ash|swamp tar|tar|bowl of water|empty bowl|jug|jug of water|cup of water|empty cup|tin can)$/,
    { tab: TABS.SKILLING, subtab: "Crafting" }],
  [/^(empty vial|vial|enchanted vial)$/, { tab: TABS.POTIONS, subtab: "Vials" }],

  // ── Prayer-skilling items (bones / shards / ashes that fall through) ─────
  // The earlier bones rule lists specific bone types but misses Blessed bones
  // and recent Necromancy/Prayer drops. Catch them here.
  [/^(blessed bones?|blessed bone shards?|blessed bone statuette|impious ashes|accursed ashes|infernal ashes|vile ashes|malicious ashes|fiendish ashes|abyssal ashes)$/,
    { tab: TABS.PRAYER, subtab: "Bones" }],

  // ── Herblore secondaries (route to Potions tab) ──────────────────────────
  // These are the common potion-ingredient items players keep next to their
  // potion stash. Many fall through to Misc/Other without an explicit rule.
  [/^(limpwurt root|snape grass|red spiders' eggs|red spider's eggs|eye of newt|white berries|wine of zamorak|chocolate dust|crushed nest|crushed bird nest|goat horn dust|potato cactus|jangerberries|cactus spine|nihil dust|crystal dust|amylase crystal|aldarium|mort myre fungus|mort myre stem|mort myre pear|volcanic ash|swamp tar|coconut milk|lava scale shard|toad's legs|toads legs|unicorn horn dust|unicorn horn|phoenix feather|ground mud rune|magic essence)$/,
    { tab: TABS.SKILLING, subtab: "Herblore" }],

  [/(pickaxe|hatchet|knife|tinderbox|chisel|harpoon|fishing rod|fly fishing rod|small fishing net|big fishing net|lobster pot|butterfly net|bird snare|box trap|noose wand|spade|rake|seed dibber|secateurs|watering can|gardening trowel|compost|imcando hammer|hammer$)/, { tab: TABS.TOOLS, subtab: "Skilling tools" }],
  [/(crafting cape|magic cape|max cape|completionist cape)/, { tab: TABS.UNTRADEABLE, subtab: "Skill capes", weight: 0 }],

  [/(quest|key$|gilded key|crystal key|loop half|tooth half|brimstone key|sliding piece|puzzle box|relic part|musical|enchanted bar|silver pendant)/, { tab: TABS.QUEST, subtab: "Quest" }],

  [/(bow$|shortbow|longbow|crossbow$|composite bow|magic shortbow|magic longbow|toxic blowpipe|twisted bow|bow of faerdhinen|zaryte crossbow|armadyl crossbow|dragon crossbow|dragon hunter crossbow|karil's|crystal bow)/, (name) => ({ tab: TABS.RANGE, subtab: "Weapons", weight: tierWeight(name) })],
  [/(arrow|bolt|dart|knife|javelin)s$/, { tab: TABS.RANGE, subtab: "Ammo" }],
  [/(coif|leather|studded|d'hide|dragonhide|ranger|black d'hide|red d'hide|blue d'hide|green d'hide|crystal armour|armadyl chestplate|armadyl chainskirt|armadyl helmet|masori|pegasian|ava's)/, (name) => ({ tab: TABS.RANGE, subtab: "Armour", weight: tierWeight(name) + slotWeight(name) / 1000 })],

  [/(staff$|staff of|wand$|trident|sceptre|sang|harmonised|volatile|nightmare staff|kodai|master wand|ancient staff|iban's staff|toxic staff|powered staff)/, (name) => ({ tab: TABS.MAGIC, subtab: "Weapons", weight: tierWeight(name) })],
  [/(robe|mystic|ancestral|virtus|dagon'hai|infinity|3rd age mage|ahrim's|elder chaos|swampbark|bloodbark|splitbark)/, (name) => ({ tab: TABS.MAGIC, subtab: "Armour", weight: tierWeight(name) + slotWeight(name) / 1000 })],
  [/(tome of|book of (darkness|law|balance|war))/, { tab: TABS.MAGIC, subtab: "Off-hand" }],

  [/(scimitar|longsword|sword$|dagger|whip|mace|warhammer|battleaxe|godsword|claws|rapier|saeldor|hasta|halberd|tentacle|sara sword|blade of saeldor|scythe of vitur|^scythe|elder maul|inquisitor's mace|noxious|ghrazi rapier|osmumten's fang|abyssal dagger)/, (name) => ({ tab: TABS.COMBAT, subtab: weaponSubtab(name), weight: tierWeight(name) })],
  [/(platebody|chainbody|platelegs|plateskirt|kiteshield|full helm|sq shield|defender|gilded|bandos|torva|justiciar|fighter torso|fire cape|infernal cape|amulet of|dragon boots|dragon gloves|barrows gloves|necklace|amulet)/, (name) => ({ tab: TABS.COMBAT, subtab: armourSubtab(name), weight: tierWeight(name) + slotWeight(name) / 1000 })],

  [/(dragon bones|babydragon bones|wyvern bones|ourg bones|superior dragon bones)/, { tab: TABS.PRAYER, subtab: "Bones" }],
  [/(hide|dragonhide|red dragonhide|blue dragonhide|green dragonhide|black dragonhide)/, { tab: TABS.RESOURCES, subtab: "Hides" }],
  // Bird nests are a Woodcutting / Birdhouse-trapping byproduct, NOT a PvM
  // drop. Community convention puts them in the Skilling tab next to logs
  // and seeds, where they live in birdhouse-run rotations. Excludes
  // "Crushed nest" (the Saradomin brew secondary — already routed to
  // Herblore above) and "Clue nest (…)" (already routed to Clues).
  [/^(bird nest|bird nest \((?:red|gold|green|blue)\)|seed nest|egg nest|ring nest|hespori seed nest|wyson the gardener nest|bird's nest|bird's-?nest)$/i,
    { tab: TABS.SKILLING, subtab: "Hunter" }],
  [/(scale|zulrah's scales)/, { tab: TABS.RESOURCES, subtab: "Drops" }],

  [/(slayer helmet|black mask|salve amulet ?\(.*\)|^imbued )/, (name) => ({ tab: TABS.COMBAT, subtab: "Slayer", weight: slotWeight(name) })],
  // Untradeables: word-boundary-anchored to avoid false positives. "void" was
  // matching "voidwaker" (the spec weapon); "defender" was matching nothing
  // beyond what we already capture in Combat — so we omit it from this rule.
  [/(graceful|ardougne cloak|fire cape|infernal cape|fighter torso|\bvoid (?:knight|mage|melee|ranger|elite|seal)\b|elite void|barrows gloves|max cape|completionist cape|\bvoid (?:top|robe|gloves|helm))/, (name) => ({ tab: TABS.UNTRADEABLE, subtab: "Achievement", weight: slotWeight(name) })]
];

function foodWeight(name: string): number {
  const order = ["anglerfish", "manta ray", "dark crab", "sea turtle", "shark", "monkfish", "swordfish", "lobster", "tuna", "bass", "salmon", "trout", "pike", "cod", "herring", "sardine", "karambwan"];
  for (let i = 0; i < order.length; i++) if (name.includes(order[i])) return i;
  return 999;
}

function potionSubtab(name: string): string {
  if (/(saradomin brew|super combat|combat potion)/.test(name)) return "Combat";
  if (/(prayer|super restore|sanfew)/.test(name)) return "Restore";
  if (/(stamina|energy)/.test(name)) return "Stamina";
  if (/(antifire|antidote|antipoison|antivenom)/.test(name)) return "Defensive";
  if (/(super attack|super strength|super defence|attack potion|strength potion|defence potion)/.test(name)) return "Melee";
  if (/(ranging|super ranging|bastion)/.test(name)) return "Range";
  if (/(magic|super magic|battlemage|ancient brew|forgotten brew)/.test(name)) return "Magic";
  if (/(divine)/.test(name)) return "Divine";
  return "Other";
}

function potionWeight(name: string): number {
  if (name.includes("divine")) return 0;
  if (name.includes("super combat") || name.includes("saradomin brew")) return 1;
  if (name.includes("super")) return 2;
  if (name.includes("ancient brew") || name.includes("forgotten brew")) return 3;
  return 5;
}

function weaponSubtab(name: string): string {
  if (/whip|tentacle/.test(name)) return "Whips";
  if (/scythe/.test(name)) return "2H/Special";
  if (/godsword|battleaxe|claws|halberd|2h sword|elder maul/.test(name)) return "2H/Special";
  if (/scimitar|longsword|rapier|saeldor|abyssal/.test(name)) return "Slash";
  if (/dagger|^sword$|sword\(|fang/.test(name)) return "Stab";
  if (/mace|warhammer|hasta|inquisitor/.test(name)) return "Crush";
  return "Other";
}

function armourSubtab(name: string): string {
  if (/torva|bandos|justiciar/.test(name)) return "End-game";
  if (/barrows|dharok|verac|guthan|torag|ahrim|karil/.test(name)) return "Barrows";
  if (/dragon|crystal|granite|obsidian/.test(name)) return "High tier";
  return "Standard";
}

function slotWeight(name: string): number {
  const slot = detectSlot(name);
  return slot ? SLOT_WEIGHT[slot] : 999;
}

function jewelleryWeight(name: string): number {
  // Higher charges first within the same item (glory(6) before glory(1)).
  const m = name.match(/\((\d+)\)/);
  const charges = m ? parseInt(m[1], 10) : 0;
  return -charges; // negative so higher charges sort first
}

function clueWeight(name: string): number {
  // Sort clue tiers: beginner < easy < medium < hard < elite < master
  const order = ["beginner", "easy", "medium", "hard", "elite", "master"];
  for (let i = 0; i < order.length; i++) if (name.includes(order[i])) return i;
  return 99;
}

// ── Wiki-fact layer ─────────────────────────────────────────────────────────
// The regex RULES above encode hand-curated OSRS community knowledge — they
// know that an "Amulet of fury" belongs in the Jewellery tab, that a "Bandos
// chestplate" is end-game melee. Those specific calls should always win.
//
// But the regex *fallback* — anything that drops through to Misc — is a pure
// guess. That's where the Wiki facts come in: equipment slot, combat style and
// associated skill are hard data from oldschool.runescape.wiki (see
// scripts/build-item-data.mjs). When the regex layer is uncertain we let those
// facts decide, so newly-released or obscure items land correctly without a
// new hand-written rule.

// Minimal shape the classifier needs from an ItemMeta record. Kept structural
// so classifier.ts has no import dependency on item-meta.ts (which is
// server-only) — the organizer passes a plain object through.
export interface ClassifierMeta {
  slot: string | null;
  style: string | null;
  skills: string[];
  kinds: string[];
  clue: string | null;
}

// Wiki equipment-slot strings line up 1:1 with our Slot union, except the
// Wiki has no slot for ammo-less thrown weapons — handled by the null guard.
const META_SLOTS: ReadonlySet<string> = new Set(SLOT_ORDER);

function metaSlot(meta: ClassifierMeta): Slot {
  return meta.slot && META_SLOTS.has(meta.slot) ? (meta.slot as Slot) : null;
}

// Decide a tab purely from Wiki facts. Returns null when the facts don't
// point anywhere confident — the caller then keeps the regex result.
// An "unfinished" marker in the name: unstrung bows, unfinished bolts, etc.
// The Wiki tags these with the *finished* item's equipment slot + combat
// style (a "Willow longbow (u)" carries slot:weapon, style:ranged) even
// though the item itself is a Fletching intermediate, not wearable gear.
const UNFINISHED_MARKER = /\(u\)|\bunstrung\b|\bunf\b|\bunfinished\b|\bunpolished\b/;

function classifyFromMeta(meta: ClassifierMeta, lower: string): Classification | null {
  const slot = metaSlot(meta);
  const kinds = new Set(meta.kinds);
  const skills = new Set(meta.skills);

  // 0. Unfinished crafting/fletching/smithing intermediates that the Wiki
  //    tagged with the *finished* item's slot+style — route to Skilling by
  //    the production skill BEFORE the combat rule below would mistake them
  //    for wearable gear. Guarded by both a skill tag and a name marker so
  //    a genuinely-named weapon ("Crystal bow (u)" doesn't exist, but be
  //    safe) can't be misrouted.
  if (slot && UNFINISHED_MARKER.test(lower) &&
      (skills.has("fletching") || skills.has("crafting") || skills.has("smithing"))) {
    return { tab: TABS.SKILLING, subtab: pickSkill(skills), slot: null, weight: 450 };
  }

  // 1. Consumables first — kind tags are unambiguous, and a few consumables
  //    (Holy water occupies the weapon slot) would otherwise be pulled into a
  //    combat tab by the slot rule below. A potion is a potion.
  if (kinds.has("potion")) {
    return { tab: TABS.POTIONS, subtab: potionSubtab(lower), slot: null, weight: potionWeight(lower) };
  }
  if (kinds.has("food")) {
    return { tab: TABS.FOOD, subtab: "Cooked", slot: null, weight: foodWeight(lower) };
  }
  if (kinds.has("rune")) {
    return { tab: TABS.RUNES, subtab: "Runes", slot: null, weight: 0 };
  }

  // 2. Equipable combat gear → Combat / Range / Magic by Wiki combat style.
  //    This is the single biggest accuracy win: a "style" tag means the Wiki
  //    explicitly classed the item as melee/ranged/magic armour or weapon.
  if (meta.style && slot) {
    const tab: Tab =
      meta.style === "ranged" ? TABS.RANGE :
      meta.style === "magic"  ? TABS.MAGIC :
      TABS.COMBAT;
    const subtab = kinds.has("weapon") ? "Weapons" : armourSubtab(lower);
    return { tab, subtab, slot, weight: SLOT_WEIGHT[slot] + tierWeight(lower) };
  }

  // 3. Clue rewards — route to the Clues tab with the tier as weight.
  if (kinds.has("clue") && meta.clue) {
    return { tab: TABS.CLUES, subtab: "Rewards", slot: null, weight: clueWeight(meta.clue) };
  }

  // 4. Pets → Trophy.
  if (kinds.has("pet")) {
    return { tab: TABS.TROPHY, subtab: "Pets", slot: null, weight: 1 };
  }

  // 5. Skilling tools — an axe, pickaxe or harpoon occupies the weapon slot
  //    but is a *tool* first. The Wiki tags these `kind:tool` with a gathering
  //    skill and no combat style, so route them to Skilling under that skill
  //    BEFORE the generic slot rule below would pull them into Combat.
  if (kinds.has("tool") && skills.size > 0) {
    return { tab: TABS.SKILLING, subtab: pickSkill(skills), slot: null, weight: 400 };
  }

  // 6. Equipable item with a slot but no combat style — gear the Wiki didn't
  //    class as combat (graceful, skilling outfits, cosmetics). Bucket by slot
  //    under Combat as a sane home rather than Misc.
  if (slot) {
    return { tab: TABS.COMBAT, subtab: "Other gear", slot, weight: SLOT_WEIGHT[slot] + 800 };
  }

  // 7. Skilling supplies — a skill tag with no slot means raw material /
  //    tool / output. Route to Skilling under the skill's own subtab.
  if (skills.size > 0) {
    const skill = pickSkill(skills);
    return { tab: TABS.SKILLING, subtab: skill, slot: null, weight: 500 };
  }

  return null;
}

// When the Wiki lists several skills for one item (e.g. Logs → woodcutting,
// fletching, crafting) pick the most specific producer skill for the subtab.
const SKILL_PRIORITY = [
  "herblore", "farming", "runecraft", "construction", "smithing",
  "fletching", "crafting", "cooking", "fishing", "mining",
  "woodcutting", "hunter", "prayer", "magic"
];
function pickSkill(skills: Set<string>): string {
  for (const s of SKILL_PRIORITY) {
    if (skills.has(s)) return s[0].toUpperCase() + s.slice(1);
  }
  const first = [...skills][0] ?? "Other";
  return first[0].toUpperCase() + first.slice(1);
}

// Tabs the Wiki's combat-gear facts are allowed to override the regex on.
// For these, "is this melee/ranged/magic gear" is an equipment stat the Wiki
// knows for certain — the regex only ever guesses it from name keywords
// (and gets fooled: "Bandos chaps" is Ranged armour, not melee Godwars gear).
const COMBAT_TABS: ReadonlySet<Tab> = new Set([TABS.COMBAT, TABS.RANGE, TABS.MAGIC]);

export function classify(name: string, meta?: ClassifierMeta | null): Classification {
  if (!name) return fallback();
  const lower = name.toLowerCase();

  let regexResult: Classification | null = null;
  for (const [pattern, action] of RULES) {
    if (pattern.test(lower)) {
      const result = typeof action === "function" ? action(lower) : action;
      if (result) { regexResult = finalize(result, lower); break; }
    }
  }

  // 1. Wiki combat-gear is authoritative. When the Wiki records an equipment
  //    slot AND a combat style, the item *is* melee/ranged/magic gear and the
  //    Wiki — not a name-keyword guess — decides which combat tab it lands in.
  //    This is the heart of "the Wiki is always right": the regex can mis-read
  //    "Bandos chaps" as melee, the Wiki knows it needs 70 Ranged.
  if (meta && meta.style && metaSlot(meta) && !meta.kinds.includes("tool")
      && !UNFINISHED_MARKER.test(lower)) {
    const metaResult = classifyFromMeta(meta, lower);
    if (metaResult && COMBAT_TABS.has(metaResult.tab)) {
      // Keep the regex's subtab/weight when it agreed on the same tab — the
      // hand-curated rules carry finer grouping (Barrows set, End-game tier).
      if (regexResult && regexResult.tab === metaResult.tab) return regexResult;
      return metaResult;
    }
  }

  // 2. Wiki consumable kinds are authoritative too. `kind:potion`/`food`/`rune`
  //    is a hard fact; the regex can collide on a name fragment ("Kodai potion"
  //    matches the "kodai" weapon keyword, "Cat antipoison" matches "cat").
  //    A potion is a potion regardless of what word sits in its name.
  if (meta) {
    const kinds = meta.kinds;
    if (kinds.includes("potion"))
      return { tab: TABS.POTIONS, subtab: potionSubtab(lower), slot: null, weight: potionWeight(lower) };
    if (kinds.includes("food") && !meta.slot)
      return { tab: TABS.FOOD, subtab: "Cooked", slot: null, weight: foodWeight(lower) };
    if (kinds.includes("rune"))
      return { tab: TABS.RUNES, subtab: "Runes", slot: null, weight: 0 };
  }

  // 2. The regex layer is authoritative for everything it confidently places
  //    that the Wiki didn't claim as combat gear — named teleports, clues,
  //    potions, jewellery: OSRS conventions that aren't equipment stats.
  if (regexResult && regexResult.tab !== TABS.MISC) return regexResult;

  // 3. Wiki facts rescue whatever the regex left in Misc — slot/skill/kind
  //    place obscure or new items the rules never covered.
  if (meta) {
    const metaResult = classifyFromMeta(meta, lower);
    if (metaResult) return metaResult;
  }

  return regexResult ?? fallback(lower);
}

function finalize(partial: Partial, lower: string): Classification {
  const slot = detectSlot(lower);
  const weight = partial.weight ?? ((slot ? SLOT_WEIGHT[slot] : 500) + tierWeight(lower));
  return {
    tab: partial.tab,
    subtab: partial.subtab || "Other",
    slot,
    weight
  };
}

function fallback(lower?: string): Classification {
  return { tab: TABS.MISC, subtab: "Other", slot: lower ? detectSlot(lower) : null, weight: 999 };
}

// Tab order follows community convention: Tab 1 is jewellery/teleports
// (most-used, top-left), then combat gear, then consumables, then resources,
// then collection/trophies, then misc. Empty tabs get skipped at render time.
export const TAB_ORDER: Tab[] = [
  "Jewellery",
  "Combat", "Range", "Magic", "Prayer",
  "Food", "Potions", "Runes",
  "Skilling", "Resources", "Tools",
  "Quest", "Clues", "Trophy", "Untradeables", "Misc"
];
