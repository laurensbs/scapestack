import { getItems } from "./item-db";
import { getItemMeta } from "./item-meta";
import {
  parseTag,
  parseBankMemoryTsv,
  looksLikeBankMemoryTsv,
  exportTags as exportTagsRaw
} from "./bank-tags";
import { classify, TAB_ORDER, type Tab, type Slot } from "./classifier";
import { priceFor, getPrices } from "./prices";
import { getAlchData, alchFor } from "./alch";
import { isKeeper } from "./keeper-items";
// Vanilla OSRS Bank Tags don't allow empty slots inside a tab — items must
// flow left-to-right continuously. Web UI grouping is preserved by sort order.
function denseLayout(items: Array<{ id: number }>): Record<number, number> {
  const layout: Record<number, number> = {};
  for (let i = 0; i < items.length; i++) layout[i] = items[i].id;
  return layout;
}
import { spriteIdForItem } from "./utils";
import { junkThresholds, subtabRank, shuffleKey, newShuffleSeed } from "./playstyle";

const GRID_COLS = 8;

export interface OrganizedItem {
  id: number;
  name: string;
  subtab: string;
  slot: Slot;
  weight: number;
  quantity: number;
  unitPrice: number;
  stackValue: number;
  /** Per-item high alchemy value (0 if unknown). */
  highalch?: number;
  /** GE 4-hr buy limit (0 if unknown). */
  geLimit?: number;
}

export interface OrganizedTab {
  name: Tab;
  iconItemId: number;
  items: OrganizedItem[];
  layout: Record<number, number>;
  quantity: number;
  value: number;
  /**
   * Optional slot → label map for bank-filler tiles. When a set / pipeline
   * row has a missing piece, the layout builder records what *should* sit in
   * that slot (e.g. "Dharok's platelegs") so the filler can name itself.
   * Keyed by the same slot index as `layout`.
   */
  fillerLabels?: Record<number, string>;
}

export interface OrganizeStats {
  tabs: number;
  items: number;
  unclassified: number;
  totalQuantity: number;
  totalValue: number;
  hasQuantities: boolean;
  hasPrices: boolean;
  junkFilterActive: boolean;
}

export interface OrganizeImportWarnings {
  parsedItemCount: number;
  recognizedItemCount: number;
  duplicateItemCount: number;
  fallbackItemCount: number;
  fallbackItemIds: number[];
  /** @deprecated Unknown IDs are retained as fallback tiles; use fallbackItemCount. */
  ignoredItemCount: number;
  /** @deprecated Unknown IDs are retained as fallback tiles; use fallbackItemIds. */
  ignoredItemIds: number[];
}

export interface OrganizeResult {
  source: { name: string; iconItemId: number; itemCount: number; kind: "banktags" | "bankMemory" | "ids" };
  tabs: OrganizedTab[];
  unclassified: number[];
  stats: OrganizeStats;
  importWarnings: OrganizeImportWarnings;
}

export interface OrganizeInput {
  input?: string;
  itemIds?: number[];
  junkFilter?: boolean;
  includePrices?: boolean;
  archetype?: import("./archetype").Archetype;
  // Tie-break seed for the subtle within-group shuffle. Omit for a fresh
  // arrangement each call; pass a fixed value to reproduce an exact layout.
  shuffleSeed?: number;
}

