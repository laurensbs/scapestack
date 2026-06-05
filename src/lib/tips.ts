// Bank-tips engine. Inspects the organised bank and surfaces actionable
// suggestions — items to decant, outfits to complete, redundant duplicates
// to merge, untradeable rewards the player has unlocked but not collected.
//
// Each detector returns zero or more `BankTip`s. Tips are dismissable per
// session in the UI; the engine itself is pure and re-computes on every
// bank render.

import type { OrganizedTab, OrganizedItem } from "./organizer";

export type TipSeverity = "info" | "save" | "earn";

export interface BankTip {
  /** Stable id so the UI can dismiss / dedupe across renders. */
  id: string;
  /** Coarse intent — drives icon + colour. */
  kind: "decant" | "stack-merge" | "outfit-incomplete" | "untradeable-pickup";
  /**
   * Sub-category within a kind. The UI groups tips by (kind, subKind) into
   * one collapsible row, so a player sees "Decant jewellery (5)" and "Decant
   * potions (3)" instead of 8 individual rows. Optional — when omitted the
   * tip renders as a standalone row.
   */
  subKind?: "potions" | "jewellery";
  severity: TipSeverity;
  /** One-line headline shown in the card. */
  title: string;
  /** One-line elaboration shown under the title. */
  detail: string;
  /** Item IDs the tip refers to — used for highlighting and to find icon. */
  itemIds: number[];
  /** Item IDs plus display names, used for exact wiki links and copy plans. */
  itemRefs?: Array<{ id: number; name: string }>;
  /** Optional: number of bank slots reclaimed if the user follows the tip. */
  slotsFreed?: number;
}

function itemRefs(items: Array<{ id: number; name: string }>, limit = 8): Array<{ id: number; name: string }> {
  const seen = new Set<number>();
  const out: Array<{ id: number; name: string }> = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ id: item.id, name: item.name });
    if (out.length >= limit) break;
  }
  return out;
}

// ─── Decant detector ────────────────────────────────────────────────────────
// Two kinds of decant opportunities:
//   1. Charged jewellery with multiple charge-states in the bank (glory(1) +
//      glory(3) + glory(6)).
//   2. Potions with multiple dose-states in the bank (super combat(1) + (3) +
//      (4)). Player can recharge or decant at a Wise Old Man, Bob's Brilliant
//      Axes-style NPC, or via the rune pouch dose-balancer plugin.

const CHARGED_JEWELLERY_BASES = [
  "Amulet of glory", "Ring of dueling", "Games necklace", "Skills necklace",
  "Combat bracelet", "Ring of wealth", "Burning amulet", "Necklace of passage",
  "Digsite pendant", "Slayer ring", "Necklace of binding",
  "Bracelet of slaughter", "Expeditious bracelet", "Amulet of chemistry"
];

/** Strip a (N) suffix and return [base, charge|null]. */
function splitCharged(name: string): { base: string; charge: number | null } {
  const m = name.match(/^(.+?)\s?\((\d+)\)$/);
  if (!m) return { base: name, charge: null };
  return { base: m[1].trim(), charge: parseInt(m[2], 10) };
}

function detectDecant(items: OrganizedItem[]): BankTip[] {
  // Group items by their stripped base name. Only the bases we care about
  // (charged jewellery + potions) qualify.
  const groups = new Map<string, Array<{ item: OrganizedItem; charge: number }>>();
  for (const it of items) {
    const { base, charge } = splitCharged(it.name);
    if (charge === null) continue;
    const isJewellery = CHARGED_JEWELLERY_BASES.some((b) => base === b);
    const isPotion = /(potion|brew|serum|antifire|antidote|anti-?venom|antipoison|stamina|energy|prayer|combat|restore|ranging|magic|bastion|battlemage)/i.test(base);
    if (!isJewellery && !isPotion) continue;
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push({ item: it, charge });
  }

  const tips: BankTip[] = [];
  for (const [base, entries] of groups) {
    if (entries.length < 2) continue;
    // Distinct charge values needed — duplicate (4)s aren't decant fodder.
    const charges = [...new Set(entries.map((e) => e.charge))].sort((a, b) => b - a);
    if (charges.length < 2) continue;
    const ids = entries.map((e) => e.item.id);
    const refs = itemRefs(entries.map((e) => e.item));
    const totalSlots = entries.length;
    const isJew = CHARGED_JEWELLERY_BASES.some((b) => base === b);
    tips.push({
      id: `decant:${base}`,
      kind: "decant",
      subKind: isJew ? "jewellery" : "potions",
      severity: "save",
      title: isJew
        ? `${base} — ${charges.join(", ")} charges in bank`
        : `${base} — doses ${charges.join(", ")}`,
      detail: isJew
        ? `Recharge at a Fountain of Rune or your POH altar to collapse to 1 slot.`
        : `Decant at Bob in Edgeville or via the Potion Decanter plugin to free ${totalSlots - 1} slots.`,
      itemIds: ids,
      itemRefs: refs,
      slotsFreed: Math.max(0, totalSlots - 1)
    });
  }
  return tips;
}

