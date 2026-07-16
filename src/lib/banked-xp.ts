export interface BankedXpItem {
  id: number;
  name: string;
  quantity?: number;
}

export type BankedXpStatus = "unknown" | "known-empty" | "estimated";
export type PrayerXpMethod = "bury" | "gilded-altar" | "chaos-altar" | "ectofuntus";

export interface BankedXpMaterial {
  name: string;
  quantity: number;
  xpLow: number;
  xpHigh: number;
  method: string;
}

export interface BankedXpEstimate {
  skill: string;
  status: BankedXpStatus;
  method: string | null;
  totalXpLow: number;
  totalXpHigh: number;
  totalQuantity: number;
  coveredXpLow: number;
  coveredXpHigh: number;
  remainingXpLow: number | null;
  remainingXpHigh: number | null;
  materials: BankedXpMaterial[];
  assumptions: string[];
}

export interface BankedXpSkillDescriptor {
  skill: string;
  suppliesLabel: string;
  actionVerb: string;
  bringHint: string;
  keywords: readonly string[];
}

export interface EstimateBankedXpInput {
  skill: string;
  bank?: readonly BankedXpItem[];
  currentLevel?: number;
  xpRemaining?: number | null;
  prayerMethod?: PrayerXpMethod;
}

type Bank = Map<string, number>;
type DirectRecipe = {
  name: string;
  item: string;
  xp: number;
  level?: number;
  method: string;
};

const MAX_ITEM_QUANTITY = 2_147_483_647;
const MAX_VISIBLE_MATERIALS = 3;

export const BANKED_XP_SKILL_DESCRIPTORS: readonly BankedXpSkillDescriptor[] = [
  { skill: "Cooking", suppliesLabel: "raw food", actionVerb: "Cook", bringHint: "Use the closest range and bank", keywords: ["raw fish", "raw shark", "raw karambwan", "raw anglerfish"] },
  { skill: "Prayer", suppliesLabel: "bones or ashes", actionVerb: "Offer", bringHint: "Use the selected altar or ash method", keywords: ["bones", "ashes"] },
  { skill: "Herblore", suppliesLabel: "potion supplies", actionVerb: "Mix", bringHint: "Withdraw one herb, unfinished potion and secondary chain at a time", keywords: ["herb", "weed", "potion (unf)", "secondary"] },
  { skill: "Fletching", suppliesLabel: "logs or ammo parts", actionVerb: "Fletch", bringHint: "Bring a knife, bow strings or feathers for the chosen stack", keywords: ["logs", "bow string", "dart tip", "bolts (unf)"] },
  { skill: "Crafting", suppliesLabel: "gems, leather, glass or battlestaves", actionVerb: "Craft", bringHint: "Bring the mould, thread or charged orb the stack needs", keywords: ["uncut", "leather", "molten glass", "battlestaff"] },
  { skill: "Smithing", suppliesLabel: "ore or bars", actionVerb: "Smith", bringHint: "Use the best furnace or anvil route for this stack", keywords: [" ore", " bar", "coal"] },
  { skill: "Construction", suppliesLabel: "planks", actionVerb: "Build", bringHint: "Bring a hammer, saw and your normal house route", keywords: ["plank"] },
  { skill: "Firemaking", suppliesLabel: "logs", actionVerb: "Burn", bringHint: "Bring a tinderbox and one log stack", keywords: ["logs"] },
  { skill: "Farming", suppliesLabel: "useful seeds", actionVerb: "Plant", bringHint: "Bring compost and teleports for one tree or herb run", keywords: ["seed", "sapling"] },
  { skill: "Magic", suppliesLabel: "runes", actionVerb: "Cast", bringHint: "Use a staff when it saves elemental runes", keywords: ["rune", "staff"] },
  { skill: "Runecraft", suppliesLabel: "essence", actionVerb: "Runecraft", bringHint: "Bring pouches and your altar route", keywords: ["essence", "pouch", "tiara", "talisman"] },
  { skill: "Fishing", suppliesLabel: "fishing tools", actionVerb: "Fish", bringHint: "Bring your best rod, harpoon or vessel", keywords: ["fishing rod", "harpoon", "lobster pot", "fishing net", "karambwan vessel"] },
  { skill: "Woodcutting", suppliesLabel: "an axe", actionVerb: "Chop", bringHint: "Bring the best axe you own", keywords: [" axe"] },
  { skill: "Mining", suppliesLabel: "a pickaxe", actionVerb: "Mine", bringHint: "Bring the best pickaxe you own", keywords: ["pickaxe"] },
  { skill: "Hunter", suppliesLabel: "traps or birdhouse supplies", actionVerb: "Hunt", bringHint: "Bring traps or one complete birdhouse loop", keywords: ["box trap", "bird snare", "clockwork", "butterfly net"] }
] as const;

