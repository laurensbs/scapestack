// Quest recommendations and the quest half of the next-best-action queue.
//
// Quest data comes from the Wiki via scripts/build-quest-data.mjs.
//
// The engine is deliberately permissive about prerequisites when it only has
// Hiscores: QP total is all it can see, so it suggests a quest when the skill
// requirements are met and the QP gate is cleared, then lists the direct
// prereqs as context. A RuneLite sync replaces that guesswork with the real
// completed-quest set, which is the whole point of the plugin.

import { questSlug, type QuestRecord } from "./quest-db";
import type { QuestRequirementEvaluation } from "./quest-requirements";
import { buildQuestRoute, type QuestRouteEvidence } from "./quest-route";
import { isCuratedQuestUnlock, questUnlockSignal } from "./quest-unlocks";
import type { DiaryRecord } from "./diary-db";
import { skillCapeId } from "./skill-capes";
import type { CompletionItem } from "./goals";
import { computeCombatLevel, type HiscoreSkill } from "./hiscores";
import type { PlannerAccountType } from "./account-type";
import { lvl } from "./next-up-shared";
import { diaryNextBestActions } from "./next-up-diaries";
import type {
  NextBestAction,
  NextBestActionKind,
  NextBestActionPreparation,
  Recommendation
} from "./next-up-types";


// ── Quests ──────────────────────────────────────────────────────────────────
// Quest data comes from the Wiki via scripts/build-quest-data.mjs. We only
// surface the heavyweight, "what-now" worthy ones: Master / Grandmaster
// difficulty, OR "Special" (RFD, miniquests with big rewards). Anything
// shorter would clutter the hub for high-level players.
//
// The recommendation logic is permissive on prerequisites: we can't tell
// from Hiscores which quests a player has actually completed, only their
// QP total. So we suggest a quest when the player meets every skill req
// AND has enough QP for the quest's QP-gate, and then list the *direct*
// quest prereqs as context — the player knows whether they've done them.
export const QUEST_CAPE_QP_THRESHOLD = 290;

