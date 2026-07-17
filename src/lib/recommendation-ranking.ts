import type { Recommendation, RecKind } from "./next-up";
import type { RecommendationSessionProfile } from "./recommendation-session";

export type RankingDimension =
  | "usefulness"
  | "fit"
  | "commitment"
  | "friction"
  | "opportunity-cost"
  | "preference"
  | "trust";

export type RankingRuleCode =
  | "base_usefulness"
  | "mood_route_fit"
  | "session_time_fit"
  | "active_slayer_task"
  | "near_meaningful_unlock"
  | "established_boss_commitment"
  | "bank_supported_short_win"
  | "accepted_route_progress"
  | "scout_kc"
  | "long_prerequisite_chain"
  | "wilderness_without_intent"
  | "distant_maxing_lane"
  | "uncertain_gear_gate"
  | "setup_friction"
  | "risk_friction"
  | "learned_preference"
  | "account_evidence"
  | "session_novelty"
  | "recent_rejection";

export interface RankingContribution {
  code: RankingRuleCode;
  dimension: RankingDimension;
  points: number;
  detail: string;
}

export interface RecommendationRankingCandidateInput {
  rec: Recommendation;
  profile: RecommendationSessionProfile;
  hardViolations: string[];
  kindFit: number;
  timeFit: number;
  accountFit: number;
  noveltyFit: number;
  preferenceFit: number;
  honestyFit: number;
  recentlyRejected: boolean;
  acceptedRoute: boolean;
}

export interface RecommendationRankingContext {
  mood: string;
  routeLens: string;
  minutes: number;
  hasBank: boolean;
  seed?: string | number;
}

export interface RecommendationRankingCandidateTrace {
  id: string;
  kind: RecKind;
  family: string;
  eligible: boolean;
  hardViolations: string[];
  score: number | null;
  rank: number | null;
  contributions: RankingContribution[];
}

export interface RankedRecommendationCandidate {
  rec: Recommendation;
  score: number;
  family: string;
  contributions: RankingContribution[];
}

