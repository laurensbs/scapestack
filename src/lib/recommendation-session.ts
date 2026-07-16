import type {
  RecKind,
  Recommendation,
  RecommendationGearConfidence
} from "./next-up";

export type SessionIntensity = "low" | "moderate" | "high" | "extreme";
export type SessionAttention = "afk" | "low" | "active" | "focused";
export type SessionCost = "none" | "low" | "moderate" | "high";
export type SessionSetupConfidence = "verified" | "guided" | "unknown" | "not-needed";
export type SessionProfitEvidence = "account" | "catalogue" | "none";
export type SessionPrerequisiteDepth = "none" | "short" | "long";

/** Internal planning dimensions. These are ranking facts, not player-facing UI. */
export interface RecommendationSessionProfile {
  intensity: SessionIntensity;
  attention: SessionAttention;
  setupMinutes: number;
  minimumMinutes: number;
  idleWindowSeconds: number;
  resetCost: SessionCost;
  wilderness: boolean;
  raid: boolean;
  deathCost: SessionCost;
  setupConfidence: SessionSetupConfidence;
  expectedProfit: "positive" | "unknown" | "none";
  profitEvidence: SessionProfitEvidence;
  unlockValue: number;
  prerequisiteDepth: SessionPrerequisiteDepth;
}

const RAID_SLUGS = new Set(["cox", "tob", "toa"]);
const WILDERNESS_SLUGS = new Set([
  "callisto",
  "venenatis",
  "vetion",
  "calvarion",
  "spindel",
  "artio",
  "scorpia",
  "chaos-elemental",
  "chaos-fanatic",
  "crazy-archaeologist",
  "king-black-dragon"
]);

const KIND_DEFAULTS: Record<RecKind, RecommendationSessionProfile> = {
  goal: profile("moderate", "active", 8, 30, "moderate", 0.82),
  quest: profile("moderate", "focused", 10, 60, "moderate", 0.88),
  diary: profile("moderate", "active", 8, 45, "moderate", 0.86),
  boss: profile("high", "focused", 12, 45, "high", 0.42, "unknown", "moderate"),
  kc: profile("high", "focused", 10, 45, "moderate", 0.48, "unknown", "moderate"),
  minigame: profile("moderate", "active", 5, 20, "low", 0.64),
  money: profile("moderate", "active", 5, 20, "low", 0.58),
  slayer: profile("moderate", "active", 5, 15, "low", 0.7, "guided", "low"),
  skill: profile("low", "active", 5, 30, "low", 0.68),
  bank: profile("low", "low", 2, 5, "low", 0.2),
  milestone: profile("low", "active", 5, 30, "low", 0.76)
};

function profile(
  intensity: SessionIntensity,
  attention: SessionAttention,
  setupMinutes: number,
  minimumMinutes: number,
  resetCost: SessionCost,
  unlockValue: number,
  setupConfidence: SessionSetupConfidence = "not-needed",
  deathCost: SessionCost = "none"
): RecommendationSessionProfile {
  return {
    intensity,
    attention,
    setupMinutes,
    minimumMinutes,
    idleWindowSeconds: 0,
    resetCost,
    wilderness: false,
    raid: false,
    deathCost,
    setupConfidence,
    expectedProfit: "none",
    profitEvidence: "none",
    unlockValue,
    prerequisiteDepth: "none"
  };
}

function setupConfidence(value: RecommendationGearConfidence | undefined, kind: RecKind): SessionSetupConfidence {
  if (value === "confirmed") return "verified";
  if (value === "likely") return "guided";
  if (value === "not-needed") return "not-needed";
  if (value === "unknown") return "unknown";
  return kind === "boss" || kind === "kc" ? "unknown" : "not-needed";
}

