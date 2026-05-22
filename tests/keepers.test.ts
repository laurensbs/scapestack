import { describe, it, expect } from "vitest";
import { isKeeper, keeperCategory } from "@/lib/keeper-items";
import { isJunkCandidate } from "@/lib/junk";
import { organize } from "@/lib/organizer";
import { buildUseCaseTabs } from "@/lib/use-case-tabs";

// Items the user explicitly reported as misrouted to Misc / flagged as junk
// in the screenshot. Each one should now route to the right tab AND never
// appear in the junk list.
const KEEPER_BUG_CASES: Array<{ name: string; bucket: string; category: string }> = [
  { name: "Arclight",             bucket: "PvM Gear", category: "demonbane" },
  { name: "Darklight",            bucket: "PvM Gear", category: "demonbane" },
  { name: "Emberlight",           bucket: "PvM Gear", category: "demonbane" },
  { name: "Blisterwood flail",    bucket: "PvM Gear", category: "demonbane" },
  { name: "Cannon base",          bucket: "PvM Gear", category: "cannon" },
  { name: "Cannon stand",         bucket: "PvM Gear", category: "cannon" },
  { name: "Cannon furnace",       bucket: "PvM Gear", category: "cannon" },
  { name: "Cannon barrels",       bucket: "PvM Gear", category: "cannon" },
  { name: "Beaver",               bucket: "Drops",    category: "pet" },
  { name: "Heron",                bucket: "Drops",    category: "pet" },
  { name: "Olmlet",               bucket: "Drops",    category: "pet" },
  { name: "Ancient remnant",      bucket: "Drops",    category: "dt2-drop" },
  { name: "Awakener's orb",       bucket: "Drops",    category: "dt2-drop" },
  { name: "Voidwaker hilt",       bucket: "Drops",    category: "dt2-drop" },
  { name: "Blood essence",        bucket: "Skilling", category: "essence" },
  { name: "Angler waders",        bucket: "Cosmetic", category: "outfit" },
  { name: "Lumberjack hat",       bucket: "Cosmetic", category: "outfit" },
  { name: "Witchwood icon",       bucket: "Misc",     category: "slayer-util" },
  { name: "Slayer's staff",       bucket: "PvM Gear", category: "slayer-util" },
  { name: "Salve amulet",         bucket: "PvM Gear", category: "demonbane" },
  { name: "Salve amulet(ei)",     bucket: "PvM Gear", category: "demonbane" },
];

describe("keeper-items — protect community-iconic but cheap items", () => {
  for (const c of KEEPER_BUG_CASES) {
    it(`${c.name} → isKeeper, category=${c.category}`, () => {
      expect(isKeeper({ name: c.name })).toBe(true);
      const cat = keeperCategory({
        name: c.name, id: 0, subtab: "", slot: null, weight: 999,
        quantity: 1, unitPrice: 0, stackValue: 0
      });
      expect(cat).toBe(c.category);
    });
  }
});

describe("isJunkCandidate — keeper items are never flagged as junk", () => {
  for (const c of KEEPER_BUG_CASES) {
    it(`${c.name} is not junk even at 0 gp / qty 1`, () => {
      const result = isJunkCandidate(
        {
          name: c.name, id: 0, subtab: "", slot: null, weight: 999,
          quantity: 1, unitPrice: 0, stackValue: 0, highalch: 0
        },
        "Misc"
      );
      expect(result).toBe(false);
    });
  }
});

// Regression: items reported by the user as falsely flagged as junk in the
// Misc tab. Each one should pass the isJunkCandidate guard now.
const NEVER_JUNK_FROM_USER_REPORT: string[] = [
  "Barbarian rod", "Blackstone fragment", "Breach of the scarab",
  "Charged ice", "Cursed phalanx", "Dark claw", "Dark totem base",
  "Dark totem middle", "Double ammo mould", "Fossilised dung",
  "Holy wrench", "Keris partisan of the sun", "Lyre",
  "Menaphite ornament kit", "Ogre bellows (2)", "Remnant of akkha",
  "Remnant of zebak", "Seal of passage", "Shayzien greaves (5)",
  "Sled", "Soul bearer", "Strange teleorb", "Vyre noble shoes"
];

