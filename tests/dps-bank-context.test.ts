import { describe, expect, it } from "vitest";
import { buildDpsBankContext } from "@/lib/dps-bank-context";
import { normalizeBankHandoffItems } from "@/lib/next-bank-handoff";

describe("dps bank context", () => {
  it("hydrates owned DPS gear from a bank handoff", () => {
    const context = buildDpsBankContext(normalizeBankHandoffItems([
      { id: 4151, name: "Abyssal whip", quantity: 1, stackValue: 1_700_000, subtab: "Melee", slot: "weapon" },
      { id: 11832, name: "Bandos chestplate", quantity: 1, stackValue: 28_000_000, subtab: "Melee", slot: "body" },
      { id: 995, name: "Coins", quantity: 1_000_000, unitPrice: 1, stackValue: 1_000_000, subtab: "Currency" }
    ]));

    expect(context).toMatchObject({
      weaponCount: 1,
      summary: {
        itemCount: 3,
        label: "3 items · 30.70M gp"
      }
    });
    expect(context?.owned.map((gear) => gear.name)).toEqual([
      "Abyssal whip",
      "Bandos chestplate"
    ]);
  });

  it("returns null without handoff items", () => {
    expect(buildDpsBankContext([])).toBeNull();
  });
});
