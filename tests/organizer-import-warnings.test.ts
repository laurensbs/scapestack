import { describe, expect, it } from "vitest";
import { organize } from "@/lib/organizer";

describe("organizer import warnings", () => {
  it("keeps unknown item IDs as fallback tiles instead of dropping them", async () => {
    const result = await organize({
      itemIds: [4151, 99999999, 4151, 995],
      includePrices: false,
      shuffleSeed: 1
    });

    expect(result.source.itemCount).toBe(3);
    expect(result.importWarnings).toMatchObject({
      parsedItemCount: 4,
      recognizedItemCount: 2,
      duplicateItemCount: 1,
      fallbackItemCount: 1,
      fallbackItemIds: [99999999],
      ignoredItemCount: 1,
      ignoredItemIds: [99999999]
    });
    expect(result.tabs.flatMap((tab) => tab.items).map((item) => [item.id, item.name]))
      .toContainEqual([99999999, "Unknown item #99999999"]);
  });

  it("uses Bank Memory names for unknown IDs when the TSV provides them", async () => {
    const result = await organize({
      input: [
        "Item id\tItem name\tItem quantity",
        "99999999\tFuture boss shard\t7",
        "995\tCoins\t12000"
      ].join("\n"),
      includePrices: false,
      shuffleSeed: 1
    });

    const unknown = result.tabs.flatMap((tab) => tab.items).find((item) => item.id === 99999999);
    expect(unknown).toMatchObject({
      id: 99999999,
      name: "Future boss shard",
      quantity: 7
    });
    expect(result.source.itemCount).toBe(2);
    expect(result.importWarnings.fallbackItemIds).toEqual([99999999]);
    expect(result.importWarnings.ignoredItemIds).toEqual(result.importWarnings.fallbackItemIds);
  });
});
