// Untradeable & milestone goal definitions. Each goal can be matched against
// a bank export by either a specific item id list (preferred) OR a name regex
// (fallback for variant items like trimmed/charged versions).
//
// We deliberately focus on UNTRADEABLE goals because:
//   - they're earned, not bought — meaningful progress
//   - they don't fluctuate with GE prices
//   - ironmen care about them obsessively
//
// Sources: oldschool.runescape.wiki + community knowledge.

export interface Goal {
  id: string;              // stable slug for React + dismissal storage
  name: string;            // display name
  itemIds?: number[];      // any matching id counts as "have it"
  namePattern?: RegExp;    // fallback name match (lowercased)
  notes?: string;          // 1-line context, shown on hover

  // Supersedes: owning this goal's item satisfies these earlier goals.
  // E.g. Infernal cape supersedes Fire cape. Slayer helm supersedes Black mask.
  // Karamja gloves 4 supersedes 1, 2, and 3.
  // Listed as the EARLIER goal slugs (the ones this one fulfils).
  supersedes?: string[];

  // Tier within its parent set (for "Tier 3/4" display when grouped).
  // If set, only the highest unlocked tier is shown by default; lower tiers
  // collapse into a "earned through Tier N" badge.
  tier?: number;
}

export interface GoalSet {
  id: string;
  name: string;
  category: GoalCategory;
  emoji?: string;
  /** OSRS sprite ID — preferred over emoji when rendering the set header. */
  iconItemId?: number;
  description?: string;    // 1-line, shown in collapsed view
  goals: Goal[];
}

export type GoalCategory =
  | "capes"
  | "combat-prestige"
  | "diary"
  | "skill-outfits"
  | "barrows"
  | "gwd"
  | "wildy-bosses"
  | "raid-uniques"
  | "graceful"
  | "quest-uniques"
  | "misc-untradeable";

export const GOAL_CATEGORIES: Record<GoalCategory, { label: string; order: number }> = {
  capes:              { label: "Capes",                order: 1 },
  "combat-prestige":  { label: "Combat prestige",      order: 2 },
  diary:              { label: "Achievement diaries",  order: 3 },
  graceful:           { label: "Graceful",             order: 4 },
  barrows:            { label: "Barrows sets",         order: 5 },
  gwd:                { label: "GWD sets",             order: 6 },
  "raid-uniques":     { label: "Raid uniques",         order: 7 },
  "wildy-bosses":     { label: "Wildy boss uniques",   order: 8 },
  "skill-outfits":    { label: "Skilling outfits",     order: 9 },
  "quest-uniques":    { label: "Quest rewards",        order: 10 },
  "misc-untradeable": { label: "Other untradeables",   order: 11 }
};

// Archetype-specific category priority for the goals page. The default
// `order` field above is used for "unspecified" / "main"; the lists below
// pull combat-relevant categories to the front for PvMers/ironmen, and
// skilling-relevant categories first for skillers.
type GoalArchetype = "main" | "pvm" | "skiller" | "ironman" | "unspecified";

const GOAL_CATEGORY_ORDER_BY_ARCHETYPE: Record<GoalArchetype, GoalCategory[]> = {
  unspecified: ["capes", "combat-prestige", "diary", "graceful", "barrows", "gwd", "raid-uniques", "wildy-bosses", "skill-outfits", "quest-uniques", "misc-untradeable"],
  main:        ["capes", "combat-prestige", "diary", "graceful", "barrows", "gwd", "raid-uniques", "wildy-bosses", "skill-outfits", "quest-uniques", "misc-untradeable"],
  // PvMer cares about raid + GWD + wildy uniques + combat prestige first.
  pvm:         ["combat-prestige", "raid-uniques", "gwd", "wildy-bosses", "barrows", "capes", "diary", "quest-uniques", "graceful", "skill-outfits", "misc-untradeable"],
  // Ironman: every untradeable matters — capes + diary + skilling first, since
  // those mark account progression milestones unique to ironman play.
  ironman:     ["capes", "diary", "skill-outfits", "graceful", "combat-prestige", "raid-uniques", "gwd", "barrows", "wildy-bosses", "quest-uniques", "misc-untradeable"],
  // Skiller: skill capes + outfits + diaries lead.
  skiller:     ["skill-outfits", "capes", "diary", "graceful", "quest-uniques", "misc-untradeable", "combat-prestige", "barrows", "gwd", "raid-uniques", "wildy-bosses"]
};

/**
 * Return the goal-category display order tailored to the given archetype.
 * Falls back to the default order when archetype is unknown.
 */
export function goalCategoryOrder(archetype: string | null | undefined): GoalCategory[] {
  if (archetype && archetype in GOAL_CATEGORY_ORDER_BY_ARCHETYPE) {
    return GOAL_CATEGORY_ORDER_BY_ARCHETYPE[archetype as GoalArchetype];
  }
  return GOAL_CATEGORY_ORDER_BY_ARCHETYPE.unspecified;
}

// ── Hiscores → unlocked-capes synthesis ────────────────────────────────────
// Map each OSRS skill (as it appears in the Hiscores response) to the
// canonical skill cape item-id. When the player gives us an RSN we fetch
// their Hiscores, and for every skill at level 99 we emit the corresponding
// cape id so checkCompletion() ticks the cape even when the cape itself
// isn't in the player's bank — they've earned the 99, that's what matters.
const SKILL_CAPE_ITEM_IDS: Record<string, number> = {
  Attack:       9747,
  Strength:     9750,
  Defence:      9753,
  Hitpoints:    9768,
  Ranged:       9756, // "Ranging cape" — Hiscores uses "Ranged" as skill name
  Prayer:       9759,
  Magic:        9762,
  Cooking:      9801,
  Woodcutting:  9807,
  Fletching:    9783,
  Fishing:      9798,
  Firemaking:   9804,
  Crafting:     9780,
  Smithing:     9795,
  Mining:       9792,
  Herblore:     9774,
  Agility:      9771,
  Thieving:     9777,
  Slayer:       9786,
  Farming:      9810,
  Runecraft:    9765,
  Hunter:       9948,
  Construction: 9789, // OSRS in-game name: "Construct. cape"
  Sailing:      31288
};

interface HiscoreSkillLike { name: string; level: number }

/**
 * Convert a Hiscores skills array into a list of pseudo-items the goal
 * tracker can treat as "owned". For every skill at level 99 we emit the
 * corresponding skill cape; for Quest cape we'd need quest-progress data
 * (not in Hiscores), so milestone capes still require the actual item.
 */
export function unlockedFromHiscores(skills: HiscoreSkillLike[]): Array<{ id: number; name: string }> {
  const out: Array<{ id: number; name: string }> = [];
  for (const s of skills) {
    if (s.level < 99) continue;
    const itemId = SKILL_CAPE_ITEM_IDS[s.name];
    if (itemId) out.push({ id: itemId, name: `${s.name} cape` });
  }
  return out;
}

// ── Goal sets ──────────────────────────────────────────────────────────────

