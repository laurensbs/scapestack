import { describe, expect, it } from "vitest";
import { bankHandoffItemsFromSnapshot } from "@/lib/profile-bank-handoff";

describe("profile bank handoff", () => {
  it("maps saved profile snapshots into next bank handoff items", () => {
    const items = bankHandoffItemsFromSnapshot({
      ts: 1780474742285,
      items: [
        { id: 11840, name: "Dragon boots", quantity: 2, stackValue: 240_000 },
        { id: 995, name: "Coins", quantity: 5_000_000, stackValue: 5_000_000 }
      ]
    });

    expect(items).toEqual([
      {
        id: 11840,
        name: "Dragon boots",
        quantity: 2,
        unitPrice: 120_000,
        stackValue: 240_000,
        subtab: "Profile snapshot",
        slot: null,
        weight: 0
      },
      {
        id: 995,
        name: "Coins",
        quantity: 5_000_000,
        unitPrice: 1,
        stackValue: 5_000_000,
        subtab: "Profile snapshot",
        slot: null,
        weight: 1
      }
    ]);
  });

  it("keeps malformed quantities safe for handoff normalization", () => {
    const [item] = bankHandoffItemsFromSnapshot({
      ts: 1780474742285,
      items: [{ id: 4151, name: "Abyssal whip", quantity: 0, stackValue: 1_700_000 }]
    });

    expect(item).toMatchObject({
      quantity: 1,
      unitPrice: 1_700_000,
      stackValue: 1_700_000,
      subtab: "Profile snapshot",
      slot: null,
      weight: 0
    });
  });
});
