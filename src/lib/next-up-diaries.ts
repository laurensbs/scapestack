// Achievement Diary recommendations and the diary half of the next-best-action
// queue.
//
// Diary data comes from the Wiki via scripts/build-diary-data.mjs, so exact
// skill requirements per tier are known for all 12 regions. The engine
// suggests the highest tier the player *just barely* meets — at least one
// requirement within a few levels — so it reads as a stretch rather than a
// trivial pass. Tiers a maxed account already cleared are skipped.
//
// Copy rule enforced by tests/diary-copy-regression.ts: meeting the skill
// gates is never presented as proof that every task in the tier is done.

import { type DiaryRecord, type DiaryTier } from "./diary-db";
import type { QuestBankItem } from "./quest-requirements";
import { skillCapeId } from "./skill-capes";
import { buildDiaryTierProgress } from "./diary-task-progress";
import { diaryRewardFor } from "./diary-rewards";
import {
  diaryBlockerCount,
  diaryCompletedRequirementLines,
  diaryMissingRequirementLines,
  diaryReadinessLabel,
  diaryReadinessSummary,
  diaryTierKey,
  evaluateDiaryTier,
  type DiaryRequirementEvaluation
} from "./diary-requirements";
import type { CompletionItem } from "./goals";
import { computeTotalLevel, type HiscoreSkill } from "./hiscores";
import type { PlannerAccountType } from "./account-type";
import type {
  NextBestAction,
  NextBestActionKind,
  NextBestActionPreparation,
  Recommendation
} from "./next-up-types";

// ── Achievement Diaries ─────────────────────────────────────────────────────
// Diary data comes from the Wiki via scripts/build-diary-data.mjs. For each
// of the 12 regions we know exact skill requirements per tier. The engine
// suggests the *highest tier the player just barely meets* — the tier where
// at least one skill req is within 5 levels of the player's actual level, so
// it feels like a stretch rather than a trivial pass. Lower tiers a maxed
// account already cleared are skipped automatically.
export const DIARY_TIERS_ORDER: DiaryTier[] = ["Easy", "Medium", "Hard", "Elite"];

// Reward icons come from diary-rewards.ts — this module used to keep its own
// copy of that table, which is exactly how the two drift apart.

function diaryUnlockValue(tier: DiaryTier): number {
  return { Easy: 55, Medium: 68, Hard: 82, Elite: 94 }[tier];
}

function diaryItemLabel(req: DiaryRequirementEvaluation["itemRequirements"][number]): string {
  return `${req.quantity > 1 ? `${req.quantity}x ` : ""}${req.name}`;
}

function diaryPreparation(evaluation: DiaryRequirementEvaluation, kind: NextBestActionKind): NextBestActionPreparation {
  if (kind === "do-diary" && evaluation.tier !== "Elite") return "Low";
  if (evaluation.tier === "Elite" || evaluation.missingRequirements.length > 5 || kind === "train-diary-skill") return "High";
  return "Medium";
}