// ─── Stack-merge detector ───────────────────────────────────────────────────
// Surface items where the player has multiple distinct IDs of essentially
// the same item (noted vs unnoted, placeholder duplicates from withdraw-X).
// Most banks won't have this, but it's a real footgun for ironmen / people
// using the bank-fillers plugin.

function detectStackMerge(items: OrganizedItem[]): BankTip[] {
  // Group by stripped name (ignore (i), (or), (t), (g), (e), (charged)
  // suffixes — common variant markers).
  const stripSuffix = (s: string) =>
    s.replace(/\s?\((i|or|t|g|e|p|c|charged|inactive|empty|uncharged)\)$/i, "").trim();
  const byBase = new Map<string, OrganizedItem[]>();
  for (const it of items) {
    const base = stripSuffix(it.name);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base)!.push(it);
  }
  const tips: BankTip[] = [];
  for (const [base, group] of byBase) {
    if (group.length < 2) continue;
    // Different IDs → variants. Same id appearing twice = bug; skip.
    const uniqIds = new Set(group.map((g) => g.id));
    if (uniqIds.size < 2) continue;
    // Filter: don't tip on intentional dose-variants — decant handles those.
    if (group.every((g) => /\(\d+\)$/.test(g.name))) continue;
    // Filter: 2 variants where one is a charged form (e.g. Glory + Glory(6))
    // also belongs to the decant tip, not stack-merge.
    if (group.some((g) => /\(\d+\)$/.test(g.name))) continue;
    tips.push({
      id: `merge:${base}`,
      kind: "stack-merge",
      severity: "save",
      title: `${group.length} variants of ${base} in your bank`,
      detail: `Variants: ${group.map((g) => g.name).join(", ")}. Keep the imbued / charged form and free the others.`,
      itemIds: group.map((g) => g.id),
      itemRefs: itemRefs(group),
      slotsFreed: Math.max(0, group.length - 1)
    });
  }
  return tips;
}

// ─── Outfit-incomplete detector ────────────────────────────────────────────
// For each known skilling outfit family, count how many distinct pieces the
// player owns. If the family is *partially* owned (1-3 of 4 pieces, etc.)
// surface the XP-bonus loss and what's missing.

interface OutfitFamily {
  family: string;       // display name
  prefix: string;       // name prefix to match
  expectedSlots: Array<"head" | "body" | "legs" | "feet" | "hands">;
  xpBonus: string;      // e.g. "2.5% Fishing XP"
}

const OUTFIT_FAMILIES: OutfitFamily[] = [
  { family: "Angler",      prefix: "Angler ",      expectedSlots: ["head", "body", "legs", "feet"], xpBonus: "2.5% Fishing XP" },
  { family: "Lumberjack",  prefix: "Lumberjack ",  expectedSlots: ["head", "body", "legs", "feet"], xpBonus: "2.5% Woodcutting XP" },
  { family: "Pyromancer",  prefix: "Pyromancer ",  expectedSlots: ["head", "body", "legs", "feet"], xpBonus: "2.5% Firemaking XP" },
  { family: "Prospector",  prefix: "Prospector ",  expectedSlots: ["head", "body", "legs", "feet"], xpBonus: "2.5% Mining XP" },
  { family: "Farmer's",    prefix: "Farmer's ",    expectedSlots: ["head", "body", "legs", "feet"], xpBonus: "2.5% Farming XP" },
  { family: "Smiths",      prefix: "Smiths ",      expectedSlots: ["head", "body", "legs", "feet", "hands"], xpBonus: "Smithing bonuses (anvil dmg, ingot return)" },
  { family: "Carpenter's", prefix: "Carpenter's ", expectedSlots: ["head", "body", "legs", "feet"], xpBonus: "2.5% Construction XP at Mahogany Homes" },
  { family: "Zealot's",    prefix: "Zealot's ",    expectedSlots: ["head", "body", "legs", "feet"], xpBonus: "Bone Voyage prayer XP" },
  { family: "Rogue",       prefix: "Rogue ",       expectedSlots: ["head", "body", "legs", "feet", "hands"], xpBonus: "2x loot from pickpocketing" },
  { family: "Graceful",    prefix: "Graceful ",    expectedSlots: ["head", "body", "legs", "feet", "hands"], xpBonus: "Faster run energy regen" }
];

// Skip the entire family prefix when matching pieces — "Angler hat" /
// "Angler top" / "Angler waders" / "Angler boots".
function detectOutfits(items: OrganizedItem[]): BankTip[] {
  const tips: BankTip[] = [];
  for (const fam of OUTFIT_FAMILIES) {
    const owned = items.filter((it) =>
      it.name.startsWith(fam.prefix) ||
      it.name.toLowerCase().startsWith(fam.prefix.toLowerCase())
    );
    if (owned.length === 0) continue;
    if (owned.length >= fam.expectedSlots.length) continue;
    const missing = fam.expectedSlots.length - owned.length;
    tips.push({
      id: `outfit:${fam.family}`,
      kind: "outfit-incomplete",
      severity: missing === 1 ? "earn" : "info",
      title: `${fam.family} outfit ${owned.length}/${fam.expectedSlots.length} — ${missing} piece${missing === 1 ? "" : "s"} away from ${fam.xpBonus}`,
      detail: missing === 1
        ? `One piece left. The full bonus only kicks in with every slot worn.`
        : `Owned: ${owned.map((it) => it.name).join(", ")}.`,
      itemIds: owned.map((it) => it.id),
      itemRefs: itemRefs(owned)
    });
  }
  return tips;
}

