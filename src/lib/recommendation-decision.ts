import type { AccountStageId } from "./account-stage";
import type { PlannerAccountType } from "./account-type";
import type { Mood, RouteLens, TimeBudget } from "./mood";
import type { Recommendation, RecKind } from "./next-up";

export const RECOMMENDATION_DECISION_VERSION = 1 as const;

export type RecommendationFactProvenance = "public_stats" | "bank" | "runelite" | "preference";

export type RecommendationReasonCode =
  | "visible_progress_fit"
  | "boss_kc_progress"
  | "bank_context_used"
  | "runelite_filtered_finished"
  | "session_preference_fit";

export interface RecommendationDecisionFact {
  code: RecommendationReasonCode;
  provenance: RecommendationFactProvenance;
  subject: string;
  value?: string | number;
}

export interface RecommendationDecisionUnknown {
  code: "public_progress" | "bank_setup" | "runelite_completion";
  subject: string;
  impact: "ranking" | "setup" | "completion";
}

export interface RecommendationDecisionAssumption {
  code: "bank_is_current" | "manual_finish";
  subject: string;
  provenance: RecommendationFactProvenance;
}

export interface RecommendationDecisionAlternative {
  recommendationId: string;
  activity: string;
  routeFamily: RecKind;
  lostBecause: {
    code: "lower_account_fit" | "mood_mismatch" | "timebox_mismatch";
    provenance: "preference";
    subject: string;
  };
}

export type RecommendationCompletionEvidence =
  | { kind: "boss_kc_at_least"; boss: string; target: number; provenance: "public_stats" | "runelite" }
  | { kind: "quest_completed"; quest: string; provenance: "runelite" }
  | { kind: "diary_completed"; diary: string; provenance: "runelite" }
  | { kind: "slayer_task_finished"; provenance: "runelite" }
  | { kind: "bank_changed"; provenance: "bank" }
  | { kind: "manual_confirmation"; label: string; provenance: "preference" };

export interface RecommendationDecision {
  id: string;
  version: typeof RECOMMENDATION_DECISION_VERSION;
  recommendationId: string;
  activity: {
    kind: RecKind;
    title: string;
    bossSlug?: string;
    iconItemId?: number;
    link?: string;
  };
  routeFamily: RouteLens;
  goal: { label: string; completionRule: string };
  firstStep: { label: string };
  stopPoint: { label: string };
  timebox: { minutes: TimeBudget; label: string };
  setup: {
    required: Array<{ item: string; provenance: RecommendationFactProvenance }>;
    optional: Array<{ item: string; provenance: RecommendationFactProvenance }>;
  };
  reasons: RecommendationDecisionFact[];
  unknowns: RecommendationDecisionUnknown[];
  assumptions: RecommendationDecisionAssumption[];
  alternatives: RecommendationDecisionAlternative[];
  constraints: {
    mood: Mood;
    routeFamily: RouteLens;
    timeboxMinutes: TimeBudget;
    accountStage: AccountStageId;
    accountType: PlannerAccountType | null;
  };
  completion: {
    mode: "automatic" | "manual";
    evidence: RecommendationCompletionEvidence;
  };
  fallback: {
    used: boolean;
    action: string;
    missing: Array<RecommendationDecisionUnknown["code"]>;
  };
}

export interface BuildRecommendationDecisionInput {
  winner: Recommendation;
  alternatives: Recommendation[];
  mood: Mood;
  routeFamily: RouteLens;
  minutes: TimeBudget;
  accountStage: AccountStageId;
  accountType: PlannerAccountType | null;
  hasPublicStats: boolean;
  hasBank: boolean;
  hasRuneLite: boolean;
}

export interface RecommendationDecisionCopy {
  title: string;
  why: string;
  firstStep: string;
  stopPoint: string;
  timebox: string;
  requiredSetup: string[];
}

const EXACT_RUNELITE_KINDS = new Set<RecKind>(["quest", "diary", "slayer", "kc"]);
const BANK_RELEVANT_KINDS = new Set<RecKind>(["boss", "kc", "slayer", "money", "skill", "minigame"]);
const TEXT_LIMIT = 500;

function cleanText(value: unknown, fallback: string, limit = TEXT_LIMIT): string {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, limit) : fallback;
}

function firstStepFor(rec: Recommendation): string {
  const routeFirst = rec.routeChain?.steps.find((step) => step.label === "Do this first")?.text;
  return cleanText(
    rec.actionPlan?.steps[0] ?? routeFirst ?? rec.actionPlan?.prep,
    fallbackFirstStep(rec)
  );
}

