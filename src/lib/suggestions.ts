// Smart suggestions: rule-based recommendations based on what's in the bank.
// Each rule looks for a specific pattern and returns a Suggestion if it fires.
// No LLM, no API — just regex + arithmetic on the OrganizedTab[] result.

import type { OrganizedTab, OrganizedItem } from "./organizer";
import { wikiSearchUrl } from "./wiki";

export type SuggestionTone = "tip" | "warning" | "win";

export interface SuggestionItemRef {
  id: number;
  name: string;
}

export interface Suggestion {
  id: string;            // stable key for React
  tone: SuggestionTone;
  title: string;
  body: string;
  steps: string[];
  itemIds?: number[];
  matchedItems?: SuggestionItemRef[];
  gpImpact?: number;     // optional gp value freed/gained
  actionLabel?: string;
  actionHref?: string;
}

type Bank = OrganizedTab[];
const HIGH_VALUE_STACK_THRESHOLD = 25_000_000;

function allItems(tabs: Bank): OrganizedItem[] {
  return tabs.flatMap((t) => t.items);
}

function find(items: OrganizedItem[], pattern: RegExp): OrganizedItem[] {
  return items.filter((it) => pattern.test(it.name.toLowerCase()));
}

function totalQuantity(items: OrganizedItem[]): number {
  return items.reduce((s, it) => s + it.quantity, 0);
}

function itemIdentity(items: OrganizedItem[], limit = 8): Pick<Suggestion, "itemIds" | "matchedItems"> {
  const seen = new Set<number>();
  const matchedItems: SuggestionItemRef[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    matchedItems.push({ id: item.id, name: item.name });
    if (matchedItems.length >= limit) break;
  }
  return {
    itemIds: matchedItems.map((item) => item.id),
    matchedItems
  };
}

// ── Rules ───────────────────────────────────────────────────────────────────

function ruleCoinsToPlatinum(items: OrganizedItem[]): Suggestion | null {
  const coins = items.find((it) => it.id === 995);
  if (!coins) return null;
  if (coins.quantity < 1_000_000) return null;
  const platTokens = Math.floor(coins.quantity / 1000);
  return {
    id: "coins-to-plat",
    tone: "tip",
    title: "Free up bank space with platinum tokens",
    body: `You have ${coins.quantity.toLocaleString()} gp. Convert to ${platTokens.toLocaleString()} platinum tokens at any banker for the same value, one slot instead of one stack. Reversible anytime.`,
    steps: [
      "Withdraw your coin stack.",
      "Use a banker or the Grand Exchange clerk.",
      "Convert coins to platinum tokens and keep one slot."
    ],
    ...itemIdentity([coins]),
    actionLabel: "Open platinum token guide",
    actionHref: wikiSearchUrl("Platinum token OSRS")
  };
}

function ruleDecantPotions(items: OrganizedItem[]): Suggestion | null {
  // Look for potions with dose < 4 that could be decanted up
  const potions = items.filter((it) =>
    /\((\d)\)$/.test(it.name) &&
    !/divine|holy/.test(it.name.toLowerCase())
  );
  type Family = { base: string; doses: Record<number, OrganizedItem> };
  const byFamily = new Map<string, Family>();
  for (const it of potions) {
    const m = it.name.match(/^(.+?)\((\d)\)$/);
    if (!m) continue;
    const base = m[1].trim().toLowerCase();
    const dose = parseInt(m[2], 10);
    if (!byFamily.has(base)) byFamily.set(base, { base, doses: {} });
    byFamily.get(base)!.doses[dose] = it;
  }
  const decantable = Array.from(byFamily.values()).filter((f) => {
    const doses = Object.keys(f.doses).map(Number);
    return doses.length > 1 || (doses[0] && doses[0] < 4);
  });
  if (decantable.length === 0) return null;
  const names = decantable.slice(0, 3).map((f) => f.base).join(", ");
  const more = decantable.length > 3 ? ` and ${decantable.length - 3} more` : "";
  const matchedPotions = decantable.flatMap((family) => Object.values(family.doses));
  return {
    id: "decant-potions",
    tone: "tip",
    title: "Decant fragmented potions",
    body: `${decantable.length} potion families have mixed doses (${names}${more}). Visit a Bob Barter (Grand Exchange) or any decanter to fold them into 4-doses. Cleaner bank, fewer click-misses mid-trip.`,
    steps: [
      "Withdraw the mixed-dose potion stacks.",
      "Talk to Bob Barter at the Grand Exchange.",
      "Decant into 4-dose stacks before rebuilding your supplies tab."
    ],
    ...itemIdentity(matchedPotions),
    actionLabel: "Open decanting guide",
    actionHref: wikiSearchUrl("OSRS potion decanting")
  };
}