const COOKING_RECIPES: DirectRecipe[] = [
  direct("raw anglerfish", 230, 84, "Cook raw anglerfish"),
  direct("raw manta ray", 216.3, 91, "Cook raw manta rays"),
  direct("raw sea turtle", 211.3, 82, "Cook raw sea turtles"),
  direct("raw shark", 210, 80, "Cook raw sharks"),
  direct("raw dark crab", 215, 90, "Cook raw dark crabs"),
  direct("raw karambwan", 190, 30, "Cook raw karambwan"),
  direct("raw monkfish", 150, 62, "Cook raw monkfish"),
  direct("raw swordfish", 140, 45, "Cook raw swordfish"),
  direct("raw lobster", 120, 40, "Cook raw lobster"),
  direct("raw tuna", 100, 30, "Cook raw tuna"),
  direct("raw salmon", 90, 25, "Cook raw salmon"),
  direct("raw trout", 70, 15, "Cook raw trout")
];

const PRAYER_BASE_XP: DirectRecipe[] = [
  direct("superior dragon bones", 150, 70, "Offer superior dragon bones"),
  direct("dagannoth bones", 125, 1, "Offer dagannoth bones"),
  direct("lava dragon bones", 85, 1, "Offer lava dragon bones"),
  direct("dragon bones", 72, 1, "Offer dragon bones"),
  direct("wyvern bones", 72, 1, "Offer wyvern bones"),
  direct("wyrm bones", 50, 1, "Offer wyrm bones"),
  direct("big bones", 15, 1, "Offer big bones"),
  direct("infernal ashes", 62.5, 1, "Scatter infernal ashes"),
  direct("abyssal ashes", 42.5, 1, "Scatter abyssal ashes"),
  direct("malicious ashes", 32.5, 1, "Scatter malicious ashes"),
  direct("accursed ashes", 12.5, 1, "Scatter accursed ashes")
];

const LOG_FLETCHING: DirectRecipe[] = [
  direct("magic logs", 91.5, 85, "Cut magic longbows (u)"),
  direct("yew logs", 75, 70, "Cut yew longbows (u)"),
  direct("maple logs", 58.25, 55, "Cut maple longbows (u)"),
  direct("willow logs", 41.5, 40, "Cut willow longbows (u)"),
  direct("oak logs", 25, 25, "Cut oak longbows (u)"),
  direct("logs", 10, 10, "Cut longbows (u)")
];

const FIREMAKING_RECIPES: DirectRecipe[] = [
  direct("redwood logs", 350, 90, "Burn redwood logs"),
  direct("magic logs", 303.8, 75, "Burn magic logs"),
  direct("yew logs", 202.5, 60, "Burn yew logs"),
  direct("maple logs", 135, 45, "Burn maple logs"),
  direct("willow logs", 90, 30, "Burn willow logs"),
  direct("teak logs", 105, 35, "Burn teak logs"),
  direct("oak logs", 60, 15, "Burn oak logs"),
  direct("logs", 40, 1, "Burn logs")
];

const CONSTRUCTION_RECIPES: DirectRecipe[] = [
  direct("mahogany plank", 140, 52, "Build with mahogany planks"),
  direct("teak plank", 90, 35, "Build with teak planks"),
  direct("oak plank", 60, 15, "Build with oak planks"),
  direct("plank", 29, 1, "Build with planks")
];

const CRAFTING_RECIPES: DirectRecipe[] = [
  direct("uncut onyx", 167.5, 67, "Cut uncut onyx"),
  direct("uncut dragonstone", 137.5, 55, "Cut uncut dragonstones"),
  direct("uncut diamond", 107.5, 43, "Cut uncut diamonds"),
  direct("uncut ruby", 85, 34, "Cut uncut rubies"),
  direct("uncut emerald", 67.5, 27, "Cut uncut emeralds"),
  direct("uncut sapphire", 50, 20, "Cut uncut sapphires"),
  direct("black dragon leather", 86, 84, "Craft black d'hide bodies"),
  direct("red dragon leather", 78, 77, "Craft red d'hide bodies"),
  direct("blue dragon leather", 70, 71, "Craft blue d'hide bodies"),
  direct("green dragon leather", 62, 63, "Craft green d'hide bodies"),
  direct("molten glass", 52.5, 46, "Blow unpowered orbs")
];

