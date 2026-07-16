import { describe, expect, it } from "vitest";
import {
  bankedXpMaterialLine,
  estimateBankedXp,
  normalizeBankedXpItems,
  normalizeBankedXpName
} from "@/lib/banked-xp";

describe("banked XP", () => {
  it("counts raw Cooking supplies, aggregates item variants and excludes cooked fish", () => {
    const estimate = estimateBankedXp({
      skill: "Cooking",
      currentLevel: 99,
      xpRemaining: 50_000,
      bank: [
        { id: 383, name: "Raw shark", quantity: 100 },
        { id: 384, name: "Raw shark", quantity: 25 },
        { id: 385, name: "Shark", quantity: 5_000 }
      ]
    });

    expect(estimate.status).toBe("estimated");
    expect(estimate.materials).toEqual([
      expect.objectContaining({ name: "raw shark", quantity: 125, xpHigh: 26_250 })
    ]);
    expect(estimate.totalXpLow).toBeLessThan(estimate.totalXpHigh);
    expect(estimate.totalXpHigh).toBe(26_250);
    expect(bankedXpMaterialLine(estimate)).toContain("125 raw shark");
    expect(bankedXpMaterialLine(estimate)).toContain("Cooking XP");
  });

  it("keeps missing bank context unknown and an explicit empty bank honest", () => {
    const missing = estimateBankedXp({ skill: "Cooking", xpRemaining: 1_000 });
    const empty = estimateBankedXp({ skill: "Cooking", bank: [], xpRemaining: 1_000 });
    const cookedOnly = estimateBankedXp({
      skill: "Cooking",
      bank: [{ id: 385, name: "Shark", quantity: 1_000 }],
      xpRemaining: 1_000
    });

    expect(missing.status).toBe("unknown");
    expect(empty.status).toBe("known-empty");
    expect(cookedOnly.status).toBe("known-empty");
    expect(bankedXpMaterialLine(missing)).toBeNull();
    expect(bankedXpMaterialLine(empty)).toBeNull();
    expect(JSON.stringify([missing, empty, cookedOnly])).not.toMatch(/no raw fish/i);
  });

  it("normalizes noted labels and combines duplicate canonical names", () => {
    const bank = normalizeBankedXpItems([
      { id: 536, name: "Dragon bones", quantity: 4 },
      { id: 537, name: "Dragon bones (noted)", quantity: 6 },
      { id: -1, name: "Dragon bones (variant)", quantity: 2 }
    ]);

    expect(normalizeBankedXpName(" Dragon bones (noted) ")).toBe("dragon bones");
    expect(bank.get("dragon bones")).toBe(12);
  });

  it("models Prayer bones by method without multiplying ashes", () => {
    const bank = [
      { id: 536, name: "Dragon bones", quantity: 10 },
      { id: 25778, name: "Infernal ashes", quantity: 10 }
    ];
    const altar = estimateBankedXp({ skill: "Prayer", bank, prayerMethod: "gilded-altar" });
    const chaos = estimateBankedXp({ skill: "Prayer", bank, prayerMethod: "chaos-altar" });

    expect(altar.totalXpLow).toBe(3_145);
    expect(altar.totalXpHigh).toBe(3_145);
    expect(chaos.totalXpLow).toBe(3_145);
    expect(chaos.totalXpHigh).toBe(5_665);
    expect(chaos.assumptions.join(" ")).toContain("50% bone-save");
  });

  it("limits Herblore to complete unfinished or herb chains and excludes finished potions", () => {
    const estimate = estimateBankedXp({
      skill: "Herblore",
      currentLevel: 80,
      bank: [
        { id: 99, name: "Ranarr potion (unf)", quantity: 80 },
        { id: 257, name: "Ranarr weed", quantity: 20 },
        { id: 227, name: "Vial of water", quantity: 20 },
        { id: 231, name: "Snape grass", quantity: 100 },
        { id: 2434, name: "Prayer potion(4)", quantity: 5_000 }
      ]
    });

    expect(estimate.materials).toContainEqual(expect.objectContaining({
      name: "prayer potion supplies",
      quantity: 100,
      xpHigh: 8_750
    }));
    expect(estimate.totalXpHigh).toBe(8_750);

    const finishedOnly = estimateBankedXp({
      skill: "Herblore",
      currentLevel: 99,
      bank: [{ id: 2434, name: "Prayer potion(4)", quantity: 5_000 }]
    });
    expect(finishedOnly.status).toBe("known-empty");
  });

  it("counts Fletching logs, bows, darts and bolts while allocating shared parts once", () => {
    const estimate = estimateBankedXp({
      skill: "Fletching",
      currentLevel: 99,
      bank: [
        { id: 1513, name: "Magic logs", quantity: 10 },
        { id: 70, name: "Magic longbow (u)", quantity: 8 },
        { id: 1777, name: "Bow string", quantity: 5 },
        { id: 11232, name: "Dragon dart tip", quantity: 20 },
        { id: 8465, name: "Dragon bolts (unf)", quantity: 20 },
        { id: 314, name: "Feather", quantity: 25 }
      ]
    });

    expect(estimate.totalXpHigh).toBe(1_948.5);
    expect(estimate.materials).toHaveLength(3);
    expect(estimate.assumptions.join(" ")).toContain("allocated once");
  });

  it("handles Crafting chains and never counts finished Smithing products", () => {
    const crafting = estimateBankedXp({
      skill: "Crafting",
      currentLevel: 99,
      bank: [
        { id: 1391, name: "Battlestaff", quantity: 100 },
        { id: 571, name: "Water orb", quantity: 40 },
        { id: 1617, name: "Uncut diamond", quantity: 10 }
      ]
    });
    expect(crafting.totalXpHigh).toBe(6_575);

    const smithing = estimateBankedXp({
      skill: "Smithing",
      currentLevel: 99,
      bank: [
        { id: 2361, name: "Adamantite bar", quantity: 10 },
        { id: 1127, name: "Rune platebody", quantity: 1_000 }
      ]
    });
    expect(smithing.totalXpHigh).toBe(625);
    expect(smithing.materials.map((entry) => entry.name)).not.toContain("rune platebody");
  });

  it("covers planks, logs, seeds and one complete Magic rune method", () => {
    const construction = estimateBankedXp({ skill: "Construction", currentLevel: 99, bank: [{ id: 8782, name: "Mahogany plank", quantity: 100 }] });
    const firemaking = estimateBankedXp({ skill: "Firemaking", currentLevel: 99, bank: [{ id: 1517, name: "Maple logs", quantity: 100 }] });
    const farming = estimateBankedXp({ skill: "Farming", currentLevel: 99, bank: [{ id: 5316, name: "Magic seed", quantity: 2 }] });
    const magic = estimateBankedXp({
      skill: "Magic",
      currentLevel: 99,
      bank: [
        { id: 561, name: "Nature rune", quantity: 1_000 },
        { id: 554, name: "Fire rune", quantity: 5_000 }
      ]
    });

    expect(construction.totalXpHigh).toBe(14_000);
    expect(firemaking.totalXpHigh).toBe(13_500);
    expect(farming.totalXpHigh).toBeCloseTo(27_827.6);
    expect(magic.materials[0]).toMatchObject({ name: "High Alchemy casts", quantity: 1_000, xpHigh: 65_000 });
  });

  it("keeps quantities and XP finite and non-negative for hostile numeric input", () => {
    const quantities = [Number.NaN, Number.POSITIVE_INFINITY, -10_000, -1, 0, 1, 10, Number.MAX_VALUE];
    for (const quantity of quantities) {
      for (const skill of ["Cooking", "Prayer", "Crafting", "Smithing", "Construction", "Firemaking", "Farming", "Magic"]) {
        const estimate = estimateBankedXp({
          skill,
          currentLevel: 99,
          xpRemaining: quantity,
          bank: [{ id: 383, name: "Raw shark", quantity }]
        });
        expect(Number.isFinite(estimate.totalXpLow), `${skill}:${quantity}`).toBe(true);
        expect(Number.isFinite(estimate.totalXpHigh), `${skill}:${quantity}`).toBe(true);
        expect(estimate.totalXpLow, `${skill}:${quantity}`).toBeGreaterThanOrEqual(0);
        expect(estimate.totalXpHigh, `${skill}:${quantity}`).toBeGreaterThanOrEqual(0);
        expect(estimate.coveredXpLow, `${skill}:${quantity}`).toBeGreaterThanOrEqual(0);
        expect(estimate.coveredXpHigh, `${skill}:${quantity}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
