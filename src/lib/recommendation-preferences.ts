import type { Recommendation, RecKind } from "./next-up";
import type { RecommendationFeedback, RecommendationMemoryAction } from "./recommendation-feedback";
import { recommendationSessionProfile } from "./recommendation-session";

export type RecommendationPreferenceFamily =
  | "bank"
  | "bossing"
  | "minigame"
  | "money"
  | "skilling"
  | "slayer"
  | "unlock";

export interface RecommendationPreferenceProfile {
  familyScores: Record<RecommendationPreferenceFamily, number>;
  attentionScores: Record<"low-pressure" | "active", number>;
  timeboxScores: Record<"short" | "standard" | "long", number>;
  wildernessScore: number;
  evidenceCount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_FAMILY_SCORES: Record<RecommendationPreferenceFamily, number> = {
  bank: 0,
  bossing: 0,
  minigame: 0,
  money: 0,
  skilling: 0,
  slayer: 0,
  unlock: 0
};

function familyForKind(kind: string): RecommendationPreferenceFamily | null {
  if (kind === "boss" || kind === "kc") return "bossing";
  if (kind === "goal" || kind === "quest" || kind === "diary" || kind === "milestone") return "unlock";
  if (kind === "skill") return "skilling";
  if (kind === "bank" || kind === "minigame" || kind === "money" || kind === "slayer") return kind;
  return null;
}

function actionScore(action: RecommendationMemoryAction): number {
  if (action === "completed_runelite") return 1;
  if (action === "completed_manual") return 0.8;
  if (action === "started") return 0.2;
  if (action === "not_my_style") return -0.85;
  if (action === "too_boring") return -0.6;
  if (action === "too_hard") return -0.4;
  if (action === "not_today") return -0.15;
  if (action === "try_another") return -0.08;
  return 0;
}

function halfLifeDays(action: RecommendationMemoryAction): number {
  return action === "completed_runelite" || action === "completed_manual" ? 21 : 10;
}

function decay(action: RecommendationMemoryAction, ageMs: number): number {
  return Math.pow(0.5, Math.max(0, ageMs) / (halfLifeDays(action) * DAY_MS));
}

function accountKey(rsn?: string): string | undefined {
  const value = rsn?.trim().toLowerCase().replace(/\s+/g, " ");
  return value || undefined;
}

function timeboxBucket(minutes: number | undefined): "short" | "standard" | "long" | null {
  if (!minutes || !Number.isFinite(minutes)) return null;
  if (minutes <= 30) return "short";
  if (minutes >= 120) return "long";
  return "standard";
}

function pressureBucket(attention: string | undefined): "low-pressure" | "active" | null {
  if (attention === "afk" || attention === "low") return "low-pressure";
  if (attention === "active" || attention === "focused") return "active";
  return null;
}

function clampScore(value: number): number {
  return Math.max(-2, Math.min(2, value));
}

/** Builds a small, decaying taste model. It is deliberately bounded: account
 * facts and the current mood remain more important than historical clicks. */
export function buildRecommendationPreferenceProfile(
  feedback: RecommendationFeedback,
  options: { rsn?: string; now?: number } = {}
): RecommendationPreferenceProfile {
  const rsnKey = accountKey(options.rsn);
  const now = options.now ?? Date.now();
  const familyScores = { ...EMPTY_FAMILY_SCORES };
  const attentionScores = { "low-pressure": 0, active: 0 };
  const timeboxScores = { short: 0, standard: 0, long: 0 };
  let wildernessScore = 0;
  let evidenceCount = 0;

  for (const entry of feedback.recent) {
    if (rsnKey ? entry.rsnKey !== rsnKey : Boolean(entry.rsnKey)) continue;
    const base = actionScore(entry.action);
    const family = familyForKind(entry.kind);
    if (!family || base === 0) continue;
    const weighted = base * decay(entry.action, now - entry.savedAt);
    familyScores[family] += weighted;
    const pressure = pressureBucket(entry.attention);
    if (pressure) attentionScores[pressure] += weighted;
    const timebox = timeboxBucket(entry.minutes);
    if (timebox) timeboxScores[timebox] += weighted;
    if (entry.wilderness) wildernessScore += weighted;
    evidenceCount += 1;
  }

  for (const family of Object.keys(familyScores) as RecommendationPreferenceFamily[]) {
    familyScores[family] = clampScore(familyScores[family]);
  }
  attentionScores["low-pressure"] = clampScore(attentionScores["low-pressure"]);
  attentionScores.active = clampScore(attentionScores.active);
  timeboxScores.short = clampScore(timeboxScores.short);
  timeboxScores.standard = clampScore(timeboxScores.standard);
  timeboxScores.long = clampScore(timeboxScores.long);

  return {
    familyScores,
    attentionScores,
    timeboxScores,
    wildernessScore: clampScore(wildernessScore),
    evidenceCount
  };
}

export function recommendationPreferenceMultiplier(
  profile: RecommendationPreferenceProfile | undefined,
  rec: Recommendation,
  minutes: number
): number {
  if (!profile || profile.evidenceCount === 0) return 1;
  const family = familyForKind(rec.kind as RecKind);
  if (!family) return 1;
  const session = recommendationSessionProfile(rec);
  const pressure = pressureBucket(session.attention);
  const timebox = timeboxBucket(minutes);
  let multiplier = 1 + profile.familyScores[family] * 0.07;
  if (pressure) multiplier *= 1 + profile.attentionScores[pressure] * 0.02;
  if (timebox) multiplier *= 1 + profile.timeboxScores[timebox] * 0.015;
  if (session.wilderness) multiplier *= 1 + profile.wildernessScore * 0.025;
  return Math.max(0.8, Math.min(1.2, multiplier));
}

export function recommendationPreferenceContext(rec: Recommendation, minutes: number) {
  const session = recommendationSessionProfile(rec);
  return {
    minutes,
    attention: session.attention,
    wilderness: session.wilderness
  } as const;
}