const SMITHING_BARS: DirectRecipe[] = [
  direct("runite bar", 75, 85, "Smith runite bars"),
  direct("adamantite bar", 62.5, 70, "Smith adamantite bars"),
  direct("mithril bar", 50, 50, "Smith mithril bars"),
  direct("steel bar", 37.5, 30, "Smith steel bars"),
  direct("iron bar", 25, 15, "Smith iron bars"),
  direct("bronze bar", 12.5, 1, "Smith bronze bars")
];

const FARMING_RECIPES: DirectRecipe[] = [
  direct("magic seed", 13_913.8, 75, "Grow magic trees"),
  direct("palm tree seed", 10_509.6, 68, "Grow palm trees"),
  direct("yew seed", 7_150.9, 60, "Grow yew trees"),
  direct("papaya tree seed", 6_380.4, 57, "Grow papaya trees"),
  direct("maple seed", 3_448.4, 45, "Grow maple trees"),
  direct("pineapple seed", 4_791.7, 51, "Grow pineapple trees"),
  direct("snapdragon seed", 98.5, 62, "Grow snapdragon"),
  direct("ranarr seed", 30.5, 32, "Grow ranarr")
];

const HERBLORE_RECIPES = [
  potion("Toadflax", "toadflax potion (unf)", "crushed nest", "saradomin brew", 81, 180),
  potion("Dwarf weed", "dwarf weed potion (unf)", "wine of zamorak", "ranging potion", 72, 162.5),
  potion("Lantadyme", "lantadyme potion (unf)", "potato cactus", "magic potion", 76, 172.5),
  potion("Cadantine", "cadantine potion (unf)", "white berries", "super defence", 66, 150),
  potion("Snapdragon", "snapdragon potion (unf)", "red spiders' eggs", "super restore", 63, 142.5),
  potion("Kwuarm", "kwuarm potion (unf)", "limpwurt root", "super strength", 55, 125),
  potion("Avantoe", "avantoe potion (unf)", "mort myre fungus", "super energy", 52, 117.5),
  potion("Irit leaf", "irit potion (unf)", "eye of newt", "super attack", 45, 100),
  potion("Ranarr weed", "ranarr potion (unf)", "snape grass", "prayer potion", 38, 87.5),
  potion("Harralander", "harralander potion (unf)", "goat horn dust", "combat potion", 36, 84),
  potion("Tarromin", "tarromin potion (unf)", "limpwurt root", "strength potion", 12, 50),
  potion("Guam leaf", "guam potion (unf)", "eye of newt", "attack potion", 3, 25)
] as const;

const DART_RECIPES = [
  { item: "dragon dart tip", name: "dragon darts", level: 95, xp: 25.8 },
  { item: "amethyst dart tip", name: "amethyst darts", level: 90, xp: 21 },
  { item: "rune dart tip", name: "rune darts", level: 81, xp: 18.8 },
  { item: "adamant dart tip", name: "adamant darts", level: 67, xp: 15 },
  { item: "mithril dart tip", name: "mithril darts", level: 54, xp: 11.2 }
] as const;

const BOLT_RECIPES = [
  { item: "dragon bolts (unf)", name: "dragon bolts", level: 84, xp: 12 },
  { item: "runite bolts (unf)", name: "runite bolts", level: 69, xp: 10 },
  { item: "adamant bolts (unf)", name: "adamant bolts", level: 61, xp: 7 },
  { item: "mithril bolts (unf)", name: "mithril bolts", level: 54, xp: 5 }
] as const;

function direct(item: string, xp: number, level: number, method: string): DirectRecipe {
  return { item, name: item, xp, level, method };
}

function potion(herb: string, unfinished: string, secondary: string, result: string, level: number, xp: number) {
  return { herb: herb.toLowerCase(), unfinished, secondary, result, level, xp };
}

export function bankedXpDescriptor(skill: string): BankedXpSkillDescriptor | null {
  return BANKED_XP_SKILL_DESCRIPTORS.find((entry) => entry.skill.toLowerCase() === skill.toLowerCase()) ?? null;
}