function ruleSparePotPotions(items: OrganizedItem[]): Suggestion | null {
  // Player has a lot of low-dose potions (probably leftover from old trips)
  const lowDose = items.filter((it) => /\((1|2)\)$/.test(it.name));
  if (lowDose.length < 5) return null;
  const sample = lowDose.slice(0, 3).map((it) => it.name).join(", ");
  return {
    id: "low-dose-cleanup",
    tone: "warning",
    title: `${lowDose.length} low-dose potions cluttering bank`,
    body: `Items like ${sample} are taking up slots. Decant or drink them off — most players keep only 4-doses to maximise bank space.`,
    steps: [
      "Filter the bank for potion doses ending in (1) or (2).",
      "Decant useful potions; sell or drink obsolete leftovers.",
      "Keep only trip-ready 4-dose stacks in your supplies tab."
    ],
    ...itemIdentity(lowDose),
    actionLabel: "Open potion decanting",
    actionHref: wikiSearchUrl("OSRS potion decanting")
  };
}

function ruleNoRunePouch(items: OrganizedItem[]): Suggestion | null {
  const hasPouch = items.some((it) => /rune pouch/i.test(it.name));
  const runeCount = find(items, /\brune$/).length;
  if (hasPouch) return null;
  if (runeCount < 4) return null;
  return {
    id: "missing-rune-pouch",
    tone: "tip",
    title: "Get a Rune Pouch",
    body: `You have ${runeCount} different rune stacks but no rune pouch. The pouch holds 4 rune types and saves 3 inventory slots. Reward from the Slayer Tower (Mysterious Old Man) or the Wintertodt.`,
    steps: [
      "Check if you already have enough Slayer points or reward currency.",
      "Buy or unlock the rune pouch.",
      "Load your four most-used rune types and move it to gear/supplies."
    ],
    ...itemIdentity(find(items, /\brune$/)),
    actionLabel: "Open rune pouch guide",
    actionHref: wikiSearchUrl("Rune pouch OSRS")
  };
}

function rulePartialBarrowsSet(items: OrganizedItem[]): Suggestion | null {
  // Detect partial Barrows sets — fun visual diagnostic
  const sets = [
    { name: "Dharok", pieces: [/dharok's helm/, /dharok's platebody/, /dharok's platelegs/, /dharok's greataxe/] },
    { name: "Ahrim", pieces: [/ahrim's hood/, /ahrim's robetop/, /ahrim's robeskirt/, /ahrim's staff/] },
    { name: "Karil", pieces: [/karil's coif/, /karil's leathertop/, /karil's leatherskirt/, /karil's crossbow/] },
    { name: "Verac", pieces: [/verac's helm/, /verac's brassard/, /verac's plateskirt/, /verac's flail/] },
    { name: "Torag", pieces: [/torag's helm/, /torag's platebody/, /torag's platelegs/, /torag's hammers/] },
    { name: "Guthan", pieces: [/guthan's helm/, /guthan's platebody/, /guthan's chainskirt/, /guthan's warspear/] }
  ];
  const incomplete = sets.map((set) => {
    const matchedPieces = items.filter((item) => set.pieces.some((pattern) => pattern.test(item.name.toLowerCase())));
    return { name: set.name, have: matchedPieces.length, total: set.pieces.length, matchedPieces };
  }).filter((s) => s.have > 0 && s.have < s.total);
  if (incomplete.length === 0) return null;
  const top = incomplete.sort((a, b) => b.have - a.have)[0];
  return {
    id: "barrows-set",
    tone: "tip",
    title: `Almost a full ${top.name}'s set`,
    body: `You have ${top.have}/${top.total} pieces. One more Barrows trip and you've got the visual flex of a complete set in your gear tab.`,
    steps: [
      `Check which ${top.name} piece is missing.`,
      "Decide: finish the set, sell duplicates, or collapse it into a loot tab.",
      "Use the set as a gear-tab anchor if you keep it."
    ],
    ...itemIdentity(top.matchedPieces),
    actionLabel: `Open ${top.name} set guide`,
    actionHref: wikiSearchUrl(`${top.name} Barrows set OSRS`)
  };
}

function ruleStackedFood(items: OrganizedItem[]): Suggestion | null {
  const food = find(items, /\b(shark|monkfish|manta ray|anglerfish|dark crab|karambwan)\b/);
  const totalFood = totalQuantity(food);
  if (totalFood < 1000) return null;
  return {
    id: "stacked-food",
    tone: "win",
    title: `${totalFood.toLocaleString()} food stacked`,
    body: "Plenty of food in the bank — you're set for serious bossing. Watch the GE price; high-tier food (manta, anglerfish) sometimes spikes after content updates.",
    steps: [
      "Keep one visible stack in supplies.",
      "Move surplus food to a PvM resupply tab.",
      "Sell excess if it blocks upgrades or liquidity."
    ],
    ...itemIdentity(food),
    actionLabel: "Check food prices",
    actionHref: wikiSearchUrl("OSRS food price")
  };
}

function ruleHerbsToHerblore(items: OrganizedItem[]): Suggestion | null {
  const grimy = find(items, /^grimy /);
  if (grimy.length < 5) return null;
  const total = totalQuantity(grimy);
  return {
    id: "grimy-herbs",
    tone: "tip",
    title: `${total.toLocaleString()} grimy herbs unprocessed`,
    body: `Clean and herblore them for the xp gain — or sell as-is if you're short on cash. Top decanters in Edgeville will trade you finished potions if you bring the herbs + secondaries.`,
    steps: [
      "Sort grimy herbs by potion family.",
      "Clean them if you want Herblore XP.",
      "Sell or process low-priority herbs before reorganising."
    ],
    ...itemIdentity(grimy),
    actionLabel: "Open Herblore training",
    actionHref: wikiSearchUrl("OSRS Herblore training")
  };
}

