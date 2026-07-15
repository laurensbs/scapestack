import type { Mood, RouteLens, TimeBudget } from "../src/lib/mood";
import type { NextUpResult, RecKind, Recommendation } from "../src/lib/next-up";

export type AuditRuleLevel = "hard" | "editorial";

export interface RecommendationMatcher {
  ids?: string[];
  kinds?: RecKind[];
  titleIncludes?: string[];
  titleExcludes?: string[];
}

export type AuditRule =
  | { id: string; level: AuditRuleLevel; description: string; type: "headline-required" }
  | { id: string; level: AuditRuleLevel; description: string; type: "basis-is"; basis: NextUpResult["summary"]["basis"] }
  | { id: string; level: AuditRuleLevel; description: string; type: "account-type-is"; accountType: NonNullable<NextUpResult["summary"]["accountType"]> }
  | { id: string; level: AuditRuleLevel; description: string; type: "headline-matches"; matcher: RecommendationMatcher }
  | { id: string; level: AuditRuleLevel; description: string; type: "headline-does-not-match"; matcher: RecommendationMatcher }
  | { id: string; level: AuditRuleLevel; description: string; type: "visible-any"; matcher: RecommendationMatcher }
  | { id: string; level: AuditRuleLevel; description: string; type: "visible-none"; matcher: RecommendationMatcher }
  | { id: string; level: AuditRuleLevel; description: string; type: "headline-has-decision-reason" }
  | { id: string; level: AuditRuleLevel; description: string; type: "headline-is-not-scout-kc" }
  | {
      id: string;
      level: AuditRuleLevel;
      description: string;
      type: "path-percent-range";
      path: "overall" | "Skills" | "Quests" | "Diaries" | "Bosses";
      min: number;
      max: number;
    }
  | { id: string; level: AuditRuleLevel; description: string; type: "mood-headline-safe" };

export interface AuditSelection {
  mood: Mood;
  minutes: TimeBudget;
  routeLens?: RouteLens;
}

export interface AuditRuleContext {
  result: NextUpResult;
  headline: Recommendation | null;
  visible: Recommendation[];
  selection?: AuditSelection;
}

export interface AuditRuleResult {
  id: string;
  level: AuditRuleLevel;
  description: string;
  passed: boolean;
  actual: string;
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

export function recommendationMatches(rec: Recommendation, matcher: RecommendationMatcher): boolean {
  if (matcher.ids && !matcher.ids.includes(rec.id)) return false;
  if (matcher.kinds && !matcher.kinds.includes(rec.kind)) return false;

  const title = normalized(rec.title);
  if (matcher.titleIncludes?.some((part) => !title.includes(normalized(part)))) return false;
  if (matcher.titleExcludes?.some((part) => title.includes(normalized(part)))) return false;
  return true;
}

function isScoutKc(rec: Recommendation | null): boolean {
  if (!rec || rec.kind !== "kc") return false;
  if (typeof rec.kcMeta?.kc === "number" && rec.kcMeta.kc > 0 && rec.kcMeta.kc < 5) return true;
  return `${rec.why} ${rec.decisionReason ?? ""}`.toLowerCase().includes("scout read");
}

function pathPercent(result: NextUpResult, path: Extract<AuditRule, { type: "path-percent-range" }>["path"]): number | null {
  if (path === "overall") return result.pathProgress.overallPercent;
  return result.pathProgress.paths.find((candidate) => candidate.label === path)?.percent ?? null;
}

function recommendationSummary(rec: Recommendation | null): string {
  return rec ? `${rec.id} [${rec.kind}] ${rec.title}` : "no headline";
}

export function evaluateAuditRule(rule: AuditRule, context: AuditRuleContext): AuditRuleResult {
  let passed = false;
  let actual = recommendationSummary(context.headline);

  switch (rule.type) {
    case "headline-required":
      passed = context.headline !== null;
      break;
    case "basis-is":
      passed = context.result.summary.basis === rule.basis;
      actual = `basis=${context.result.summary.basis}`;
      break;
    case "account-type-is":
      passed = context.result.summary.accountType === rule.accountType;
      actual = `accountType=${context.result.summary.accountType ?? "unknown"}`;
      break;
    case "headline-matches":
      passed = context.headline !== null && recommendationMatches(context.headline, rule.matcher);
      break;
    case "headline-does-not-match":
      passed = context.headline === null || !recommendationMatches(context.headline, rule.matcher);
      break;
    case "visible-any": {
      const matches = context.visible.filter((rec) => recommendationMatches(rec, rule.matcher));
      passed = matches.length > 0;
      actual = matches.length > 0
        ? matches.map((rec) => recommendationSummary(rec)).join(" | ")
        : `visible=${context.visible.map((rec) => `${rec.id}[${rec.kind}]`).join(", ")}`;
      break;
    }
    case "visible-none": {
      const matches = context.visible.filter((rec) => recommendationMatches(rec, rule.matcher));
      passed = matches.length === 0;
      actual = matches.length === 0
        ? "no forbidden recommendation visible"
        : matches.map((rec) => recommendationSummary(rec)).join(" | ");
      break;
    }
    case "headline-has-decision-reason":
      passed = Boolean(context.headline?.decisionReason?.trim());
      actual = context.headline?.decisionReason?.trim() || "missing decisionReason";
      break;
    case "headline-is-not-scout-kc":
      passed = !isScoutKc(context.headline);
      break;
    case "path-percent-range": {
      const percent = pathPercent(context.result, rule.path);
      passed = percent !== null && percent >= rule.min && percent <= rule.max;
      actual = `${rule.path}=${percent ?? "missing"}% (allowed ${rule.min}-${rule.max}%)`;
      break;
    }
    case "mood-headline-safe": {
      const mood = context.selection?.mood;
      const forbiddenKinds: Partial<Record<Mood, RecKind[]>> = {
        chill: ["boss", "kc"],
        afk: ["boss", "kc"],
        short: ["boss", "kc"]
      };
      const forbidden = mood ? forbiddenKinds[mood] ?? [] : [];
      passed = Boolean(mood && context.headline && !forbidden.includes(context.headline.kind));
      actual = mood
        ? `mood=${mood}, headline=${recommendationSummary(context.headline)}`
        : "scenario has no mood selection";
      break;
    }
  }

  return {
    id: rule.id,
    level: rule.level,
    description: rule.description,
    passed,
    actual
  };
}
