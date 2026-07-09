import { describe, expect, it } from "vitest";
import {
  primaryActionForRecommendation,
  recommendationHrefWithContext,
  routeActionForHref
} from "@/lib/recommendation-action";
import type { Recommendation } from "@/lib/next-up";

function rec(overrides: Partial<Recommendation>): Recommendation {
  return {
    id: "test",
    kind: "bank",
    title: "Do the thing",
    why: "Because it helps.",
    score: 10,
    ...overrides
  };
}

describe("recommendation primary actions", () => {
  it("labels known Scapestack routes with concrete tool names", () => {
    expect(routeActionForHref("/dps").label).toBe("Open kill check");
    expect(routeActionForHref("/goals").label).toBe("Choose unlock");
    expect(routeActionForHref("/bank?sample=1").label).toBe("Check gear");
    expect(routeActionForHref("/slayer/").label).toBe("Check task");
    expect(routeActionForHref("/gp").label).toBe("Open cash route in /next");
    expect(routeActionForHref("/skills").label).toBe("Open skill route in /next");
    expect(routeActionForHref("/quests/animal-magnetism").label).toBe("Check quest requirements");
    expect(routeActionForHref("/slayer?rsn=Lynx+Titan&source=plugin-sync").href)
      .toBe("/slayer?rsn=Lynx+Titan&source=plugin-sync");
    expect(routeActionForHref("/plugin").helper).toBe("Let Scapestack skip finished quests, diary steps, clog slots and Slayer.");
    expect(routeActionForHref("/plugin").helper).not.toContain("exact account state");
  });

  it("keeps boss recommendations in the modal path and exposes a DPS deep-link", () => {
    const action = primaryActionForRecommendation(rec({
      kind: "kc",
      bossSlug: "vardorvis",
      link: "/dps"
    }));

    expect(action.label).toBe("Open boss setup");
    expect(action.bossSlug).toBe("vardorvis");
    expect(action.href).toBe("/dps?boss=vardorvis&from=next");
  });

  it("carries /next RSN context into internal recommendation routes", () => {
    expect(recommendationHrefWithContext("/goals", { from: "next", rsn: " Lynx Titan " }))
      .toBe("/goals?rsn=Lynx+Titan&from=next");
    expect(recommendationHrefWithContext("/slayer?task=greater-demons", { from: "next", rsn: "Lynx Titan" }))
      .toBe("/slayer?task=greater-demons&rsn=Lynx+Titan&from=next");
    expect(recommendationHrefWithContext("/plugin", { from: "next", rsn: "Lynx Titan" }))
      .toBe("/plugin?rsn=Lynx+Titan&from=next#verify-sync");
    expect(recommendationHrefWithContext("/quests/animal-magnetism", {
      from: "next",
      rsn: "Lynx Titan",
      hasBankContext: false
    })).toBe("/quests/animal-magnetism?rsn=Lynx+Titan&from=next&bank=none");
  });

  it("sends retired tool routes straight to active /next intents", () => {
    expect(routeActionForHref("/gp", { from: "next", rsn: "Lynx Titan" })).toMatchObject({
      label: "Open cash route in /next",
      href: "/next?intent=cash&time=30&rsn=Lynx+Titan&from=next"
    });
    expect(routeActionForHref("/skills", { from: "next", rsn: "Lynx Titan", hasBankContext: false })).toMatchObject({
      label: "Open skill route in /next",
      href: "/next?intent=skill&time=60&rsn=Lynx+Titan&from=next&bank=none"
    });
    expect(routeActionForHref("/quests", { from: "next", rsn: "Lynx Titan" }).href)
      .toBe("/next?intent=quest&time=120&rsn=Lynx+Titan&from=next");
    expect(routeActionForHref("/diary", { from: "next", rsn: "Lynx Titan" }).href)
      .toBe("/next?intent=quest&time=60&rsn=Lynx+Titan&from=next");
  });

  it("marks recommendation routes as bankless when /next has no bank context", () => {
    expect(recommendationHrefWithContext("/goals", {
      from: "next",
      hasBankContext: false,
      rsn: "Lynx Titan"
    })).toBe("/goals?rsn=Lynx+Titan&from=next&bank=none");

    expect(recommendationHrefWithContext("/dps?boss=zulrah", {
      from: "next",
      hasBankContext: false,
      rsn: "Lynx Titan"
    })).toBe("/dps?boss=zulrah&rsn=Lynx+Titan&from=next&bank=none");
  });

  it("preserves existing route context instead of overwriting it", () => {
    expect(recommendationHrefWithContext("/slayer?rsn=Old+Name&from=bank", { from: "next", rsn: "Lynx Titan" }))
      .toBe("/slayer?rsn=Old+Name&from=bank");
    expect(recommendationHrefWithContext("/next?intent=cash&rsn=Old+Name", { from: "next", rsn: "Lynx Titan" }))
      .toBe("/next?intent=cash&rsn=Old+Name&from=next");
  });

  it("adds active RSN to boss DPS links from /next", () => {
    const action = primaryActionForRecommendation(rec({
      kind: "kc",
      bossSlug: "vardorvis",
      link: "/dps"
    }), { from: "next", rsn: "Lynx Titan" });

    expect(action.href).toBe("/dps?boss=vardorvis&from=next&rsn=Lynx+Titan");
  });

  it("URL-encodes boss deep-link slugs defensively", () => {
    const action = primaryActionForRecommendation(rec({
      kind: "boss",
      bossSlug: "king black dragon",
      link: "/dps"
    }));

    expect(action.href).toBe("/dps?boss=king%20black%20dragon&from=next");
  });

  it("falls back to OSRS Wiki guides when no internal route exists", () => {
    const action = primaryActionForRecommendation(rec({
      kind: "quest",
      title: "Dragon Slayer II"
    }));

    expect(action.label).toBe("Open quest guide");
    expect(action.external).toBe(true);
    expect(action.href).toContain("oldschool.runescape.wiki");
  });

  it("uses neutral wording for unknown step-by-step fallbacks", () => {
    const action = primaryActionForRecommendation(rec({
      kind: "other" as Recommendation["kind"],
      title: "Do a precise activity"
    }));

    expect(action.label).toBe("Show step-by-step guide");
    expect(action.label).not.toBe("Show exact steps");
  });
});
