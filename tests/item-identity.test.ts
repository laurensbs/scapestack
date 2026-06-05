import { describe, expect, it } from "vitest";
import { buildItemIdentity, normalizeOsrsItemId } from "@/lib/item-identity";

describe("item identity", () => {
  it("normalizes unsafe item IDs to a safe OSRS fallback", () => {
    expect(normalizeOsrsItemId(4151)).toBe(4151);
    expect(normalizeOsrsItemId(-995)).toBe(995);
    expect(normalizeOsrsItemId(Number.NaN)).toBe(995);
  });

  it("keeps BankTags, sprite proxy and wiki price IDs aligned", () => {
    const identity = buildItemIdentity({
      id: 4151,
      name: "Abyssal whip",
      quantity: 1
    });

    expect(identity).toMatchObject({
      itemId: 4151,
      spriteId: 4151,
      badge: "OSRS item #4151",
      bankTagsToken: "4151",
      spriteUrl: "/api/sprite/item/4151.png",
      wikiUrl: "https://oldschool.runescape.wiki/w/Special:Search?search=Abyssal%20whip",
      priceUrl: "https://prices.runescape.wiki/osrs/item/4151"
    });
    expect(identity.facts).toContain("OSRS Wiki search: Abyssal whip");
  });

  it("shows stack sprite variants without changing the exported item ID", () => {
    const identity = buildItemIdentity({
      id: 995,
      name: "Coins",
      quantity: 10_000
    });

    expect(identity.itemId).toBe(995);
    expect(identity.spriteId).toBe(1004);
    expect(identity.badge).toBe("OSRS item #995 · sprite #1004");
    expect(identity.bankTagsToken).toBe("995");
    expect(identity.wikiUrl).toContain("search=Coins");
  });
});
