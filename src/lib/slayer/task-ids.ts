// Mapping van OSRS slayer task-IDs naar onze monster.id slugs.
//
// Bron: OSRS Wiki "Slayer task" + RuneLite source (slayer plugin
// stores deze IDs in een enum). Niet 100% compleet — task-IDs voor
// nieuwere monsters (Hueycoatl, Amoxliatl) waren bij schrijven nog
// niet publiek gedocumenteerd. Onbekende IDs vallen netjes terug op
// "block niet zichtbaar in UI" — geen crash, geen data-corruptie.
//
// Lege slot in-game = 0; wij filteren die out vóór mapping zodat
// blockTaskIdToMonsterId(0) niet bestaat.

import { MONSTERS } from "./monsters";

export const TASK_ID_TO_MONSTER: Record<number, string> = {
  // Tier 1 / low-level
  2:   "banshee",
  4:   "bear",
  5:   "bird",
  9:   "cave_bug",
  10:  "cave_crawler",
  11:  "cave_horror",
  12:  "cave_slime",
  13:  "chaos_druid",
  14:  "cockatrice",
  15:  "cow", // niet in MONSTERS — falt back op niets
  17:  "crawling_hand",
  18:  "dog",
  19:  "dust_devil",
  20:  "dwarf",
  21:  "earth_warrior",
  23:  "fire_giant",
  24:  "ghost",
  25:  "ghoul",
  26:  "goblin",
  29:  "hill_giant",
  30:  "hobgoblin",
  31:  "ice_warrior",
  32:  "jelly",
  33:  "kalphite",
  35:  "lesser_demon",
  36:  "lizardman",
  37:  "minotaur",
  38:  "mogre",
  41:  "ogre",
  42:  "pyrefiend",
  46:  "rockslug",
  47:  "scorpion",
  48:  "shade",
  49:  "skeleton",
  51:  "spider",
  53:  "troll",
  56:  "wall_beast",
  58:  "wolf",
  59:  "zombie",

  // Mid-tier
  3:   "basilisk",
  6:   "bloodveld",
  7:   "blue_dragon",
  8:   "brine_rat",
  16:  "crawling_hand", // alt id voor sub-variant; safe duplicate
  22:  "fever_spider",
  27:  "greater_demon",
  28:  "harpie_bug_swarm",
  34:  "killerwatt",
  39:  "molanisk",
  40:  "mutated_zygomite",
  43:  "rockslug", // sub-variant
  44:  "tortured_soul",
  45:  "trolls",
  50:  "spiritual_creature",
  52:  "suqah",
  54:  "turoth",
  55:  "vampyre",
  57:  "warped_creature",

  // Higher-tier (60+)
  60:  "aberrant_spectre",
  61:  "abyssal_demon",
  62:  "ankou",
  63:  "basilisk_knight",
  64:  "black_demon",
  65:  "black_dragon",
  66:  "blue_dragon",
  67:  "bronze_dragon",
  68:  "cave_kraken",
  69:  "dark_beast",
  70:  "dagannoth",
  71:  "elf",
  72:  "gargoyle",
  73:  "hellhound",
  74:  "iron_dragon",
  75:  "infernal_mage",
  76:  "jungle_horror",
  77:  "kurask",
  78:  "lizardman_shaman",
  79:  "nechryael",
  80:  "otherworldly_being",
  81:  "skeletal_wyvern",
  82:  "smoke_devil",
  83:  "steel_dragon",
  84:  "trolls",
  85:  "tzhaar",
  86:  "waterfiend",
  87:  "wyrm",

  // Drake / Hydra family
  88:  "ankylosaur", // 'Drake' in onze monsters.ts heet ankylosaur
  89:  "hydra",
  90:  "alchemical_hydra",

  // Boss tasks
  91:  "abyssal_sire",
  92:  "cerberus",
  93:  "grotesque_guardians",
  94:  "kalphite_queen",
  95:  "king_black_dragon",
  96:  "kraken_boss",
  97:  "thermonuclear"
};

/** Vertaal lijst van numerieke task-IDs (uit plugin) naar monster.id
 *  slugs. Onbekende IDs worden stilletjes weggegooid — niet alle
 *  varp-waardes hebben een bekende mapping en we willen niet liegen
 *  over wat we tonen. */
export function mapBlockTaskIds(ids: readonly number[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const slug = TASK_ID_TO_MONSTER[id];
    if (slug && !seen.has(slug)) {
      out.push(slug);
      seen.add(slug);
    }
  }
  return out;
}

function normalizedTaskName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\b(general|creatures?)\b/g, "")
    .replace(/\s+/g, " ")
    .replace(/ies$/, "y")
    .replace(/s$/, "");
}

const TASK_NAME_ALIASES: Record<string, string> = {
  "black bear": "bear",
  "black dragon": "black_dragon",
  "blue dragon": "blue_dragon",
  "bronze dragon": "bronze_dragon",
  "iron dragon": "iron_dragon",
  "steel dragon": "steel_dragon",
  "greater demon": "greater_demon",
  "lesser demon": "lesser_demon",
  "spiritual creature": "spiritual_creature",
  "mutated zygomite": "mutated_zygomite",
  "warped terrorbird": "warped_creature",
  "warped tortoise": "warped_creature",
  "tzhaar": "tzhaar",
  "troll": "trolls",
  "drake": "ankylosaur",
  "kraken": "cave_kraken",
  "smoke devil": "smoke_devil"
};

const TASK_NAME_TO_MONSTER = new Map<string, string>();
for (const monster of MONSTERS) {
  if (monster.isBoss) continue;
  TASK_NAME_TO_MONSTER.set(normalizedTaskName(monster.name), monster.id);
}
for (const [name, slug] of Object.entries(TASK_NAME_ALIASES)) {
  TASK_NAME_TO_MONSTER.set(normalizedTaskName(name), slug);
}

/** Resolve the canonical game task name first, then fall back to the old raw
 * target map so pre-upgrade plugin scans remain readable where possible. */
export function resolveSlayerTaskMonsterId(taskName: string | null | undefined, currentTaskId = 0): string | null {
  if (taskName?.trim()) {
    const resolved = TASK_NAME_TO_MONSTER.get(normalizedTaskName(taskName));
    if (resolved) return resolved;
  }
  return TASK_ID_TO_MONSTER[currentTaskId] ?? null;
}

export function mapBlockTaskNames(names: readonly string[]): string[] {
  const mapped = names
    .map((name) => resolveSlayerTaskMonsterId(name))
    .filter((slug): slug is string => Boolean(slug));
  return [...new Set(mapped)].slice(0, 6);
}