export function questRecs(
  quests: Map<string, QuestRecord>,
  skills: HiscoreSkill[],
  qp: number | null,
  completedQuestNames: Set<string> | undefined,
  bank: CompletionItem[],
  accountType: PlannerAccountType | null,
  completionEvidence: Exclude<QuestRouteEvidence, "unknown"> | undefined
): Recommendation[] {
  if (skills.length === 0) return [];
  if (qp !== null && qp >= QUEST_CAPE_QP_THRESHOLD) return [];
  const combatLevel = computeCombatLevel(skills);
  const recs: Recommendation[] = [];
  const bankItems = bank.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity }));
  for (const q of quests.values()) {
    if (completedQuestNames && completedQuestNames.has(q.name.toLowerCase())) continue;
    // Filter to recommendation-worthy difficulty. "Special" covers RFD and
    // a handful of other big multi-part quests.
    if (q.difficulty !== "Master" && q.difficulty !== "Grandmaster" && q.difficulty !== "Special") continue;
    // The Wiki-derived quest data covers skill/QP gates but not practical
    // boss-fight requirements. Low-combat skillers should not be pushed into
    // SOTE/Blood Moon/MM2 just because their non-combat skills qualify.
    if (combatLevel < 50 && (q.difficulty === "Master" || q.difficulty === "Grandmaster")) continue;
    if (combatLevel < 70 && q.difficulty === "Grandmaster") continue;
    // Skill gates — every required skill must be met.
    const meets = q.skillReqs.every((r) => lvl(skills, r.skill) >= r.level);
    if (!meets) continue;
    // QP gate. Unknown QP (null — the normal case, the Hiscores do not
    // publish it) skips the check: bad recs are recoverable, hiding a good
    // rec is invisible damage.
    if (q.qpReq > 0 && qp !== null && qp > 0 && qp < q.qpReq) continue;

    const unlock = questUnlockSignal(q);
    const route = buildQuestRoute(q, quests, {
      skills,
      completedQuestNames,
      completionCoverage: completedQuestNames && !completionEvidence ? "partial" : "complete",
      completionEvidence,
      bankItems,
      accountType,
      payoff: unlock.label
    });
    const { progress, activeEvaluation, activeQuest } = route;

    // Score the target unlock, but charge friction for the remaining route.
    // A short executable block can still surface; a large unknown chain cannot
    // masquerade as one quest session.
    const base = q.difficulty === "Grandmaster" ? 70 : q.difficulty === "Master" ? 60 : 55;
    const prereqPenalty = progress.prerequisiteDepth === "long" ? 24 : progress.prerequisiteDepth === "short" ? 9 : 0;
    const executableBonus = progress.expectedBlockMinutes.max <= 45 ? 5 : progress.activeIsTarget ? 3 : 0;
    const score = base + executableBonus - prereqPenalty;
    const firstPrep = progress.skillPreparation[0]
      ?? progress.missingItems[0]
      ?? (activeEvaluation.readinessStatus === "ready-to-start" ? `Start ${activeQuest.name}.` : progress.bankNote);
    const nextStep = progress.nextQuestName
      ? `Next route after this: ${progress.nextQuestName}.`
      : `Stop after ${activeQuest.name} and replan.`;
    const targetQuery = progress.activeIsTarget ? "" : `?target=${encodeURIComponent(questSlug(q.name))}`;

    recs.push({
      id: `quest:${q.name}`,
      kind: "quest",
      questName: activeQuest.name,
      title: `Do ${activeQuest.name}`,
      why: `${progress.expectedBlock} toward ${unlock.label}.`,
      payoff: progress.activeIsTarget ? `Unlocks ${unlock.label}.` : `${q.name} remains the larger unlock route.`,
      decisionReason: progress.whyThisBlock,
      needs: [
        ...progress.skillPreparation,
        ...progress.missingItems,
        ...(!activeEvaluation.bank.checked && activeEvaluation.itemRequirements.length > 0 ? [progress.bankNote] : [])
      ].slice(0, 5),
      score,
      link: `/quests/${progress.activeQuestSlug}${targetQuery}`,
      completionTarget: { kind: "quest_completed", quest: activeQuest.name },
      questRoute: progress,
      routeTags: ["unlock", ...(progress.remainingBlocks <= 2 ? ["returning" as const] : []), ...(q.difficulty === "Grandmaster" ? ["fun" as const] : [])],
      gearConfidence: activeQuest.difficulty === "Grandmaster" ? "unknown" : "likely",
      sessionProfile: {
        minimumMinutes: progress.expectedBlockMinutes.min,
        prerequisiteDepth: progress.prerequisiteDepth,
        resetCost: progress.prerequisiteDepth === "long" ? "high" : "moderate"
      },
      quality: {
        accountFit: progress.completionEvidence === "unknown" ? 0.48 : 0.82,
        actionability: activeEvaluation.readinessStatus === "ready-to-start" ? 0.92 : progress.skillPreparation.length <= 1 ? 0.7 : 0.48,
        stopPoint: 0.9,
        gearConfidence: activeEvaluation.bank.checked ? 0.86 : activeQuest.difficulty === "Grandmaster" ? 0.48 : 0.66,
        unlockValue: q.difficulty === "Grandmaster" ? 0.96 : 0.86,
        fun: q.difficulty === "Grandmaster" ? 0.72 : 0.58,
        friction: progress.prerequisiteDepth === "long" ? 0.82 : progress.prerequisiteDepth === "short" ? 0.48 : 0.22
      },
      planSeed: {
        timebox: progress.expectedBlock,
        prep: firstPrep,
        steps: [
          firstPrep,
          activeEvaluation.bank.checked && progress.ownedItems.length > 0
            ? `Pull ${progress.ownedItems.slice(0, 3).join(", ")} from your bank.`
            : `Open the ${activeQuest.name} Wiki guide for the exact quest steps.`,
          progress.stopPoint,
          nextStep
        ].filter((step, index, steps) => steps.indexOf(step) === index).slice(0, 4)
      }
    });
  }
  return recs;
}

export function completedQuestKnown(completedQuestNames: Set<string> | undefined, questName: string): boolean {
  return completedQuestNames?.has(questName.toLowerCase()) ?? false;
}

function relevantQuestPool(quests: Map<string, QuestRecord>): QuestRecord[] {
  return [...quests.values()].filter((quest) => {
    if (isCuratedQuestUnlock(quest.name)) return true;
    if (quest.difficulty === "Grandmaster" || quest.difficulty === "Master" || quest.difficulty === "Special") return true;
    if (quest.difficulty === "Intermediate" && quest.questReqs.length <= 3) return true;
    return false;
  });
}

