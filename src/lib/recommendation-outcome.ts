import type { AccountSnapshotDelta, SnapshotDataAvailability } from "./account-snapshot-delta";
import type { RecommendationDecision, RecommendationCompletionEvidence } from "./recommendation-decision";
import type { SyncDeltaSummary } from "./sync-repo";

export const RECOMMENDATION_OUTCOME_VERSION = 1 as const;

export type RecommendationOutcomeStatus =
  | "completed"
  | "progressed"
  | "unchanged"
  | "contradicted"
  | "unknown";

export interface RecommendationOutcomeProgress {
  before: number;
  after: number;
  target: number;
  remaining: number;
  unit: "KC" | "level" | "items" | "task";
}

export interface RecommendationOutcome {
  id: string;
  version: typeof RECOMMENDATION_OUTCOME_VERSION;
  decisionId: string;
  recommendationId: string;
  recommendationKind: RecommendationDecision["activity"]["kind"];
  mood: RecommendationDecision["constraints"]["mood"];
  routeLens: RecommendationDecision["constraints"]["routeFamily"];
  minutes: RecommendationDecision["constraints"]["timeboxMinutes"];
  activity: string;
  status: RecommendationOutcomeStatus;
  evidenceType: RecommendationCompletionEvidence["kind"];
  observedAt: string;
  title: string;
  detail: string;
  nextStopPoint: string;
  progress?: RecommendationOutcomeProgress;
  terminal: boolean;
}