// ─── Untradeable-pickup detector ────────────────────────────────────────────
// Look for "you have the prerequisite, where's the reward?" cases. Conservative
// because we don't have stats/Hiscores integration here — only inferred from
// items present in the bank.

interface PickupHint {
  id: string;
  precondition: (names: Set<string>) => boolean;
  rewardName: string;
  message: string;
  itemHint: number;     // canonical item id for the icon
}

const PICKUP_HINTS: PickupHint[] = [
  {
    id: "infernal-cape",
    // If the player has Fire cape, they presumably have the Inferno unlock
    // path even if they haven't done it yet. Surface infernal as an upgrade.
    precondition: (names) => names.has("Fire cape") && !names.has("Infernal cape"),
    rewardName: "Infernal cape",
    message: "Inferno completion = +4 cape slot DPS over Fire cape. Worth the grind.",
    itemHint: 21295
  },
  {
    id: "quest-point-cape",
    precondition: (names) => names.has("Music cape") || names.has("Achievement diary cape"),
    rewardName: "Quest point cape",
    message: "If you've earned a Music or Diary cape, you're close enough to QPC that finishing the last quests pays back fast.",
    itemHint: 9813
  },
  {
    id: "diary-cape",
    // If they have multiple diary rewards, they've completed multiple diaries
    // and might be close to the diary cape.
    precondition: (names) => {
      const diaryRewards = [
        "Karamja gloves 4", "Ardougne cloak 4", "Falador shield 4",
        "Varrock armour 4", "Wilderness sword 4", "Kandarin headgear 4",
        "Desert amulet 4", "Fremennik sea boots 4", "Rada's blessing 4",
        "Morytania legs 4", "Western banner 4"
      ];
      const owned = diaryRewards.filter((r) => names.has(r));
      return owned.length >= 5 && !names.has("Achievement diary cape") && !names.has("Achievement diary cape (t)");
    },
    rewardName: "Achievement diary cape",
    message: "You've completed 5+ Elite diaries. Twiggy O'Korn in Draynor gives you the cape — go grab it.",
    itemHint: 19476
  },
  {
    id: "salve-amulet-imbue",
    // If they have Salve amulet (e) but not the imbued version, suggest the
    // Nightmare Zone imbue.
    precondition: (names) => names.has("Salve amulet (e)") && !names.has("Salve amulet(ei)"),
    rewardName: "Salve amulet(ei)",
    message: "Imbue your Salve (e) at Nightmare Zone for the (ei) — +20% acc/dmg vs all undead, BIS for Vorkath / wyverns.",
    itemHint: 12018
  },
  {
    id: "slayer-helm-imbue",
    precondition: (names) => names.has("Slayer helmet") && !names.has("Slayer helmet (i)"),
    rewardName: "Slayer helmet (i)",
    message: "Imbue at NMZ / Soul Wars / Mage Arena for +15% ranged & mage on slayer tasks. Big upgrade for bossing.",
    itemHint: 11865
  },
  {
    id: "voidwaker-pieces",
    // If they have all 3 voidwaker pieces, suggest assembling.
    precondition: (names) => names.has("Voidwaker hilt") && names.has("Voidwaker blade") && names.has("Voidwaker gem") && !names.has("Voidwaker"),
    rewardName: "Voidwaker",
    message: "All 3 pieces in your bank — assemble the Voidwaker at the DT2 boss-room recipe NPC.",
    itemHint: 27690
  }
];

function detectPickups(items: OrganizedItem[]): BankTip[] {
  const names = new Set(items.map((it) => it.name));
  const tips: BankTip[] = [];
  for (const hint of PICKUP_HINTS) {
    if (!hint.precondition(names)) continue;
    tips.push({
      id: `pickup:${hint.id}`,
      kind: "untradeable-pickup",
      severity: "earn",
      title: `Pick up your ${hint.rewardName}`,
      detail: hint.message,
      itemIds: [hint.itemHint],
      itemRefs: [{ id: hint.itemHint, name: hint.rewardName }]
    });
  }
  return tips;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute all bank tips from the current organised bank. Pure / deterministic
 * so it's safe to call inside a React useMemo on every render.
 */
export function computeTips(tabs: OrganizedTab[]): BankTip[] {
  const allItems = tabs.flatMap((t) => t.items);
  return [
    ...detectDecant(allItems),
    ...detectStackMerge(allItems),
    ...detectOutfits(allItems),
    ...detectPickups(allItems)
  ];
}
