// Per-tab layout strategies. Each strategy takes a list of items and returns a
// {slot: itemId} map. The conventions come from community research:
//
// - Jewellery: row 1 currency, row 2 charged jewellery, row 3 teleport tabs,
//   row 4 teleport items, row 5+ worn neck/rings (osrsadvice inspiration thread,
//   RuneTags "tps" by bilumas — modality rows)
// - Potions: vertical columns by family, doses 4 → 1 descending (Tuck's guide)
// - Runes: rows by use-case (elements / high-tier / combos / utility), not
//   alphabetical, so rune-pouch loadouts map to a row
// - Food: row per tier descending in heal value, karambwan its own row
// - Combat / Range / Magic: row 1 = primary weapons in switch-cycle order
//   (Spiritika layout — left to right is the order you click during a kill),
//   then gear sets each on their own row in equipment-slot order
//   (RuneTags CoX by Dextor16, Maria Kati layout)
// - Empty-slot dividers between conceptual panels (RuneTags herbrun by
//   balrogz4skillz uses 2-slot gaps as visual rhythm)
//
// Sources: osrsadvice t4918 (Spiritika/Muffin/Maria), runetags.com explore page,
// github.com/runelite/runelite/wiki/Bank-Tags.

import type { Slot } from "./classifier";
import type { OrganizedItem } from "./organizer";

const GRID_COLS = 8;

export type LayoutStrategy = (items: OrganizedItem[]) => Record<number, number>;

// ── Generic helpers ──────────────────────────────────────────────────────────

/**
 * Place items left-to-right starting at startSlot. Dense — no padding to row
 * boundary, no empty cells. Logical grouping is preserved purely by sort
 * order; whitespace between groups is not allowed because it produced rows of
 * blank cells in the rendered grid.
 */
function packRow(layout: Record<number, number>, startSlot: number, items: OrganizedItem[]): number {
  let slot = startSlot;
  for (const it of items) layout[slot++] = it.id;
  return slot;
}

/**
 * Historical "visual divider" between groups. Now a no-op: dense packing only.
 * Kept as a function so existing call sites still compile; future call sites
 * should just stop calling it.
 */
function divider(slot: number, _gap = 1): number {
  return slot;
}

function groupBySubtab(items: OrganizedItem[]): Map<string, OrganizedItem[]> {
  const m = new Map<string, OrganizedItem[]>();
  for (const it of items) {
    if (!m.has(it.subtab)) m.set(it.subtab, []);
    m.get(it.subtab)!.push(it);
  }
  return m;
}

// ── Jewellery: structured tab 1 ──────────────────────────────────────────────
// Three modality groups separated by a half-row gap (visual rhythm):
//   - Currencies + utility pouches (row 1)
//   - Teleport modalities (charged jewellery, teleport tablets, teleport items)
//   - Worn equipment (amulets, rings)
//   - Diary rewards
const JEWELLERY_ROWS = [
  "Currency",              // R1: coins, plat tokens, looting bag, rune pouch, gem bag
  "Charged jewellery",     // R2: glory, dueling, games, skills, slayer ring, dig pendant
  "Teleport tablets",      // R3: scrolls + tablets
  "Teleport items",        // R4: ectophial, chronicle, royal seed pod, max cape, etc
  "Worn amulets",          // R5: fury, torture, anguish, occult, blood fury
  "Worn rings",            // R6: berserker, archers, seers, brimstone, ultor, magus
  "Diary rewards"          // R7: ardy cloak, karamja gloves, morytania legs, etc
];

const layoutJewellery: LayoutStrategy = (items) => {
  const layout: Record<number, number> = {};
  const bySubtab = groupBySubtab(items);
  let slot = 0;

  // Currency row
  const currency = bySubtab.get("Currency");
  if (currency?.length) { slot = packRow(layout, slot, currency); bySubtab.delete("Currency"); }

  // Teleport block — three rows close together (no gap between them)
  for (const row of ["Charged jewellery", "Teleport tablets", "Teleport items"]) {
    const group = bySubtab.get(row);
    if (group?.length) { slot = packRow(layout, slot, group); bySubtab.delete(row); }
  }

  // Gap between teleports and worn gear
  if (bySubtab.get("Worn amulets")?.length || bySubtab.get("Worn rings")?.length) {
    slot = divider(slot, 1);
  }

  for (const row of ["Worn amulets", "Worn rings"]) {
    const group = bySubtab.get(row);
    if (group?.length) { slot = packRow(layout, slot, group); bySubtab.delete(row); }
  }

  // Gap before diary rewards
  if (bySubtab.get("Diary rewards")?.length) slot = divider(slot, 1);
  const diary = bySubtab.get("Diary rewards");
  if (diary?.length) { slot = packRow(layout, slot, diary); bySubtab.delete("Diary rewards"); }

  // Overflow: anything else
  if (bySubtab.size > 0) slot = divider(slot, 1);
  for (const remaining of bySubtab.values()) slot = packRow(layout, slot, remaining);
  return layout;
};