export function normalizeBankedXpName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+\((?:noted|placeholder|variant)\)$/i, "")
    .replace(/\s+/g, " ");
}

export function normalizeBankedXpItems(items: readonly BankedXpItem[]): Bank {
  const bank: Bank = new Map();
  for (const item of items) {
    const name = normalizeBankedXpName(item.name);
    if (!name || name.startsWith("unknown item")) continue;
    const quantity = safeQuantity(item.quantity);
    if (quantity <= 0) continue;
    bank.set(name, Math.min(MAX_ITEM_QUANTITY, (bank.get(name) ?? 0) + quantity));
  }
  return bank;
}

export function estimateBankedXp(input: EstimateBankedXpInput): BankedXpEstimate {
  const descriptor = bankedXpDescriptor(input.skill);
  const remaining = input.xpRemaining === null || input.xpRemaining === undefined
    ? null
    : safeXp(input.xpRemaining);
  if (!descriptor || input.bank === undefined) return emptyEstimate(input.skill, "unknown", remaining);

  const bank = normalizeBankedXpItems(input.bank);
  const level = Math.max(1, Math.min(99, Math.floor(input.currentLevel ?? 99)));
  const result = calculate(descriptor.skill, bank, level, input.prayerMethod ?? "gilded-altar");
  const materials = result.materials
    .filter((entry) => entry.quantity > 0 && entry.xpHigh > 0)
    .sort((a, b) => b.xpHigh - a.xpHigh)
    .slice(0, MAX_VISIBLE_MATERIALS);
  const allMaterials = result.materials.filter((entry) => entry.quantity > 0 && entry.xpHigh > 0);
  const totalXpLow = safeXp(allMaterials.reduce((sum, entry) => sum + entry.xpLow, 0));
  const totalXpHigh = safeXp(allMaterials.reduce((sum, entry) => sum + entry.xpHigh, 0));
  const totalQuantity = allMaterials.reduce((sum, entry) => Math.min(MAX_ITEM_QUANTITY, sum + entry.quantity), 0);
  if (totalXpHigh <= 0) return { ...emptyEstimate(descriptor.skill, "known-empty", remaining), assumptions: result.assumptions };

  return {
    skill: descriptor.skill,
    status: "estimated",
    method: result.method,
    totalXpLow,
    totalXpHigh,
    totalQuantity,
    coveredXpLow: remaining === null ? totalXpLow : Math.min(remaining, totalXpLow),
    coveredXpHigh: remaining === null ? totalXpHigh : Math.min(remaining, totalXpHigh),
    remainingXpLow: remaining === null ? null : Math.max(0, remaining - totalXpHigh),
    remainingXpHigh: remaining === null ? null : Math.max(0, remaining - totalXpLow),
    materials,
    assumptions: result.assumptions
  };
}

export function bankedXpMaterialLine(estimate: BankedXpEstimate): string | null {
  if (estimate.status !== "estimated" || estimate.materials.length === 0) return null;
  const stacks = estimate.materials
    .map((entry) => `${entry.quantity.toLocaleString("en-US")} ${entry.name}`)
    .join(", ");
  return `${stacks} cover ${formatXpRange(estimate.coveredXpLow, estimate.coveredXpHigh)} ${estimate.skill} XP`;
}

export function formatXpRange(low: number, high: number): string {
  const safeLow = Math.round(safeXp(low));
  const safeHigh = Math.round(safeXp(high));
  if (safeLow === safeHigh) return `about ${safeHigh.toLocaleString("en-US")}`;
  return `about ${safeLow.toLocaleString("en-US")}-${safeHigh.toLocaleString("en-US")}`;
}

