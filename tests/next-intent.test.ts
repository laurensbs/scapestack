import { describe, expect, it } from "vitest";
import { legacyRouteNextHref, nextIntentFromSearch } from "@/lib/next-intent";

describe("/next route intent", () => {
  it("maps old tool routes to intent-aware next URLs", () => {
    expect(legacyRouteNextHref("gp")).toBe("/next?intent=cash&time=30");
    expect(legacyRouteNextHref("ge")).toBe("/next?intent=cash&time=15");
    expect(legacyRouteNextHref("quests")).toBe("/next?intent=quest&time=120");
    expect(legacyRouteNextHref("diary")).toBe("/next?intent=quest&time=60");
    expect(legacyRouteNextHref("skills")).toBe("/next?intent=skill&time=60");
  });

  it("parses cash, quest and skilling intents into mood presets", () => {
    expect(nextIntentFromSearch("?intent=cash&time=15")).toMatchObject({
      intent: "cash",
      mood: "cash",
      minutes: 15,
      label: "Cash route"
    });
    expect(nextIntentFromSearch("from=diary")).toMatchObject({
      intent: "quest",
      mood: "quest",
      label: "Quest route"
    });
    expect(nextIntentFromSearch("mood=skills")).toMatchObject({
      intent: "skill",
      mood: "chill",
      label: "Skill route"
    });
    expect(nextIntentFromSearch("from=profile&rsn=Lynx+Titan")).toMatchObject({
      intent: "profile",
      mood: "focused",
      label: "Profile Hiscores route",
      helper: "Started from this RSN's Hiscores; add bank for gear and RuneLite sync when you need verified quest, diary, collection-log or Slayer coverage."
    });
    expect(nextIntentFromSearch("from=profile&rsn=Lynx+Titan")?.helper).not.toContain("exact quest");
  });

  it("ignores unknown intent and invalid time budgets", () => {
    expect(nextIntentFromSearch("?intent=marketing")).toBeNull();
    expect(nextIntentFromSearch("?intent=cash&time=999")).toMatchObject({
      intent: "cash",
      minutes: 30
    });
  });
});