function stopPointFor(rec: Recommendation): string {
  const planStop = rec.actionPlan?.steps.at(-1);
  const routeStop = rec.routeChain?.steps.find((step) => step.label === "After that")?.text;
  return cleanText(planStop ?? routeStop, fallbackStopPoint(rec));
}

function fallbackFirstStep(rec: Recommendation): string {
  if (rec.kind === "boss" || rec.kind === "kc") return "Check the setup, then do one short trip.";
  if (rec.kind === "quest" || rec.kind === "diary") return "Open the next unfinished step and complete one block.";
  if (rec.kind === "slayer") return "Check the task, take supplies, then start one task block.";
  if (rec.kind === "bank") return "Open the bank and make the first useful change.";
  return `Start one ${cleanText(rec.title, "useful account step", 120)} block.`;
}

function fallbackStopPoint(rec: Recommendation): string {
  if (rec.kind === "boss" || rec.kind === "kc") return "Stop after one trip and review the kill.";
  if (rec.kind === "quest" || rec.kind === "diary") return "Stop after the next completed step.";
  if (rec.kind === "slayer") return "Stop when the current task block is finished.";
  if (rec.kind === "bank") return "Stop after saving the bank change.";
  return "Stop after one clear progress block.";
}

function completionEvidence(
  rec: Recommendation,
  stopPoint: string,
  input: Pick<BuildRecommendationDecisionInput, "hasRuneLite" | "hasPublicStats" | "hasBank">
): RecommendationDecision["completion"] {
  const kcTarget = rec.title.match(/(?:to|at least)\s+(\d[\d,]*)\s*KC\b/i)?.[1];
  if (rec.kind === "kc" && rec.bossSlug && kcTarget && (input.hasRuneLite || input.hasPublicStats)) {
    return {
      mode: "automatic",
      evidence: {
        kind: "boss_kc_at_least",
        boss: rec.bossSlug,
        target: Number(kcTarget.replaceAll(",", "")),
        provenance: input.hasRuneLite ? "runelite" : "public_stats"
      }
    };
  }
  if (rec.kind === "quest" && input.hasRuneLite) {
    return { mode: "automatic", evidence: { kind: "quest_completed", quest: rec.title, provenance: "runelite" } };
  }
  if (rec.kind === "diary" && input.hasRuneLite) {
    return { mode: "automatic", evidence: { kind: "diary_completed", diary: rec.title, provenance: "runelite" } };
  }
  if (rec.kind === "slayer" && input.hasRuneLite) {
    return { mode: "automatic", evidence: { kind: "slayer_task_finished", provenance: "runelite" } };
  }
  if (rec.kind === "bank" && input.hasBank) {
    return { mode: "automatic", evidence: { kind: "bank_changed", provenance: "bank" } };
  }
  return { mode: "manual", evidence: { kind: "manual_confirmation", label: stopPoint, provenance: "preference" } };
}

function alternativeReason(
  alternative: Recommendation,
  winner: Recommendation,
  mood: Mood,
  minutes: TimeBudget
): RecommendationDecisionAlternative["lostBecause"] {
  if ((mood === "chill" || mood === "afk") && (alternative.kind === "boss" || alternative.kind === "kc")) {
    return { code: "mood_mismatch", provenance: "preference", subject: mood };
  }
  if (minutes <= 30 && (alternative.kind === "boss" || alternative.kind === "kc" || alternative.kind === "quest")) {
    return { code: "timebox_mismatch", provenance: "preference", subject: `${minutes} minutes` };
  }
  return {
    code: "lower_account_fit",
    provenance: "preference",
    subject: alternative.kind === winner.kind ? "a similar route already won" : "lower fit for this session"
  };
}

function timeboxLabel(rec: Recommendation, minutes: TimeBudget): string {
  return cleanText(rec.actionPlan?.timebox, `${minutes} minute session`, 100);
}

function stableDecisionId(input: BuildRecommendationDecisionInput): string {
  const cleanRecommendationId = input.winner.id.replace(/[^a-z0-9:_-]+/gi, "-").slice(0, 120);
  return `decision:v${RECOMMENDATION_DECISION_VERSION}:${cleanRecommendationId}:${input.routeFamily}:${input.mood}:${input.minutes}`;
}

