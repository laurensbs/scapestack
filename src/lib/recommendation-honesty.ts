import type { Recommendation, RecKind } from "./next-up";
import { recommendationSessionProfile } from "./recommendation-session";

export type RecommendationHonestyLevel =
  | "verified"
  | "supported"
  | "estimated"
  | "insufficient";

export interface RecommendationHonestyContext {
  hasPublicStats: boolean;
  hasBank: boolean;
  hasRuneLite: boolean;
}

export type RecommendationInvalidatingUnknown =
  | "progress"
  | "setup"
  | "completion"
  | "requirements";

export interface RecommendationHonestyAssessment {
  level: RecommendationHonestyLevel;
  scoreMultiplier: number;
  bankWouldChangePlan: boolean;
  canUseSetupClaims: boolean;
  invalidatingUnknowns: RecommendationInvalidatingUnknown[];
  firstCheck?: string;
}

const ACCOUNT_PROGRESS_KINDS = new Set<RecKind>([
  "goal",
  "quest",
  "diary",
  "boss",
  "kc",
  "money",
  "slayer",
  "skill",
  "milestone"
]);

const RUNELITE_COMPLETION_KINDS = new Set<RecKind>(["quest", "diary", "slayer"]);
const SETUP_CRITICAL_KINDS = new Set<RecKind>(["boss", "kc", "slayer"]);

function recommendationText(rec: Recommendation): string {
  return `${rec.id} ${rec.title} ${rec.why} ${rec.payoff ?? ""} ${(rec.needs ?? []).join(" ")}`.toLowerCase();
}

/** Whether seeing the current bank can materially change method, setup or feasibility. */
export function recommendationBankWouldChangePlan(rec: Recommendation): boolean {
  if (rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer") return true;
  if (rec.completionTarget?.kind === "bank_quantity_at_least") return true;

  const text = recommendationText(rec);
  if (rec.kind === "money") {
    return /boss|gear|weapon|armour|armor|food|potion|rune|supply|capital|buy/.test(text);
  }
  if (rec.kind === "skill") {
    return /banked|raw |logs?|bars?|ores?|herbs?|bones?|hides?|planks?|essence|seeds?|supplies|materials?/.test(text);
  }
  if (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "goal") {
    return /bring|item|gear|food|potion|rune|supply/.test(text);
  }
  return false;
}

export function recommendationNeedsRuneLiteCompletion(rec: Recommendation): boolean {
  if (RUNELITE_COMPLETION_KINDS.has(rec.kind)) return true;
  return rec.completionTarget?.kind === "quest_completed"
    || rec.completionTarget?.kind === "diary_completed"
    || rec.completionTarget?.kind === "collection_log_item_obtained"
    || rec.completionTarget?.kind === "slayer_task_finished";
}

function firstCheckFor(
  rec: Recommendation,
  unknowns: RecommendationInvalidatingUnknown[]
): string | undefined {
  if (unknowns.includes("progress")) {
    return "Check your current levels and progress first, then start one short block.";
  }
  if (unknowns.includes("completion")) {
    if (rec.kind === "slayer") return "Check your current Slayer task first, then plan one task block.";
    return "Check the next unfinished requirement first, then complete one step.";
  }
  if (unknowns.includes("requirements")) {
    return "Check the next manual requirement first, then complete one step.";
  }
  if (unknowns.includes("setup")) {
    if (rec.kind === "boss" || rec.kind === "kc") {
      return "Check your gear, food and teleport first; only start if one short trip is covered.";
    }
    if (rec.kind === "slayer") {
      return "Check your task gear and supplies first, then start one task block.";
    }
    return "Check what supplies you already have first, then choose the method.";
  }
  return undefined;
}

/** Internal truth boundary. Levels are ranking facts, never visible badges. */
export function assessRecommendationHonesty(
  rec: Recommendation,
  context: RecommendationHonestyContext
): RecommendationHonestyAssessment {
  const profile = recommendationSessionProfile(rec);
  const bankWouldChangePlan = recommendationBankWouldChangePlan(rec);
  const invalidatingUnknowns: RecommendationInvalidatingUnknown[] = [];

  if (!context.hasPublicStats && ACCOUNT_PROGRESS_KINDS.has(rec.kind)) {
    invalidatingUnknowns.push("progress");
  }
  if (!context.hasRuneLite && recommendationNeedsRuneLiteCompletion(rec)) {
    invalidatingUnknowns.push("completion");
  }

  const uncertainSetup = profile.setupConfidence === "unknown" || profile.setupConfidence === "guided";
  if (!context.hasBank && bankWouldChangePlan && (SETUP_CRITICAL_KINDS.has(rec.kind) || uncertainSetup)) {
    invalidatingUnknowns.push("setup");
  }

  if (
    !context.hasRuneLite
    && (rec.kind === "quest" || rec.kind === "diary")
    && (rec.needs?.length ?? 0) > 0
    && !invalidatingUnknowns.includes("completion")
  ) {
    invalidatingUnknowns.push("requirements");
  }

  const hasHardUnknown = invalidatingUnknowns.includes("progress")
    || invalidatingUnknowns.includes("setup");
  const hasAnyUnknown = invalidatingUnknowns.length > 0
    || (!context.hasBank && bankWouldChangePlan);
  const level: RecommendationHonestyLevel = hasHardUnknown
    ? "insufficient"
    : hasAnyUnknown
      ? "estimated"
      : context.hasRuneLite || (context.hasBank && bankWouldChangePlan)
        ? "verified"
        : "supported";
  const scoreMultiplier: Record<RecommendationHonestyLevel, number> = {
    verified: 1.06,
    supported: 1,
    estimated: 0.88,
    insufficient: 0.68
  };

  return {
    level,
    scoreMultiplier: scoreMultiplier[level],
    bankWouldChangePlan,
    canUseSetupClaims: context.hasBank && !invalidatingUnknowns.includes("completion"),
    invalidatingUnknowns,
    firstCheck: firstCheckFor(rec, invalidatingUnknowns)
  };
}

export function recommendationHonestyMultiplier(
  rec: Recommendation,
  context: RecommendationHonestyContext | undefined
): number {
  return context ? assessRecommendationHonesty(rec, context).scoreMultiplier : 1;
}