export interface RecommendationRankingTrace {
  version: 1;
  generatedCount: number;
  eligibleCount: number;
  context: Pick<RecommendationRankingContext, "mood" | "routeLens" | "minutes">;
  candidates: RecommendationRankingCandidateTrace[];
  winner: {
    id: string;
    score: number;
    strongestReasons: RankingRuleCode[];
  };
  runnerUp: {
    id: string;
    score: number;
    lostBy: number;
    lostBecause: RankingRuleCode[];
  } | null;
  alternatives: Array<{ id: string; family: string }>;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const round = (value: number): number => Math.round(value * 10) / 10;

function recommendationText(rec: Recommendation): string {
  return `${rec.id} ${rec.title} ${rec.why} ${rec.payoff ?? ""} ${rec.decisionReason ?? ""}`.toLowerCase();
}

function isNearMeaningfulUnlock(rec: Recommendation, profile: RecommendationSessionProfile): boolean {
  if (profile.unlockValue < 0.72 || profile.prerequisiteDepth === "long") return false;
  return rec.kind === "goal"
    || rec.kind === "diary"
    || rec.kind === "quest"
    || rec.kind === "milestone"
    || Boolean(rec.routeTags?.includes("unlock"));
}

function isDistantMaxingLane(rec: Recommendation, profile: RecommendationSessionProfile): boolean {
  if (!rec.routeTags?.includes("maxing") && !/\b99\b|maxing lane|skill cape/.test(recommendationText(rec))) return false;
  const text = recommendationText(rec);
  const close = /\b[1-3] levels?\b|one level|next level|close|nearly|almost|xp left: [0-9]{1,6}\b/.test(text);
  return !close && profile.minimumMinutes >= 30;
}

function contribution(
  code: RankingRuleCode,
  dimension: RankingDimension,
  points: number,
  detail: string
): RankingContribution | null {
  const bounded = round(points);
  return Math.abs(bounded) < 0.1 ? null : { code, dimension, points: bounded, detail };
}

function scoreCandidate(
  input: RecommendationRankingCandidateInput,
  context: RecommendationRankingContext
): RankingContribution[] {
  const { rec, profile } = input;
  const entries: Array<RankingContribution | null> = [];
  const baseUsefulness = clamp(rec.score, 0, 120);
  entries.push(contribution("base_usefulness", "usefulness", baseUsefulness, "Candidate usefulness before session context."));
  entries.push(contribution(
    "mood_route_fit",
    "fit",
    clamp((input.kindFit - 1) * 40, -34, 84),
    "How well the activity family matches the selected mood and route."
  ));
  entries.push(contribution(
    "session_time_fit",
    "fit",
    clamp((input.timeFit - 1) * 22, -18, 9),
    "How cleanly the activity fits the available session."
  ));

  if (rec.kind === "slayer" && Boolean(rec.slayerDecision)) {
    entries.push(contribution("active_slayer_task", "commitment", 34, "An active task is already accepted account progress."));
  }
  if (isNearMeaningfulUnlock(rec, profile)) {
    entries.push(contribution("near_meaningful_unlock", "usefulness", 14, "A meaningful unlock is close enough to act on now."));
  }
  const kc = rec.kcMeta?.kc;
  if ((rec.kind === "kc" || rec.kind === "boss") && typeof kc === "number" && kc >= 15) {
    entries.push(contribution(
      "established_boss_commitment",
      "commitment",
      kc >= 50 ? 14 : 10,
      "Existing KC shows this is a real route, not a one-off scout."
    ));
  }
  if (context.hasBank && profile.minimumMinutes <= 30 && profile.setupConfidence !== "unknown") {
    entries.push(contribution("bank_supported_short_win", "usefulness", 9, "The bank supports a bounded action with a clean stop."));
  }
  if (input.acceptedRoute) {
    entries.push(contribution("accepted_route_progress", "commitment", 32, "The player already started this unfinished route."));
  }
  if (rec.kind === "kc" && typeof kc === "number" && kc > 0 && kc < 5) {
    entries.push(contribution("scout_kc", "commitment", -24, "One to four KC is scouting evidence, not commitment."));
  }
  if (profile.prerequisiteDepth === "long") {
    entries.push(contribution(
      "long_prerequisite_chain",
      "opportunity-cost",
      context.minutes <= 30 ? -28 : -12,
      "Prerequisites consume too much of this session before progress starts."
    ));
  }
  if (profile.wilderness && (context.mood !== "bossing" && context.mood !== "cash" || profile.setupConfidence !== "verified")) {
    entries.push(contribution("wilderness_without_intent", "opportunity-cost", -24, "Wilderness risk lacks explicit intent or a verified setup."));
  }
  if (isDistantMaxingLane(rec, profile)) {
    entries.push(contribution("distant_maxing_lane", "opportunity-cost", -16, "The maxing lane is far from a useful stop point."));
  }
  if ((rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer") && profile.setupConfidence === "unknown") {
    entries.push(contribution("uncertain_gear_gate", "opportunity-cost", -22, "Unknown gear can invalidate the whole trip."));
  } else if ((rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer") && profile.setupConfidence === "guided") {
    entries.push(contribution("uncertain_gear_gate", "opportunity-cost", -3, "The trip still needs a setup check."));
  }

  entries.push(contribution("setup_friction", "friction", -clamp(profile.setupMinutes * 0.55, 0, 10), "Time spent preparing before useful progress."));
  const rawRiskPenalty = (profile.resetCost === "high" ? 6 : profile.resetCost === "moderate" ? 3 : 0)
    + (profile.deathCost === "high" ? 6 : profile.deathCost === "moderate" ? 3 : 0);
  const riskPenalty = profile.wilderness || profile.raid ? rawRiskPenalty : Math.min(4, rawRiskPenalty);
  entries.push(contribution("risk_friction", "friction", -riskPenalty, "Reset and death cost make a failed session more expensive."));
  entries.push(contribution(
    "learned_preference",
    "preference",
    clamp((input.preferenceFit - 1) * 70, -12, 12),
    "A small bounded adjustment from explicit previous choices."
  ));
  entries.push(contribution(
    "account_evidence",
    "trust",
    clamp((input.honestyFit - 1) * 38, -13, 3),
    "Whether account progress and setup evidence support the claim."
  ));
  entries.push(contribution(
    "session_novelty",
    "preference",
    clamp((input.noveltyFit - 1) * 32, -30, 0),
    "Recently skipped or repeated routes should not immediately return."
  ));
  if (input.recentlyRejected) {
    entries.push(contribution("recent_rejection", "preference", -36, "This exact route was recently rejected."));
  }
  if (input.accountFit < 1) {
    entries.push(contribution("scout_kc", "commitment", clamp((input.accountFit - 1) * 24, -20, 0), "Account history is too thin for headline confidence."));
  }

  return entries.filter((entry): entry is RankingContribution => entry !== null);
}

function seededRank(seed: string | number | undefined, id: string): number {
  const input = `${seed ?? "scapestack"}:${id}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function rankRecommendationCandidates(
  inputs: RecommendationRankingCandidateInput[],
  context: RecommendationRankingContext,
  familyFor: (rec: Recommendation) => string
): { ranked: RankedRecommendationCandidate[]; traces: RecommendationRankingCandidateTrace[] } {
  const hasNonRejected = inputs.some((input) => input.hardViolations.length === 0 && !input.recentlyRejected);
  const traces: RecommendationRankingCandidateTrace[] = [];
  const ranked: RankedRecommendationCandidate[] = [];

  for (const input of inputs) {
    const hardViolations = [...new Set([
      ...input.hardViolations,
      ...(hasNonRejected && input.recentlyRejected ? ["recently-rejected"] : [])
    ])];
    const eligible = hardViolations.length === 0;
    const contributions = eligible ? scoreCandidate(input, context) : [];
    const score = eligible ? round(contributions.reduce((total, item) => total + item.points, 0)) : null;
    const family = familyFor(input.rec);
    traces.push({
      id: input.rec.id,
      kind: input.rec.kind,
      family,
      eligible,
      hardViolations,
      score,
      rank: null,
      contributions
    });
    if (eligible && score !== null) ranked.push({ rec: input.rec, score, family, contributions });
  }

  ranked.sort((left, right) => {
    const gap = right.score - left.score;
    if (Math.abs(gap) > 0.5) return gap;
    const seededGap = seededRank(context.seed, left.rec.id) - seededRank(context.seed, right.rec.id);
    return seededGap || gap || left.rec.id.localeCompare(right.rec.id);
  });
  const rankById = new Map(ranked.map((candidate, index) => [candidate.rec.id, index + 1]));
  for (const trace of traces) trace.rank = rankById.get(trace.id) ?? null;
  return { ranked, traces };
}

function strongestPositiveCodes(candidate: RankedRecommendationCandidate): RankingRuleCode[] {
  return candidate.contributions
    .filter((entry) => entry.points > 0)
    .sort((left, right) => right.points - left.points)
    .slice(0, 3)
    .map((entry) => entry.code);
}

function runnerUpLossCodes(
  winner: RankedRecommendationCandidate,
  runnerUp: RankedRecommendationCandidate
): RankingRuleCode[] {
  const winnerByCode = new Map(winner.contributions.map((entry) => [entry.code, entry.points]));
  const runnerUpByCode = new Map(runnerUp.contributions.map((entry) => [entry.code, entry.points]));
  const codes = new Set([...winnerByCode.keys(), ...runnerUpByCode.keys()]);
  return [...codes]
    .map((code) => ({ code, disadvantage: (winnerByCode.get(code) ?? 0) - (runnerUpByCode.get(code) ?? 0) }))
    .filter((entry) => entry.disadvantage > 0)
    .sort((left, right) => right.disadvantage - left.disadvantage)
    .slice(0, 3)
    .map((entry) => entry.code);
}

export function buildRecommendationRankingTrace(input: {
  context: RecommendationRankingContext;
  traces: RecommendationRankingCandidateTrace[];
  ranked: RankedRecommendationCandidate[];
  winner: RankedRecommendationCandidate;
  alternatives: RankedRecommendationCandidate[];
}): RecommendationRankingTrace {
  const runnerUp = input.ranked.find((candidate) => candidate.rec.id !== input.winner.rec.id) ?? null;
  return {
    version: 1,
    generatedCount: input.traces.length,
    eligibleCount: input.ranked.length,
    context: {
      mood: input.context.mood,
      routeLens: input.context.routeLens,
      minutes: input.context.minutes
    },
    candidates: input.traces,
    winner: {
      id: input.winner.rec.id,
      score: input.winner.score,
      strongestReasons: strongestPositiveCodes(input.winner)
    },
    runnerUp: runnerUp ? {
      id: runnerUp.rec.id,
      score: runnerUp.score,
      lostBy: round(input.winner.score - runnerUp.score),
      lostBecause: runnerUpLossCodes(input.winner, runnerUp)
    } : null,
    alternatives: input.alternatives.map((candidate) => ({ id: candidate.rec.id, family: candidate.family }))
  };
}