function buildDiaryAction(evaluation: DiaryRequirementEvaluation): NextBestAction | null {
  if (evaluation.readinessStatus === "completed") return null;

  const missingSkills = evaluation.skillRequirements.filter((req) => !req.met);
  const missingTiers = evaluation.tierDependencies.filter((req) => !req.met);
  const missingQuests = evaluation.questRequirements.filter((req) => !req.met);
  const missingItems = evaluation.bank.notApplicable ? [] : evaluation.bank.missing;
  const unlockValue = diaryUnlockValue(evaluation.tier);
  const unlockLabel = `${evaluation.region} ${evaluation.tier} diary`;
  const reward = diaryRewardFor(evaluation.region, evaluation.tier);
  const requiredItems = evaluation.itemRequirements.slice(0, 6).map(diaryItemLabel);
  const accountTypeNote = evaluation.accountWarnings[0];

  if (missingSkills.length === 0 && missingTiers.length === 0 && missingQuests.length === 0 && missingItems.length === 0) {
    const kind: NextBestActionKind = "do-diary";
    return {
      id: `nba:diary:${evaluation.region}:${evaluation.tier}`,
      kind,
      title: `Finish ${reward.name}`,
      reason: `${diaryReadinessSummary(evaluation)} Payoff: ${evaluation.payoff}`,
      missingRequirements: evaluation.bank.notApplicable ? diaryMissingRequirementLines(evaluation) : [],
      requiredItems,
      preparation: diaryPreparation(evaluation, kind),
      relevantQuestOrUnlock: evaluation.payoff,
      unlockValue,
      iconItemId: reward.itemId,
      accountTypeNote
    };
  }

  if (missingSkills.length > 0 && missingSkills.length <= 2) {
    const closest = missingSkills
      .map((req) => ({ ...req, gap: req.level - req.currentLevel }))
      .sort((a, b) => a.gap - b.gap)[0];
    const widestGap = Math.max(...missingSkills.map((req) => req.level - req.currentLevel));
    if (closest && closest.gap <= 10 && widestGap <= 10) {
      const kind: NextBestActionKind = "train-diary-skill";
      return {
        id: `nba:diary-skill:${evaluation.region}:${evaluation.tier}:${closest.skill}`,
        kind,
        title: `Train ${closest.skill} to ${closest.level} for ${unlockLabel}`,
        reason: `${closest.level} ${closest.skill} needed, you have ${closest.currentLevel}; that is the nearest diary step.`,
        missingRequirements: diaryMissingRequirementLines(evaluation),
        requiredItems,
        preparation: diaryPreparation(evaluation, kind),
        relevantQuestOrUnlock: unlockLabel,
        unlockValue: Math.max(1, unlockValue - closest.gap),
        iconItemId: skillCapeId(closest.skill),
        accountTypeNote
      };
    }
  }

  if (missingTiers.length === 0 && missingSkills.length === 0 && missingQuests.length === 0 && missingItems.length > 0 && missingItems.length <= 5) {
    const kind: NextBestActionKind = "collect-diary-items";
    return {
      id: `nba:diary-items:${evaluation.region}:${evaluation.tier}`,
      kind,
      title: `Collect ${missingItems.length} item${missingItems.length === 1 ? "" : "s"} for ${unlockLabel}`,
      reason: `${unlockLabel} is blocked by bank prep; finishing the item list unlocks ${evaluation.payoff}`,
      missingRequirements: diaryMissingRequirementLines(evaluation),
      requiredItems,
      preparation: diaryPreparation(evaluation, kind),
      relevantQuestOrUnlock: unlockLabel,
      unlockValue: Math.max(1, unlockValue - 5),
      iconItemId: reward.itemId,
      accountTypeNote
    };
  }

  if (missingSkills.length === 0 && (missingTiers.length > 0 || missingQuests.length > 0) && missingTiers.length + missingQuests.length <= 3) {
    const nextBlocker = missingQuests[0]?.name ?? `${evaluation.region} ${missingTiers[0]?.tier} diary`;
    const kind: NextBestActionKind = "complete-diary-prereq";
    return {
      id: `nba:diary-prereq:${evaluation.region}:${evaluation.tier}`,
      kind,
      title: `Complete ${nextBlocker} for ${unlockLabel}`,
      reason: `${unlockLabel} is close, but prerequisite progress blocks the payoff: ${evaluation.payoff}`,
      missingRequirements: diaryMissingRequirementLines(evaluation),
      requiredItems,
      preparation: diaryPreparation(evaluation, kind),
      relevantQuestOrUnlock: unlockLabel,
      unlockValue: Math.max(1, unlockValue - (missingTiers.length + missingQuests.length) * 4),
      iconItemId: reward.itemId,
      accountTypeNote
    };
  }

  return null;
}

export function diaryNextBestActions(input: {
  diaries: Map<string, DiaryRecord>;
  skills: HiscoreSkill[];
  bankItems: QuestBankItem[];
  accountType: PlannerAccountType | null;
  completedQuestNames?: Set<string>;
  completedDiaryTiers?: Set<string>;
  knownQuestNames?: Iterable<string>;
}): NextBestAction[] {
  if (input.skills.length === 0 || input.diaries.size === 0) return [];
  const completedQuests = input.completedQuestNames ? [...input.completedQuestNames] : [];
  const actions: NextBestAction[] = [];

  for (const [region, diary] of input.diaries) {
    for (const tier of DIARY_TIERS_ORDER) {
      const key = diaryTierKey(region, tier);
      if (input.completedDiaryTiers?.has(key)) continue;
      const evaluation = evaluateDiaryTier(region, tier, diary, {
        skills: input.skills,
        completedQuests,
        completedDiaryTiers: input.completedDiaryTiers,
        bankItems: input.bankItems,
        accountType: input.accountType,
        knownQuestNames: input.knownQuestNames
      });
      const action = buildDiaryAction(evaluation);
      if (action) actions.push(action);
    }
  }

  return actions
    .sort((a, b) => b.unlockValue - a.unlockValue)
    .slice(0, 6);
}

