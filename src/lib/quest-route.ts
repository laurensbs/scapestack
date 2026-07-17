import type { HiscoreSkill } from "./hiscores";
import type { PlannerAccountType } from "./account-type";
import { questSlug, type QuestRecord } from "./quest-db";
import {
  evaluateQuestRequirements,
  type QuestBankItem,
  type QuestRequirementEvaluation
} from "./quest-requirements";

export type QuestRouteEvidence = "runelite" | "tracker" | "unknown";
export type QuestPrerequisiteDepth = "none" | "short" | "long";

export interface QuestRouteProgress {
  targetQuestName: string;
  activeQuestName: string;
  activeQuestSlug: string;
  activeIsTarget: boolean;
  completionEvidence: QuestRouteEvidence;
  completedPrerequisites: string[];
  remainingPrerequisites: string[];
  remainingBlocks: number;
  nextQuestName: string | null;
  payoff: string;
  whyThisBlock: string;
  expectedBlock: string;
  expectedBlockMinutes: { min: number; max: number };
  chainEstimate: string;
  prerequisiteDepth: QuestPrerequisiteDepth;
  boostAssumption: string;
  skillPreparation: string[];
  ownedItems: string[];
  missingItems: string[];
  bankNote: string;
  stopPoint: string;
}

export interface QuestRouteBuildResult {
  progress: QuestRouteProgress;
  activeQuest: QuestRecord;
  activeEvaluation: QuestRequirementEvaluation;
}

interface QuestRouteContext {
  skills?: HiscoreSkill[];
  completedQuestNames?: Iterable<string>;
  completionEvidence?: Exclude<QuestRouteEvidence, "unknown">;
  bankItems?: QuestBankItem[];
  accountType?: PlannerAccountType | null;
  payoff: string;
}

const LENGTH_MINUTES: Record<string, { min: number; max: number }> = {
  "very short": { min: 10, max: 25 },
  short: { min: 20, max: 45 },
  medium: { min: 45, max: 75 },
  long: { min: 90, max: 150 },
  "very long": { min: 150, max: 240 }
};

function normalizedQuestName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function completedQuestSet(values: Iterable<string> | undefined): Set<string> {
  return new Set(Array.from(values ?? []).map(normalizedQuestName));
}

function questByName(quests: Map<string, QuestRecord>, name: string): QuestRecord | null {
  const direct = quests.get(name);
  if (direct) return direct;
  const normalized = normalizedQuestName(name);
  for (const quest of quests.values()) {
    if (normalizedQuestName(quest.name) === normalized) return quest;
  }
  return null;
}

export function questLengthMinutes(length: string | null): { min: number; max: number } {
  return LENGTH_MINUTES[(length ?? "medium").toLowerCase()] ?? LENGTH_MINUTES.medium;
}

function formatMinutes(range: { min: number; max: number }): string {
  if (range.min < 60) return `${range.min}-${range.max} min`;
  const start = Math.round(range.min / 30) / 2;
  const end = Math.round(range.max / 30) / 2;
  return `${start}-${end} hr`;
}

function unresolvedPrerequisites(
  target: QuestRecord,
  completed: Set<string>,
  completionKnown: boolean
): string[] {
  if (!completionKnown) return [...target.questReqs];
  return target.questReqs.filter((name) => !completed.has(normalizedQuestName(name)));
}

function unresolvedDependencyCount(quest: QuestRecord, completed: Set<string>): number {
  return quest.questReqs.filter((name) => !completed.has(normalizedQuestName(name))).length;
}

function pickExecutableQuest(
  target: QuestRecord,
  quests: Map<string, QuestRecord>,
  completed: Set<string>,
  completionKnown: boolean
): QuestRecord {
  if (!completionKnown) return target;
  const unresolved = unresolvedPrerequisites(target, completed, true)
    .map((name, index) => ({ quest: questByName(quests, name), index }))
    .filter((entry): entry is { quest: QuestRecord; index: number } => Boolean(entry.quest));
  if (unresolved.length === 0) return target;

  return unresolved
    .map((entry) => ({
      ...entry,
      dependencyCount: unresolvedDependencyCount(entry.quest, completed),
      duration: questLengthMinutes(entry.quest.length).max
    }))
    .sort((a, b) => {
      const aExecutable = a.dependencyCount === 0 ? 0 : 1;
      const bExecutable = b.dependencyCount === 0 ? 0 : 1;
      return aExecutable - bExecutable
        || a.dependencyCount - b.dependencyCount
        || a.duration - b.duration
        || a.index - b.index;
    })[0]?.quest ?? target;
}

function nextQuestAfter(
  target: QuestRecord,
  active: QuestRecord,
  quests: Map<string, QuestRecord>,
  completed: Set<string>,
  completionKnown: boolean
): string | null {
  if (!completionKnown || active.name === target.name) return null;
  const simulated = new Set(completed);
  simulated.add(normalizedQuestName(active.name));
  return pickExecutableQuest(target, quests, simulated, true).name;
}

