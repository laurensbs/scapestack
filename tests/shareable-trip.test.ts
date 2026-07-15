import { describe, expect, it } from "vitest";
import {
  formatShareableTripCard,
  shareableTripFromRecommendation
} from "@/lib/shareable-trip";
import type { Recommendation } from "@/lib/next-up";

describe("shareable trip card", () => {
  it("shares the plan without bank contents", () => {
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
      rsn: "Lauky",
      stopPoint: "Stop at 50 KC."
    });
    const text = formatShareableTripCard(card);

    expect(card).toEqual({
      version: 1,
      title: "Push Vorkath to 50 KC",
      kind: "boss",
      rsn: "Lauky",
      why: "Salve would improve the trip, but the route is still clear.",
      stopPoint: "Stop at 50 KC.",
      iconItemId: 21907,
      bossSlug: "vorkath"
    });
    expect(text).toContain("Do this first: Push Vorkath to 50 KC");
    expect(text).toContain("No bank contents included.");
    expect(text).not.toContain("Abyssal whip");
    expect(text).not.toContain("quantity");
    expect(text).not.toContain("bankItems");
  });
});
