import { describe, expect, it } from "vitest";
import { buildRecommendationIdentity } from "@/lib/recommendation-identity";

describe("recommendation identity", () => {
  it("exposes OSRS item ID backing a recommendation sprite", () => {
    const identity = buildRecommendationIdentity({
      kind: "boss",
      title: "Try Vorkath",
      iconItemId: 21907
    });

    expect(identity).toMatchObject({
      label: "Visual ID #21907",
      helper: "boss recommendation sprite uses OSRS item #21907."
    });
    expect(identity?.item.spriteUrl).toBe("/api/sprite/item/21907.png");
    expect(identity?.item.priceUrl).toBe("https://prices.runescape.wiki/osrs/item/21907");
  });

  it("returns null when a recommendation has no item sprite", () => {
    expect(buildRecommendationIdentity({
      kind: "quest",
      title: "Do Dragon Slayer",
      iconItemId: undefined
    })).toBeNull();
  });
});
