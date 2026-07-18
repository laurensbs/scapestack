import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatShareableTripCard,
  shareableTripFromRecommendation
} from "@/lib/shareable-trip";
import type { Recommendation } from "@/lib/next-up";

describe("shareable trip card", () => {
  it("shares a useful account decision without private context", () => {
    const rec = {
      id: "boss:vorkath",
      kind: "boss",
      title: "Push Vorkath to 50 KC",
      why: "You already have KC, so 50 is a clean stop point.",
      decisionReason: "Salve would improve the trip, but the route is still clear.",
      iconItemId: 21907,
      bossSlug: "vorkath"
    } as Recommendation;

    const card = shareableTripFromRecommendation(rec, {
      bankContext: true,
      stopPoint: "Stop at 50 KC."
    });
    const text = formatShareableTripCard(card);

    expect(card).toMatchObject({
      version: 1,
      result: "My bank supports this Vorkath trip",
      title: "Push Vorkath to 50 KC",
      kind: "boss",
      why: "Salve would improve the trip, but the route is still clear.",
      stopPoint: "Stop at 50 KC.",
      iconItemId: 21907,
      bossSlug: "vorkath"
    });
    expect(card.previewText).toBe(text);
    expect(card.ogImageUrl).toContain("/share/trip/opengraph-image?");
    expect(card.ogImageUrl).toContain("item=21907");
    expect(text).toContain("Do this first: Push Vorkath to 50 KC");
    expect(text).toContain("Shared from Scapestack. No bank contents, RSN or raw stats included.");
    expect(text).not.toContain("Abyssal whip");
    expect(text).not.toContain("Lauky");
    expect(text).not.toContain("quantity");
    expect(text).not.toContain("bankItems");
  });

  it("falls back when recommendation copy includes private/debug context", () => {
    const rec = {
      id: "skill:cooking",
      kind: "skill",
      title: "Pick a maxing lane: Cooking",
      why: "bank rows: 314 raw sharks quantity 9999",
      decisionReason: "payload included raw stats",
      iconItemId: 9801
    } as Recommendation;

    const card = shareableTripFromRecommendation(rec, {
      bankContext: true,
      accountSafeProgress: "This bank covers 430k Cooking XP",
      stopPoint: "Stop after the next level."
    });

    expect(card.result).toBe("This bank covers 430k Cooking XP");
    expect(card.why).toBe("Scapestack found a cleaner next trip.");
    expect(card.why).not.toMatch(/bank rows|payload|raw stats|quantity|Lauky|Abyssal whip/i);
    expect(card.ogImageUrl).not.toMatch(/bank\+rows|payload|raw\+stats|quantity|Lauky|Abyssal\+whip/i);
  });

  it("has an Open Graph image route for social crawlers", () => {
    expect(cardRouteSource()).toContain("ImageResponse");
    expect(cardRouteSource()).toContain("WHAT TO DO NOW");
    expect(cardRouteSource()).toContain("brandUrl(`/api/sprite/item/${itemId}`)");
    expect(cardRouteSource()).toMatch(/payload\|bank rows\?\|raw stats\?/);
  });
});

function cardRouteSource(): string {
  return readFileSync("src/app/share/trip/opengraph-image.tsx", "utf8");
}