function minimumMinutesFromTimebox(value: string | undefined): number | null {
  if (!value) return null;
  const text = value.toLowerCase();
  if (text.includes("long-term")) return 180;
  if (text.includes("session")) {
    const sessions = Number(text.match(/\d+/)?.[0] ?? 1);
    return Math.max(45, sessions * 45);
  }
  const first = Number(text.match(/\d+/)?.[0]);
  if (!Number.isFinite(first) || first <= 0) return null;
  return /\bhr\b|hour/.test(text) ? first * 60 : first;
}

function prerequisiteDepth(text: string, rec: Recommendation): SessionPrerequisiteDepth {
  const extra = Number(text.match(/\(\+(\d+) more\)/)?.[1] ?? 0);
  if (extra >= 5 || /long prereq|very long|grandmaster/.test(text) || (rec.quality?.friction ?? 0) >= 0.7) {
    return "long";
  }
  if (extra > 0 || /prereq|requirement|needs:/.test(text) || (rec.quality?.friction ?? 0) >= 0.4) {
    return "short";
  }
  return "none";
}

function inferredRisk(rec: Recommendation, text: string): Pick<RecommendationSessionProfile, "raid" | "wilderness"> {
  const slug = rec.bossSlug?.toLowerCase();
  return {
    raid: Boolean(slug && RAID_SLUGS.has(slug)) || /chambers of xeric|theatre of blood|tombs of amascut|\braid\b/.test(text),
    wilderness: Boolean(slug && WILDERNESS_SLUGS.has(slug)) || /\bwilderness\b|\bwildy\b|callisto|venenatis|vet'ion|vetion|calvar'ion|calvarion|spindel|artio|scorpia/.test(text)
  };
}

/** Produces a complete profile even while generators migrate to explicit overrides. */
export function recommendationSessionProfile(rec: Recommendation): RecommendationSessionProfile {
  const defaults = KIND_DEFAULTS[rec.kind];
  const text = `${rec.id} ${rec.title} ${rec.why} ${rec.payoff ?? ""} ${rec.decisionReason ?? ""} ${rec.actionPlan?.timebox ?? ""} ${rec.planSeed?.timebox ?? ""}`.toLowerCase();
  const activityText = `${rec.id} ${rec.title}`.toLowerCase();
  const risk = inferredRisk(rec, text);
  const taggedAfk = rec.routeTags?.includes("afk") ?? false;
  const explicitAfk = taggedAfk || /birdhouse|redwood|motherlode|karambwan|amethyst/.test(activityText);
  const timebox = rec.actionPlan?.timebox ?? rec.planSeed?.timebox;
  const minimumMinutes = /birdhouse|herb run|herbs \+ birdhouses/.test(text)
    ? 10
    : minimumMinutesFromTimebox(timebox) ?? defaults.minimumMinutes;
  const profit = rec.kind === "money" || rec.routeTags?.includes("gp") || /gp\/hr|average loot|profit/.test(text);
  const intense = /\bintense\b|inferno|vardorvis|colosseum/.test(text);
  const longPrerequisites = prerequisiteDepth(text, rec);
  const base: RecommendationSessionProfile = {
    ...defaults,
    intensity: risk.raid ? "extreme" : intense ? "high" : explicitAfk ? "low" : defaults.intensity,
    attention: explicitAfk ? "afk" : defaults.attention,
    idleWindowSeconds: explicitAfk ? (/birdhouse|herb/.test(text) ? 600 : 20) : 0,
    minimumMinutes,
    resetCost: risk.raid || longPrerequisites === "long" ? "high" : defaults.resetCost,
    wilderness: risk.wilderness,
    raid: risk.raid,
    deathCost: risk.wilderness ? "high" : risk.raid ? "moderate" : defaults.deathCost,
    setupConfidence: setupConfidence(rec.gearConfidence, rec.kind),
    expectedProfit: profit ? "positive" : rec.kind === "boss" || rec.kind === "kc" ? "unknown" : "none",
    profitEvidence: profit ? "catalogue" : "none",
    unlockValue: rec.quality?.unlockValue ?? defaults.unlockValue,
    prerequisiteDepth: longPrerequisites
  };

  return { ...base, ...rec.sessionProfile };
}
