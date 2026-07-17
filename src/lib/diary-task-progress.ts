import type { DiaryTaskDefinition, DiaryTier } from "./diary-db";
import type { DiaryRequirementEvaluation } from "./diary-requirements";
import {
  DIARY_TIER_ORDER,
  diaryRewardFor,
  diaryTierCompletionEvidence,
  type DiaryRewardBankItem
} from "./diary-rewards";

export type DiaryTaskEvidence = "runelite" | "reward" | "manual" | "unknown";

export interface DiaryTaskProgressItem extends DiaryTaskDefinition {
  status: "done" | "to-confirm";
  evidence: DiaryTaskEvidence;
}

export interface DiaryTierProgress {
  region: string;
  tier: DiaryTier;
  rewardName: string;
  rewardItemId: number;
  payoff: string;
  completionEvidence: "runelite" | "reward" | null;
  tasks: DiaryTaskProgressItem[];
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  nextSweepTaskIds: string[];
  nextTask: string | null;
  blockers: string[];
  preparation: string[];
  stopPoint: string;
}

function unique(values: string[]): string[] {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function itemBlockerCopy(
  region: string,
  requirement: DiaryRequirementEvaluation["itemRequirements"][number]
): string {
  const candidates = [requirement.name, ...requirement.alternatives.map((alternative) => alternative.name)]
    .map((name) => name.toLowerCase());
  const diaryReward = DIARY_TIER_ORDER
    .map((tier) => diaryRewardFor(region, tier))
    .find((reward) => candidates.includes(reward.name.toLowerCase()));

  return diaryReward ? `Claim ${diaryReward.name} first` : requirement.availabilityCopy;
}

export function buildDiaryTierProgress(input: {
  evaluation: DiaryRequirementEvaluation;
  tasks: DiaryTaskDefinition[];
  exactCompleted?: Iterable<string>;
  bankItems?: DiaryRewardBankItem[];
  manualCompletedTaskIds?: Iterable<string>;
}): DiaryTierProgress {
  const { evaluation } = input;
  const completionEvidence = diaryTierCompletionEvidence({
    region: evaluation.region,
    tier: evaluation.tier,
    exactCompleted: input.exactCompleted ?? [],
    bankItems: input.bankItems ?? []
  });
  const manual = new Set(input.manualCompletedTaskIds ?? []);
  const tasks = input.tasks.map((task): DiaryTaskProgressItem => {
    if (completionEvidence) return { ...task, status: "done", evidence: completionEvidence };
    if (manual.has(task.id)) return { ...task, status: "done", evidence: "manual" };
    return { ...task, status: "to-confirm", evidence: "unknown" };
  });
  const unfinished = tasks.filter((task) => task.status === "to-confirm");
  const nextSweep = unfinished.slice(0, 3);
  const reward = diaryRewardFor(evaluation.region, evaluation.tier);
  const blockers = unique([
    ...evaluation.skillRequirements.filter((req) => !req.met).map((req) => `${req.level} ${req.skill} (${req.currentLevel} now)`),
    ...evaluation.tierDependencies.filter((req) => !req.met).map((req) => `Finish ${evaluation.region} ${req.tier} first`),
    ...evaluation.questRequirements.filter((req) => !req.met).map((req) => req.name),
    ...evaluation.itemRequirements.filter((req) => !req.met).map((req) => itemBlockerCopy(evaluation.region, req))
  ]);
  const preparation = unique([
    ...blockers,
    ...(nextSweep[0]?.requirements ?? [])
  ]).slice(0, 6);
  const completedTasks = tasks.length - unfinished.length;

  return {
    region: evaluation.region,
    tier: evaluation.tier,
    rewardName: reward.name,
    rewardItemId: reward.itemId,
    payoff: evaluation.payoff,
    completionEvidence,
    tasks,
    totalTasks: tasks.length,
    completedTasks,
    remainingTasks: unfinished.length,
    nextSweepTaskIds: nextSweep.map((task) => task.id),
    nextTask: unfinished[0]?.label ?? null,
    blockers,
    preparation,
    stopPoint: completionEvidence
      ? "the claimed reward."
      : unfinished.length === 0
        ? `claiming ${reward.name} and syncing RuneLite.`
        : `the next ${nextSweep.length} task${nextSweep.length === 1 ? "" : "s"} in this sweep.`
  };
}
