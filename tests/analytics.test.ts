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
    track("plan:context_ready", { serverMs: 380, criticalMs: 340, optionalMs: 210, plannerMs: 24, timeoutCount: 0 });
    track("mood:changed", { mood: "chill", sessionMinutes: 45, source: "onboarding" });
    track("plan:first_rendered", recommendation);
    track("recommendation:impression", recommendation);
    track("recommendation:accepted", recommendation);
    track("trip:started", recommendation);
    track("trip:completed_manual", recommendation);

    expect(events.map((event) => event.event)).toEqual([
      "rsn:submitted",
      "plan:context_ready",
      "mood:changed",
      "plan:first_rendered",
      "recommendation:impression",
      "recommendation:accepted",
      "trip:started",
      "trip:completed_manual"
    ]);
    expect(JSON.stringify(events)).not.toMatch(/Lauky|claimToken|bankRows|payload/);
  });

  it("keeps source timing useful without accepting account data", () => {
    const envelope = validateAnalyticsEnvelope("plan:context_ready", {
      serverMs: 800,
      criticalMs: 760,
      optionalMs: 450,
      plannerMs: 32,
      timeoutCount: 2,
      rsn: "Lauky",
      bankRows: [995, 1_000_000]
    });

    expect(envelope?.props).toEqual({
      serverMs: 800,
      criticalMs: 760,
      optionalMs: 450,
      plannerMs: 32,
      timeoutCount: 2
    });
  });

  it("captures a returning RuneLite and timeline funnel", () => {
    const events: AnalyticsEnvelope[] = [];
    setAnalyticsTransport((event) => events.push(event));
    const recommendation = recommendationProps({ context: "bank_runelite" });

    track("return:visit", { hasBank: true, hasRunelite: true, hasTripHistory: true });
    track("timeline:viewed", { hasProgress: true, hasBankUpdate: true, hasRuneliteProgress: true, momentCount: 4 });
    track("reminder:created", { source: "return_recap", goalKind: "boss", delivery: "local" });
    track("reminder:opened", { source: "return_recap", goalKind: "boss" });
    track("reminder:cancelled", { source: "return_recap" });
    track("runelite:sync_success", { result: "found", fresh: true, bankReady: true, source: "saved" });
    track("recommendation:another", { ...recommendation, nextRouteFamily: "unlock" });
    track("recommendation:skipped", { ...recommendation, reason: "another_plan" });
    track("outcome:viewed", { status: "completed", evidenceType: "boss_kc_at_least" });
    track("boss:opened", { bossSlug: "vorkath", source: "next", hasBank: true });
    track("boss:loadout_used", { bossSlug: "vorkath", source: "next", hasBank: true, action: "copy_runelite_tab" });

    expect(events).toHaveLength(11);
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