export const GOAL_SETS: GoalSet[] = [
  // ── Capes ──
  {
    id: "skill-capes",
    name: "Skill capes (99s)",
    category: "capes",
    emoji: "🎓",
    iconItemId: 9747, // Attack cape — generic stand-in
    description: "One per 99 skill cape. 24 to collect (incl. Sailing if 99'd).",
    goals: [
      { id: "cape-attack", name: "Attack cape", namePattern: /^attack cape/i, notes: "99 Attack" },
      { id: "cape-strength", name: "Strength cape", namePattern: /^strength cape/i, notes: "99 Strength" },
      { id: "cape-defence", name: "Defence cape", namePattern: /^defence cape/i, notes: "99 Defence" },
      { id: "cape-hp", name: "Hitpoints cape", namePattern: /^hitpoints cape/i },
      { id: "cape-ranged", name: "Ranged cape", namePattern: /^ranged cape/i },
      { id: "cape-prayer", name: "Prayer cape", namePattern: /^prayer cape/i },
      { id: "cape-magic", name: "Magic cape", namePattern: /^magic cape/i },
      { id: "cape-cooking", name: "Cooking cape", namePattern: /^cooking cape/i },
      { id: "cape-wc", name: "Woodcutting cape", namePattern: /^woodcutting cape/i },
      { id: "cape-fletching", name: "Fletching cape", namePattern: /^fletching cape/i },
      { id: "cape-fishing", name: "Fishing cape", namePattern: /^fishing cape/i },
      { id: "cape-fm", name: "Firemaking cape", namePattern: /^firemaking cape/i },
      { id: "cape-crafting", name: "Crafting cape", namePattern: /^crafting cape/i },
      { id: "cape-smithing", name: "Smithing cape", namePattern: /^smithing cape/i },
      { id: "cape-mining", name: "Mining cape", namePattern: /^mining cape/i },
      { id: "cape-herblore", name: "Herblore cape", namePattern: /^herblore cape/i },
      { id: "cape-agility", name: "Agility cape", namePattern: /^agility cape/i },
      { id: "cape-thieving", name: "Thieving cape", namePattern: /^thieving cape/i },
      { id: "cape-slayer", name: "Slayer cape", namePattern: /^slayer cape/i },
      { id: "cape-farming", name: "Farming cape", namePattern: /^farming cape/i },
      { id: "cape-rc", name: "Runecraft cape", namePattern: /^runecraft cape/i },
      { id: "cape-hunter", name: "Hunter cape", namePattern: /^hunter cape/i },
      { id: "cape-construction", name: "Construction cape", namePattern: /^construction cape/i },
      { id: "cape-sailing", name: "Sailing cape", namePattern: /^sailing cape/i }
    ]
  },
  {
    id: "milestone-capes",
    name: "Milestone capes",
    category: "capes",
    emoji: "🏆",
    iconItemId: 13280, // Max cape
    description: "Quest, Diary, Music, Max, Champion's, Mythical.",
    goals: [
      { id: "qp-cape", name: "Quest point cape", namePattern: /^quest point cape/i, notes: "All quests done" },
      { id: "diary-cape", name: "Achievement diary cape", namePattern: /^achievement diary cape/i, notes: "All elite diaries done" },
      { id: "music-cape", name: "Music cape", namePattern: /^music cape/i, notes: "All music tracks unlocked" },
      { id: "max-cape", name: "Max cape", namePattern: /^max cape/i, notes: "All 23 skills at 99", tier: 1 },
      { id: "comp-cape", name: "Completionist cape", namePattern: /^completionist cape/i, tier: 2, supersedes: ["max-cape"] },
      { id: "champ-cape", name: "Champion's cape", namePattern: /^champion's cape/i, notes: "All champion scrolls" },
      { id: "myth-cape", name: "Mythical cape", namePattern: /^mythical cape/i, notes: "Dragon Slayer II reward" }
    ]
  },

  // ── Combat prestige ──
  {
    id: "fire-cape",
    name: "Fire / Infernal cape",
    category: "combat-prestige",
    emoji: "🔥",
    iconItemId: 21295, // Infernal cape
    description: "TzHaar inferno milestones — the most-coveted untradeable capes.",
    goals: [
      { id: "fire-cape", name: "Fire cape", namePattern: /^fire cape$/i, notes: "Kill TzTok-Jad", tier: 1 },
      { id: "infernal-cape", name: "Infernal cape", namePattern: /^infernal cape$/i, notes: "Beat the Inferno", tier: 2, supersedes: ["fire-cape"] }
    ]
  },
  {
    id: "saradomin-cape",
    name: "Imbued god capes",
    category: "combat-prestige",
    emoji: "✨",
    iconItemId: 21791, // Imbued Saradomin cape
    description: "Mage Arena II rewards — one per god.",
    goals: [
      { id: "saradomin-cape", name: "Imbued Saradomin cape", namePattern: /^imbued saradomin cape/i },
      { id: "zamorak-cape", name: "Imbued Zamorak cape", namePattern: /^imbued zamorak cape/i },
      { id: "guthix-cape", name: "Imbued Guthix cape", namePattern: /^imbued guthix cape/i }
    ]
  },
  {
    id: "combat-trinkets",
    name: "Combat trinkets",
    category: "combat-prestige",
    emoji: "🥊",
    iconItemId: 7462, // Barrows gloves
    description: "Earned upgrades. Fighter torso, Avernic defender, Barrows gloves, more.",
    goals: [
      { id: "fighter-torso", name: "Fighter torso", namePattern: /^fighter torso/i, notes: "Barbarian Assault HM3+" },
      { id: "avernic", name: "Avernic defender", namePattern: /^avernic defender/i, notes: "ToB drop" },
      { id: "barrows-gloves", name: "Barrows gloves", namePattern: /^barrows gloves/i, notes: "RFD elite" },
      { id: "ferocious-gloves", name: "Ferocious gloves", namePattern: /^ferocious gloves/i, notes: "Hydra drop" },
      { id: "torture", name: "Amulet of torture", namePattern: /^amulet of torture/i },
      { id: "anguish", name: "Necklace of anguish", namePattern: /^necklace of anguish/i },
      { id: "rancour", name: "Amulet of rancour", namePattern: /^amulet of rancour/i },
      { id: "occult", name: "Occult necklace", namePattern: /^occult necklace/i },
      { id: "lightbearer", name: "Lightbearer", namePattern: /^lightbearer/i }
    ]
  },
  {
    id: "void-knight",
    name: "Void knight set",
    category: "combat-prestige",
    emoji: "🛡️",
    iconItemId: 8839, // Void knight top
    description: "Pest Control reward — 4 helm variants + body + robe + gloves.",
    goals: [
      { id: "void-mage", name: "Void mage helm", namePattern: /^void mage helm/i },
      { id: "void-melee", name: "Void melee helm", namePattern: /^void melee helm/i },
      { id: "void-range", name: "Void ranger helm", namePattern: /^void ranger helm/i },
      { id: "void-top", name: "Void knight top", namePattern: /^void knight top/i },
      { id: "void-robe", name: "Void knight robe", namePattern: /^void knight robe/i },
      { id: "void-gloves", name: "Void knight gloves", namePattern: /^void knight gloves/i }
    ]
  },
  {
    id: "elite-void",
    name: "Elite Void",
    category: "combat-prestige",
    emoji: "🌟",
    iconItemId: 13072, // Elite void top
    description: "Upgraded Void — full elite set.",
    goals: [
      { id: "elite-void-top", name: "Elite void top", namePattern: /^elite void top/i, tier: 2, supersedes: ["void-top"] },
      { id: "elite-void-robe", name: "Elite void robe", namePattern: /^elite void robe/i, tier: 2, supersedes: ["void-robe"] }
    ]
  },

  // ── Diary ──
  {
    id: "karamja-diary",
    name: "Karamja gloves",
    category: "diary",
    emoji: "🌴",
    iconItemId: 13103, // Karamja gloves 4
    description: "4 tiers — easy, medium, hard, elite.",
    goals: [
      { id: "karamja-1", name: "Karamja gloves 1", namePattern: /^karamja gloves 1$/i, tier: 1 },
      { id: "karamja-2", name: "Karamja gloves 2", namePattern: /^karamja gloves 2$/i, tier: 2, supersedes: ["karamja-1"] },
      { id: "karamja-3", name: "Karamja gloves 3", namePattern: /^karamja gloves 3$/i, tier: 3, supersedes: ["karamja-1", "karamja-2"] },
      { id: "karamja-4", name: "Karamja gloves 4", namePattern: /^karamja gloves 4$/i, tier: 4, supersedes: ["karamja-1", "karamja-2", "karamja-3"] }
    ]
  },
  {
    id: "ardy-cloak",
    name: "Ardougne cloak",
    category: "diary",
    emoji: "🌫️",
    iconItemId: 13124, // Ardougne cloak 4
    description: "Ardy diary reward, 4 tiers.",
    goals: [
      { id: "ardy-1", name: "Ardougne cloak 1", namePattern: /^ardougne cloak 1$/i, tier: 1 },
      { id: "ardy-2", name: "Ardougne cloak 2", namePattern: /^ardougne cloak 2$/i, tier: 2, supersedes: ["ardy-1"] },
      { id: "ardy-3", name: "Ardougne cloak 3", namePattern: /^ardougne cloak 3$/i, tier: 3, supersedes: ["ardy-1", "ardy-2"] },
      { id: "ardy-4", name: "Ardougne cloak 4", namePattern: /^ardougne cloak 4$/i, tier: 4, supersedes: ["ardy-1", "ardy-2", "ardy-3"] }
    ]
  },
  {
    id: "falador-shield",
    name: "Falador shield",
    category: "diary",
    emoji: "🛡️",
    iconItemId: 13120, // Falador shield 4
    goals: [
      { id: "fal-1", name: "Falador shield 1", namePattern: /^falador shield 1$/i, tier: 1 },
      { id: "fal-2", name: "Falador shield 2", namePattern: /^falador shield 2$/i, tier: 2, supersedes: ["fal-1"] },
      { id: "fal-3", name: "Falador shield 3", namePattern: /^falador shield 3$/i, tier: 3, supersedes: ["fal-1", "fal-2"] },
      { id: "fal-4", name: "Falador shield 4", namePattern: /^falador shield 4$/i, tier: 4, supersedes: ["fal-1", "fal-2", "fal-3"] }
    ]
  },
  {
    id: "morytania-legs",
    name: "Morytania legs",
    category: "diary",
    emoji: "🦇",
    iconItemId: 13115, // Morytania legs 4
    goals: [
      { id: "mory-1", name: "Morytania legs 1", namePattern: /^morytania legs 1$/i, tier: 1 },
      { id: "mory-2", name: "Morytania legs 2", namePattern: /^morytania legs 2$/i, tier: 2, supersedes: ["mory-1"] },
      { id: "mory-3", name: "Morytania legs 3", namePattern: /^morytania legs 3$/i, tier: 3, supersedes: ["mory-1", "mory-2"] },
      { id: "mory-4", name: "Morytania legs 4", namePattern: /^morytania legs 4$/i, tier: 4, supersedes: ["mory-1", "mory-2", "mory-3"] }
    ]
  },
  {
    id: "desert-amulet",
    name: "Desert amulet",
    category: "diary",
    emoji: "🏜️",
    iconItemId: 13136, // Desert amulet 4
    goals: [
      { id: "desert-1", name: "Desert amulet 1", namePattern: /^desert amulet 1$/i, tier: 1 },
      { id: "desert-2", name: "Desert amulet 2", namePattern: /^desert amulet 2$/i, tier: 2, supersedes: ["desert-1"] },
      { id: "desert-3", name: "Desert amulet 3", namePattern: /^desert amulet 3$/i, tier: 3, supersedes: ["desert-1", "desert-2"] },
      { id: "desert-4", name: "Desert amulet 4", namePattern: /^desert amulet 4$/i, tier: 4, supersedes: ["desert-1", "desert-2", "desert-3"] }
    ]
  },
  {
    id: "varrock-armour",
    name: "Varrock armour",
    category: "diary",
    emoji: "⚒️",
    iconItemId: 13106, // Varrock armour 4
    goals: [
      { id: "var-1", name: "Varrock armour 1", namePattern: /^varrock armour 1$/i, tier: 1 },
      { id: "var-2", name: "Varrock armour 2", namePattern: /^varrock armour 2$/i, tier: 2, supersedes: ["var-1"] },
      { id: "var-3", name: "Varrock armour 3", namePattern: /^varrock armour 3$/i, tier: 3, supersedes: ["var-1", "var-2"] },
      { id: "var-4", name: "Varrock armour 4", namePattern: /^varrock armour 4$/i, tier: 4, supersedes: ["var-1", "var-2", "var-3"] }
    ]
  },
  {
    id: "fremennik-boots",
    name: "Fremennik sea boots",
    category: "diary",
    emoji: "❄️",
    iconItemId: 13132, // Fremennik sea boots 4
    goals: [
      { id: "frem-1", name: "Fremennik sea boots 1", namePattern: /^fremennik sea boots 1$/i, tier: 1 },
      { id: "frem-2", name: "Fremennik sea boots 2", namePattern: /^fremennik sea boots 2$/i, tier: 2, supersedes: ["frem-1"] },
      { id: "frem-3", name: "Fremennik sea boots 3", namePattern: /^fremennik sea boots 3$/i, tier: 3, supersedes: ["frem-1", "frem-2"] },
      { id: "frem-4", name: "Fremennik sea boots 4", namePattern: /^fremennik sea boots 4$/i, tier: 4, supersedes: ["frem-1", "frem-2", "frem-3"] }
    ]
  },
  {
    id: "kandarin-headgear",
    name: "Kandarin headgear",
    category: "diary",
    emoji: "🎩",
    iconItemId: 13140, // Kandarin headgear 4
    goals: [
      { id: "kand-1", name: "Kandarin headgear 1", namePattern: /^kandarin headgear 1$/i, tier: 1 },
      { id: "kand-2", name: "Kandarin headgear 2", namePattern: /^kandarin headgear 2$/i, tier: 2, supersedes: ["kand-1"] },
      { id: "kand-3", name: "Kandarin headgear 3", namePattern: /^kandarin headgear 3$/i, tier: 3, supersedes: ["kand-1", "kand-2"] },
      { id: "kand-4", name: "Kandarin headgear 4", namePattern: /^kandarin headgear 4$/i, tier: 4, supersedes: ["kand-1", "kand-2", "kand-3"] }
    ]
  },
  {
    id: "wildy-sword",
    name: "Wilderness sword",
    category: "diary",
    emoji: "💀",
    iconItemId: 13111, // Wilderness sword 4
    goals: [
      { id: "wild-1", name: "Wilderness sword 1", namePattern: /^wilderness sword 1$/i, tier: 1 },
      { id: "wild-2", name: "Wilderness sword 2", namePattern: /^wilderness sword 2$/i, tier: 2, supersedes: ["wild-1"] },
      { id: "wild-3", name: "Wilderness sword 3", namePattern: /^wilderness sword 3$/i, tier: 3, supersedes: ["wild-1", "wild-2"] },
      { id: "wild-4", name: "Wilderness sword 4", namePattern: /^wilderness sword 4$/i, tier: 4, supersedes: ["wild-1", "wild-2", "wild-3"] }
    ]
  },
  {
    id: "western-banner",
    name: "Western banner",
    category: "diary",
    emoji: "🪶",
    iconItemId: 13128, // Western banner 4
    goals: [
      { id: "west-1", name: "Western banner 1", namePattern: /^western banner 1$/i, tier: 1 },
      { id: "west-2", name: "Western banner 2", namePattern: /^western banner 2$/i, tier: 2, supersedes: ["west-1"] },
      { id: "west-3", name: "Western banner 3", namePattern: /^western banner 3$/i, tier: 3, supersedes: ["west-1", "west-2"] },
      { id: "west-4", name: "Western banner 4", namePattern: /^western banner 4$/i, tier: 4, supersedes: ["west-1", "west-2", "west-3"] }
    ]
  },

  // ── Graceful ──
  {
    id: "graceful",
    name: "Graceful set",
    category: "graceful",
    emoji: "🏃",
    iconItemId: 11854, // Graceful top
    description: "Rooftop agility reward — 6 pieces.",
    goals: [
      { id: "grace-hood", name: "Graceful hood", namePattern: /^graceful hood$/i },
      { id: "grace-cape", name: "Graceful cape", namePattern: /^graceful cape$/i },
      { id: "grace-top", name: "Graceful top", namePattern: /^graceful top$/i },
      { id: "grace-legs", name: "Graceful legs", namePattern: /^graceful legs$/i },
      { id: "grace-gloves", name: "Graceful gloves", namePattern: /^graceful gloves$/i },
      { id: "grace-boots", name: "Graceful boots", namePattern: /^graceful boots$/i }
    ]
  },

  // ── Barrows sets ──
  {
    id: "dharok",
    name: "Dharok's set",
    category: "barrows",
    emoji: "💪",
    iconItemId: 4718, // Dharok's greataxe
    goals: [
      { id: "dharok-helm", name: "Dharok's helm", namePattern: /^dharok's helm$/i },
      { id: "dharok-body", name: "Dharok's platebody", namePattern: /^dharok's platebody$/i },
      { id: "dharok-legs", name: "Dharok's platelegs", namePattern: /^dharok's platelegs$/i },
      { id: "dharok-axe", name: "Dharok's greataxe", namePattern: /^dharok's greataxe$/i }
    ]
  },
  {
    id: "ahrim",
    name: "Ahrim's set",
    category: "barrows",
    emoji: "🔮",
    iconItemId: 4710, // Ahrim's staff
    goals: [
      { id: "ahrim-hood", name: "Ahrim's hood", namePattern: /^ahrim's hood$/i },
      { id: "ahrim-top", name: "Ahrim's robetop", namePattern: /^ahrim's robetop$/i },
      { id: "ahrim-skirt", name: "Ahrim's robeskirt", namePattern: /^ahrim's robeskirt$/i },
      { id: "ahrim-staff", name: "Ahrim's staff", namePattern: /^ahrim's staff$/i }
    ]
  },
  {
    id: "karil",
    name: "Karil's set",
    category: "barrows",
    emoji: "🏹",
    iconItemId: 4734, // Karil's crossbow
    goals: [
      { id: "karil-coif", name: "Karil's coif", namePattern: /^karil's coif$/i },
      { id: "karil-top", name: "Karil's leathertop", namePattern: /^karil's leathertop$/i },
      { id: "karil-skirt", name: "Karil's leatherskirt", namePattern: /^karil's leatherskirt$/i },
      { id: "karil-bow", name: "Karil's crossbow", namePattern: /^karil's crossbow$/i }
    ]
  },
  {
    id: "verac",
    name: "Verac's set",
    category: "barrows",
    emoji: "🪓",
    iconItemId: 4755, // Verac's flail
    goals: [
      { id: "verac-helm", name: "Verac's helm", namePattern: /^verac's helm$/i },
      { id: "verac-body", name: "Verac's brassard", namePattern: /^verac's brassard$/i },
      { id: "verac-skirt", name: "Verac's plateskirt", namePattern: /^verac's plateskirt$/i },
      { id: "verac-flail", name: "Verac's flail", namePattern: /^verac's flail$/i }
    ]
  },
  {
    id: "torag",
    name: "Torag's set",
    category: "barrows",
    emoji: "🔨",
    iconItemId: 4747, // Torag's hammers
    goals: [
      { id: "torag-helm", name: "Torag's helm", namePattern: /^torag's helm$/i },
      { id: "torag-body", name: "Torag's platebody", namePattern: /^torag's platebody$/i },
      { id: "torag-legs", name: "Torag's platelegs", namePattern: /^torag's platelegs$/i },
      { id: "torag-hammer", name: "Torag's hammers", namePattern: /^torag's hammers$/i }
    ]
  },
  {
    id: "guthan",
    name: "Guthan's set",
    category: "barrows",
    emoji: "🛡️",
    iconItemId: 4726, // Guthan's warspear
    goals: [
      { id: "guthan-helm", name: "Guthan's helm", namePattern: /^guthan's helm$/i },
      { id: "guthan-body", name: "Guthan's platebody", namePattern: /^guthan's platebody$/i },
      { id: "guthan-skirt", name: "Guthan's chainskirt", namePattern: /^guthan's chainskirt$/i },
      { id: "guthan-spear", name: "Guthan's warspear", namePattern: /^guthan's warspear$/i }
    ]
  },

  // ── GWD ──
  {
    id: "bandos",
    name: "Bandos set",
    category: "gwd",
    emoji: "⚔️",
    iconItemId: 11812, // Bandos hilt
    description: "General Graardor drops.",
    goals: [
      { id: "bandos-helm", name: "Bandos chestplate", namePattern: /^bandos chestplate$/i },
      { id: "bandos-legs", name: "Bandos tassets", namePattern: /^bandos tassets$/i },
      { id: "bandos-boots", name: "Bandos boots", namePattern: /^bandos boots$/i },
      { id: "bandos-hilt", name: "Bandos hilt", namePattern: /^bandos hilt$/i }
    ]
  },
  {
    id: "armadyl",
    name: "Armadyl set",
    category: "gwd",
    emoji: "🦅",
    iconItemId: 11810, // Armadyl hilt
    description: "Kree'arra drops.",
    goals: [
      { id: "arma-helm", name: "Armadyl helmet", namePattern: /^armadyl helmet$/i },
      { id: "arma-body", name: "Armadyl chestplate", namePattern: /^armadyl chestplate$/i },
      { id: "arma-legs", name: "Armadyl chainskirt", namePattern: /^armadyl chainskirt$/i },
      { id: "arma-hilt", name: "Armadyl hilt", namePattern: /^armadyl hilt$/i }
    ]
  },
  {
    id: "saradomin-gwd",
    name: "Saradomin set",
    category: "gwd",
    emoji: "👑",
    iconItemId: 11814, // Saradomin hilt
    description: "Zilyana drops.",
    goals: [
      { id: "sara-sword", name: "Saradomin sword", namePattern: /^saradomin sword$/i },
      { id: "sara-light", name: "Saradomin's light", namePattern: /^saradomin's light$/i },
      { id: "sara-hilt", name: "Saradomin hilt", namePattern: /^saradomin hilt$/i }
    ]
  },
  {
    id: "zamorak-gwd",
    name: "Zamorak set",
    category: "gwd",
    emoji: "🦂",
    iconItemId: 11816, // Zamorak hilt
    description: "K'ril drops.",
    goals: [
      { id: "zammy-spear", name: "Zamorakian spear", namePattern: /^zamorakian spear$/i },
      { id: "zammy-hasta", name: "Zamorakian hasta", namePattern: /^zamorakian hasta$/i },
      { id: "zammy-hilt", name: "Zamorak hilt", namePattern: /^zamorak hilt$/i }
    ]
  },

  // ── Raid uniques ──
  {
    id: "cox-uniques",
    name: "CoX uniques",
    category: "raid-uniques",
    emoji: "🦂",
    iconItemId: 20997, // Twisted bow
    description: "Chambers of Xeric — highest-tier drops.",
    goals: [
      { id: "twisted-bow", name: "Twisted bow", namePattern: /^twisted bow$/i },
      { id: "elder-maul", name: "Elder maul", namePattern: /^elder maul$/i },
      { id: "dhcb", name: "Dragon hunter crossbow", namePattern: /^dragon hunter crossbow$/i },
      { id: "dinhs", name: "Dinh's bulwark", namePattern: /^dinh's bulwark$/i },
      { id: "kodai-insignia", name: "Kodai insignia", namePattern: /^kodai insignia$/i },
      { id: "ancestral-hat", name: "Ancestral hat", namePattern: /^ancestral hat$/i },
      { id: "ancestral-top", name: "Ancestral robe top", namePattern: /^ancestral robe top$/i },
      { id: "ancestral-bottom", name: "Ancestral robe bottom", namePattern: /^ancestral robe bottom$/i }
    ]
  },
  {
    id: "tob-uniques",
    name: "ToB uniques",
    category: "raid-uniques",
    emoji: "🦇",
    iconItemId: 22325, // Scythe of vitur
    description: "Theatre of Blood.",
    goals: [
      { id: "scythe", name: "Scythe of vitur", namePattern: /^scythe of vitur/i },
      { id: "rapier", name: "Ghrazi rapier", namePattern: /^ghrazi rapier$/i },
      { id: "sang", name: "Sanguinesti staff", namePattern: /^sanguinesti staff$/i },
      { id: "justi-helm", name: "Justiciar faceguard", namePattern: /^justiciar faceguard$/i },
      { id: "justi-body", name: "Justiciar chestguard", namePattern: /^justiciar chestguard$/i },
      { id: "justi-legs", name: "Justiciar legguards", namePattern: /^justiciar legguards$/i },
      { id: "avernic", name: "Avernic defender", namePattern: /^avernic defender/i }
    ]
  },
  {
    id: "toa-uniques",
    name: "ToA uniques",
    category: "raid-uniques",
    emoji: "🏺",
    iconItemId: 26219, // Osmumten's fang
    description: "Tombs of Amascut.",
    goals: [
      { id: "shadow", name: "Tumeken's shadow", namePattern: /^tumeken's shadow/i },
      { id: "fang", name: "Osmumten's fang", namePattern: /^osmumten's fang$/i },
      { id: "masori-mask", name: "Masori mask", namePattern: /^masori mask/i },
      { id: "masori-body", name: "Masori body", namePattern: /^masori body/i },
      { id: "masori-chaps", name: "Masori chaps", namePattern: /^masori chaps/i },
      { id: "lightbearer-toa", name: "Lightbearer", namePattern: /^lightbearer$/i }
    ]
  },

  // ── Wildy bosses ──
  {
    id: "wildy-rings",
    name: "Wildy boss rings",
    category: "wildy-bosses",
    emoji: "💀",
    iconItemId: 28307, // Ultor ring
    description: "Vet'ion / Venenatis / Callisto, with corrupted variants.",
    goals: [
      { id: "ring-suffering", name: "Ring of suffering", namePattern: /^ring of suffering/i },
      { id: "treasonous", name: "Treasonous ring", namePattern: /^treasonous ring/i },
      { id: "tyrannical", name: "Tyrannical ring", namePattern: /^tyrannical ring/i },
      { id: "ultor", name: "Ultor ring", namePattern: /^ultor ring$/i, notes: "Vet'ion upgrade" },
      { id: "venator", name: "Venator ring", namePattern: /^venator ring$/i, notes: "Phantom Muspah" },
      { id: "magus", name: "Magus ring", namePattern: /^magus ring$/i, notes: "Duke Sucellus" },
      { id: "bellator", name: "Bellator ring", namePattern: /^bellator ring$/i, notes: "Whisperer" }
    ]
  },
  {
    id: "voidwaker",
    name: "Voidwaker",
    category: "wildy-bosses",
    emoji: "🗡️",
    iconItemId: 27690, // Voidwaker
    description: "3 hilt pieces from Vet'ion/Callisto/Venenatis.",
    goals: [
      { id: "voidwaker", name: "Voidwaker", namePattern: /^voidwaker$/i },
      { id: "vw-hilt", name: "Voidwaker hilt", namePattern: /^voidwaker hilt$/i },
      { id: "vw-blade", name: "Voidwaker blade", namePattern: /^voidwaker blade$/i },
      { id: "vw-gem", name: "Voidwaker gem", namePattern: /^voidwaker gem$/i }
    ]
  },

  // ── Skill outfits ──
  {
    id: "pyromancer",
    name: "Pyromancer outfit",
    category: "skill-outfits",
    emoji: "🔥",
    iconItemId: 20708, // Pyromancer hood
    description: "Wintertodt — 2% firemaking XP per piece.",
    goals: [
      { id: "pyro-hood", name: "Pyromancer hood", namePattern: /^pyromancer hood$/i },
      { id: "pyro-garb", name: "Pyromancer garb", namePattern: /^pyromancer garb$/i },
      { id: "pyro-robe", name: "Pyromancer robe", namePattern: /^pyromancer robe$/i },
      { id: "pyro-boots", name: "Pyromancer boots", namePattern: /^pyromancer boots$/i }
    ]
  },
  {
    id: "angler",
    name: "Angler outfit",
    category: "skill-outfits",
    emoji: "🎣",
    iconItemId: 13258, // Angler hat
    description: "Fishing Trawler — 2.5% fishing XP for full set.",
    goals: [
      { id: "angler-hat", name: "Angler hat", namePattern: /^angler hat$/i },
      { id: "angler-top", name: "Angler top", namePattern: /^angler top$/i },
      { id: "angler-waders", name: "Angler waders", namePattern: /^angler waders$/i },
      { id: "angler-boots", name: "Angler boots", namePattern: /^angler boots$/i }
    ]
  },
  {
    id: "lumberjack",
    name: "Lumberjack outfit",
    category: "skill-outfits",
    emoji: "🪓",
    iconItemId: 10941, // Lumberjack hat
    description: "Temple Trekking — woodcutting XP boost.",
    goals: [
      { id: "lumb-hat", name: "Lumberjack hat", namePattern: /^lumberjack hat$/i },
      { id: "lumb-top", name: "Lumberjack top", namePattern: /^lumberjack top$/i },
      { id: "lumb-legs", name: "Lumberjack legs", namePattern: /^lumberjack legs$/i },
      { id: "lumb-boots", name: "Lumberjack boots", namePattern: /^lumberjack boots$/i }
    ]
  },
  {
    id: "prospector",
    name: "Prospector outfit",
    category: "skill-outfits",
    emoji: "⛏️",
    iconItemId: 12013, // Prospector helmet
    description: "Motherlode Mine — mining XP boost. Golden variant supersedes.",
    goals: [
      { id: "prosp-helm",   name: "Prospector helmet", namePattern: /^(golden )?prospector helmet$/i,   itemIds: [12013, 25549] },
      { id: "prosp-jacket", name: "Prospector jacket", namePattern: /^(golden )?prospector jacket$/i,   itemIds: [12014, 25551] },
      { id: "prosp-legs",   name: "Prospector legs",   namePattern: /^(golden )?prospector legs$/i,     itemIds: [12015, 25553] },
      { id: "prosp-boots",  name: "Prospector boots",  namePattern: /^(golden )?prospector boots$/i,    itemIds: [12016, 25555] }
    ]
  },
  {
    id: "rogue",
    name: "Rogue outfit",
    category: "skill-outfits",
    emoji: "🥷",
    iconItemId: 5554, // Rogue mask
    description: "Rogues' Den — thieving outfit, double loot on pickpocket.",
    goals: [
      { id: "rogue-mask", name: "Rogue mask", namePattern: /^rogue mask$/i },
      { id: "rogue-top", name: "Rogue top", namePattern: /^rogue top$/i },
      { id: "rogue-trousers", name: "Rogue trousers", namePattern: /^rogue trousers$/i },
      { id: "rogue-gloves", name: "Rogue gloves", namePattern: /^rogue gloves$/i },
      { id: "rogue-boots", name: "Rogue boots", namePattern: /^rogue boots$/i }
    ]
  },
  {
    id: "farmer",
    name: "Farmer's outfit",
    category: "skill-outfits",
    emoji: "🌾",
    iconItemId: 13642, // Farmer's strawhat
    description: "Tithe Farm — farming XP boost.",
    goals: [
      { id: "farm-hat", name: "Farmer's strawhat", namePattern: /^farmer's strawhat$/i },
      { id: "farm-jacket", name: "Farmer's jacket", namePattern: /^farmer's jacket$/i },
      { id: "farm-boro", name: "Farmer's boro trousers", namePattern: /^farmer's boro trousers$/i },
      { id: "farm-boots", name: "Farmer's boots", namePattern: /^farmer's boots$/i }
    ]
  },

  // ── Quest unique rewards ──
  {
    id: "quest-rewards",
    name: "Quest reward keepers",
    category: "quest-uniques",
    emoji: "📜",
    iconItemId: 22109, // Ava's assembler — iconic quest reward
    description: "Iconic quest rewards worth keeping forever.",
    goals: [
      { id: "ava-assembler", name: "Ava's assembler", namePattern: /^ava's assembler$/i, notes: "DS2" },
      { id: "barrelchest", name: "Barrelchest anchor", namePattern: /^barrelchest anchor$/i },
      { id: "anti-shield", name: "Anti-dragon shield", namePattern: /^anti-dragon shield$/i },
      { id: "dragonfire-shield", name: "Dragonfire shield", namePattern: /^dragonfire shield$/i },
      { id: "dragonfire-ward", name: "Dragonfire ward", namePattern: /^dragonfire ward$/i },
      { id: "book-balance", name: "Book of balance", namePattern: /^book of balance$/i },
      { id: "book-law", name: "Book of law", namePattern: /^book of law$/i },
      { id: "book-darkness", name: "Book of darkness", namePattern: /^book of darkness$/i },
      { id: "book-war", name: "Book of war", namePattern: /^book of war$/i },
      { id: "rune-pouch", name: "Rune pouch", namePattern: /^rune pouch$/i, notes: "Slayer reward" },
      { id: "divine-rune-pouch", name: "Divine rune pouch", namePattern: /^divine rune pouch$/i },
      { id: "drakan-medallion", name: "Drakan's medallion", namePattern: /^drakan's medallion$/i }
    ]
  },

  // ── Misc untradeable ──
  {
    id: "slayer-rewards",
    name: "Slayer rewards",
    category: "misc-untradeable",
    emoji: "🐉",
    iconItemId: 11865, // Slayer helmet (i)
    description: "Bought with slayer points or unlocked from tasks.",
    goals: [
      { id: "black-mask", name: "Black mask", namePattern: /^black mask( \(\d+\))?$/i, tier: 1 },
      { id: "slayer-helm", name: "Slayer helmet", namePattern: /^slayer helmet$/i, tier: 2, supersedes: ["black-mask"] },
      { id: "slayer-helm-i", name: "Slayer helmet (i)", namePattern: /^(imbued )?slayer helmet \(i\)/i, notes: "Imbued at Nightmare Zone", tier: 3, supersedes: ["black-mask", "slayer-helm"] },
      { id: "salve-e", name: "Salve amulet (e)", namePattern: /^salve amulet ?\(e\)/i, tier: 1 },
      { id: "salve-ei", name: "Salve amulet(ei)", namePattern: /^salve amulet ?\(ei\)/i, notes: "Enchanted + imbued", tier: 2, supersedes: ["salve-e"] },
      { id: "abyssal-tentacle", name: "Abyssal tentacle", namePattern: /^abyssal tentacle$/i },
      { id: "noxious-halberd", name: "Noxious halberd", namePattern: /^noxious halberd$/i }
    ]
  },
  {
    id: "crystal-equip",
    name: "Crystal equipment",
    category: "misc-untradeable",
    emoji: "💎",
    iconItemId: 25865, // Bow of Faerdhinen
    description: "Song of the Elves rewards.",
    goals: [
      { id: "bowfa", name: "Bow of Faerdhinen", namePattern: /^bow of faerdhinen/i },
      { id: "crystal-helm", name: "Crystal helm", namePattern: /^crystal helm/i },
      { id: "crystal-body", name: "Crystal body", namePattern: /^crystal body/i },
      { id: "crystal-legs", name: "Crystal legs", namePattern: /^crystal legs/i },
      { id: "blade-saeldor", name: "Blade of Saeldor", namePattern: /^blade of saeldor/i }
    ]
  }
];

// ── Canonical icon IDs ──────────────────────────────────────────────────────
// For goals that aren't in the player's bank, we still want a sprite to
// display. This table maps the goal's id (slug) to the canonical OSRS item id.
// Curated by hand for the visible sets — not exhaustive.
export const GOAL_ICON_IDS: Record<string, number> = {
  // Capes
  "cape-attack": 9747, "cape-strength": 9750, "cape-defence": 9753,
  "cape-hp": 9768, "cape-ranged": 9756, "cape-prayer": 9759,
  "cape-magic": 9762, "cape-cooking": 9801, "cape-wc": 9807,
  "cape-fletching": 9783, "cape-fishing": 9798, "cape-fm": 9804,
  "cape-crafting": 9780, "cape-smithing": 9795, "cape-mining": 9792,
  "cape-herblore": 9774, "cape-agility": 9771, "cape-thieving": 9777,
  "cape-slayer": 9786, "cape-farming": 9810, "cape-rc": 9765,
  "cape-hunter": 9948, "cape-construction": 9789,
  // Milestone capes
  "qp-cape": 9813, "diary-cape": 19476, "music-cape": 13221,
  "max-cape": 13280,
  "champ-cape": 21439, "myth-cape": 22114,
  // Combat prestige
  "fire-cape": 6570, "infernal-cape": 21295,
  "saradomin-cape": 21791, "zamorak-cape": 21795, "guthix-cape": 21793,
  "fighter-torso": 10551, "avernic": 22322,
  "barrows-gloves": 7462, "ferocious-gloves": 22981,
  "torture": 19553, "anguish": 19547, "rancour": 29801,
  "occult": 12002, "lightbearer": 25975,
  // Void
  "void-mage": 11663, "void-melee": 11665, "void-range": 11664,
  "void-top": 8839, "void-robe": 8840, "void-gloves": 8842,
  "elite-void-top": 13072, "elite-void-robe": 13073,
  // Diary trinkets — canonical OSRS item IDs verified against items.json
  "karamja-1": 11136, "karamja-2": 11138, "karamja-3": 11140, "karamja-4": 13103,
  "ardy-1": 13121, "ardy-2": 13122, "ardy-3": 13123, "ardy-4": 13124,
  "fal-1": 13117, "fal-2": 13118, "fal-3": 13119, "fal-4": 13120,
  "mory-1": 13112, "mory-2": 13113, "mory-3": 13114, "mory-4": 13115,
  "desert-1": 13133, "desert-2": 13134, "desert-3": 13135, "desert-4": 13136,
  "var-1": 13104, "var-2": 13105, "var-3": 13106, "var-4": 13107,
  "frem-1": 13129, "frem-2": 13130, "frem-3": 13131, "frem-4": 13132,
  "kand-1": 13137, "kand-2": 13138, "kand-3": 13139, "kand-4": 13140,
  "wild-1": 13108, "wild-2": 13109, "wild-3": 13110, "wild-4": 13111,
  "west-1": 13141, "west-2": 13142, "west-3": 13143, "west-4": 13144,
  // Graceful
  "grace-hood": 11850, "grace-cape": 11852, "grace-top": 11854,
  "grace-legs": 11856, "grace-gloves": 11858, "grace-boots": 11860,
  // Barrows
  "dharok-helm": 4716, "dharok-body": 4720, "dharok-legs": 4722, "dharok-axe": 4718,
  "ahrim-hood": 4708, "ahrim-top": 4712, "ahrim-skirt": 4714, "ahrim-staff": 4710,
  "karil-coif": 4732, "karil-top": 4736, "karil-skirt": 4738, "karil-bow": 4734,
  "verac-helm": 4753, "verac-body": 4757, "verac-skirt": 4759, "verac-flail": 4755,
  "torag-helm": 4745, "torag-body": 4749, "torag-legs": 4751, "torag-hammer": 4747,
  "guthan-helm": 4724, "guthan-body": 4728, "guthan-skirt": 4730, "guthan-spear": 4726,
  // GWD
  "bandos-helm": 11832, "bandos-legs": 11834, "bandos-boots": 11836, "bandos-hilt": 11812,
  "arma-helm": 11826, "arma-body": 11828, "arma-legs": 11830, "arma-hilt": 11810,
  "sara-sword": 11838, "sara-light": 11840, "sara-hilt": 11814,
  "zammy-spear": 11824, "zammy-hasta": 11889, "zammy-hilt": 11816,
  // Raid uniques
  "twisted-bow": 20997, "elder-maul": 21003, "dhcb": 21012,
  "dinhs": 21015, "kodai-insignia": 21043,
  "ancestral-hat": 21018, "ancestral-top": 21021, "ancestral-bottom": 21024,
  "scythe": 22325, "rapier": 22324, "sang": 22323,
  "justi-helm": 22326, "justi-body": 22327, "justi-legs": 22328,
  "shadow": 27275, "fang": 26219, "masori-mask": 27226,
  "masori-body": 27229, "masori-chaps": 27232, "lightbearer-toa": 25975,
  // Wildy rings
  "ring-suffering": 19550, "treasonous": 12605, "tyrannical": 12603,
  "ultor": 28307, "venator": 25487, "magus": 25486, "bellator": 28316,
  "voidwaker": 27690, "vw-hilt": 27687, "vw-blade": 27684, "vw-gem": 27681,
  // Skill outfits
  "pyro-hood": 20708, "pyro-garb": 20704, "pyro-robe": 20706, "pyro-boots": 20710,
  "angler-hat": 13258, "angler-top": 13259, "angler-waders": 13260, "angler-boots": 13261,
  "lumb-hat": 10941, "lumb-top": 10939, "lumb-legs": 10940, "lumb-boots": 10933,
  "prosp-helm": 12013, "prosp-jacket": 12014, "prosp-legs": 12015, "prosp-boots": 12016,
  "rogue-mask": 5554, "rogue-top": 5553, "rogue-trousers": 5555,
  "rogue-gloves": 5556, "rogue-boots": 5557,
  "farm-hat": 13642, "farm-jacket": 13640, "farm-boro": 13641, "farm-boots": 13644,
  // Quest rewards
  "ava-assembler": 22109, "barrelchest": 10887, "anti-shield": 1540,
  "dragonfire-shield": 11283, "dragonfire-ward": 22002,
  "book-balance": 3844, "book-law": 3842, "book-darkness": 3840, "book-war": 3843,
  "rune-pouch": 12791, "divine-rune-pouch": 27281, "drakan-medallion": 22400,
  // Slayer
  "black-mask": 8901, "slayer-helm": 11864, "slayer-helm-i": 11865,
  "salve-e": 10588, "salve-ei": 19550,
  "abyssal-tentacle": 12006, "noxious-halberd": 26477,
  // Crystal
  "bowfa": 25865, "crystal-helm": 23971, "crystal-body": 23975, "crystal-legs": 23979,
  "blade-saeldor": 23995
};

export function iconForGoal(goalId: string, state?: GoalState): number | undefined {
  // Prefer the actual item we matched (in the player's bank) over the canonical.
  if (state?.matchedItemId) return state.matchedItemId;
  return GOAL_ICON_IDS[goalId];
}

// ── Match engine ───────────────────────────────────────────────────────────

export interface CompletionItem {
  id: number;
  name: string;
  quantity?: number;
}

export interface GoalState {
  /** Player physically owns this goal's item in their bank. */
  owned: boolean;
  /** Counts as complete (owned OR superseded by a later/upgraded goal owned). */
  satisfied: boolean;
  /** If satisfied via supersedes, the goal id that did it. */
  satisfiedBy?: string;
  /** The actual OSRS item id we matched in the bank (for sprite display). */
  matchedItemId?: number;
}

export interface SetCompletion {
  setId: string;
  /** Total goals satisfied (owned + superseded). */
  completed: number;
  /** Total goals in the set. */
  total: number;
  /** Detailed state per goal id. */
  perGoal: Record<string, GoalState>;
  /** Highest tier goal owned (for tiered sets like diaries). */
  highestTier?: number;
  /** Max tier in this set (e.g. 4 for diary trinkets). */
  maxTier?: number;
}

export function checkCompletion(
  items: CompletionItem[],
  sets: GoalSet[] = GOAL_SETS
): SetCompletion[] {
  // Build a lowercase name lookup for fast regex matching.
  const itemNames = items.map((it) => ({ id: it.id, lower: it.name.toLowerCase() }));
  const itemIds = new Set(items.map((it) => it.id));

  const completions = sets.map((set) => {
    // Step 1: identify which goals are physically owned + capture matched id.
    const owned: Record<string, { hit: boolean; matchedId?: number }> = {};
    for (const goal of set.goals) {
      let matchedId: number | undefined;
      if (goal.itemIds) {
        for (const id of goal.itemIds) {
          if (itemIds.has(id)) { matchedId = id; break; }
        }
      }
      if (matchedId === undefined && goal.namePattern) {
        for (const it of itemNames) {
          if (goal.namePattern.test(it.lower)) { matchedId = it.id; break; }
        }
      }
      owned[goal.id] = { hit: matchedId !== undefined, matchedId };
    }

    // Step 2: propagate supersedes — if a goal is owned, mark its
    // supersedes targets as satisfied.
    const perGoal: Record<string, GoalState> = {};
    for (const goal of set.goals) {
      const o = owned[goal.id];
      perGoal[goal.id] = {
        owned: o.hit,
        satisfied: o.hit,
        matchedItemId: o.matchedId
      };
    }
    for (const goal of set.goals) {
      if (!owned[goal.id].hit || !goal.supersedes) continue;
      for (const earlierId of goal.supersedes) {
        if (perGoal[earlierId] && !perGoal[earlierId].satisfied) {
          perGoal[earlierId] = {
            ...perGoal[earlierId],
            satisfied: true,
            satisfiedBy: goal.id
          };
        }
      }
    }

    // Step 3: aggregate.
    const completed = Object.values(perGoal).filter((s) => s.satisfied).length;
    const tiered = set.goals.filter((g) => g.tier !== undefined);
    const ownedTiered = tiered.filter((g) => perGoal[g.id].owned);
    const highestTier = ownedTiered.length > 0
      ? Math.max(...ownedTiered.map((g) => g.tier!))
      : undefined;
    const maxTier = tiered.length > 0
      ? Math.max(...tiered.map((g) => g.tier!))
      : undefined;

    return {
      setId: set.id,
      completed,
      total: set.goals.length,
      perGoal,
      highestTier,
      maxTier
    };
  });

  // A later reward can supersede a goal in another set. Elite Void is the
  // important example: owning an elite top proves the normal Void top even
  // though those rewards live in separate browse groups. Apply those links
  // after every set has been matched, then recompute the affected totals.
  const ownedGoals = sets.flatMap((set, setIndex) =>
    set.goals
      .filter((goal) => completions[setIndex]?.perGoal[goal.id]?.owned)
      .map((goal) => goal)
  );
  for (const ownedGoal of ownedGoals) {
    for (const earlierId of ownedGoal.supersedes ?? []) {
      for (const completion of completions) {
        const earlier = completion.perGoal[earlierId];
        if (!earlier || earlier.satisfied) continue;
        completion.perGoal[earlierId] = {
          ...earlier,
          satisfied: true,
          satisfiedBy: ownedGoal.id
        };
      }
    }
  }
  for (const completion of completions) {
    completion.completed = Object.values(completion.perGoal).filter((state) => state.satisfied).length;
  }

  return completions;
}

/**
 * Tiered sets get treated as a single goal — "Karamja gloves: tier 3/4".
 * Returns a normalised count that doesn't punish you for not having lower
 * tiers when you have a higher one.
 */
export interface NormalisedSet {
  setId: string;
  /** 1 if any tier owned (or non-tiered set fully done), 0 otherwise. */
  earnedAny: boolean;
  /** For tiered sets: max tier reached. For non-tiered: number of items owned. */
  progress: number;
  /** For tiered sets: max tier total. For non-tiered: total items. */
  max: number;
  /** Is the set 100% done (all tiers / all pieces)? */
  complete: boolean;
  /** Set is purely tiered (single tier-chain)? */
  isTiered: boolean;
}

export function normaliseCompletion(c: SetCompletion, set: GoalSet): NormalisedSet {
  // A set is "purely tiered" if EVERY goal has a tier AND the tiers form a
  // single chain (e.g. diary trinket 1/2/3/4, fire→infernal).
  const allTiered = set.goals.every((g) => g.tier !== undefined);
  const uniqueTiers = new Set(set.goals.map((goal) => goal.tier));
  const isTiered = allTiered && uniqueTiers.size === set.goals.length && c.maxTier !== undefined;

  if (isTiered) {
    const tier = c.highestTier ?? 0;
    return {
      setId: c.setId,
      earnedAny: tier > 0,
      progress: tier,
      max: c.maxTier!,
      complete: tier === c.maxTier,
      isTiered: true
    };
  }

  return {
    setId: c.setId,
    earnedAny: c.completed > 0,
    progress: c.completed,
    max: c.total,
    complete: c.completed === c.total,
    isTiered: false
  };
}

// "Closest to complete" — sets where you have most but not all pieces.
// Skips tiered sets where you already own the top tier.
export function closestToComplete(completions: SetCompletion[], limit = 5): SetCompletion[] {
  return completions
    .map((c) => {
      const set = GOAL_SETS.find((s) => s.id === c.setId)!;
      const norm = normaliseCompletion(c, set);
      return { c, norm, missing: norm.max - norm.progress };
    })
    .filter(({ norm }) => norm.earnedAny && !norm.complete)
    .sort((a, b) => a.missing - b.missing || b.norm.progress - a.norm.progress)
    .slice(0, limit)
    .map(({ c }) => c);
}

export function overallStats(completions: SetCompletion[]) {
  // For overall stats, count each set as completed if normalised says so.
  // This avoids the "you have karamja-4 but not 1/2/3" undercount.
  let done = 0;
  let total = 0;
  for (const c of completions) {
    const set = GOAL_SETS.find((s) => s.id === c.setId);
    if (!set) continue;
    const norm = normaliseCompletion(c, set);
    if (norm.isTiered) {
      // Tiered set = 1 "item": you either have it (any tier) or you don't.
      // But we still want progress visibility — give partial credit by tier.
      total += norm.max;
      done += norm.progress;
    } else {
      total += norm.max;
      done += norm.progress;
    }
  }
  return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}