export async function organize(opts: OrganizeInput): Promise<OrganizeResult> {
  const items = await getItems();
  const [prices, alch, itemMeta] = await Promise.all([
    opts.includePrices ? getPrices() : Promise.resolve(null),
    opts.includePrices ? getAlchData() : Promise.resolve(null),
    // Wiki-derived fact layer (slot/style/skill per id). Best-effort: if the
    // file is missing the classifier just falls back to its regex rules.
    getItemMeta().catch(() => null)
  ]);

  let ids: number[] = [];
  const quantities = new Map<number, number>();
  const inputNames = new Map<number, string>();
  let sourceName = "Bank";
  let sourceKind: OrganizeResult["source"]["kind"] = "banktags";

  if (Array.isArray(opts.itemIds)) {
    ids = opts.itemIds.map(Number).filter((n) => Number.isFinite(n));
    sourceKind = "ids";
  } else if (typeof opts.input === "string" && opts.input.trim()) {
    const trimmed = opts.input.trim();
    if (looksLikeBankMemoryTsv(trimmed)) {
      const rows = parseBankMemoryTsv(trimmed);
      ids = rows.map((r) => r.id);
      for (const r of rows) {
        quantities.set(r.id, r.quantity);
        if (r.name.trim()) inputNames.set(r.id, r.name.trim());
      }
      sourceName = "Bank (Bank Memory)";
      sourceKind = "bankMemory";
    } else if (trimmed.startsWith("banktags,")) {
      const tag = parseTag(trimmed);
      ids = tag.items;
      sourceName = tag.name;
    } else {
      ids = trimmed.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n));
      sourceKind = "ids";
    }
  }

  if (!ids.length) throw new Error("No items to organize");

  const parsedItemCount = ids.length;
  const seen = new Set<number>();
  ids = ids.filter((id) => (seen.has(id) ? false : seen.add(id)));
  const duplicateItemCount = parsedItemCount - ids.length;

  // Keep IDs we don't recognize. These are usually brand-new OSRS items not
  // present in the local wiki dump yet. Dropping them makes a real player think
  // Scapestack lost their bank; keeping them with a fallback label preserves the
  // item ID, sprite proxy, wiki link, export token and handoff payload.
  const fallbackItemIds = Array.from(new Set(
    ids
      .filter((id) => !items.has(Math.abs(id)))
      .map((id) => Math.abs(id))
  ));

  // Note: an earlier attempt to dedupe noted-variant pairs (id N + id N+1
  // sharing a name) was removed. Real RuneLite Bank Memory exports already
  // contain only unnoted IDs, and OSRS has plenty of legitimate consecutive
  // same-name pairs (cut gems 1601/1602, etc.) that a naive dedupe would
  // wrongly collapse — including the padded IDs many tests rely on. If
  // duplicate tiles ever resurface in real exports, fix the export source
  // instead.

  // Playstyle-aware junk threshold: an ironman keeps every item, a maxed main
  // buries more clutter. See playstyle.ts for the per-archetype values.
  const archetype = opts.archetype ?? "unspecified";
  const junk = junkThresholds(archetype);

  const classified = ids.map((id) => {
    const absId = Math.abs(id);
    const name = items.get(absId) ?? inputNames.get(id) ?? inputNames.get(absId) ?? `Unknown item #${absId}`;
    const cls = classify(name, itemMeta?.get(Math.abs(id)) ?? null);
    const quantity = quantities.get(id) ?? 0;
    const alchEntry = alchFor(alch, id);
    const highalch = alchEntry?.highalch ?? 0;
    const geLimit = alchEntry?.limit ?? 0;
    // Use the GE price when available; fall back to high alch so untradeable
    // or just-released items still contribute to bank value. RuneLite does
    // something similar so totals line up better with what players see in-game.
    const gePrice = priceFor(prices, id);
    const unitPrice = gePrice > 0 ? gePrice : highalch;
    const stackValue = unitPrice * (quantity || 1);
    let tab: Tab = cls.tab;
    // Junk filter: relegate cheap, low-quantity items to Misc — BUT respect
    // the community-curated keeper list (Arclight, pets, herbs, cannon parts,
    // skilling outfit pieces, etc.) so iconic but cheap items aren't buried.
    // junk.value is 0 for ironmen → the condition can never fire, so an
    // ironman bank is never auto-thinned.
    if (opts.junkFilter && quantity > 0 && unitPrice > 0 &&
        unitPrice <= junk.value && quantity <= junk.quantity &&
        cls.tab !== "Misc" && !isKeeper({ name })) {
      tab = "Misc";
    }
    return { id, name, quantity, unitPrice, stackValue, highalch, geLimit, subtab: cls.subtab, slot: cls.slot, weight: cls.weight, tab };
  });

  const tabsMap = new Map<Tab, typeof classified>();
  for (const item of classified) {
    if (!tabsMap.has(item.tab)) tabsMap.set(item.tab, []);
    tabsMap.get(item.tab)!.push(item);
  }

  // Sort within each tab. Order of precedence:
  //   1. Playstyle subtab rank — a skiller's Herbs row floats above Logs;
  //      a PvMer's Weapons above Armour. Subtabs not prioritised tie at 1000.
  //   2. Subtab name — alphabetical among same-rank subtabs (stable grouping).
  //   3. Classifier weight — slot/tier order the classifier assigned.
  //   4. Quantity — bigger stacks first within an otherwise-equal group.
  //   5. Shuffle key — a deterministic per-seed tie-break so two organise
  //      clicks lay equal-rank items out slightly differently. The shuffle
  //      ONLY ever reorders items the steps above already called equal, so
  //      the bank's structure is identical every time — just gently varied.
  const seed = opts.shuffleSeed ?? newShuffleSeed();
  for (const list of tabsMap.values()) {
    list.sort((a, b) => {
      const ra = subtabRank(archetype, a.subtab);
      const rb = subtabRank(archetype, b.subtab);
      if (ra !== rb) return ra - rb;
      if (a.subtab !== b.subtab) return a.subtab.localeCompare(b.subtab);
      if (a.weight !== b.weight) return a.weight - b.weight;
      if (a.quantity !== b.quantity) return b.quantity - a.quantity;
      const ka = shuffleKey(seed, a.id);
      const kb = shuffleKey(seed, b.id);
      if (ka !== kb) return ka - kb;
      return a.name.localeCompare(b.name);
    });
  }

  const tabs: OrganizedTab[] = [];
  let totalQuantity = 0;
  let totalValue = 0;
  for (const tabName of TAB_ORDER) {
    const list = tabsMap.get(tabName);
    if (!list || !list.length) continue;
    let iconId = pickIcon(tabName, list);
    // Tab icon should reflect the coin stack size if coins were picked.
    if (iconId === 995) {
      const coins = list.find((it) => it.id === 995);
      iconId = spriteIdForItem(995, coins?.quantity ?? 0);
    }
    const tabQty = list.reduce((s, it) => s + (it.quantity || 0), 0);
    const tabValue = list.reduce((s, it) => s + (it.stackValue || 0), 0);
    totalQuantity += tabQty;
    totalValue += tabValue;
    const exportedItems = list.map(({ id, name, subtab, slot, weight, quantity, unitPrice, stackValue, highalch, geLimit }) => ({
      id, name, subtab, slot, weight, quantity, unitPrice, stackValue, highalch, geLimit
    }));
    tabs.push({
      name: tabName,
      iconItemId: iconId,
      items: exportedItems,
      layout: denseLayout(exportedItems),
      quantity: tabQty,
      value: tabValue
    });
  }

  // Reorder tabs based on archetype preference (PvMers want Combat first,
  // skillers want Skilling first, etc.). Unspecified = default TAB_ORDER.
  if (opts.archetype && opts.archetype !== "unspecified") {
    const { tabPriority } = await import("./archetype");
    tabs.sort((a, b) => tabPriority(opts.archetype!, a.name) - tabPriority(opts.archetype!, b.name));
  }

  // We deliberately DO NOT cap to 9 tabs here. The cap (RuneLite Bank Tags
  // import limit) is a UI-level concern: when the player views in type-tab
  // mode, the client folds the smallest tabs into Misc. When they view in
  // use-case mode (or export), all tabs are needed so items don't lose their
  // original classification.

  const hasPrices = !!(prices && prices.size);
  const totalCoins = classified.find((c) => c.id === 995)?.quantity ?? 0;
  const sourceIcon = spriteIdForItem(995, totalCoins);
  return {
    source: { name: sourceName, iconItemId: sourceIcon, itemCount: ids.length, kind: sourceKind },
    tabs,
    unclassified: classified.filter((c) => c.tab === "Misc").map((c) => c.id),
    importWarnings: {
      parsedItemCount,
      recognizedItemCount: ids.length - fallbackItemIds.length,
      duplicateItemCount,
      fallbackItemCount: fallbackItemIds.length,
      fallbackItemIds,
      ignoredItemCount: fallbackItemIds.length,
      ignoredItemIds: fallbackItemIds
    },
    stats: {
      tabs: tabs.length,
      items: ids.length,
      unclassified: classified.filter((c) => c.tab === "Misc").length,
      totalQuantity,
      totalValue,
      hasQuantities: sourceKind === "bankMemory",
      hasPrices,
      junkFilterActive: !!opts.junkFilter
    }
  };
}