export function buildRecommendationDecision(input: BuildRecommendationDecisionInput): RecommendationDecision {
  const winner = input.winner;
  const firstStep = firstStepFor(winner);
  const stopPoint = stopPointFor(winner);
  const unknowns: RecommendationDecisionUnknown[] = [];
  if (!input.hasPublicStats) unknowns.push({ code: "public_progress", subject: "levels and KC", impact: "ranking" });
  if (!input.hasBank && BANK_RELEVANT_KINDS.has(winner.kind)) {
    unknowns.push({ code: "bank_setup", subject: "gear and supplies", impact: "setup" });
  }
  if (!input.hasRuneLite && EXACT_RUNELITE_KINDS.has(winner.kind)) {
    unknowns.push({ code: "runelite_completion", subject: "finished account steps", impact: "completion" });
  }

  const reasons: RecommendationDecisionFact[] = [];
  if (winner.kind === "kc" && winner.kcMeta && input.hasPublicStats) {
    reasons.push({ code: "boss_kc_progress", provenance: "public_stats", subject: winner.bossSlug ?? winner.title, value: winner.kcMeta.kc });
  } else if (input.hasPublicStats) {
    reasons.push({ code: "visible_progress_fit", provenance: "public_stats", subject: winner.kind });
  }
  if (input.hasBank && BANK_RELEVANT_KINDS.has(winner.kind)) {
    reasons.push({ code: "bank_context_used", provenance: "bank", subject: winner.kind });
  }
  if (input.hasRuneLite && EXACT_RUNELITE_KINDS.has(winner.kind)) {
    reasons.push({ code: "runelite_filtered_finished", provenance: "runelite", subject: winner.kind });
  }
  reasons.push({ code: "session_preference_fit", provenance: "preference", subject: input.mood, value: input.minutes });

  const requiredProvenance: RecommendationFactProvenance | null = input.hasBank
    ? "bank"
    : input.hasRuneLite && EXACT_RUNELITE_KINDS.has(winner.kind)
      ? "runelite"
      : input.hasPublicStats
        ? "public_stats"
        : null;
  const required = requiredProvenance
    ? (winner.needs ?? []).slice(0, 4).map((item) => ({
        item: cleanText(item, "Check the activity requirement", 180),
        provenance: requiredProvenance
      }))
    : [];
  const optional: RecommendationDecision["setup"]["optional"] = [];
  if (!input.hasBank && BANK_RELEVANT_KINDS.has(winner.kind)) optional.push({ item: "Add bank for exact gear and supplies", provenance: "preference" });
  if (!input.hasRuneLite && EXACT_RUNELITE_KINDS.has(winner.kind)) optional.push({ item: "Connect RuneLite to skip finished work", provenance: "preference" });

  const completion = completionEvidence(winner, stopPoint, input);
  const assumptions: RecommendationDecisionAssumption[] = [];
  if (input.hasBank) assumptions.push({ code: "bank_is_current", subject: "saved bank", provenance: "bank" });
  if (completion.mode === "manual") assumptions.push({ code: "manual_finish", subject: stopPoint, provenance: "preference" });

  return {
    id: stableDecisionId(input),
    version: RECOMMENDATION_DECISION_VERSION,
    recommendationId: cleanText(winner.id, "unknown-recommendation", 200),
    activity: {
      kind: winner.kind,
      title: cleanText(winner.title, "Choose one useful account step", 300),
      ...(winner.bossSlug ? { bossSlug: cleanText(winner.bossSlug, "", 100) } : {}),
      ...(winner.iconItemId ? { iconItemId: winner.iconItemId } : {}),
      ...(winner.link ? { link: cleanText(winner.link, "", 500) } : {})
    },
    routeFamily: input.routeFamily,
    goal: { label: cleanText(winner.title, "Make useful account progress", 300), completionRule: stopPoint },
    firstStep: { label: firstStep },
    stopPoint: { label: stopPoint },
    timebox: { minutes: input.minutes, label: timeboxLabel(winner, input.minutes) },
    setup: { required, optional },
    reasons,
    unknowns,
    assumptions,
    alternatives: input.alternatives.slice(0, 2).map((alternative) => ({
      recommendationId: cleanText(alternative.id, "unknown-alternative", 200),
      activity: cleanText(alternative.title, "Alternative route", 300),
      routeFamily: alternative.kind,
      lostBecause: alternativeReason(alternative, winner, input.mood, input.minutes)
    })),
    constraints: {
      mood: input.mood,
      routeFamily: input.routeFamily,
      timeboxMinutes: input.minutes,
      accountStage: input.accountStage,
      accountType: input.accountType
    },
    completion,
    fallback: {
      used: unknowns.some((unknown) => unknown.impact === "ranking"),
      action: unknowns.length ? "Use the bounded first step and stop point; add missing context later." : "Re-rank after the completion rule is met.",
      missing: unknowns.map((unknown) => unknown.code)
    }
  };
}

