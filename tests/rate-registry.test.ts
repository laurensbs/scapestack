import { afterEach, describe, expect, it, vi } from "vitest";
import { BOSSES } from "@/lib/bosses";
import type { DpsBreakdown } from "@/lib/dps";
import type { GearItem } from "@/lib/gear";
import {
  bossProfitEstimate,
  evaluateRate,
  moneyMethodRate,
  rateRankingValue,
  type RateRecord
} from "@/lib/rate-registry";

const weapon = { id: 1, name: "Test weapon" } as GearItem;
const dps: DpsBreakdown = {
  style: "ranged",
  weapon,
  maxHit: 40,
  hitChance: 0.8,
  dps: 8,
  ttk: 90,
  setup: { weapon },
  gearScore: 100
};

function record(retrievedAt: string): RateRecord {
  return {
    id: "test-rate",
    evidence: "editorial",
    unit: "gp-per-hour",
    sourceUrl: "https://oldschool.runescape.wiki/w/Money_making_guide",
    retrievedAt,
    staleAfterMs: 24 * 60 * 60 * 1000,
    assumptions: ["One test assumption"],
    inputs: { expected: 100 },
    range: { low: 80, expected: 100, high: 120 },
    fallback: "Hide the rate."
  };
}

describe("rate registry", () => {
  it("uses an injected fixed clock for freshness boundaries", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    expect(evaluateRate(record("2026-07-17T00:00:00.000Z"), now).freshness).toBe("fresh");
    expect(evaluateRate(record("2026-07-15T00:00:00.000Z"), now).freshness).toBe("stale");
    expect(evaluateRate(record("not-a-date"), now).freshness).toBe("fallback");
  });

  it("builds a range from boss pace instead of a precise GP/hour claim", () => {
    const boss = BOSSES.find((entry) => entry.slug === "vorkath");
    expect(boss).toBeDefined();
    const estimate = bossProfitEstimate(boss!, dps, null, new Date("2026-07-17T12:00:00.000Z"));
    expect(estimate).not.toBeNull();
    expect(estimate!.grossGpPerHour.range.low).toBeLessThan(estimate!.grossGpPerHour.range.expected);
    expect(estimate!.grossGpPerHour.range.high).toBeGreaterThan(estimate!.grossGpPerHour.range.expected);
    expect(estimate!.grossGpPerHour.inputs.supplyCostsIncluded).toBe(false);
    expect(estimate!.grossGpPerHour.sourceUrl).toContain("oldschool.runescape.wiki");
  });

  it("never treats ironman loot value as spendable GP ranking", () => {
    const boss = BOSSES.find((entry) => entry.slug === "vorkath")!;
    const estimate = bossProfitEstimate(boss, dps, "ironman", new Date("2026-07-17T12:00:00.000Z"));
    expect(estimate?.spendable).toBe(false);
    expect(rateRankingValue(estimate!.grossGpPerHour, "ironman")).toBe(0);
    expect(rateRankingValue(estimate!.grossGpPerHour, null)).toBeGreaterThan(0);
  });

  it("demotes stale editorial money rates", () => {
    const fresh = moneyMethodRate({ slug: "test", expectedGpPerHour: 1_000_000, assumptions: [], now: new Date("2026-07-17T12:00:00.000Z") });
    const stale = moneyMethodRate({ slug: "test", expectedGpPerHour: 1_000_000, assumptions: [], now: new Date("2026-08-17T12:00:00.000Z") });
    expect(fresh.freshness).toBe("fresh");
    expect(stale.freshness).toBe("stale");
    expect(rateRankingValue(stale)).toBeLessThan(rateRankingValue(fresh));
  });
});

describe("price snapshot fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns an unavailable empty snapshot instead of crashing when Wiki prices fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.resetModules();
    const { getPriceSnapshot } = await import("@/lib/prices");
    await expect(getPriceSnapshot(Date.parse("2026-07-17T12:00:00.000Z"))).resolves.toMatchObject({
      freshness: "unavailable",
      fallbackUsed: true,
      retrievedAt: null
    });
  });
});
