import { describe, expect, it } from "vitest";
import { buildSlayerBankContext } from "@/lib/slayer-bank-context";
import { normalizeBankHandoffItems } from "@/lib/next-bank-handoff";

describe("slayer bank context", () => {
  it("summarizes Slayer readiness from a bank handoff", () => {
    const context = buildSlayerBankContext(normalizeBankHandoffItems([
      { id: 11865, name: "Slayer helmet (i)", quantity: 1, stackValue: 1_200_000, subtab: "Slayer", slot: "head" },
      { id: 2, name: "Cannonball", quantity: 4_000, stackValue: 680_000, subtab: "Slayer" },
      { id: 2434, name: "Prayer potion(4)", quantity: 32, stackValue: 320_000, subtab: "Potions" },
      { id: 11980, name: "Bracelet of slaughter", quantity: 6, stackValue: 70_000, subtab: "Slayer" },
      { id: 12791, name: "Rune pouch", quantity: 1, stackValue: 0, subtab: "Utility" },
      { id: 995, name: "Coins", quantity: 1_000_000, unitPrice: 1, stackValue: 1_000_000, subtab: "Currency" }
    ]));

    expect(context).toMatchObject({
      summary: {
        itemCount: 6,
        label: "6 items · 3.27M gp"
      },
      readyCount: 5,
      missing: []
    });
    expect(context?.gear.map((item) => item.name)).toEqual(["Cannonball", "Slayer helmet (i)"]);
    expect(context?.consumables.map((item) => item.name)).toContain("Prayer potion(4)");
    expect(context?.unlocks.map((item) => item.name)).toEqual(["Rune pouch"]);
  });

  it("returns useful missing hints for weak Slayer banks", () => {
    const context = buildSlayerBankContext(normalizeBankHandoffItems([
      { id: 385, name: "Shark", quantity: 40, stackValue: 40_000, subtab: "Food" }
    ]));

    expect(context?.readyCount).toBe(1);
    expect(context?.missing).toEqual([
      "Slayer helm / black mask",
      "Prayer restore",
      "Task bracelet",
      "Rune pouch"
    ]);
  });

  it("returns null without handoff items", () => {
    expect(buildSlayerBankContext([])).toBeNull();
  });
});
