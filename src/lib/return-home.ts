import type { AccountTimelineMoment } from "./account-timeline";

export interface ReturnHomeFallback {
  progressTitle?: string | null;
  progressDetail?: string | null;
  startedTitle?: string | null;
  lastPlanTitle?: string | null;
}

export interface ReturnHomeSummary {
  eyebrow: string;
  headline: string;
  detail: string;
  stopPoint: string | null;
  hasNewProgress: boolean;
  latestMomentId: string | null;
}

const MOMENT_WEIGHT: Partial<Record<AccountTimelineMoment["kind"], number>> = {
  outcome: 100,
  quest: 92,
  diary: 90,
  "collection-log": 86,
  level: 82,
  boss: 78,
  slayer: 74,
  xp: 68,
  bank: 42
};

function unseenMoments(moments: AccountTimelineMoment[], lastSeenMomentId?: string | null): AccountTimelineMoment[] {
  if (!lastSeenMomentId) return moments;
  const boundary = moments.findIndex((moment) => moment.id === lastSeenMomentId);
  return boundary < 0 ? moments : moments.slice(0, boundary);
}

function strongestMoment(moments: AccountTimelineMoment[]): AccountTimelineMoment | null {
  return moments.reduce<AccountTimelineMoment | null>((best, moment) => {
    const weight = MOMENT_WEIGHT[moment.kind] ?? 0;
    if (weight === 0) return best;
    if (!best) return moment;
    const bestWeight = MOMENT_WEIGHT[best.kind] ?? 0;
    if (weight !== bestWeight) return weight > bestWeight ? moment : best;
    return Date.parse(moment.occurredAt) > Date.parse(best.occurredAt) ? moment : best;
  }, null);
}

function outcomeStopPoint(moment: AccountTimelineMoment | null): string | null {
  if (moment?.kind !== "outcome") return null;
  if (moment.outcomeStatus === "completed") return "Previous stop point complete. Your next trip can move on.";
  if (moment.outcomeStatus === "progressed") return "Previous stop point progressed. Continue it or take a fresh route.";
  if (moment.outcomeStatus === "contradicted") return "Previous stop point needs a fresh check before you continue.";
  return null;
}

function cleanPlanTitle(value: string): string {
  return value.replace(/^Next pick changed to\s+/i, "").replace(/^(Started|Planned)\s+/i, "").trim();
}

export function buildReturnHomeSummary(input: {
  moments?: AccountTimelineMoment[];
  lastSeenMomentId?: string | null;
  fallback?: ReturnHomeFallback;
}): ReturnHomeSummary {
  const moments = input.moments ?? [];
  const unseen = unseenMoments(moments, input.lastSeenMomentId);
  const strongest = strongestMoment(unseen);
  const latestOutcome = unseen.find((moment) => moment.kind === "outcome") ?? null;
  const latestPlan = moments.find((moment) => moment.kind === "plan" || moment.kind === "trip");
  const latestMomentId = moments[0]?.id ?? null;

  if (strongest) {
    return {
      eyebrow: strongest.kind === "outcome" ? "Your last trip" : "Since your last visit",
      headline: strongest.title,
      detail: strongest.detail ?? "Scapestack found this in your latest account progress.",
      stopPoint: outcomeStopPoint(latestOutcome),
      hasNewProgress: true,
      latestMomentId
    };
  }

  if (input.fallback?.progressTitle) {
    return {
      eyebrow: "Since your last visit",
      headline: input.fallback.progressTitle,
      detail: input.fallback.progressDetail ?? "RuneLite found progress since the previous check.",
      stopPoint: outcomeStopPoint(latestOutcome),
      hasNewProgress: true,
      latestMomentId
    };
  }

  const previousPlan = input.fallback?.startedTitle
    ?? input.fallback?.lastPlanTitle
    ?? (latestPlan ? cleanPlanTitle(latestPlan.title) : null);
  return {
    eyebrow: "Ready when you are",
    headline: "No new progress yet.",
    detail: previousPlan
      ? `Last time you picked ${previousPlan}. Open the next trip to continue or recalculate.`
      : "Open a fresh trip and Scapestack will recalculate the best move for this account.",
    stopPoint: outcomeStopPoint(latestOutcome),
    hasNewProgress: false,
    latestMomentId
  };
}