function sentence(value: string): string {
  const clean = cleanText(value, "", 220).replace(/[.!?]+$/, "");
  return clean ? `${clean}.` : "";
}

function reasonCopy(fact: RecommendationDecisionFact): string {
  switch (fact.code) {
    case "boss_kc_progress":
      return `${fact.subject} is already at ${fact.value} KC`;
    case "bank_context_used":
      return "Your saved bank was used for this route";
    case "runelite_filtered_finished":
      return "RuneLite filtered finished work";
    case "session_preference_fit":
      return `This fits ${fact.subject} and ${fact.value} minutes`;
    case "visible_progress_fit":
      return "This best matches your visible account progress";
  }
}

export function recommendationDecisionCopy(decision: RecommendationDecision): RecommendationDecisionCopy {
  const primary = decision.reasons.find((reason) => reason.code !== "session_preference_fit") ?? decision.reasons[0];
  const preference = decision.reasons.find((reason) => reason.code === "session_preference_fit");
  const why = [primary, preference]
    .filter((fact, index, list): fact is RecommendationDecisionFact => Boolean(fact) && list.findIndex((candidate) => candidate?.code === fact?.code) === index)
    .map(reasonCopy)
    .join(". ");
  return {
    title: decision.goal.label,
    why: sentence(why || decision.fallback.action),
    firstStep: decision.firstStep.label,
    stopPoint: decision.stopPoint.label,
    timebox: decision.timebox.label,
    requiredSetup: decision.setup.required.map((requirement) => requirement.item)
  };
}

const REC_KINDS = new Set<RecKind>(["goal", "quest", "diary", "boss", "kc", "minigame", "slayer", "skill", "milestone", "money", "bank"]);
const MOODS = new Set<Mood>(["chill", "focused", "cash", "quest", "bossing", "unlock", "afk", "short"]);
const ROUTES = new Set<RouteLens>(["smart", "maxing", "fun", "unlock-chain", "gp-upgrade", "boss-log", "afk-progress", "short-login"]);
const TIMES = new Set<TimeBudget>([15, 30, 60, 120]);
const PROVENANCE = new Set<RecommendationFactProvenance>(["public_stats", "bank", "runelite", "preference"]);
const REASON_CODES = new Set<RecommendationReasonCode>(["visible_progress_fit", "boss_kc_progress", "bank_context_used", "runelite_filtered_finished", "session_preference_fit"]);
const UNKNOWN_CODES = new Set<RecommendationDecisionUnknown["code"]>(["public_progress", "bank_setup", "runelite_completion"]);
const UNKNOWN_IMPACTS = new Set<RecommendationDecisionUnknown["impact"]>(["ranking", "setup", "completion"]);
const ASSUMPTION_CODES = new Set<RecommendationDecisionAssumption["code"]>(["bank_is_current", "manual_finish"]);
const ALTERNATIVE_CODES = new Set<RecommendationDecisionAlternative["lostBecause"]["code"]>(["lower_account_fit", "mood_mismatch", "timebox_mismatch"]);
const ACCOUNT_STAGES = new Set<AccountStageId>(["first-run", "gear-first", "new-account", "early-main", "midgame-main", "returning", "iron-route", "skiller", "pvm-ready", "maxed-grinder", "runelite-aware"]);
const ACCOUNT_TYPES = new Set<PlannerAccountType>(["regular", "ironman", "hardcore", "ultimate", "group", "skiller", "pure"]);

function boundedText(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limit;
}

function validCompletion(value: RecommendationDecision["completion"] | undefined): boolean {
  if (!value || !["automatic", "manual"].includes(value.mode) || !value.evidence) return false;
  const evidence = value.evidence;
  if (evidence.kind === "boss_kc_at_least") {
    return boundedText(evidence.boss, 100) && Number.isInteger(evidence.target) && evidence.target > 0
      && ["public_stats", "runelite"].includes(evidence.provenance);
  }
  if (evidence.kind === "quest_completed") return boundedText(evidence.quest, 300) && evidence.provenance === "runelite";
  if (evidence.kind === "diary_completed") return boundedText(evidence.diary, 300) && evidence.provenance === "runelite";
  if (evidence.kind === "slayer_task_finished") return evidence.provenance === "runelite";
  if (evidence.kind === "bank_changed") return evidence.provenance === "bank";
  return evidence.kind === "manual_confirmation" && boundedText(evidence.label, TEXT_LIMIT) && evidence.provenance === "preference";
}