// ── Potions: vertical columns per family ─────────────────────────────────────
const POTION_COLS: string[] = [
  "Combat", "Range", "Magic", "Restore",
  "Stamina", "Defensive", "Melee", "Divine"
];

function potionDose(name: string): number {
  const m = name.match(/\((\d+)\)/);
  return m ? parseInt(m[1], 10) : 0;
}

const layoutPotions: LayoutStrategy = (items) => {
  const layout: Record<number, number> = {};
  const bySubtab = groupBySubtab(items);

  // Sort each column by dose descending (4 → 3 → 2 → 1), then tier
  for (const list of bySubtab.values()) {
    list.sort((a, b) => {
      const ad = potionDose(a.name);
      const bd = potionDose(b.name);
      if (ad !== bd) return bd - ad;
      if (a.weight !== b.weight) return a.weight - b.weight;
      return a.name.localeCompare(b.name);
    });
  }

  const colOrder = POTION_COLS.filter((c) => bySubtab.has(c))
    .concat(Array.from(bySubtab.keys()).filter((k) => !POTION_COLS.includes(k)));

  for (let c = 0; c < Math.min(colOrder.length, GRID_COLS); c++) {
    const items = bySubtab.get(colOrder[c]) || [];
    for (let r = 0; r < items.length; r++) {
      layout[r * GRID_COLS + c] = items[r].id;
    }
  }

  if (colOrder.length > GRID_COLS) {
    const deepest = Math.max(...colOrder.slice(0, GRID_COLS).map((c) => (bySubtab.get(c) || []).length));
    let slot = (deepest + 1) * GRID_COLS; // 1 row gap as divider
    for (let c = GRID_COLS; c < colOrder.length; c++) {
      const extras = bySubtab.get(colOrder[c]) || [];
      slot = packRow(layout, slot, extras);
    }
  }
  return layout;
};

// ── Runes: rows by use-case ──────────────────────────────────────────────────
const ELEMENTAL_ORDER = ["air", "water", "earth", "fire", "mind", "body", "chaos", "death"];
const HIGHTIER_ORDER = ["blood", "soul", "wrath", "astral", "nature", "law", "cosmic"];
const COMBINATION_ORDER = ["dust", "lava", "mud", "smoke", "steam", "mist"];

function runeSortKey(name: string, order: string[]): number {
  const n = name.toLowerCase();
  for (let i = 0; i < order.length; i++) if (n.startsWith(order[i] + " ")) return i;
  return 999;
}

const layoutRunes: LayoutStrategy = (items) => {
  const layout: Record<number, number> = {};

  const elementals = items.filter((it) => runeSortKey(it.name, ELEMENTAL_ORDER) < 999)
    .sort((a, b) => runeSortKey(a.name, ELEMENTAL_ORDER) - runeSortKey(b.name, ELEMENTAL_ORDER));
  const highTier = items.filter((it) => runeSortKey(it.name, HIGHTIER_ORDER) < 999)
    .sort((a, b) => runeSortKey(a.name, HIGHTIER_ORDER) - runeSortKey(b.name, HIGHTIER_ORDER));
  const combos = items.filter((it) => runeSortKey(it.name, COMBINATION_ORDER) < 999)
    .sort((a, b) => runeSortKey(a.name, COMBINATION_ORDER) - runeSortKey(b.name, COMBINATION_ORDER));
  const placed = new Set([...elementals, ...highTier, ...combos].map((it) => it.id));
  const rest = items.filter((it) => !placed.has(it.id));

  let slot = 0;
  if (elementals.length) slot = packRow(layout, slot, elementals);
  if (highTier.length) slot = packRow(layout, slot, highTier);
  if (combos.length) slot = packRow(layout, slot, combos);
  if (rest.length) {
    slot = divider(slot, 1); // separate misc/pouches from main rune block
    slot = packRow(layout, slot, rest);
  }
  return layout;
};

