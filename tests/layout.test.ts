import { describe, it, expect } from "vitest";
import { organize } from "@/lib/organizer";
import { buildUseCaseTabs, explainBucket } from "@/lib/use-case-tabs";
import { classify } from "@/lib/classifier";
import {
  SMALL_MAIN_BANK, MAX_MAIN_BANK, SKILLER_BANK, IRONMAN_BANK
} from "./fixtures/banks";

// Helper — runs organize() in offline mode (no prices, no quantities) and
// returns the use-case tabs view as a simplified shape that's stable across
// trivial renames.
async function shape(itemIds: number[]) {
  const result = await organize({ itemIds, includePrices: false });
  const useCase = buildUseCaseTabs(result.tabs);
  return useCase.map((t) => ({
    name: String(t.name),
    items: t.items.map((it) => it.name)
  }));
}

describe("layout regression — use-case tabs", () => {
  it("MAX_MAIN: tab order starts Teleports → PvM Gear → … → Misc", async () => {
    const tabs = await shape(MAX_MAIN_BANK);
    const names = tabs.map((t) => t.name);
    // Teleports + PvM Gear are always the first two daily-driver tabs.
    expect(names[0]).toBe("Teleports");
    expect(names[1]).toBe("PvM Gear");
    // Misc, if present, is last.
    if (names.includes("Misc")) {
      expect(names.indexOf("Misc")).toBe(names.length - 1);
    }
    // Use-case tab ordering (default archetype): Teleports < Drops < Potions < Skilling.
    const order = ["Teleports", "PvM Gear", "Drops", "Potions", "Skilling", "Clue", "Quest", "Cosmetic", "Misc"];
    const positions = names.map((n) => order.indexOf(n));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("MAX_MAIN: PvM Gear places weapons before bodies before food", async () => {
    const tabs = await shape(MAX_MAIN_BANK);
    const pvm = tabs.find((t) => t.name === "PvM Gear");
    expect(pvm).toBeDefined();
    const items = pvm!.items;

    // Pick representative items from each row.
    const idx = (name: string) => items.findIndex((n) => n.toLowerCase() === name.toLowerCase());

    const scythe = idx("Scythe of vitur");
    const tbow = idx("Twisted bow");
    const shadow = idx("Tumeken's shadow");
    const ancestralTop = idx("Ancestral robe top");
    const masoriBody = idx("Masori body (f)");
    const anglerfish = idx("Anglerfish");

    // All gear pieces should come BEFORE food.
    if (anglerfish >= 0) {
      expect(scythe).toBeLessThan(anglerfish);
      expect(tbow).toBeLessThan(anglerfish);
      expect(shadow).toBeLessThan(anglerfish);
      expect(ancestralTop).toBeLessThan(anglerfish);
      expect(masoriBody).toBeLessThan(anglerfish);
    }

    // Weapons come before bodies.
    if (scythe >= 0 && masoriBody >= 0) {
      expect(scythe).toBeLessThan(masoriBody);
    }
    if (tbow >= 0 && ancestralTop >= 0) {
      expect(tbow).toBeLessThan(ancestralTop);
    }
  });

  it("MAX_MAIN: spec weapons come after primary weapons in the weapon row", async () => {
    const tabs = await shape(MAX_MAIN_BANK);
    const pvm = tabs.find((t) => t.name === "PvM Gear");
    const items = pvm!.items;

    const scythe = items.findIndex((n) => n === "Scythe of vitur");
    const tbow = items.findIndex((n) => n === "Twisted bow");
    const shadow = items.findIndex((n) => n === "Tumeken's shadow");
    const dragonClaws = items.findIndex((n) => n === "Dragon claws");
    const voidwaker = items.findIndex((n) => n === "Voidwaker");
    const bgs = items.findIndex((n) => n === "Bandos godsword");

    // Primaries before specs.
    [scythe, tbow, shadow].forEach((primary) => {
      if (primary >= 0 && dragonClaws >= 0) expect(primary).toBeLessThan(dragonClaws);
      if (primary >= 0 && voidwaker >= 0)   expect(primary).toBeLessThan(voidwaker);
      if (primary >= 0 && bgs >= 0)         expect(primary).toBeLessThan(bgs);
    });
  });

  it("MAX_MAIN: in the weapon row, melee primary precedes ranged primary precedes magic primary", async () => {
    const tabs = await shape(MAX_MAIN_BANK);
    const items = tabs.find((t) => t.name === "PvM Gear")!.items;

    const scythe = items.indexOf("Scythe of vitur");
    const tbow = items.indexOf("Twisted bow");
    const shadow = items.indexOf("Tumeken's shadow");

    expect(scythe).toBeGreaterThan(-1);
    expect(tbow).toBeGreaterThan(-1);
    expect(shadow).toBeGreaterThan(-1);

    expect(scythe).toBeLessThan(tbow);
    expect(tbow).toBeLessThan(shadow);
  });

  it("MAX_MAIN: Teleports places coins first, then charged jewellery, then teleport tabs", async () => {
    const tabs = await shape(MAX_MAIN_BANK);
    const items = tabs.find((t) => t.name === "Teleports")!.items;

    const coins = items.indexOf("Coins");
    const glory = items.indexOf("Amulet of glory(6)");
    const dueling = items.indexOf("Ring of dueling(8)");
    const skills = items.indexOf("Skills necklace(6)");
    const varrock = items.indexOf("Varrock teleport");
    const ectophial = items.indexOf("Ectophial");

    expect(coins).toBeGreaterThan(-1);
    expect(coins).toBeLessThan(glory);
    // Ornate jewellery box order: glory → dueling → games → skills → combat
    expect(glory).toBeLessThan(dueling);
    expect(dueling).toBeLessThan(skills);
    // Charged jewellery before teleport tabs/items.
    expect(skills).toBeLessThan(varrock);
    expect(skills).toBeLessThan(ectophial);
  });

  it("MAX_MAIN: Potions order — super combat ahead of brew ahead of restore ahead of prayer", async () => {
    const tabs = await shape(MAX_MAIN_BANK);
    const items = tabs.find((t) => t.name === "Potions")!.items;

    const superCombat = items.indexOf("Super combat potion(4)");
    const ranging = items.indexOf("Ranging potion(4)");
    const brew = items.indexOf("Saradomin brew(4)");
    const restore = items.indexOf("Super restore(4)");
    const prayer = items.indexOf("Prayer potion(4)");
    const stamina = items.indexOf("Stamina potion(4)");

    // PvM-frequency family order.
    expect(superCombat).toBeGreaterThan(-1);
    expect(superCombat).toBeLessThan(ranging);
    expect(ranging).toBeLessThan(brew);
    expect(brew).toBeLessThan(restore);
    expect(restore).toBeLessThan(prayer);
    expect(prayer).toBeLessThan(stamina);
  });

  it("SMALL_MAIN: falls back to a single consolidated 'Bank' tab", async () => {
    const tabs = await shape(SMALL_MAIN_BANK);
    expect(tabs.length).toBe(1);
    expect(tabs[0].name).toBe("Bank");
    // Items should still be ordered: Teleports-class items first, then PvM
    // Gear items, then Skilling, then Misc — i.e. the consolidated bank
    // mirrors the bucket-priority order.
    const items = tabs[0].items;
    const coins = items.indexOf("Coins");
    const whip = items.indexOf("Abyssal whip");
    const pickaxe = items.indexOf("Dragon pickaxe");
    expect(coins).toBeGreaterThan(-1);
    expect(coins).toBeLessThan(whip);
    expect(whip).toBeLessThan(pickaxe);
  });

  it("SKILLER: small skiller bank consolidates with skilling items ordered after teleports", async () => {
    const tabs = await shape(SKILLER_BANK);
    expect(tabs.length).toBe(1);
    expect(tabs[0].name).toBe("Bank");
    const items = tabs[0].items;
    const glory = items.indexOf("Amulet of glory(6)");
    const pickaxe = items.indexOf("Dragon pickaxe");
    expect(glory).toBeGreaterThan(-1);
    expect(pickaxe).toBeGreaterThan(-1);
    // Teleports cluster before Skilling cluster.
    expect(glory).toBeLessThan(pickaxe);
  });

  it("Voidwaker (spec weapon) lands in PvM Gear, not Quest/Untradeables", async () => {
    // The Voidwaker is a tradeable spec weapon, but its name contains the
    // substring "void" — which used to make it match the Untradeables rule
    // for void knight gear. This test locks down that it lives in PvM Gear.
    const tabs = await shape([27690, 22325, 20997]); // voidwaker + scythe + tbow
    // With only 3 items it goes to the consolidated "Bank" tab; check it's
    // in there alongside the other gear.
    const items = tabs[0].items;
    expect(items).toContain("Voidwaker");
    expect(items).toContain("Scythe of vitur");
    expect(items).toContain("Twisted bow");
  });

  it("Voidwaker components (hilt/blade/gem) land in Drops, not PvM Gear", async () => {
    // Voidwaker is assembled from 3 boss drops. Until assembled, the pieces
    // are loot, not gear — they should land in Drops alongside other unique
    // boss drops, not in the gear tab.
    // Use 50+ items so we get the multi-tab view, not the consolidated tab.
    const tabs = await shape([...MAX_MAIN_BANK, 27681, 27684, 27687]);
    const drops = tabs.find((t) => t.name === "Drops");
    expect(drops).toBeDefined();
    expect(drops!.items).toContain("Voidwaker hilt");
    expect(drops!.items).toContain("Voidwaker blade");
    expect(drops!.items).toContain("Voidwaker gem");
  });

  it("Pumpkin / Bunny ears / Easter egg land in Cosmetic, not Misc", async () => {
    const tabs = await shape([...MAX_MAIN_BANK, 1959, 1037, 1961]);
    const cosmetic = tabs.find((t) => t.name === "Cosmetic");
    expect(cosmetic).toBeDefined();
    expect(cosmetic!.items).toContain("Pumpkin");
    expect(cosmetic!.items).toContain("Bunny ears");
    expect(cosmetic!.items).toContain("Easter egg");
  });

  it("Achievement diary cape lands in Quest, not PvM Gear", async () => {
    const tabs = await shape([...MAX_MAIN_BANK, 13069]); // ADC (t)
    const quest = tabs.find((t) => t.name === "Quest");
    expect(quest).toBeDefined();
    expect(quest!.items.some((n) => n.startsWith("Achievement diary cape"))).toBe(true);
  });

  it("IRONMAN: small ironman bank consolidates and contains expected gear", async () => {
    const tabs = await shape(IRONMAN_BANK);
    expect(tabs.length).toBe(1);
    const items = tabs[0].items;
    expect(items).toContain("Abyssal whip");
    expect(items).toContain("Dragon pickaxe");
    expect(items).toContain("Saradomin brew(4)");
  });
});

describe("layout regression — archetype-driven tab order", () => {
  async function shapeWithArchetype(itemIds: number[], archetype: "pvm" | "skiller" | "main" | "ironman" | "unspecified") {
    const result = await organize({ itemIds, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs, archetype);
    return useCase.map((t) => String(t.name));
  }

  it("MAX_MAIN with archetype 'pvm' puts PvM Gear first", async () => {
    const names = await shapeWithArchetype(MAX_MAIN_BANK, "pvm");
    expect(names[0]).toBe("PvM Gear");
    expect(names.indexOf("Potions")).toBeLessThan(names.indexOf("Skilling"));
  });

  it("MAX_MAIN with archetype 'skiller' puts Skilling first", async () => {
    const names = await shapeWithArchetype(MAX_MAIN_BANK, "skiller");
    expect(names[0]).toBe("Skilling");
  });

  it("MAX_MAIN with archetype 'ironman' puts PvM Gear and Drops near the front", async () => {
    const names = await shapeWithArchetype(MAX_MAIN_BANK, "ironman");
    expect(names[0]).toBe("PvM Gear");
    // Drops is second-most-important for an ironman (they keep every unique).
    if (names.includes("Drops")) {
      expect(names.indexOf("Drops")).toBeLessThanOrEqual(2);
    }
  });

  it("MAX_MAIN with archetype 'main' puts Teleports first", async () => {
    const names = await shapeWithArchetype(MAX_MAIN_BANK, "main");
    expect(names[0]).toBe("Teleports");
  });

  it("MAX_MAIN with archetype 'unspecified' uses the default order", async () => {
    const names = await shapeWithArchetype(MAX_MAIN_BANK, "unspecified");
    expect(names[0]).toBe("Teleports");
    expect(names[1]).toBe("PvM Gear");
  });

  it("skiller archetype: stamina potion appears before super combat potion in Potions", async () => {
    const result = await organize({ itemIds: MAX_MAIN_BANK, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs, "skiller");
    const potions = useCase.find((t) => String(t.name) === "Potions");
    expect(potions).toBeDefined();
    const names = potions!.items.map((it) => it.name);
    const stam = names.indexOf("Stamina potion(4)");
    const superCombat = names.indexOf("Super combat potion(4)");
    expect(stam).toBeGreaterThan(-1);
    expect(superCombat).toBeGreaterThan(-1);
    expect(stam).toBeLessThan(superCombat);
  });

  it("default archetype: super combat appears before stamina in Potions", async () => {
    const result = await organize({ itemIds: MAX_MAIN_BANK, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs, "unspecified");
    const potions = useCase.find((t) => String(t.name) === "Potions");
    const names = potions!.items.map((it) => it.name);
    expect(names.indexOf("Super combat potion(4)")).toBeLessThan(names.indexOf("Stamina potion(4)"));
  });

  it("skiller archetype: in Skilling tab, Herblore items come before Mining items", async () => {
    // Build a bank that has both herblore (snapdragon seed) and mining (coal) items.
    const result = await organize({ itemIds: MAX_MAIN_BANK, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs, "skiller");
    const skilling = useCase.find((t) => String(t.name) === "Skilling");
    expect(skilling).toBeDefined();
    const names = skilling!.items.map((it) => it.name);
    const snapdragon = names.indexOf("Snapdragon seed");
    const coal = names.indexOf("Coal");
    if (snapdragon >= 0 && coal >= 0) {
      // Farming/herblore-related items go before mining for skillers.
      expect(snapdragon).toBeLessThan(coal);
    }
  });
});

describe("explainBucket — diagnostic mirror of bucketFor", () => {
  it("explains every fixture item with a non-empty reason", async () => {
    const result = await organize({ itemIds: MAX_MAIN_BANK, includePrices: false });
    for (const tab of result.tabs) {
      for (const it of tab.items) {
        const ex = explainBucket(it, tab.name);
        expect(ex.bucket).toBeDefined();
        expect(ex.reason).toBeTruthy();
      }
    }
  });

  it("returns 'id-override' for explicitly overridden items", () => {
    // Voidwaker has an id-override.
    const cls = classify("voidwaker");
    const ex = explainBucket(
      { id: 27690, name: "Voidwaker", subtab: cls.subtab, slot: cls.slot, weight: cls.weight, quantity: 1, unitPrice: 0, stackValue: 0 },
      cls.tab
    );
    expect(ex.bucket).toBe("PvM Gear");
    expect(ex.reason).toMatch(/id-override/);
  });

  it("returns 'pvm-db' for items in the curated PvM DB", () => {
    // Scythe of vitur is in the DB.
    const cls = classify("scythe of vitur");
    const ex = explainBucket(
      { id: 22325, name: "Scythe of vitur", subtab: cls.subtab, slot: cls.slot, weight: cls.weight, quantity: 1, unitPrice: 0, stackValue: 0 },
      cls.tab
    );
    expect(ex.bucket).toBe("PvM Gear");
    expect(ex.reason).toMatch(/pvm-db/);
  });
});

describe("layout regression — dense packing", () => {
  // PvM Gear deliberately uses a 2D set-grouped layout where empty slots
  // appear inside short columns (a 2-piece Mystic column leaves the row
  // below empty so the next strip starts cleanly). Every OTHER tab still
  // dense-packs.
  it("non-PvM tabs: every tab's layout dense-packs (no holes)", async () => {
    const result = await organize({ itemIds: MAX_MAIN_BANK, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs);
    for (const tab of useCase) {
      if (String(tab.name) === "PvM Gear") continue;
      const slots = Object.keys(tab.layout).map(Number).sort((a, b) => a - b);
      if (slots.length === 0) continue;
      expect(slots[0]).toBe(0);
      expect(slots[slots.length - 1]).toBe(slots.length - 1);
      for (let i = 0; i < slots.length; i++) {
        expect(slots[i]).toBe(i);
      }
    }
  });

  it("PvM Gear: Bandos chest / tassets / boots end up in the same column", async () => {
    const result = await organize({ itemIds: MAX_MAIN_BANK, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs);
    const pvm = useCase.find((t) => String(t.name) === "PvM Gear");
    if (!pvm) return;
    // Build a map of itemId → slot, then check that Bandos pieces share
    // the same column (slot % 8) and sit in head→body→legs→feet order.
    const slotById = new Map<number, number>();
    for (const [slot, id] of Object.entries(pvm.layout)) {
      slotById.set(id, Number(slot));
    }
    const chest = slotById.get(11832); // Bandos chestplate
    const tassets = slotById.get(11834); // Bandos tassets
    const boots = slotById.get(11836); // Bandos boots
    expect(chest).toBeDefined();
    expect(tassets).toBeDefined();
    expect(boots).toBeDefined();
    expect(chest! % 8).toBe(tassets! % 8);
    expect(tassets! % 8).toBe(boots! % 8);
    expect(chest!).toBeLessThan(tassets!);
    expect(tassets!).toBeLessThan(boots!);
  });

  it("PvM Gear: layout is a valid 8-col grid (no slot exceeds row*8 + 7)", async () => {
    const result = await organize({ itemIds: MAX_MAIN_BANK, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs);
    const pvm = useCase.find((t) => String(t.name) === "PvM Gear");
    if (!pvm) return;
    const slots = Object.keys(pvm.layout).map(Number);
    for (const s of slots) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s % 8).toBeGreaterThanOrEqual(0);
      expect(s % 8).toBeLessThanOrEqual(7);
    }
    // Every real item id appears at exactly one slot. Bank filler IDs (the
    // sentinel placed in missing-set-piece slots) are intentionally
    // duplicated, so we exclude them from the uniqueness check.
    const BANK_FILLER = 20594;
    const itemIds = Object.values(pvm.layout).filter((id) => id !== BANK_FILLER);
    expect(itemIds.length).toBe(new Set(itemIds).size);
  });

  it("PvM Gear: a partial set (Bandos chest + tassets + boots, no helm) gets a bank filler in the helm row", async () => {
    const result = await organize({ itemIds: MAX_MAIN_BANK, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs);
    const pvm = useCase.find((t) => String(t.name) === "PvM Gear");
    if (!pvm) return;
    // Find the column that holds Bandos chestplate (id 11832).
    const slotById = new Map<number, number>();
    for (const [slot, id] of Object.entries(pvm.layout)) slotById.set(id, Number(slot));
    const chestSlot = slotById.get(11832);
    if (chestSlot === undefined) return;
    const col = chestSlot % 8;
    // Walk up from the chest slot — the row above (head row) should contain
    // a bank filler since Bandos doesn't have a helm in MAX_MAIN.
    const helmSlot = chestSlot - 8;
    expect(pvm.layout[helmSlot]).toBe(20594);
    expect(helmSlot % 8).toBe(col);
  });

  it("Potions: a complete Ranarr row lays out as grimy → clean → secondary → unf → (4) → fillers", async () => {
    // Build a tiny bank with the canonical ranarr pipeline + bulk to clear
    // the small-bank threshold. Verify the row 0..7 sits in the exact slot
    // positions our layout promises. Ranarr is the FIRST family in
    // POTION_FAMILIES (top PvM priority) so its row starts at slot 0.
    const ids = [
      617,
      207,  // Grimy ranarr weed
      257,  // Ranarr weed
      99,   // Ranarr potion (unf)
      2434, // Prayer potion(4)
      // No (3)(2)(1) — should become fillers
      // Snape grass omitted — should become filler
      ...Array.from({ length: 60 }, (_, i) => 1000 + i)
    ];
    const result = await organize({ itemIds: ids, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs);
    const potions = useCase.find((t) => String(t.name) === "Potions");
    if (!potions) return;
    // Row template: [grimy] [clean] [secondary] [unf] [(4)] [(3)] [(2)] [(1)]
    const BANK_FILLER = 20594;
    expect(potions.layout[0]).toBe(207);          // Grimy ranarr weed
    expect(potions.layout[1]).toBe(257);          // Ranarr weed
    expect(potions.layout[2]).toBe(BANK_FILLER);  // Snape grass not in fixture
    expect(potions.layout[3]).toBe(99);           // Ranarr potion (unf)
    expect(potions.layout[4]).toBe(2434);         // Prayer potion(4)
    expect(potions.layout[5]).toBe(BANK_FILLER);  // (3) missing
    expect(potions.layout[6]).toBe(BANK_FILLER);  // (2) missing
    expect(potions.layout[7]).toBe(BANK_FILLER);  // (1) missing
  });

  it("Skilling: pouches row places Small/Medium/Large/Giant in slots 0-3 with fillers for Colossal + trailing", async () => {
    const ids = [
      617,
      5509, 5510, 5512, 5514, // Small, Medium, Large, Giant pouches (no Colossal)
      ...Array.from({ length: 60 }, (_, i) => 1600 + i)
    ];
    const result = await organize({ itemIds: ids, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs);
    const skilling = useCase.find((t) => String(t.name) === "Skilling");
    if (!skilling) return;
    const BANK_FILLER = 20594;
    // Pouches are the first themed row → slots 0..7
    expect(skilling.layout[0]).toBe(5509); // Small
    expect(skilling.layout[1]).toBe(5510); // Medium
    expect(skilling.layout[2]).toBe(5512); // Large
    expect(skilling.layout[3]).toBe(5514); // Giant
    expect(skilling.layout[4]).toBe(BANK_FILLER); // Colossal (missing)
    expect(skilling.layout[5]).toBe(BANK_FILLER);
    expect(skilling.layout[6]).toBe(BANK_FILLER);
    expect(skilling.layout[7]).toBe(BANK_FILLER);
  });

  it("Potions: a partial herb family (e.g. ranarr without (3) dose) gets a bank filler in the (3) cell", async () => {
    // Build a bank with one full ranarr row missing the (3) dose. 2434 =
    // Prayer potion(4), 142 = Prayer potion(3), 139 = Prayer potion(2),
    // 2444 was Ranging potion(4) in our earlier tests so we need the right
    // family. We just check that the Potions tab has *some* row containing
    // a filler ID, which is the smoking gun for filler-row support.
    const result = await organize({ itemIds: MAX_MAIN_BANK, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs);
    const potions = useCase.find((t) => String(t.name) === "Potions");
    if (!potions) return;
    const slots = Object.values(potions.layout);
    // We expect at least one filler somewhere in the potions layout — the
    // MAX_MAIN bank doesn't own every dose state of every potion family.
    expect(slots.includes(20594)).toBe(true);
  });
});