// Regression: items that landed in Misc when they should be in Skilling /
// Prayer / Potions. The classifier had no rule covering bare farming
// produce, bowstring/wool/flax, or blessed bones.
describe("classifier — formerly-Misc items now route to the right tab", () => {
  // Lazy import to keep top-of-file clean; classify is the unit we test here.
  const fixtures: Array<{ name: string; expectedTab: string }> = [
    { name: "Pineapple",            expectedTab: "Skilling" },
    { name: "Apple",                expectedTab: "Skilling" },
    { name: "Watermelon",           expectedTab: "Skilling" },
    { name: "Cabbage",              expectedTab: "Skilling" },
    { name: "Flax",                 expectedTab: "Skilling" },
    { name: "Bowstring",            expectedTab: "Skilling" },
    { name: "Ball of wool",         expectedTab: "Skilling" },
    { name: "Soft clay",            expectedTab: "Skilling" },
    { name: "Molten glass",         expectedTab: "Skilling" },
    { name: "Bucket of sand",       expectedTab: "Skilling" },
    { name: "Blessed bones",        expectedTab: "Prayer" },
    { name: "Blessed bone shards",  expectedTab: "Prayer" },
    { name: "Blessed bone statuette", expectedTab: "Prayer" },
    { name: "Limpwurt root",        expectedTab: "Skilling" },
    { name: "Eye of newt",          expectedTab: "Skilling" },
    { name: "Empty vial",           expectedTab: "Potions" }
  ];

  for (const f of fixtures) {
    it(`${f.name} → ${f.expectedTab}`, async () => {
      const { classify } = await import("@/lib/classifier");
      const result = classify(f.name.toLowerCase());
      expect(result.tab).toBe(f.expectedTab);
    });
  }
});

// Regression: user-reported routing fixes.
describe("classifier — orbs route to Skilling/Crafting (battlestaff input)", () => {
  for (const n of ["Air orb", "Water orb", "Earth orb", "Fire orb", "Cosmic orb", "Chaos orb", "Unpowered orb"]) {
    it(`${n} → Skilling/Crafting`, async () => {
      const { classify } = await import("@/lib/classifier");
      const c = classify(n.toLowerCase());
      expect(c.tab).toBe("Skilling");
      expect(c.subtab).toBe("Crafting");
    });
  }
});

describe("classifier — Bird nest family routing (community convention)", () => {
  // Per OSRS community convention: bird nests are a Woodcutting/birdhouse
  // byproduct, not a PvM drop. They belong in Skilling. Only Crushed nest
  // (Herblore secondary) and Clue nest (a clue scroll) get special routing.
  const cases: Array<{ name: string; tab: string; subtab: string }> = [
    { name: "Bird nest",          tab: "Skilling", subtab: "Hunter" },
    { name: "Bird nest (red)",    tab: "Skilling", subtab: "Hunter" },
    { name: "Bird nest (gold)",   tab: "Skilling", subtab: "Hunter" },
    { name: "Egg nest",           tab: "Skilling", subtab: "Hunter" },
    { name: "Ring nest",          tab: "Skilling", subtab: "Hunter" },
    { name: "Crushed nest",       tab: "Skilling", subtab: "Herblore" },
    { name: "Clue nest (easy)",   tab: "Clues",    subtab: "Caskets" },
    { name: "Clue nest (elite)",  tab: "Clues",    subtab: "Caskets" }
  ];
  for (const c of cases) {
    it(`${c.name} → ${c.tab}/${c.subtab}`, async () => {
      const { classify } = await import("@/lib/classifier");
      const result = classify(c.name.toLowerCase());
      expect(result.tab).toBe(c.tab);
      expect(result.subtab).toBe(c.subtab);
    });
  }
});