function itemLabel(req: QuestRequirementEvaluation["itemRequirements"][number]): string {
  return `${req.quantity > 1 ? `${req.quantity}x ` : ""}${req.name}`;
}

function missingItemLabel(req: QuestRequirementEvaluation["itemRequirements"][number]): string {
  if (!req.ownedInBank && req.availability?.shortCopy && !req.availability.copy.includes("account mode is unknown")) {
    return req.availability.shortCopy;
  }
  if (req.missingQuantity <= 0) return itemLabel(req);
  return `${req.missingQuantity > 1 ? `${req.missingQuantity}x ` : ""}${req.name}`;
}

function preparationForQuest(
  quest: QuestRecord,
  evaluation: QuestRequirementEvaluation,
  kind: NextBestActionKind
): NextBestActionPreparation {
  const missingCount = evaluation.missingRequirements.length;
  if (
    kind === "do-quest"
    && quest.length !== "Long"
    && quest.length !== "Very Long"
    && quest.difficulty !== "Grandmaster"
    && missingCount === 0
  ) {
    return "Low";
  }
  if (
    kind === "train-skill"
    || quest.length === "Long"
    || quest.length === "Very Long"
    || quest.difficulty === "Grandmaster"
    || missingCount > 5
  ) {
    return "High";
  }
  return "Medium";
}

function buildQuestAction(
  quest: QuestRecord,
  evaluation: QuestRequirementEvaluation,
  completedQuestNames: Set<string> | undefined
): NextBestAction | null {
  const missingSkills = evaluation.skillRequirements.filter((req) => !req.met);
  const missingQuests = evaluation.questRequirements.filter((req) => !req.met);
  const missingItems = evaluation.bank.notApplicable ? [] : evaluation.bank.missing;
  const unlock = questUnlockSignal(quest);
  const link = `/quests/${questSlug(quest.name)}`;
  const requiredItems = evaluation.itemRequirements.slice(0, 6).map(itemLabel);
  const accountTypeNote = evaluation.accountWarnings[0];

  if (missingSkills.length === 0 && missingQuests.length === 0 && missingItems.length === 0) {
    return {
      id: `nba:quest:${questSlug(quest.name)}`,
      kind: "do-quest",
      questName: quest.name,
      title: `Do ${quest.name}`,
      reason: `All visible requirements are met; unlocks ${unlock.label}.`,
      missingRequirements: [],
      requiredItems,
      preparation: preparationForQuest(quest, evaluation, "do-quest"),
      relevantQuestOrUnlock: unlock.label,
      unlockValue: unlock.value,
      link,
      iconItemId: unlock.iconItemId,
      accountTypeNote
    };
  }

  if (missingSkills.length === 0 && missingQuests.length === 0 && missingItems.length > 0 && missingItems.length <= 5) {
    const itemCount = missingItems.length;
    return {
      id: `nba:items:${questSlug(quest.name)}`,
      kind: "collect-items",
      questName: quest.name,
      title: `Collect ${itemCount} item${itemCount === 1 ? "" : "s"} for ${quest.name}`,
      reason: `${quest.name} is blocked mostly by bank prep; finishing the item list unlocks ${unlock.label}.`,
      missingRequirements: missingItems.map(missingItemLabel),
      requiredItems,
      preparation: preparationForQuest(quest, evaluation, "collect-items"),
      relevantQuestOrUnlock: unlock.label,
      unlockValue: Math.max(1, unlock.value - 6),
      link,
      iconItemId: unlock.iconItemId,
      accountTypeNote
    };
  }

  if (missingSkills.length > 0 && missingSkills.length <= 2) {
    const closest = missingSkills
      .map((req) => ({ ...req, gap: req.level - req.currentLevel }))
      .sort((a, b) => a.gap - b.gap)[0];
    const widestGap = Math.max(...missingSkills.map((req) => req.level - req.currentLevel));
    if (closest && closest.gap <= 10 && widestGap <= 10) {
      return {
        id: `nba:skill:${questSlug(quest.name)}:${closest.skill}`,
        kind: "train-skill",
        questName: quest.name,
        title: `Train ${closest.skill} to ${closest.level} for ${quest.name}`,
        reason: `${closest.skill} is ${closest.gap} level${closest.gap === 1 ? "" : "s"} short; that is the cleanest step before ${unlock.label}.`,
        missingRequirements: missingSkills.map((req) => `${req.skill} ${req.currentLevel}/${req.level}`),
        requiredItems,
        preparation: preparationForQuest(quest, evaluation, "train-skill"),
        relevantQuestOrUnlock: unlock.label,
        unlockValue: Math.max(1, unlock.value - closest.gap),
        link,
        iconItemId: skillCapeId(closest.skill),
        accountTypeNote
      };
    }
  }

  if (missingSkills.length === 0 && missingQuests.length > 0 && missingQuests.length <= 3) {
    const nextQuest = missingQuests.find((req) => !completedQuestKnown(completedQuestNames, req.name)) ?? missingQuests[0];
    return {
      id: `nba:prereq:${questSlug(quest.name)}`,
      kind: "complete-prereq",
      questName: nextQuest.name,
      title: `Complete ${nextQuest.name} for ${quest.name}`,
      reason: `${quest.name} is close, but the prereq chain blocks ${unlock.label}.`,
      missingRequirements: missingQuests.map((req) => req.name),
      requiredItems,
      preparation: preparationForQuest(quest, evaluation, "complete-prereq"),
      relevantQuestOrUnlock: unlock.label,
      unlockValue: Math.max(1, unlock.value - missingQuests.length * 4),
      link,
      iconItemId: unlock.iconItemId,
      accountTypeNote
    };
  }

  return null;
}