/** Strict enough for the API boundary: builders remain ergonomic, persisted rows stay trustworthy. */
export function parseRecommendationDecision(value: unknown): RecommendationDecision | null {
  if (!value || typeof value !== "object") return null;
  const decision = value as Partial<RecommendationDecision>;
  if (decision.version !== RECOMMENDATION_DECISION_VERSION || typeof decision.id !== "string" || !decision.id.startsWith("decision:v1:") || decision.id.length > 240) return null;
  if (typeof decision.recommendationId !== "string" || !decision.recommendationId || decision.recommendationId.length > 200) return null;
  if (!decision.activity || !REC_KINDS.has(decision.activity.kind) || !boundedText(decision.activity.title, 300)) return null;
  if (!boundedText(decision.goal?.label, 300) || !boundedText(decision.goal?.completionRule, TEXT_LIMIT)) return null;
  if (!boundedText(decision.firstStep?.label, TEXT_LIMIT) || !boundedText(decision.stopPoint?.label, TEXT_LIMIT)) return null;
  if (decision.goal.completionRule !== decision.stopPoint.label) return null;
  if (!decision.timebox || !TIMES.has(decision.timebox.minutes) || !boundedText(decision.timebox.label, 100)) return null;
  if (!decision.constraints || !MOODS.has(decision.constraints.mood) || !ROUTES.has(decision.constraints.routeFamily)
    || !TIMES.has(decision.constraints.timeboxMinutes) || decision.constraints.timeboxMinutes !== decision.timebox.minutes
    || !ACCOUNT_STAGES.has(decision.constraints.accountStage)
    || (decision.constraints.accountType !== null && !ACCOUNT_TYPES.has(decision.constraints.accountType))) return null;
  if (!decision.routeFamily || !ROUTES.has(decision.routeFamily) || decision.routeFamily !== decision.constraints.routeFamily) return null;
  if (!validCompletion(decision.completion)) return null;
  if (!Array.isArray(decision.reasons) || decision.reasons.length > 6 || decision.reasons.some((fact) => (
    !REASON_CODES.has(fact.code) || !PROVENANCE.has(fact.provenance) || !boundedText(fact.subject, 300)
  ))) return null;
  if (!Array.isArray(decision.unknowns) || decision.unknowns.length > 3 || decision.unknowns.some((unknown) => (
    !UNKNOWN_CODES.has(unknown.code) || !UNKNOWN_IMPACTS.has(unknown.impact) || !boundedText(unknown.subject, 300)
  ))) return null;
  if (!Array.isArray(decision.assumptions) || decision.assumptions.length > 4 || decision.assumptions.some((assumption) => (
    !ASSUMPTION_CODES.has(assumption.code) || !PROVENANCE.has(assumption.provenance) || !boundedText(assumption.subject, TEXT_LIMIT)
  ))) return null;
  if (!Array.isArray(decision.alternatives) || decision.alternatives.length > 2 || decision.alternatives.some((alternative) => (
    !boundedText(alternative.recommendationId, 200) || !boundedText(alternative.activity, 300) || !REC_KINDS.has(alternative.routeFamily)
    || !ALTERNATIVE_CODES.has(alternative.lostBecause.code) || alternative.lostBecause.provenance !== "preference"
    || !boundedText(alternative.lostBecause.subject, 200)
  ))) return null;
  if (!decision.setup || !Array.isArray(decision.setup.required) || !Array.isArray(decision.setup.optional)
    || [...decision.setup.required, ...decision.setup.optional].length > 8
    || [...decision.setup.required, ...decision.setup.optional].some((item) => !boundedText(item.item, 180) || !PROVENANCE.has(item.provenance))) return null;
  if (!decision.fallback || typeof decision.fallback.used !== "boolean" || !boundedText(decision.fallback.action, TEXT_LIMIT)
    || !Array.isArray(decision.fallback.missing) || decision.fallback.missing.some((code) => !UNKNOWN_CODES.has(code))) return null;
  if (JSON.stringify(decision).length > 24_000) return null;
  return decision as RecommendationDecision;
}