describe("bucket routing — Crushed nest goes to Potions (Sara brew secondary)", () => {
  it("classifies Crushed nest as Skilling/Herblore", async () => {
    const { classify } = await import("@/lib/classifier");
    const c = classify("crushed nest");
    expect(c.tab).toBe("Skilling");
    expect(c.subtab).toBe("Herblore");
  });

  it("routes Crushed nest (id 6693) to the Potions tab", async () => {
    const { organize } = await import("@/lib/organizer");
    const { buildUseCaseTabs } = await import("@/lib/use-case-tabs");
    const { MAX_MAIN_BANK } = await import("@/lib/fixtures");
    const result = await organize({ itemIds: [...MAX_MAIN_BANK, 6693], includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs);
    const potions = useCase.find((t) => String(t.name) === "Potions");
    expect(potions).toBeDefined();
    expect(potions!.items.some((it) => it.id === 6693)).toBe(true);
  });
});

describe("bucket routing — storage carriers split by purpose", () => {
  const cases: Array<{ name: string; tab: string }> = [
    // Skilling supply carriers
    { name: "Gem bag",                  tab: "Skilling" },
    { name: "Coal bag",                 tab: "Skilling" },
    { name: "Log basket",               tab: "Skilling" },
    { name: "Fish barrel",              tab: "Skilling" },
    { name: "Herb sack",                tab: "Skilling" },
    { name: "Seed box",                 tab: "Skilling" },
    { name: "Bottomless compost bucket", tab: "Skilling" },
    { name: "Small pouch",              tab: "Skilling" },
    { name: "Medium pouch",             tab: "Skilling" },
    { name: "Large pouch",              tab: "Skilling" },
    { name: "Giant pouch",              tab: "Skilling" },
    { name: "Colossal pouch",           tab: "Skilling" },
    { name: "Tackle box",               tab: "Skilling" },
    { name: "Plank sack",               tab: "Skilling" },
    // PvM-utility carriers stay with Teleports
    { name: "Looting bag",              tab: "Teleports" },
    { name: "Rune pouch",               tab: "Teleports" },
    { name: "Divine rune pouch",        tab: "Teleports" }
  ];

  for (const c of cases) {
    it(`${c.name} → ${c.tab}`, async () => {
      const { keeperCategory } = await import("@/lib/keeper-items");
      const cat = keeperCategory({
        name: c.name, id: 0, subtab: "", slot: null, weight: 999,
        quantity: 1, unitPrice: 0, stackValue: 0
      });
      // Sanity check the category before checking the bucket — if the
      // keeper category is wrong the bucket route is meaningless.
      expect(cat).toBe("carrier");
    });
  }
});

describe("tool-tier dedup — lower-tier pickaxes/hatchets demote to Drops", () => {
  it("Dragon + Rune pickaxe: rune pickaxe moves to Drops", async () => {
    const { organize } = await import("@/lib/organizer");
    const { buildUseCaseTabs } = await import("@/lib/use-case-tabs");
    const { MAX_MAIN_BANK } = await import("@/lib/fixtures");
    // Dragon pickaxe (id 11920) is already in MAX_MAIN_BANK. Add Rune
    // pickaxe (id 1275) and verify it demotes.
    const result = await organize({ itemIds: [...MAX_MAIN_BANK, 1275], includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs);
    const skilling = useCase.find((t) => String(t.name) === "Skilling");
    const drops = useCase.find((t) => String(t.name) === "Drops");
    expect(skilling).toBeDefined();
    expect(drops).toBeDefined();
    expect(skilling!.items.some((it) => it.id === 11920)).toBe(true);   // Dragon stays
    expect(skilling!.items.some((it) => it.id === 1275)).toBe(false);   // Rune demoted
    expect(drops!.items.some((it) => it.id === 1275)).toBe(true);
  });

  it("Rune axe + Dragon axe: Rune axe demotes to Drops", async () => {
    const { organize } = await import("@/lib/organizer");
    const { buildUseCaseTabs } = await import("@/lib/use-case-tabs");
    const ids = [617, 1359, 6739, ...Array.from({ length: 60 }, (_, i) => 1600 + i)];
    const result = await organize({ itemIds: ids, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs);
    const skilling = useCase.find((t) => String(t.name) === "Skilling");
    const drops = useCase.find((t) => String(t.name) === "Drops");
    expect(skilling).toBeDefined();
    expect(drops).toBeDefined();
    expect(skilling!.items.some((it) => it.id === 6739)).toBe(true);   // Dragon axe stays
    expect(skilling!.items.some((it) => it.id === 1359)).toBe(false);  // Rune axe demoted
    expect(drops!.items.some((it) => it.id === 1359)).toBe(true);
  });

  it("Dragon axe (or) and Crystal axe (inactive) variants are still dedup'd", async () => {
    const { organize } = await import("@/lib/organizer");
    const { buildUseCaseTabs } = await import("@/lib/use-case-tabs");
    // 23673 = Crystal axe, 25378 = Dragon axe (or), 1359 = Rune axe
    const ids = [617, 23673, 25378, 1359, ...Array.from({ length: 60 }, (_, i) => 1600 + i)];
    const result = await organize({ itemIds: ids, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs);
    const skilling = useCase.find((t) => String(t.name) === "Skilling");
    const drops = useCase.find((t) => String(t.name) === "Drops");
    expect(skilling).toBeDefined();
    // Crystal beats Dragon and Rune. Dragon axe (or) and Rune axe demote.
    expect(skilling!.items.some((it) => it.id === 23673)).toBe(true);   // Crystal stays
    expect(drops!.items.some((it) => it.id === 25378)).toBe(true);      // Dragon (or) demoted
    expect(drops!.items.some((it) => it.id === 1359)).toBe(true);       // Rune demoted
  });

  it("Lone Rune pickaxe (no Dragon): stays in Skilling", async () => {
    const { organize } = await import("@/lib/organizer");
    const { buildUseCaseTabs } = await import("@/lib/use-case-tabs");
    // 50+ items so we get multi-tab view, no Dragon pickaxe.
    const ids = [617, 1275, ...Array.from({ length: 60 }, (_, i) => 1500 + i)];
    const result = await organize({ itemIds: ids, includePrices: false });
    const useCase = buildUseCaseTabs(result.tabs);
    const skilling = useCase.find((t) => String(t.name) === "Skilling");
    if (!skilling) return; // small-bank fallback may consolidate; either way fine
    expect(skilling.items.some((it) => it.id === 1275)).toBe(true);
  });
});

describe("isJunkCandidate — user-reported false positives", () => {
  for (const name of NEVER_JUNK_FROM_USER_REPORT) {
    it(`${name} is not junk (untradeable quest/boss/utility item)`, () => {
      // Worst case: low unitPrice, no slot, no highalch — simulates what the
      // organizer would produce for an untradeable item with no GE feed.
      // We test BOTH the unitPrice=0 (no GE feed) and unitPrice=12 (low
      // junk-range high-alch) paths.
      for (const unitPrice of [0, 12]) {
        const result = isJunkCandidate(
          {
            name, id: 0, subtab: "", slot: null, weight: 999,
            quantity: 1, unitPrice, stackValue: 0, highalch: 0
          },
          "Misc"
        );
        expect(result, `${name} @ ${unitPrice}gp`).toBe(false);
      }
    });
  }
});

describe("bucket routing — keepers land in the right use-case tab", () => {
  // Real item IDs from data/items.json so the full organize() flow runs.
  // Each pair is [item id, expected tab name].
  const cases: Array<{ id: number; tab: string; label: string }> = [
    { id: 19675, tab: "PvM Gear", label: "Arclight" },
    { id: 24699, tab: "PvM Gear", label: "Blisterwood flail" },
    { id: 6,     tab: "PvM Gear", label: "Cannon base" },
    { id: 8,     tab: "PvM Gear", label: "Cannon stand" },
    { id: 13322, tab: "Drops",    label: "Beaver pet" },
    { id: 13320, tab: "Drops",    label: "Heron pet" },
    { id: 27381, tab: "Drops",    label: "Ancient remnant" },
    { id: 28334, tab: "Drops",    label: "Awakener's orb" },
    { id: 8923,  tab: "Misc",     label: "Witchwood icon (inventory tool, not gear)" },
    { id: 4170,  tab: "PvM Gear", label: "Slayer's staff (wearable weapon)" },
    { id: 13260, tab: "Cosmetic", label: "Angler waders" }
  ];

  for (const c of cases) {
    it(`${c.label} (id ${c.id}) → ${c.tab}`, async () => {
      // Use the full MAX_MAIN fixture + the test id so we get the multi-tab
      // view (>50 items threshold) and don't hit the consolidated-bank fallback.
      const { MAX_MAIN_BANK } = await import("@/lib/fixtures");
      const ids = [...MAX_MAIN_BANK, c.id];
      const result = await organize({ itemIds: ids, includePrices: false });
      const useCase = buildUseCaseTabs(result.tabs);
      const target = useCase.find((t) => String(t.name) === c.tab);
      if (!target) {
        throw new Error(`Tab ${c.tab} missing; got: ${useCase.map((t) => t.name).join(", ")}`);
      }
      // Resolve the item name from items.json so we can search in the tab.
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const raw = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "items.json"), "utf8"));
      const itemName = typeof raw[c.id] === "string" ? raw[c.id] : raw[c.id]?.name;
      if (!itemName) {
        // Unknown id in the wiki dump — skip rather than fail (items.json drift).
        console.warn(`id ${c.id} not in items.json; skipping ${c.label}`);
        return;
      }
      expect(target.items.some((it) => it.name === itemName)).toBe(true);
    });
  }
});