// ── Food: row per tier ───────────────────────────────────────────────────────
const FOOD_TIER1 = /\b(saradomin brew|anglerfish|tuna potato|dark crab)\b/i;
const FOOD_TIER2 = /\b(manta ray|monkfish|shark)\b/i;
const FOOD_TIER3 = /\bkarambwan\b/i;
const FOOD_TIER4 = /\b(cake|pie|stew|pizza)\b/i;

const layoutFood: LayoutStrategy = (items) => {
  const layout: Record<number, number> = {};
  const r1 = items.filter((it) => FOOD_TIER1.test(it.name));
  const r2 = items.filter((it) => FOOD_TIER2.test(it.name));
  const r3 = items.filter((it) => FOOD_TIER3.test(it.name));
  const r4 = items.filter((it) => FOOD_TIER4.test(it.name));
  const placed = new Set([...r1, ...r2, ...r3, ...r4].map((it) => it.id));
  const rest = items.filter((it) => !placed.has(it.id));

  let slot = 0;
  for (const row of [r1, r2, r3]) {
    if (row.length) slot = packRow(layout, slot, row);
  }
  if (r4.length || rest.length) slot = divider(slot, 1);
  if (r4.length) slot = packRow(layout, slot, r4);
  if (rest.length) slot = packRow(layout, slot, rest);
  return layout;
};

// ── Combat / Range / Magic: switch-cycle weapons row 1 + gear-set rows ───────

// Items that should appear in "row 1" of their respective combat tabs.
// Order matters: it's the canonical switch-cycle for that style.
// From RuneTags raid tags + Spiritika forum layout.
const COMBAT_PRIMARY_ORDER = [
  /scimitar/, /^whip$|abyssal whip/, /blade of saeldor/, /scythe of vitur/,
  /^scythe/, /^osmumten's fang/, /^ghrazi rapier/, /dragon claws/,
  /voidwaker/, /^granite maul/, /^dragon dagger/, /^dragon longsword/,
  /^dragon battleaxe/, /godsword/, /^elder maul/, /^inquisitor's mace/
];

const RANGE_PRIMARY_ORDER = [
  /rune crossbow|dragon hunter crossbow|armadyl crossbow/,
  /toxic blowpipe|^blowpipe/,
  /bow of faerdhinen|^bowfa/,
  /twisted bow|^tbow/,
  /zaryte crossbow|^zcb/,
  /craws bow|webweaver/,
  /^dragon thrownaxe/, /^dark bow/,
  /^magic shortbow/, /^crystal bow/
];

const MAGIC_PRIMARY_ORDER = [
  /trident of the swamp|^toxic trident/,
  /trident of the seas/,
  /sanguinesti staff|^sang/,
  /harmonised nightmare staff|^harm/,
  /tumeken's shadow|^shadow/,
  /ancient sceptre/,
  /kodai|master wand/,
  /^volatile/,
  /^eldritch/,
  /^ancient staff/,
  /^iban's staff/
];

function pickPrimaryWeapons(items: OrganizedItem[], patterns: RegExp[]): OrganizedItem[] {
  const out: OrganizedItem[] = [];
  const used = new Set<number>();
  for (const pat of patterns) {
    for (const it of items) {
      if (used.has(it.id)) continue;
      if (pat.test(it.name.toLowerCase())) {
        out.push(it);
        used.add(it.id);
        break; // one match per pattern in the canonical order
      }
    }
  }
  return out;
}

const SLOT_ORDER_INDEX: Record<string, number> = {
  head: 0, cape: 1, neck: 2, ammo: 3, weapon: 4,
  body: 5, shield: 6, legs: 7, hands: 8, feet: 9, ring: 10
};

function slotIdx(slot: Slot): number {
  return slot ? SLOT_ORDER_INDEX[slot] ?? 99 : 99;
}