export interface ReconcileRecommendationOutcomeInput {
  decision: RecommendationDecision;
  delta: AccountSnapshotDelta;
  syncSummary?: SyncDeltaSummary | null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function comparableName(value: string): string {
  return normalize(value).replace(/^(complete|finish|finished|unlock|get|do|push|your)\s+/, "");
}

function sameSubject(left: string, right: string): boolean {
  const a = comparableName(left);
  const b = comparableName(right);
  return Boolean(a && b && (a === b || (Math.min(a.length, b.length) >= 6 && (a.includes(b) || b.includes(a)))));
}

function available(value: SnapshotDataAvailability): boolean {
  return value === "available";
}

function outcome(
  decision: RecommendationDecision,
  delta: AccountSnapshotDelta,
  status: RecommendationOutcomeStatus,
  detail: string,
  options: { progress?: RecommendationOutcomeProgress; nextStopPoint?: string } = {}
): RecommendationOutcome {
  const activity = decision.activity.title;
  const verb = status === "completed"
    ? "Finished"
    : status === "progressed"
      ? "Progressed"
      : status === "contradicted"
        ? "Re-check"
        : status === "unchanged"
          ? "Still working on"
          : "Could not confirm";
  return {
    id: `outcome:v${RECOMMENDATION_OUTCOME_VERSION}:${decision.id}:${delta.deltaId}`,
    version: RECOMMENDATION_OUTCOME_VERSION,
    decisionId: decision.id,
    recommendationId: decision.recommendationId,
    recommendationKind: decision.activity.kind,
    mood: decision.constraints.mood,
    routeLens: decision.constraints.routeFamily,
    minutes: decision.constraints.timeboxMinutes,
    activity,
    status,
    evidenceType: decision.completion.evidence.kind,
    observedAt: delta.capturedAt,
    title: `${verb} ${activity}`,
    detail,
    nextStopPoint: options.nextStopPoint ?? decision.stopPoint.label,
    ...(options.progress ? { progress: options.progress } : {}),
    terminal: status === "completed" || status === "contradicted"
  };
}

function unknown(decision: RecommendationDecision, delta: AccountSnapshotDelta, detail: string): RecommendationOutcome {
  return outcome(decision, delta, "unknown", detail, {
    nextStopPoint: "Keep the original stop point until a fresh RuneLite scan proves progress."
  });
}

function numericOutcome(
  decision: RecommendationDecision,
  delta: AccountSnapshotDelta,
  movement: { before: number; after: number; delta: number; confidence: "observed" | "source-regression" },
  target: number,
  unit: RecommendationOutcomeProgress["unit"]
): RecommendationOutcome {
  const progress = {
    before: movement.before,
    after: movement.after,
    target,
    remaining: Math.max(0, target - movement.after),
    unit
  };
  if (movement.confidence === "source-regression" || movement.after < movement.before) {
    return outcome(decision, delta, "contradicted", "RuneLite reported less progress than before, so this plan needs a fresh check.", {
      progress,
      nextStopPoint: "Re-scan before continuing this route."
    });
  }
  if (movement.before >= target) {
    return outcome(decision, delta, "contradicted", `The ${unit} target was already met before this trip started.`, {
      progress,
      nextStopPoint: "Pick a new stop point from the fresh account state."
    });
  }
  if (movement.after >= target) {
    return outcome(decision, delta, "completed", `${movement.after.toLocaleString("en-US")}/${target.toLocaleString("en-US")} ${unit}. Target reached.`, {
      progress,
      nextStopPoint: "Done. Re-plan from the fresh account state."
    });
  }
  if (movement.delta > 0) {
    return outcome(decision, delta, "progressed", `${movement.after.toLocaleString("en-US")}/${target.toLocaleString("en-US")} ${unit}. ${progress.remaining.toLocaleString("en-US")} left.`, {
      progress,
      nextStopPoint: `${progress.remaining.toLocaleString("en-US")} ${unit} left to the target.`
    });
  }
  return outcome(decision, delta, "unchanged", `No ${unit} progress toward this stop point was found.`);
}

function collectionLogOutcome(
  decision: RecommendationDecision,
  delta: AccountSnapshotDelta,
  evidence: Extract<RecommendationCompletionEvidence, { kind: "collection_log_item_obtained" }>,
  summary: SyncDeltaSummary | null | undefined
): RecommendationOutcome {
  if (!available(delta.availability.collectionLog)) return unknown(decision, delta, "Collection log progress was not available in this scan.");
  const nameMatch = summary?.collectionLogItems.some((item) => sameSubject(item.name, evidence.item)) ?? false;
  const idMatch = evidence.itemId !== undefined && delta.collectionLog.added.includes(evidence.itemId);
  if (nameMatch || idMatch) {
    return outcome(decision, delta, "completed", `${evidence.item} was added to the collection log.`, {
      nextStopPoint: "Drop obtained. Pick the next chase."
    });
  }
  if (evidence.itemId !== undefined && delta.collectionLog.removed.includes(evidence.itemId)) {
    return outcome(decision, delta, "contradicted", `${evidence.item} disappeared from the reported collection log.`, {
      nextStopPoint: "Re-scan the collection log before continuing."
    });
  }
  return outcome(decision, delta, "unchanged", `${evidence.item} was not added on this scan.`);
}

function bankQuantityOutcome(
  decision: RecommendationDecision,
  delta: AccountSnapshotDelta,
  evidence: Extract<RecommendationCompletionEvidence, { kind: "bank_quantity_at_least" }>
): RecommendationOutcome {
  if (!available(delta.availability.bank)) return unknown(decision, delta, "The bank was not available in this scan.");
  const movements = [...delta.bank.added, ...delta.bank.quantityChanged, ...delta.bank.removed];
  const movement = movements.find((item) => evidence.itemId !== undefined
    ? item.id === evidence.itemId
    : sameSubject(item.name, evidence.item));
  if (!movement) return outcome(decision, delta, "unchanged", `${evidence.item} did not change in the bank.`);
  return numericOutcome(decision, delta, {
    before: movement.beforeQuantity,
    after: movement.afterQuantity,
    delta: movement.delta,
    confidence: "observed"
  }, evidence.target, "items");
}

function slayerOutcome(
  decision: RecommendationDecision,
  delta: AccountSnapshotDelta,
  evidence: Extract<RecommendationCompletionEvidence, { kind: "slayer_task_finished" }>
): RecommendationOutcome {
  if (!available(delta.availability.slayer)) return unknown(decision, delta, "Slayer progress was not available in this scan.");
  const task = delta.slayer;
  const targetTask = evidence.taskId ?? task.taskId.before;
  const wasTarget = targetTask === null || task.taskId.before === targetTask;
  const rewardMoved = (task.points?.delta ?? 0) > 0 || (task.streak?.delta ?? 0) > 0;
  if (wasTarget && task.taskId.changed) {
    if (rewardMoved || task.taskRemaining?.after === 0) {
      return outcome(decision, delta, "completed", `${evidence.taskName ?? "Slayer task"} finished and RuneLite sees the next task state.`, {
        nextStopPoint: "Task finished. Re-plan from the new assignment."
      });
    }
    return outcome(decision, delta, "contradicted", "The Slayer task changed without enough evidence that it was completed.", {
      nextStopPoint: "Check the new task before continuing."
    });
  }
  const remaining = task.taskRemaining;
  if (!remaining || !wasTarget) return outcome(decision, delta, "unchanged", "The tracked Slayer task did not move.");
  const target = 0;
  if (remaining.confidence === "source-regression" || remaining.after > remaining.before) {
    return outcome(decision, delta, "contradicted", "The remaining task count increased, so this is probably a different assignment.", {
      nextStopPoint: "Check the task before continuing."
    });
  }
  if (remaining.after === target && remaining.before > target) {
    return outcome(decision, delta, "completed", `${evidence.taskName ?? "Slayer task"} reached 0 remaining.`, {
      nextStopPoint: "Task finished. Re-plan from the next assignment."
    });
  }
  if (remaining.delta < 0) {
    const progress: RecommendationOutcomeProgress = {
      before: remaining.before,
      after: remaining.after,
      target,
      remaining: remaining.after,
      unit: "task"
    };
    return outcome(decision, delta, "progressed", `${remaining.after.toLocaleString("en-US")} ${evidence.taskName ?? "task monsters"} left.`, {
      progress,
      nextStopPoint: `Finish the remaining ${remaining.after.toLocaleString("en-US")}.`
    });
  }
  return outcome(decision, delta, "unchanged", "The remaining Slayer task count did not change.");
}

export function reconcileRecommendationOutcome({
  decision,
  delta,
  syncSummary
}: ReconcileRecommendationOutcomeInput): RecommendationOutcome {
  const evidence = decision.completion.evidence;
  if (delta.kind === "first-sync") return unknown(decision, delta, "A previous RuneLite scan is needed before progress can be compared.");
  if (evidence.kind === "manual_confirmation") return unknown(decision, delta, "This stop point still needs a manual check.");

  if (evidence.kind === "boss_kc_at_least") {
    if (!available(delta.availability.bossKc)) return unknown(decision, delta, "Boss KC was not available in this scan.");
    const match = delta.bossKc.find((entry) => sameSubject(entry.boss, evidence.boss));
    return match?.movement
      ? numericOutcome(decision, delta, match.movement, evidence.target, "KC")
      : outcome(decision, delta, "unchanged", `No ${evidence.boss} KC change was found.`);
  }

  if (evidence.kind === "skill_level_at_least") {
    if (!available(delta.availability.skills)) return unknown(decision, delta, "Skill progress was not available in this scan.");
    const match = delta.skills.find((skill) => sameSubject(skill.name, evidence.skill));
    if (!match?.level) return outcome(decision, delta, "unchanged", `No ${evidence.skill} progress was found.`);
    const levelResult = numericOutcome(decision, delta, match.level, evidence.target, "level");
    if (levelResult.status !== "unchanged" || !match.xp || match.xp.delta <= 0) return levelResult;
    const levelsLeft = Math.max(0, evidence.target - match.level.after);
    return outcome(
      decision,
      delta,
      "progressed",
      `Gained ${match.xp.delta.toLocaleString("en-US")} ${evidence.skill} XP. Level ${evidence.target} is still ${levelsLeft} level${levelsLeft === 1 ? "" : "s"} away.`,
      {
        progress: {
          before: match.level.before,
          after: match.level.after,
          target: evidence.target,
          remaining: levelsLeft,
          unit: "level"
        },
        nextStopPoint: `Keep going to level ${evidence.target}.`
      }
    );
  }

  if (evidence.kind === "quest_completed") {
    if (!available(delta.availability.quests)) return unknown(decision, delta, "Quest progress was not available in this scan.");
    if (delta.quests.added.some((quest) => sameSubject(quest, evidence.quest))) {
      return outcome(decision, delta, "completed", `${evidence.quest} was completed.`, { nextStopPoint: "Quest finished. Pick the next unlock." });
    }
    if (delta.quests.removed.some((quest) => sameSubject(quest, evidence.quest))) {
      return outcome(decision, delta, "contradicted", `${evidence.quest} disappeared from the reported quest state.`, { nextStopPoint: "Re-scan quests before continuing." });
    }
    return outcome(decision, delta, "unchanged", `${evidence.quest} was not completed on this scan.`);
  }

  if (evidence.kind === "diary_completed") {
    if (!available(delta.availability.diaries)) return unknown(decision, delta, "Diary progress was not available in this scan.");
    const match = (entry: { region: string; tier: string }) => sameSubject(entry.region, evidence.region) && sameSubject(entry.tier, evidence.tier);
    if (delta.diaries.added.some(match)) {
      return outcome(decision, delta, "completed", `${evidence.region} ${evidence.tier} was completed.`, { nextStopPoint: "Diary tier finished. Pick the next unlock." });
    }
    if (delta.diaries.removed.some(match)) {
      return outcome(decision, delta, "contradicted", `${evidence.region} ${evidence.tier} disappeared from the reported diary state.`, { nextStopPoint: "Re-scan diaries before continuing." });
    }
    return outcome(decision, delta, "unchanged", `${evidence.region} ${evidence.tier} was not completed on this scan.`);
  }

  if (evidence.kind === "collection_log_item_obtained") {
    return collectionLogOutcome(decision, delta, evidence, syncSummary);
  }
  if (evidence.kind === "slayer_task_finished") return slayerOutcome(decision, delta, evidence);
  if (evidence.kind === "bank_quantity_at_least") return bankQuantityOutcome(decision, delta, evidence);
  if (!available(delta.availability.bank)) return unknown(decision, delta, "The bank was not available in this scan.");
  return delta.bank.status === "changed" && delta.bank.totalChangedItems > 0
    ? outcome(decision, delta, "completed", "The planned bank change was found.", { nextStopPoint: "Bank change saved. Build the next trip." })
    : outcome(decision, delta, "unchanged", "No bank change for this plan was found.");
}