export function nextBestActions(input: {
  quests: Map<string, QuestRecord>;
  diaries: Map<string, DiaryRecord>;
  skills: HiscoreSkill[];
  bank: CompletionItem[];
  accountType: PlannerAccountType | null;
  completedQuestNames?: Set<string>;
  completedQuestNamesForRequirements?: Set<string>;
  questCompletionEvidence?: Exclude<QuestRouteEvidence, "unknown">;
  completedDiaryTiers?: Set<string>;
}): NextBestAction[] {
  const bankItems = input.bank.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity
  }));

  const questActions = relevantQuestPool(input.quests)
    .filter((quest) => !completedQuestKnown(input.completedQuestNames, quest.name))
    .map((quest): NextBestAction | null => {
      const unlock = questUnlockSignal(quest);
      const route = buildQuestRoute(quest, input.quests, {
        skills: input.skills,
        completedQuestNames: input.completedQuestNames,
        completionCoverage: input.completedQuestNames && !input.questCompletionEvidence ? "partial" : "complete",
        completionEvidence: input.questCompletionEvidence,
        bankItems,
        accountType: input.accountType,
        payoff: unlock.label
      });
      const action = buildQuestAction(route.activeQuest, route.activeEvaluation, input.completedQuestNames);
      if (!action) return null;

      const targetQuery = route.progress.activeIsTarget
        ? ""
        : `?target=${encodeURIComponent(questSlug(quest.name))}`;
      return {
        ...action,
        id: `${action.id}:toward:${questSlug(quest.name)}`,
        reason: `${route.progress.whyThisBlock} This route unlocks ${unlock.label}.`,
        relevantQuestOrUnlock: unlock.label,
        unlockValue: Math.max(action.unlockValue, unlock.value - Math.max(0, route.progress.remainingBlocks - 1) * 3),
        link: `/quests/${route.progress.activeQuestSlug}${targetQuery}`,
        iconItemId: action.kind === "train-skill" ? action.iconItemId : unlock.iconItemId
      };
    })
    .filter((action): action is NextBestAction => Boolean(action));
  const diaryActions = diaryNextBestActions({
    diaries: input.diaries,
    skills: input.skills,
    bankItems,
    accountType: input.accountType,
    completedQuestNames: input.completedQuestNamesForRequirements,
    completedDiaryTiers: input.completedDiaryTiers
  });

  return [...questActions, ...diaryActions]
    .sort((a, b) => {
      const kindWeight = (action: NextBestAction): number => {
        if (action.kind === "do-quest" || action.kind === "do-diary") return 18;
        if (action.kind === "collect-items" || action.kind === "collect-diary-items") return 12;
        if (action.kind === "train-skill" || action.kind === "train-diary-skill") return 8;
        if (action.kind === "complete-prereq" || action.kind === "complete-diary-prereq") return 6;
        return 0;
      };
      return (b.unlockValue + kindWeight(b)) - (a.unlockValue + kindWeight(a));
    })
    .slice(0, 20);
}