// ── Boss KC-aware insights ──────────────────────────────────────────────────

export function diaryRecs(
  diaries: Map<string, DiaryRecord>,
  skills: HiscoreSkill[],
  context: {
    bank: CompletionItem[];
    accountType: PlannerAccountType | null;
    completedQuestNames?: Set<string>;
    completedDiaryTiers?: Set<string>;
    /** Quest titles from the quest database, used to validate derived gates. */
    knownQuestNames?: Iterable<string>;
  }
): Recommendation[] {
  if (skills.length === 0 || diaries.size === 0) return [];

  // Heuristic for "this player almost certainly already finished all diaries":
  // total level >= 2100. There's no Hiscores activity for diary completion, so
  // we use a level proxy. Below 2100, gap-filter on a per-region basis. Above
  // 2100, suppress all diary recs entirely — the audit found maxed accounts
  // were getting 7 Elite-diary recs as their top picks, which is nonsense.
  const totalLevel = computeTotalLevel(skills);
  if (totalLevel >= 2100 && !context.completedDiaryTiers) return [];

  const recs: Recommendation[] = [];
  const completedQuests = context.completedQuestNames ? [...context.completedQuestNames] : [];
  const bankItems = context.bank.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity
  }));
  for (const [region, d] of diaries) {
    // Prefer the highest concrete tier that is ready, close, or blocked by
    // a small number of actionable requirements. Exact RuneLite sync skips
    // already completed tiers.
    let best:
      | { tier: DiaryTier; evaluation: DiaryRequirementEvaluation; nearestGap: number; score: number }
      | null = null;
    for (let i = DIARY_TIERS_ORDER.length - 1; i >= 0; i--) {
      const tier = DIARY_TIERS_ORDER[i];
      if (context.completedDiaryTiers?.has(diaryTierKey(region, tier))) continue;
      const evaluation = evaluateDiaryTier(region, tier, d, {
        skills,
        completedQuests,
        completedDiaryTiers: context.completedDiaryTiers,
        bankItems,
        accountType: context.accountType,
        knownQuestNames: context.knownQuestNames
      });
      if (evaluation.readinessStatus === "completed") continue;
      const skillGaps = evaluation.skillRequirements.map((req) => req.level - req.currentLevel);
      const maxMissingSkillGap = Math.max(0, ...skillGaps);
      const nearestHeadroom = Math.min(...skillGaps.map((gap) => -gap));
      const blockerCount = evaluation.missingRequirements.length;
      const actionable =
        evaluation.readinessStatus === "ready"
        || evaluation.readinessStatus === "partially-ready"
        || evaluation.readinessStatus === "missing-items"
        || (evaluation.readinessStatus === "missing-quests" && blockerCount <= 3)
        || (evaluation.readinessStatus === "missing-skill-levels" && maxMissingSkillGap <= 10 && blockerCount <= 5);
      if (!actionable) continue;
      const tierBoost = { Easy: 0, Medium: 6, Hard: 14, Elite: 22 }[tier];
      const readinessBoost =
        evaluation.readinessStatus === "ready" ? 14
        : evaluation.readinessStatus === "partially-ready" || evaluation.readinessStatus === "missing-items" ? 9
        : evaluation.readinessStatus === "missing-quests" ? 5
        : 4;
      const freshness = Math.max(0, 8 - Math.max(0, maxMissingSkillGap));
      const score = 34 + tierBoost + readinessBoost + freshness - Math.max(0, blockerCount - 1) * 3;
      best = { tier, evaluation, nearestGap: Math.max(0, -nearestHeadroom), score };
      break;
    }
    if (!best) continue;

    const { tier, evaluation, score } = best;
    const diaryProgress = buildDiaryTierProgress({
      evaluation,
      tasks: d.tiers[tier]?.tasks ?? [],
      exactCompleted: context.completedDiaryTiers,
      bankItems
    });
    const blockers = diaryMissingRequirementLines(evaluation);
    const tasks = diaryProgress.tasks
      .filter((task) => task.status === "to-confirm")
      .map((task) => task.label);
    const completed = diaryCompletedRequirementLines(evaluation).slice(0, 4);
    const blockersText = blockers.length > 0 ? blockers.join(", ") : "ready for task sweep";
    const skillBlocker = evaluation.skillRequirements
      .filter((req) => !req.met)
      .map((req) => ({ ...req, gap: req.level - req.currentLevel }))
      .sort((a, b) => a.gap - b.gap)[0];
    const missingQuest = evaluation.questRequirements.find((req) => !req.met);
    const missingItems = evaluation.bank.notApplicable ? [] : evaluation.bank.missing;
    const title = region === "Karamja"
      ? `Finish ${diaryProgress.rewardName}`
      : skillBlocker
        ? `Train ${skillBlocker.skill} for ${region} ${tier}`
      : missingQuest
        ? `Finish ${missingQuest.name} for ${region} ${tier}`
        : missingItems.length > 0
          ? `Collect diary items for ${region} ${tier}`
          : `Do ${region} ${tier}`;
    const blockerCount = diaryBlockerCount(evaluation);
    const why = blockerCount > 0
      ? `${region} ${tier} is ${blockerCount} step${blockerCount === 1 ? "" : "s"} away: ${blockersText}.`
      : diaryProgress.remainingTasks > 0
        ? `${diaryProgress.remainingTasks} exact task${diaryProgress.remainingTasks === 1 ? "" : "s"} left. Start with: ${diaryProgress.nextTask}`
        : `${region} ${tier} is ready to claim.`;

    recs.push({
      id: `diary:${region}:${tier}`,
      kind: "diary",
      title,
      why,
      payoff: evaluation.payoff,
      decisionReason: `${diaryReadinessLabel(evaluation.readinessStatus)}: ${blockersText}. ${diaryProgress.remainingTasks} diary tasks still need confirmation. Finish after: ${diaryProgress.stopPoint}`,
      needs: [...blockers, ...tasks.slice(0, 3)].slice(0, 5),
      score,
      iconItemId: diaryProgress.rewardItemId,
      completionTarget: { kind: "diary_completed", region, tier },
      diaryProgress,
      routeTags: ["unlock", "maxing", "returning"],
      gearConfidence: "likely",
      quality: {
        accountFit: 0.78,
        actionability: evaluation.readinessStatus === "ready" ? 0.9 : evaluation.readinessStatus === "missing-skill-levels" ? 0.68 : 0.76,
        stopPoint: 0.84,
        gearConfidence: evaluation.bank.checked ? 0.86 : evaluation.bank.notApplicable ? 0.64 : 0.62,
        unlockValue: tier === "Elite" ? 0.92 : 0.82,
        fun: 0.56,
        friction: tier === "Elite" ? 0.52 : evaluation.missingRequirements.length > 0 ? 0.4 : 0.24
      },
      planSeed: {
        timebox: tier === "Elite" ? "1-2 hr" : "45-90 min",
        prep: evaluation.bank.notApplicable
          ? `${region} ${tier}: use staging/carry/storage planning instead of bank-ready.`
            : blockers.length > 0
            ? `${region} ${tier}: clear ${blockers[0]} first.`
            : `${region} ${tier}: start with ${diaryProgress.nextTask ?? `claim ${diaryProgress.rewardName}`}.`,
        steps: [
          ...blockers.slice(0, 2).map((blocker) => {
            const missingTier = blocker.match(/^(.+) diary missing$/i);
            return missingTier ? `Finish ${missingTier[1]} first.` : `Clear ${blocker}.`;
          }),
          ...(completed.length > 0 && blockers.length > 0 ? [`Already handled: ${completed.join(", ")}.`] : []),
          ...tasks.slice(0, blockers.length > 0 ? 1 : 3),
          `Claim ${diaryProgress.rewardName}, then press Sync in RuneLite.`
        ].slice(0, 4),
        caveat: evaluation.accountWarnings[0]
      }
    });
  }
  return recs;
}