function itemLabel(requirement: QuestRequirementEvaluation["itemRequirements"][number]): string {
  const name = requirement.ownedName ?? requirement.name;
  return `${requirement.quantity > 1 ? `${requirement.quantity}x ` : ""}${name}`;
}

function missingItemLabel(requirement: QuestRequirementEvaluation["itemRequirements"][number]): string {
  if (requirement.availability.shortCopy) return requirement.availability.shortCopy;
  const quantity = Math.max(1, requirement.missingQuantity);
  return `${quantity > 1 ? `${quantity}x ` : ""}${requirement.name}`;
}

function chainRange(
  target: QuestRecord,
  quests: Map<string, QuestRecord>,
  remainingPrerequisites: string[]
): { min: number; max: number } {
  const blocks = [
    ...remainingPrerequisites.map((name) => questByName(quests, name)).filter((quest): quest is QuestRecord => Boolean(quest)),
    target
  ];
  return blocks.reduce((sum, quest) => {
    const range = questLengthMinutes(quest.length);
    return { min: sum.min + range.min, max: sum.max + range.max };
  }, { min: 0, max: 0 });
}

export function buildQuestRoute(
  target: QuestRecord,
  quests: Map<string, QuestRecord>,
  context: QuestRouteContext
): QuestRouteBuildResult {
  const completionKnown = context.completedQuestNames !== undefined;
  const completed = completedQuestSet(context.completedQuestNames);
  const remainingPrerequisites = unresolvedPrerequisites(target, completed, completionKnown);
  const activeQuest = pickExecutableQuest(target, quests, completed, completionKnown);
  const activeEvaluation = evaluateQuestRequirements(activeQuest, {
    skills: context.skills,
    completedQuests: context.completedQuestNames,
    bankItems: context.bankItems,
    accountType: context.accountType
  });
  const activeRange = questLengthMinutes(activeQuest.length);
  const totalRange = chainRange(target, quests, remainingPrerequisites);
  const activeIsTarget = normalizedQuestName(activeQuest.name) === normalizedQuestName(target.name);
  const remainingBlocks = remainingPrerequisites.length + 1;
  const prerequisiteDepth: QuestPrerequisiteDepth = !completionKnown || remainingBlocks >= 5 || totalRange.min >= 120
    ? "long"
    : remainingBlocks > 1
      ? "short"
      : "none";
  const completedPrerequisites = completionKnown
    ? target.questReqs.filter((name) => completed.has(normalizedQuestName(name)))
    : [];
  const skillPreparation = activeEvaluation.skillRequirements
    .filter((requirement) => !requirement.met)
    .map((requirement) => `Train ${requirement.skill} ${requirement.currentLevel} -> ${requirement.level}`);
  const ownedItems = activeEvaluation.itemRequirements.filter((requirement) => requirement.ownedInBank).map(itemLabel);
  const missingItems = activeEvaluation.bank.checked
    ? activeEvaluation.itemRequirements.filter((requirement) => !requirement.ownedInBank).map(missingItemLabel)
    : [];
  const bankNote = activeEvaluation.itemRequirements.length === 0
    ? "No quest items needed for this block."
    : activeEvaluation.bank.notApplicable
      ? "Stage the quest items before starting; normal bank-ready does not apply."
      : activeEvaluation.bank.checked
        ? `Your bank covers ${ownedItems.length}/${activeEvaluation.itemRequirements.length} quest items.`
        : "Bank not checked; item prep stays conservative.";
  const laterCount = Math.max(0, remainingBlocks - 1);
  const whyThisBlock = !completionKnown
    ? `Quest completion is not synced, so Scapestack will not guess which ${target.name} prerequisite is unfinished.`
    : activeIsTarget
      ? `${target.name} is the next executable block for ${context.payoff}.`
      : `${activeQuest.name} is the first executable block toward ${context.payoff}; ${laterCount} later quest${laterCount === 1 ? " stays" : "s stay"} out of this session.`;
  const stopPoint = activeIsTarget
    ? `Finish ${activeQuest.name}, claim ${context.payoff}, then replan.`
    : `Finish ${activeQuest.name}, then replan the next block toward ${target.name}.`;

  return {
    activeQuest,
    activeEvaluation,
    progress: {
      targetQuestName: target.name,
      activeQuestName: activeQuest.name,
      activeQuestSlug: questSlug(activeQuest.name),
      activeIsTarget,
      completionEvidence: completionKnown ? context.completionEvidence ?? "tracker" : "unknown",
      completedPrerequisites,
      remainingPrerequisites,
      remainingBlocks,
      nextQuestName: nextQuestAfter(target, activeQuest, quests, completed, completionKnown),
      payoff: context.payoff,
      whyThisBlock,
      expectedBlock: formatMinutes(activeRange),
      expectedBlockMinutes: activeRange,
      chainEstimate: formatMinutes(totalRange),
      prerequisiteDepth,
      boostAssumption: "No boosts assumed; listed levels are treated as hard gates.",
      skillPreparation,
      ownedItems: ownedItems.slice(0, 4),
      missingItems: missingItems.slice(0, 4),
      bankNote,
      stopPoint
    }
  };
}