function calculate(skill: string, bank: Bank, level: number, prayerMethod: PrayerXpMethod) {
  if (skill === "Cooking") return cooking(bank, level);
  if (skill === "Prayer") return prayer(bank, level, prayerMethod);
  if (skill === "Herblore") return herblore(bank, level);
  if (skill === "Fletching") return fletching(bank, level);
  if (skill === "Crafting") return crafting(bank, level);
  if (skill === "Smithing") return smithing(bank, level);
  if (skill === "Construction") return directMaterials(bank, level, CONSTRUCTION_RECIPES, "Build banked planks", []);
  if (skill === "Firemaking") return directMaterials(bank, level, FIREMAKING_RECIPES, "Burn banked logs", []);
  if (skill === "Farming") return directMaterials(bank, level, FARMING_RECIPES, "Plant useful banked seeds", ["Check-health XP is included; harvest XP and failed crops are not."]);
  if (skill === "Magic") return magic(bank, level);
  if (skill === "Runecraft") return directMaterials(bank, level, [
    direct("daeyalt essence", 12, 1, "Craft daeyalt essence"),
    direct("pure essence", 8, 1, "Craft pure essence"),
    direct("rune essence", 5, 1, "Craft rune essence")
  ], "Craft banked essence", ["XP per essence uses a representative high-level rune route; the exact altar can change it."]);
  return { method: null, materials: [] as BankedXpMaterial[], assumptions: [] as string[] };
}

function cooking(bank: Bank, level: number) {
  const materials = COOKING_RECIPES.flatMap((recipe) => {
    const quantity = get(bank, recipe.item);
    if (quantity <= 0 || level < (recipe.level ?? 1)) return [];
    const successFloor = Math.min(0.98, Math.max(0.6, 0.65 + (level - (recipe.level ?? 1)) * 0.015));
    return [material(recipe.name, quantity, recipe.xp * successFloor, recipe.xp, recipe.method)];
  });
  return {
    method: "Cook banked raw food",
    materials,
    assumptions: ["The lower estimate allows for burns; the upper estimate assumes every raw food succeeds."]
  };
}

function prayer(bank: Bank, level: number, prayerMethod: PrayerXpMethod) {
  const methodLabel: Record<PrayerXpMethod, string> = {
    bury: "Bury bones and scatter ashes",
    "gilded-altar": "Use a gilded altar",
    "chaos-altar": "Use the Chaos Altar",
    ectofuntus: "Use the Ectofuntus"
  };
  const materials = PRAYER_BASE_XP.flatMap((recipe) => {
    const quantity = get(bank, recipe.item);
    if (quantity <= 0 || level < (recipe.level ?? 1)) return [];
    const ashes = recipe.item.endsWith("ashes");
    let lowMultiplier = 1;
    let highMultiplier = 1;
    if (!ashes && prayerMethod === "gilded-altar") lowMultiplier = highMultiplier = 3.5;
    if (!ashes && prayerMethod === "ectofuntus") lowMultiplier = highMultiplier = 4;
    if (!ashes && prayerMethod === "chaos-altar") {
      lowMultiplier = 3.5;
      highMultiplier = 7;
    }
    return [material(recipe.name, quantity, recipe.xp * lowMultiplier, recipe.xp * highMultiplier, ashes ? recipe.method : methodLabel[prayerMethod])];
  });
  return {
    method: methodLabel[prayerMethod],
    materials,
    assumptions: prayerMethod === "chaos-altar"
      ? ["The range starts at altar XP and ends at the long-run 50% bone-save expectation; deaths are not priced in."]
      : ["Ashes use their normal scatter XP because altar multipliers only apply to bones."]
  };
}

function herblore(sourceBank: Bank, level: number) {
  const bank = new Map(sourceBank);
  const materials: BankedXpMaterial[] = [];
  for (const recipe of HERBLORE_RECIPES) {
    if (level < recipe.level) continue;
    let secondary = get(bank, recipe.secondary);
    if (secondary <= 0) continue;
    const unfinished = Math.min(get(bank, recipe.unfinished), secondary);
    consume(bank, recipe.unfinished, unfinished);
    consume(bank, recipe.secondary, unfinished);
    secondary -= unfinished;

    const water = get(bank, "vial of water");
    const clean = get(bank, recipe.herb);
    const grimy = get(bank, `grimy ${recipe.herb}`);
    const fresh = Math.min(clean + grimy, secondary, water);
    if (fresh > 0) {
      consume(bank, recipe.secondary, fresh);
      consume(bank, "vial of water", fresh);
      const cleanUsed = Math.min(clean, fresh);
      consume(bank, recipe.herb, cleanUsed);
      consume(bank, `grimy ${recipe.herb}`, fresh - cleanUsed);
    }
    const actions = unfinished + fresh;
    if (actions > 0) materials.push(material(`${recipe.result} supplies`, actions, recipe.xp, recipe.xp, `Mix ${recipe.result}`));
  }
  return {
    method: "Mix complete potion chains",
    materials,
    assumptions: ["Finished potions are excluded: their Herblore XP has already been earned.", "Shared secondaries and vials are allocated once, highest-value recipe first."]
  };
}

