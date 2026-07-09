import { describe, expect, it } from "vitest";
import { evaluateItemAvailability } from "@/lib/item-availability";

describe("item availability", () => {
  it("treats a missing buyable item as buy-or-grab prep for Normal accounts", () => {
    const result = evaluateItemAvailability({
      name: "Plank",
      quantity: 2,
      ownedInBank: false,
      accountType: "regular"
    });

    expect(result.status).toBe("missing-buyable");
    expect(result.copy).toBe("Buy or grab 2 planks.");
  });

  it("treats the same missing item as self-sourcing for Ironman", () => {
    const result = evaluateItemAvailability({
      name: "Plank",
      quantity: 2,
      ownedInBank: false,
      accountType: "ironman"
    });

    expect(result.status).toBe("missing-shop-source");
    expect(result.copy).toBe("Source yourself: 2 planks via sawmill/Construction route.");
  });

  it("warns Hardcore Ironman about risky item sources", () => {
    const result = evaluateItemAvailability({
      name: "Plank",
      quantity: 2,
      ownedInBank: false,
      accountType: "hardcore"
    });

    expect(result.status).toBe("missing-shop-source");
    expect(result.copy).toBe("Avoid risky source unless payoff is worth it; source 2 planks yourself via sawmill/Construction route.");
  });

  it("uses staging language for Ultimate Ironman", () => {
    const result = evaluateItemAvailability({
      name: "Plank",
      quantity: 2,
      ownedInBank: false,
      accountType: "ultimate"
    });

    expect(result.status).toBe("uim-stage-manually");
    expect(result.copy).toBe("Stage/carry 2 planks before starting.");
  });

  it("does not assume Group Ironman storage is verified", () => {
    const result = evaluateItemAvailability({
      name: "Plank",
      quantity: 2,
      ownedInBank: false,
      accountType: "group"
    });

    expect(result.status).toBe("missing-shop-source");
    expect(result.copy).toBe("Own bank checked; group storage not verified for 2 planks.");
  });

  it("lets bank ownership win for every account type", () => {
    const result = evaluateItemAvailability({
      name: "Plank",
      quantity: 2,
      ownedInBank: true,
      ownedQuantity: 2,
      ownedName: "Plank",
      accountType: "ultimate"
    });

    expect(result.status).toBe("owned");
    expect(result.copy).toBe("In bank: 2 planks.");
  });
});