function ruleHighValueClueRewards(items: OrganizedItem[]): Suggestion | null {
  const caskets = find(items, /reward casket|clue scroll \((medium|hard|elite|master)\)/i);
  if (caskets.length === 0) return null;
  const total = totalQuantity(caskets);
  return {
    id: "open-clues",
    tone: "win",
    title: `${total} unopened clue${total > 1 ? "s" : ""}/caskets`,
    body: "Treasure trail rewards are sitting unredeemed. Open them — even bad rolls give cosmetics worth selling, and the rare drops are big upside.",
    steps: [
      "Open every stored casket before a cleanup pass.",
      "Sell duplicate cosmetics and stackable rewards.",
      "Keep only active clue steps in the bank."
    ],
    ...itemIdentity(caskets),
    actionLabel: "Open clue rewards",
    actionHref: wikiSearchUrl("Treasure Trails rewards OSRS")
  };
}

function ruleExpensiveBank(items: OrganizedItem[]): Suggestion | null {
  // Top-1 most valuable single stack
  const top = [...items].sort((a, b) => b.stackValue - a.stackValue)[0];
  if (!top || top.stackValue < HIGH_VALUE_STACK_THRESHOLD) return null;
  const value = top.stackValue;
  const m = value >= 1_000_000_000 ? `${(value / 1_000_000_000).toFixed(2)}B` : `${(value / 1_000_000).toFixed(0)}M`;
  return {
    id: "expensive-item",
    tone: "win",
    title: `${top.name}: ${m} gp on the shelf`,
    body: `Your most valuable single stack. If you're not using it, that's locked capital. Consider whether it's worth flipping the GE for liquid GP.`,
    steps: [
      "Ask if this item is used in your next three goals.",
      "If not, compare sell value against your next upgrade.",
      "Move it to gear if active; otherwise mark it as liquidity."
    ],
    ...itemIdentity([top]),
    gpImpact: value,
    actionLabel: `Open ${top.name} wiki`,
    actionHref: wikiSearchUrl(top.name)
  };
}

function ruleTooManyTeleportTabs(items: OrganizedItem[]): Suggestion | null {
  const tabs = find(items, /teleport$|tablet$/);
  const total = totalQuantity(tabs);
  if (total < 200) return null;
  return {
    id: "tele-stockpile",
    tone: "warning",
    title: `${total.toLocaleString()} teleport tablets in storage`,
    body: "Big stockpile. If you have a max cape or POH mounted teleports, many of these are redundant. Worth GE-ing the leftovers.",
    steps: [
      "Keep a small working stack for common routes.",
      "Compare duplicates against POH, jewelry box, and cape teleports.",
      "Sell redundant bulk tabs or move them to a travel tab."
    ],
    ...itemIdentity(tabs),
    actionLabel: "Review teleport tablets",
    actionHref: wikiSearchUrl("Teleport tablet OSRS")
  };
}

function ruleMissingPouches(items: OrganizedItem[]): Suggestion | null {
  const expected = [/small pouch/, /medium pouch/, /large pouch/, /giant pouch/, /colossal pouch/];
  const have = expected.filter((p) => items.some((it) => p.test(it.name.toLowerCase()))).length;
  const pouchItems = items.filter((item) => expected.some((pattern) => pattern.test(item.name.toLowerCase())));
  const hasEssence = items.some((it) => /pure essence|daeyalt essence/.test(it.name.toLowerCase()) && it.quantity > 1000);
  if (!hasEssence || have === expected.length || have === 0) return null;
  return {
    id: "missing-pouches",
    tone: "tip",
    title: `Runecrafting: ${have}/5 essence pouches`,
    body: "More pouches = more essence per RC trip. Giant pouch from Abyss, Colossal from Guardians of the Rift. Big speed-up for crafting time.",
    steps: [
      "Check which pouch sizes are missing.",
      "Unlock the next pouch before long RC sessions.",
      "Store pouches next to essence and teleport items."
    ],
    ...itemIdentity(pouchItems),
    actionLabel: "Open essence pouch guide",
    actionHref: wikiSearchUrl("Essence pouch OSRS")
  };
}

// ── Runner ──────────────────────────────────────────────────────────────────

const RULES = [
  ruleCoinsToPlatinum,
  ruleExpensiveBank,
  ruleHighValueClueRewards,
  ruleDecantPotions,
  ruleSparePotPotions,
  ruleNoRunePouch,
  ruleMissingPouches,
  rulePartialBarrowsSet,
  ruleStackedFood,
  ruleHerbsToHerblore,
  ruleTooManyTeleportTabs
];

export function generateSuggestions(tabs: Bank): Suggestion[] {
  const items = allItems(tabs);
  const out: Suggestion[] = [];
  for (const rule of RULES) {
    const s = rule(items);
    if (s) out.push(s);
  }
  return out;
}