function fletching(sourceBank: Bank, level: number) {
  const bank = new Map(sourceBank);
  const materials = directMaterialRows(bank, level, LOG_FLETCHING);
  let strings = get(bank, "bow string");
  const bows = [
    { item: "magic longbow (u)", name: "magic longbows (u)", level: 85, xp: 91.5 },
    { item: "yew longbow (u)", name: "yew longbows (u)", level: 70, xp: 75 },
    { item: "maple longbow (u)", name: "maple longbows (u)", level: 55, xp: 58.25 }
  ];
  for (const recipe of bows) {
    if (level < recipe.level || strings <= 0) continue;
    const quantity = Math.min(get(bank, recipe.item), strings);
    if (quantity <= 0) continue;
    strings -= quantity;
    materials.push(material(recipe.name, quantity, recipe.xp, recipe.xp, `String ${recipe.name}`));
  }
  let feathers = get(bank, "feather");
  for (const recipe of [...DART_RECIPES, ...BOLT_RECIPES].sort((a, b) => b.xp - a.xp)) {
    if (level < recipe.level || feathers <= 0) continue;
    const quantity = Math.min(get(bank, recipe.item), feathers);
    if (quantity <= 0) continue;
    feathers -= quantity;
    materials.push(material(recipe.name, quantity, recipe.xp, recipe.xp, `Finish ${recipe.name}`));
  }
  const broadArrows = Math.min(get(bank, "broad arrowheads"), get(bank, "headless arrow"));
  if (level >= 52 && broadArrows > 0) materials.push(material("broad arrows", broadArrows, 15, 15, "Finish broad arrows"));
  return {
    method: "Use complete banked Fletching stacks",
    materials,
    assumptions: ["Feathers and bow strings are allocated once; finished bows, darts and bolts are not counted again."]
  };
}

function crafting(bank: Bank, level: number) {
  const materials = directMaterialRows(bank, level, CRAFTING_RECIPES);
  let staves = get(bank, "battlestaff");
  for (const orb of ["air orb", "fire orb", "earth orb", "water orb"]) {
    if (level < 54 || staves <= 0) break;
    const quantity = Math.min(staves, get(bank, orb));
    if (quantity <= 0) continue;
    staves -= quantity;
    materials.push(material(`${orb}s + battlestaves`, quantity, 137.5, 137.5, `Attach ${orb}s`));
  }
  return {
    method: "Craft the best complete banked materials",
    materials,
    assumptions: ["Battlestaves are limited by charged orbs and allocated once."]
  };
}

function smithing(sourceBank: Bank, level: number) {
  const bank = new Map(sourceBank);
  const materials = directMaterialRows(bank, level, SMITHING_BARS);
  const gold = level >= 40 ? get(bank, "gold ore") : 0;
  if (gold > 0) materials.push(material("gold ore", gold, 22.5, 56.2, "Smelt gold ore"));
  const iron = level >= 15 ? get(bank, "iron ore") : 0;
  if (iron > 0) materials.push(material("iron ore", iron, 12.5, 12.5, "Smelt iron ore"));

  let coal = get(bank, "coal");
  const ores = [
    { item: "runite ore", name: "runite ore", level: 85, coal: 8, xp: 50 },
    { item: "adamantite ore", name: "adamantite ore", level: 70, coal: 6, xp: 37.5 },
    { item: "mithril ore", name: "mithril ore", level: 50, coal: 4, xp: 30 },
    { item: "iron ore", name: "steel-bar iron ore", level: 30, coal: 2, xp: 17.5 }
  ];
  for (const recipe of ores) {
    if (level < recipe.level || coal < recipe.coal) continue;
    const availableOre = recipe.item === "iron ore" ? 0 : get(bank, recipe.item);
    const quantity = Math.min(availableOre, Math.floor(coal / recipe.coal));
    if (quantity <= 0) continue;
    coal -= quantity * recipe.coal;
    materials.push(material(recipe.name, quantity, recipe.xp, recipe.xp, `Smelt ${recipe.name}`));
  }
  return {
    method: "Smith bars and smelt usable ore",
    materials,
    assumptions: ["Coal is allocated once, highest-tier ore first.", "Finished armour and weapons are excluded because their Smithing XP is already earned.", "Gold ore shows the normal-to-Goldsmith-gauntlets range."]
  };
}