// Iconic per-tab default — community convention says the tab icon should be
// the "most clicked" item, not the rarest. We hand-pick a recognizable item
// by regex per tab, with the best weapon as fallback.
const ICONIC_PATTERNS: Record<string, RegExp[]> = {
  Jewellery: [/^coins$/i, /amulet of glory/i, /ring of dueling/i],
  Combat:    [/abyssal whip/i, /scythe of vitur/i, /bandos godsword/i, /scimitar/i],
  Range:     [/twisted bow/i, /toxic blowpipe/i, /bow of faerdhinen/i, /zaryte crossbow/i],
  Magic:     [/tumeken's shadow/i, /sanguinesti staff/i, /^trident of/i, /^kodai/i],
  Prayer:    [/dragon bones/i, /superior dragon bones/i, /^bones$/i],
  Food:      [/anglerfish/i, /^shark$/i, /^manta ray$/i, /karambwan/i],
  Potions:   [/super combat/i, /saradomin brew/i, /super restore/i, /prayer potion/i],
  Runes:     [/^blood rune$/i, /^death rune$/i, /^nature rune$/i, /^law rune$/i],
  Skilling:  [/^dragon pickaxe/i, /dragon axe/i, /infernal axe/i, /^bird nest/i],
  Resources: [/dragonhide/i, /^dragon bones/i, /^zulrah's scales/i],
  Tools:     [/dragon axe/i, /dragon pickaxe/i, /^master scroll/i],
  Quest:     [/quest point cape/i, /^key$/i, /antique lamp/i],
  Clues:     [/master casket|reward casket \(master\)/i, /reward casket/i, /clue scroll \(master\)/i],
  Trophy:    [/twisted (trophy|relic)/i, /partyhat/i, /halloween mask/i, /third-age/i],
  Untradeables: [/infernal cape/i, /fire cape/i, /max cape/i, /quest point cape/i],
  Misc:      [/^coins$/i]
};

function pickIcon(tabName: string, items: Array<{ id: number; name: string; slot: Slot }>): number {
  // 1. Try iconic patterns for this tab
  const patterns = ICONIC_PATTERNS[tabName] || [];
  for (const pat of patterns) {
    const match = items.find((it) => pat.test(it.name));
    if (match) return match.id;
  }
  // 2. Fall back to weapon, then any equip, then first item
  const weapon = items.find((i) => i.slot === "weapon");
  if (weapon) return weapon.id;
  const equip = items.find((i) => i.slot);
  return (equip || items[0]).id;
}

function buildLayout(items: Array<{ id: number; subtab: string }>): Record<number, number> {
  const layout: Record<number, number> = {};
  const bySubtab = new Map<string, Array<{ id: number }>>();
  for (const item of items) {
    if (!bySubtab.has(item.subtab)) bySubtab.set(item.subtab, []);
    bySubtab.get(item.subtab)!.push(item);
  }
  let slot = 0;
  for (const group of bySubtab.values()) {
    for (const item of group) {
      layout[slot] = item.id;
      slot++;
    }
    const rem = slot % GRID_COLS;
    if (rem !== 0) slot += GRID_COLS - rem;
  }
  return layout;
}

export function exportTabs(tabs: OrganizedTab[]): string[] {
  return exportTagsRaw(tabs);
}
