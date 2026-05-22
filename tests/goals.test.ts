import { describe, it, expect } from "vitest";
import { goalCategoryOrder, GOAL_CATEGORIES, unlockedFromHiscores } from "@/lib/goals";

describe("unlockedFromHiscores — synthetic skill capes from Hiscores", () => {
  it("emits a Woodcutting cape for a player at 99 Woodcutting", () => {
    const skills = [
      { name: "Woodcutting", level: 99 },
      { name: "Attack", level: 60 },
      { name: "Defence", level: 99 }
    ];
    const items = unlockedFromHiscores(skills);
    const wcCape = items.find((it) => it.name === "Woodcutting cape");
    expect(wcCape).toBeDefined();
    expect(wcCape!.id).toBe(9807);
    // Attack < 99 → no cape
    expect(items.find((it) => it.name === "Attack cape")).toBeUndefined();
    // Defence at 99 → cape
    expect(items.find((it) => it.name === "Defence cape")).toBeDefined();
  });

  it("returns an empty array for a player below 99 in everything", () => {
    const items = unlockedFromHiscores([
      { name: "Attack", level: 50 }, { name: "Strength", level: 60 }
    ]);
    expect(items).toEqual([]);
  });

  it("synthesises Construction cape (despite OSRS item being 'Construct. cape')", () => {
    const items = unlockedFromHiscores([{ name: "Construction", level: 99 }]);
    expect(items.find((it) => it.name === "Construction cape")?.id).toBe(9789);
  });
});

describe("goalCategoryOrder — archetype-aware category display", () => {
  it("returns the default order for null / unspecified", () => {
    const def = goalCategoryOrder(null);
    expect(def[0]).toBe("capes");
    expect(def[1]).toBe("combat-prestige");
    // Every category present in the default order should match the GOAL_CATEGORIES keys.
    const all = Object.keys(GOAL_CATEGORIES);
    expect(def.sort()).toEqual([...all].sort());
  });

  it("pvm: combat-prestige + raid-uniques rank ahead of skill-outfits", () => {
    const order = goalCategoryOrder("pvm");
    expect(order.indexOf("combat-prestige")).toBeLessThan(order.indexOf("skill-outfits"));
    expect(order.indexOf("raid-uniques")).toBeLessThan(order.indexOf("skill-outfits"));
    expect(order.indexOf("gwd")).toBeLessThan(order.indexOf("skill-outfits"));
  });

  it("skiller: skill-outfits + capes rank ahead of raid-uniques", () => {
    const order = goalCategoryOrder("skiller");
    expect(order.indexOf("skill-outfits")).toBeLessThan(order.indexOf("raid-uniques"));
    expect(order.indexOf("capes")).toBeLessThan(order.indexOf("raid-uniques"));
  });

  it("ironman: diary + capes lead, raid-uniques mid-pack", () => {
    const order = goalCategoryOrder("ironman");
    expect(order[0]).toBe("capes");
    expect(order.indexOf("diary")).toBeLessThan(order.indexOf("raid-uniques"));
    expect(order.indexOf("skill-outfits")).toBeLessThan(order.indexOf("raid-uniques"));
  });

  it("falls back to default order for unknown archetype strings", () => {
    const order = goalCategoryOrder("bogus");
    expect(order).toEqual(goalCategoryOrder(null));
  });

  it("every archetype's order is a complete permutation of GOAL_CATEGORIES", () => {
    const all = Object.keys(GOAL_CATEGORIES).sort();
    for (const a of ["main", "pvm", "skiller", "ironman", "unspecified"]) {
      const order = goalCategoryOrder(a);
      expect(order.length).toBe(all.length);
      expect([...order].sort()).toEqual(all);
    }
  });
});
