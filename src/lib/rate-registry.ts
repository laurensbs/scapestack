import type { PlannerAccountType } from "./account-type";
import type { Boss } from "./bosses";
import type { DpsBreakdown } from "./dps";

export type RateEvidence = "live-prices" | "measured" | "editorial";
export type RateFreshness = "fresh" | "stale" | "fallback";

export interface RateRange {
  low: number;
  expected: number;
  high: number;
}

export interface RateRecord {
  id: string;
  evidence: RateEvidence;
  unit: "gp-per-hour" | "gp-per-kill" | "kills-per-hour";
  sourceUrl: string;
  retrievedAt: string;
  staleAfterMs: number;
  assumptions: string[];
  inputs: Record<string, number | string | boolean | null>;
  range: RateRange;
  fallback: string;
}

export interface EvaluatedRate extends RateRecord {
  freshness: RateFreshness;
  ageMs: number;
  confidenceWeight: number;
}

export interface BossProfitEstimate {
  grossGpPerHour: EvaluatedRate;
  lootPerKill: EvaluatedRate;
  killsPerHour: EvaluatedRate;
  spendable: boolean;
  displayLabel: string;
  sourceLabel: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BOSS_RATE_AUDITED_AT = "2026-07-17T00:00:00.000Z";
const MONEY_RATE_AUDITED_AT = "2026-07-17T00:00:00.000Z";

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function orderedRange(low: number, expected: number, high: number): RateRange {
  const safeExpected = finiteNonNegative(expected);
  return {
    low: Math.min(finiteNonNegative(low), safeExpected),
    expected: safeExpected,
    high: Math.max(finiteNonNegative(high), safeExpected)
  };
}

export function evaluateRate(record: RateRecord, now = new Date()): EvaluatedRate {
  const retrievedAt = Date.parse(record.retrievedAt);
  const ageMs = Number.isFinite(retrievedAt) ? Math.max(0, now.getTime() - retrievedAt) : Infinity;
  const freshness: RateFreshness = !Number.isFinite(retrievedAt)
    ? "fallback"
    : ageMs > record.staleAfterMs
      ? "stale"
      : "fresh";
  const confidenceWeight = freshness === "fresh"
    ? record.evidence === "live-prices" ? 1 : record.evidence === "measured" ? 0.9 : 0.72
    : freshness === "stale"
      ? 0.38
      : 0.2;
  return { ...record, freshness, ageMs, confidenceWeight };
}

function bossWikiUrl(boss: Boss): string {
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent(boss.name.replace(/ /g, "_"))}`;
}

function isIron(accountType: PlannerAccountType | null | undefined): boolean {
  return accountType === "ironman" || accountType === "hardcore" || accountType === "ultimate";
}

export function bossProfitEstimate(
  boss: Boss,
  dps: DpsBreakdown,
  accountType: PlannerAccountType | null | undefined,
  now = new Date()
): BossProfitEstimate | null {
  if (!boss.avgLootGp || !boss.killsPerHourCap || dps.dps <= 0 || dps.ttk <= 0) return null;

  const mechanicalKills = Math.min(boss.killsPerHourCap, 3600 / dps.ttk);
  const expectedKills = Math.max(1, mechanicalKills * 0.78);
  const kills = evaluateRate({
    id: `boss:${boss.slug}:kills-per-hour`,
    evidence: "editorial",
    unit: "kills-per-hour",
    sourceUrl: bossWikiUrl(boss),
    retrievedAt: BOSS_RATE_AUDITED_AT,
    staleAfterMs: 30 * DAY_MS,
    assumptions: [
      "Solo encounter with the selected bank setup",
      "Includes movement, banking and mechanics rather than uninterrupted attacking",
      `Never exceeds the curated ${boss.killsPerHourCap} kills/hour encounter ceiling`
    ],
    inputs: {
      modelledTtkSeconds: Math.round(dps.ttk * 10) / 10,
      mechanicalKillsPerHour: Math.round(mechanicalKills * 10) / 10,
      encounterCap: boss.killsPerHourCap,
      uptimeAssumption: 0.78
    },
    range: orderedRange(expectedKills * 0.8, expectedKills, Math.min(boss.killsPerHourCap, expectedKills * 1.15)),
    fallback: "Show one-trip advice without an hourly rate."
  }, now);

  const loot = evaluateRate({
    id: `boss:${boss.slug}:loot-per-kill`,
    evidence: "editorial",
    unit: "gp-per-kill",
    sourceUrl: bossWikiUrl(boss),
    retrievedAt: BOSS_RATE_AUDITED_AT,
    staleAfterMs: 14 * DAY_MS,
    assumptions: [
      "Long-run average including rare drops",
      "Gross trade value before food, charges, deaths and GE tax",
      "Actual short trips can land far outside this range"
    ],
    inputs: { curatedAverageLootGp: boss.avgLootGp },
    range: orderedRange(boss.avgLootGp * 0.78, boss.avgLootGp, boss.avgLootGp * 1.22),
    fallback: "Hide profit and keep the boss as a gear or learning recommendation."
  }, now);

  const gross = evaluateRate({
    id: `boss:${boss.slug}:gross-gp-per-hour`,
    evidence: "editorial",
    unit: "gp-per-hour",
    sourceUrl: loot.sourceUrl,
    retrievedAt: loot.retrievedAt,
    staleAfterMs: Math.min(loot.staleAfterMs, kills.staleAfterMs),
    assumptions: [...loot.assumptions, ...kills.assumptions],
    inputs: {
      expectedLootPerKill: loot.range.expected,
      expectedKillsPerHour: kills.range.expected,
      supplyCostsIncluded: false
    },
    range: orderedRange(
      loot.range.low * kills.range.low,
      loot.range.expected * kills.range.expected,
      loot.range.high * kills.range.high
    ),
    fallback: "Hide GP/hour and recommend a single test trip."
  }, now);

  const spendable = !isIron(accountType);
  return {
    grossGpPerHour: gross,
    lootPerKill: loot,
    killsPerHour: kills,
    spendable,
    displayLabel: spendable ? "Estimated gross value" : "Estimated loot value",
    sourceLabel: gross.freshness === "fresh" ? "Wiki guide checked Jul 17" : "Older Wiki estimate"
  };
}

export function moneyMethodRate(input: {
  slug: string;
  expectedGpPerHour: number;
  assumptions: string[];
  now?: Date;
}): EvaluatedRate {
  const expected = finiteNonNegative(input.expectedGpPerHour);
  return evaluateRate({
    id: `money:${input.slug}:gp-per-hour`,
    evidence: "editorial",
    unit: "gp-per-hour",
    sourceUrl: "https://oldschool.runescape.wiki/w/Money_making_guide",
    retrievedAt: MONEY_RATE_AUDITED_AT,
    staleAfterMs: 14 * DAY_MS,
    assumptions: input.assumptions,
    inputs: { curatedExpectedGpPerHour: expected, liveItemRecalculationAvailable: false },
    range: orderedRange(expected * 0.72, expected, expected * 1.28),
    fallback: "Keep the method as an activity suggestion without a profit promise."
  }, input.now);
}

export function rateRankingValue(rate: EvaluatedRate | null, accountType?: PlannerAccountType | null): number {
  if (!rate || isIron(accountType)) return 0;
  return rate.range.expected * rate.confidenceWeight;
}

export function formatRateRange(range: RateRange, formatter: (value: number) => string): string {
  return `${formatter(Math.round(range.low))}-${formatter(Math.round(range.high))}`;
}