function makeCombatLayout(primaryOrder: RegExp[]): LayoutStrategy {
  return (items) => {
    const layout: Record<number, number> = {};

    // Row 1: primary weapons in switch-cycle order
    const primaries = pickPrimaryWeapons(items, primaryOrder);
    let slot = 0;
    if (primaries.length) slot = packRow(layout, slot, primaries);

    // Remaining items grouped by subtab, ordered by avg weight (high tier first)
    const primaryIds = new Set(primaries.map((it) => it.id));
    const remaining = items.filter((it) => !primaryIds.has(it.id));
    const bySubtab = groupBySubtab(remaining);

    const subtabsOrdered = Array.from(bySubtab.entries())
      .map(([name, list]) => ({
        name,
        list,
        avgWeight: list.reduce((s, it) => s + it.weight, 0) / list.length
      }))
      .sort((a, b) => a.avgWeight - b.avgWeight);

    if (subtabsOrdered.length && primaries.length) slot = divider(slot, 1);

    for (const { list } of subtabsOrdered) {
      list.sort((a, b) => {
        const sa = slotIdx(a.slot);
        const sb = slotIdx(b.slot);
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name);
      });
      slot = packRow(layout, slot, list);
    }
    return layout;
  };
}

const layoutCombat = makeCombatLayout(COMBAT_PRIMARY_ORDER);
const layoutRange = makeCombatLayout(RANGE_PRIMARY_ORDER);
const layoutMagic = makeCombatLayout(MAGIC_PRIMARY_ORDER);

// ── Skilling: row per skill subtab ───────────────────────────────────────────
const SKILLING_ROW_ORDER = [
  "Runecraft", "Herbs", "Herblore", "Logs", "Ore", "Bars", "Gems",
  "Farming", "Construction", "Hunter", "Raw fish", "Agility"
];

const layoutSkilling: LayoutStrategy = (items) => {
  const layout: Record<number, number> = {};
  const bySubtab = groupBySubtab(items);
  let slot = 0;
  let placed = false;
  for (const row of SKILLING_ROW_ORDER) {
    const list = bySubtab.get(row);
    if (list?.length) {
      slot = packRow(layout, slot, list);
      bySubtab.delete(row);
      placed = true;
    }
  }
  if (bySubtab.size > 0 && placed) slot = divider(slot, 1);
  for (const rest of bySubtab.values()) slot = packRow(layout, slot, rest);
  return layout;
};

// ── Clues: tier per row, dividers between scroll/bottle/casket ──────────────
const CLUE_TIERS = ["beginner", "easy", "medium", "hard", "elite", "master"];

const layoutClues: LayoutStrategy = (items) => {
  const layout: Record<number, number> = {};
  const scrolls = items.filter((it) => /clue scroll/i.test(it.name))
    .sort((a, b) => clueTierRank(a.name) - clueTierRank(b.name));
  const bottles = items.filter((it) => /clue bottle/i.test(it.name))
    .sort((a, b) => clueTierRank(a.name) - clueTierRank(b.name));
  const rest = items.filter((it) => !scrolls.includes(it) && !bottles.includes(it));

  let slot = 0;
  if (scrolls.length) slot = packRow(layout, slot, scrolls);
  if (bottles.length) slot = packRow(layout, slot, bottles);
  if (rest.length) {
    if (slot > 0) slot = divider(slot, 1);
    slot = packRow(layout, slot, rest);
  }
  return layout;
};

function clueTierRank(name: string): number {
  const n = name.toLowerCase();
  for (let i = 0; i < CLUE_TIERS.length; i++) if (n.includes(CLUE_TIERS[i])) return i;
  return 99;
}

// ── Generic: subtab grouped, one subtab per row block, dividers between ──────
const layoutGeneric: LayoutStrategy = (items) => {
  const layout: Record<number, number> = {};
  const bySubtab = groupBySubtab(items);
  let slot = 0;
  let first = true;
  for (const list of bySubtab.values()) {
    if (!first && bySubtab.size > 2) slot = divider(slot, 1);
    slot = packRow(layout, slot, list);
    first = false;
  }
  return layout;
};

// ── Strategy dispatch ────────────────────────────────────────────────────────
export function layoutForTab(tabName: string, items: OrganizedItem[]): Record<number, number> {
  switch (tabName) {
    case "Jewellery": return layoutJewellery(items);
    case "Potions":   return layoutPotions(items);
    case "Runes":     return layoutRunes(items);
    case "Food":      return layoutFood(items);
    case "Combat":    return layoutCombat(items);
    case "Range":     return layoutRange(items);
    case "Magic":     return layoutMagic(items);
    case "Skilling":  return layoutSkilling(items);
    case "Clues":     return layoutClues(items);
    default:          return layoutGeneric(items);
  }
}
