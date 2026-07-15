import { afterEach, describe, expect, it } from "vitest";
import {
  resetAnalyticsState,
  setAnalyticsTransport,
  track,
  validateAnalyticsEnvelope,
  type AnalyticsEnvelope
} from "@/lib/analytics";

afterEach(resetAnalyticsState);

describe("privacy-safe analytics contract", () => {
  it("removes RSNs, bank rows, payloads, tokens and unknown fields", () => {
    const envelope = validateAnalyticsEnvelope("rsn:submitted", {
      source: "homepage",
      context: "public_stats",
      hasBank: false,
      sample: false,
      rsn: "Lauky",
      bankRows: "995 Coins 1000000",
      payload: { quests: [] },
      claimToken: "secret"
    });

    expect(envelope).toEqual({
      event: "rsn:submitted",
      props: {
        source: "homepage",
        context: "public_stats",
        hasBank: false,
        sample: false
      }
    });
  });

  it("rejects unknown events and non-primitive values", () => {
    expect(validateAnalyticsEnvelope("account:dump", { rsn: "Lauky" })).toBeNull();
    expect(validateAnalyticsEnvelope("bank:attached", { source: "next" })).toBeNull();
    expect(validateAnalyticsEnvelope("bank:attached", { source: "Lauky", linkedToAccount: true })).toBeNull();
    expect(validateAnalyticsEnvelope("bank:attached", {
      source: "next",
      linkedToAccount: true,
      extra: [1, 2, 3]
    })?.props).toEqual({ source: "next", linkedToAccount: true });
  });

  it("deduplicates recommendation impressions without suppressing deliberate new ones", () => {
    const events: AnalyticsEnvelope[] = [];
    setAnalyticsTransport((event) => events.push(event));
    const props = recommendationProps();

    track("recommendation:impression", props, { dedupeKey: "rec-1:chill:0" });
    track("recommendation:impression", props, { dedupeKey: "rec-1:chill:0" });
    track("recommendation:impression", { ...props, mood: "gp" }, { dedupeKey: "rec-1:gp:0" });

    expect(events.map((event) => event.event)).toEqual([
      "recommendation:impression",
      "recommendation:impression"
    ]);
  });

  it("never lets a transport failure break the player action", () => {
    setAnalyticsTransport(() => { throw new Error("vendor down"); });
    expect(() => track("bank:attached", { source: "next", linkedToAccount: true })).not.toThrow();
  });

  it("captures the complete first-run decision funnel", () => {
    const events: AnalyticsEnvelope[] = [];
    setAnalyticsTransport((event) => events.push(event));
    const recommendation = recommendationProps();

    track("rsn:submitted", { source: "homepage", context: "public_stats", hasBank: false, sample: false });
    track("mood:changed", { mood: "chill", sessionMinutes: 45, source: "onboarding" });
    track("plan:first_rendered", recommendation);
    track("recommendation:impression", recommendation);
    track("recommendation:accepted", recommendation);
    track("trip:started", recommendation);
    track("trip:completed_manual", recommendation);

    expect(events.map((event) => event.event)).toEqual([
      "rsn:submitted",
      "mood:changed",
      "plan:first_rendered",
      "recommendation:impression",
      "recommendation:accepted",
      "trip:started",
      "trip:completed_manual"
    ]);
    expect(JSON.stringify(events)).not.toMatch(/Lauky|claimToken|bankRows|payload/);
  });

  it("captures a returning RuneLite and recap funnel", () => {
    const events: AnalyticsEnvelope[] = [];
    setAnalyticsTransport((event) => events.push(event));
    const recommendation = recommendationProps({ context: "bank_runelite" });

    track("return:visit", { hasBank: true, hasRunelite: true, hasTripHistory: true });
    track("recap:viewed", { hasProgress: true, hasBankUpdate: true, hasRuneliteProgress: true, period: "week" });
    track("runelite:sync_success", { result: "found", fresh: true, bankReady: true, source: "saved" });
    track("recommendation:another", { ...recommendation, nextRouteFamily: "unlock" });
    track("recommendation:skipped", { ...recommendation, reason: "another_plan" });
    track("trip:completed_sync", { ...recommendation, evidence: "runelite_progress" });
    track("boss:opened", { bossSlug: "vorkath", source: "next", hasBank: true });
    track("boss:loadout_used", { bossSlug: "vorkath", source: "next", hasBank: true, action: "copy_runelite_tab" });

    expect(events).toHaveLength(8);
    expect(events.every((event) => !Object.keys(event.props).some((key) => /rsn|bankRows|token|payload/i.test(key)))).toBe(true);
  });
});

function recommendationProps(overrides: Record<string, unknown> = {}) {
  return {
    recommendationId: "boss:vorkath:50kc",
    recommendationKind: "boss",
    routeFamily: "smart",
    mood: "chill",
    accountStage: "midgame",
    context: "public_stats" as const,
    sessionMinutes: 45,
    elapsedMs: 320,
    ...overrides
  };
}