function magic(bank: Bank, level: number) {
  const candidates: BankedXpMaterial[] = [];
  const infiniteFire = hasAny(bank, ["staff of fire", "fire battlestaff", "mystic fire staff", "lava battlestaff", "smoke battlestaff"]);
  const infiniteAir = hasAny(bank, ["staff of air", "air battlestaff", "mystic air staff", "smoke battlestaff", "mist battlestaff", "dust battlestaff"]);
  const infiniteEarth = hasAny(bank, ["staff of earth", "earth battlestaff", "mystic earth staff", "lava battlestaff", "dust battlestaff", "mud battlestaff"]);
  if (level >= 55) {
    const casts = Math.min(get(bank, "nature rune"), infiniteFire ? MAX_ITEM_QUANTITY : Math.floor(get(bank, "fire rune") / 5));
    if (casts > 0) candidates.push(material("High Alchemy casts", casts, 65, 65, "Cast High Alchemy"));
  }
  if (level >= 45) {
    const casts = Math.min(get(bank, "law rune"), infiniteAir ? MAX_ITEM_QUANTITY : Math.floor(get(bank, "air rune") / 5));
    if (casts > 0) candidates.push(material("Camelot teleports", casts, 55.5, 55.5, "Teleport to Camelot"));
  }
  if (level >= 86) {
    const logs = get(bank, "mahogany logs") + get(bank, "teak logs") + get(bank, "oak logs");
    const casts = Math.min(get(bank, "nature rune"), Math.floor(get(bank, "astral rune") / 2), infiniteEarth ? MAX_ITEM_QUANTITY : Math.floor(get(bank, "earth rune") / 15), logs);
    if (casts > 0) candidates.push(material("Plank Make casts", casts, 90, 90, "Cast Plank Make"));
  }
  const best = candidates.sort((a, b) => b.xpHigh - a.xpHigh)[0];
  return {
    method: best?.method ?? "Use a complete rune stack",
    materials: best ? [best] : [],
    assumptions: ["Only one complete selected spell route is counted, so shared runes are never double-counted.", "High Alchemy assumes you have a suitable item to cast on; its value is not included."]
  };
}

function directMaterials(bank: Bank, level: number, recipes: DirectRecipe[], method: string, assumptions: string[]) {
  return { method, materials: directMaterialRows(bank, level, recipes), assumptions };
}

function directMaterialRows(bank: Bank, level: number, recipes: DirectRecipe[]): BankedXpMaterial[] {
  return recipes.flatMap((recipe) => {
    const quantity = get(bank, recipe.item);
    return quantity > 0 && level >= (recipe.level ?? 1)
      ? [material(recipe.name, quantity, recipe.xp, recipe.xp, recipe.method)]
      : [];
  });
}

function material(name: string, quantity: number, xpPerItemLow: number, xpPerItemHigh: number, method: string): BankedXpMaterial {
  const safe = safeQuantity(quantity);
  return {
    name,
    quantity: safe,
    xpLow: safeXp(safe * Math.max(0, xpPerItemLow)),
    xpHigh: safeXp(safe * Math.max(xpPerItemLow, xpPerItemHigh)),
    method
  };
}

function emptyEstimate(skill: string, status: Exclude<BankedXpStatus, "estimated">, remaining: number | null): BankedXpEstimate {
  return {
    skill,
    status,
    method: null,
    totalXpLow: 0,
    totalXpHigh: 0,
    totalQuantity: 0,
    coveredXpLow: 0,
    coveredXpHigh: 0,
    remainingXpLow: remaining,
    remainingXpHigh: remaining,
    materials: [],
    assumptions: []
  };
}

function get(bank: Bank, name: string): number {
  return bank.get(normalizeBankedXpName(name)) ?? 0;
}

function consume(bank: Bank, name: string, quantity: number): void {
  const key = normalizeBankedXpName(name);
  bank.set(key, Math.max(0, (bank.get(key) ?? 0) - safeQuantity(quantity)));
}

function hasAny(bank: Bank, names: string[]): boolean {
  return names.some((name) => get(bank, name) > 0);
}

function safeQuantity(quantity: number | undefined): number {
  if (quantity === undefined) return 1;
  if (!Number.isFinite(quantity)) return 0;
  return Math.max(0, Math.min(MAX_ITEM_QUANTITY, Math.floor(quantity)));
}

function safeXp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, value));
}
