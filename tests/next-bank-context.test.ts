import { describe, expect, it } from "vitest";
import { buildNextBankContext } from "@/lib/next-bank-context";
import { normalizeBankHandoffItems } from "@/lib/next-bank-handoff";

describe("next bank context", () => {
  it("summarizes a handoff into valued areas for the next result view", () => {
    const context = buildNextBankContext(normalizeBankHandoffItems([
      { id: 11806, name: "Saradomin godsword", quantity: 1, stackValue: 28_780_000, subtab: "PvM Gear" },
      { id: 11804, name: "Bandos godsword", quantity: 1, stackValue: 20_000_000, subtab: "PvM Gear" },
      { id: 995, name: "Coins", quantity: 1_000_000, unitPrice: 1, stackValue: 1_000_000, subtab: "Currency" },
      { id: 12695, name: "Super combat potion(4)", quantity: 8, stackValue: 0, subtab: "Potions" }
    ]));

    expect(context).toMatchObject({
      hasValuedBank: true,
      summary: {
        itemCount: 4,
        totalValue: 49_780_000,
        label: "4 items · 49.78M gp"
      },
      topAreas: [
        { name: "PvM Gear", itemCount: 2, totalValue: 48_780_000 },
        { name: "Currency", itemCount: 1, totalValue: 1_000_000 },
        { name: "Potions", itemCount: 1, totalValue: 0 }
      ]
    });
  });

  it("returns null without bank items", () => {
    expect(buildNextBankContext([])).toBeNull();
  });
});
