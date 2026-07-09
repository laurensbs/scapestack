import type { PlannerAccountType } from "./account-type";
import { accountModeSourceCopy, isIronPlannerAccount, isUltimatePlannerAccount, plannerAccountTypeLabel } from "./account-type";
import type { DiaryRecord, DiaryTier } from "./diary-db";
import type { HiscoreSkill } from "./hiscores";
import {
  evaluateItemAvailability,
  type ItemAvailability,
  type ItemAvailabilityStatus,
  type ItemSourceHint
} from "./item-availability";
import { normalizeQuestBankItems, type QuestBankItem, type RequirementTripDecision } from "./quest-requirements";

export type DiaryReadinessStatus =
  | "ready"
  | "partially-ready"
  | "missing-skill-levels"
  | "missing-quests"
  | "missing-items"
  | "completed";

export interface DiaryItemAlternative {
  name: string;
  quantity: number;
  note?: string;
}

export interface DiaryItemRequirement {
  id: string;
  name: string;
  quantity: number;
  note?: string;
  alternatives: DiaryItemAlternative[];
}

export interface EvaluatedDiarySkillRequirement {
  skill: string;
  level: number;
  currentLevel: number;
  met: boolean;
}

export interface EvaluatedDiaryQuestRequirement {
  name: string;
  met: boolean;
}

export interface EvaluatedDiaryItemRequirement extends DiaryItemRequirement {
  met: boolean;
  ownedInBank: boolean;
  ownedName: string | null;
  ownedQuantity: number;
  missingQuantity: number;
  availability: ItemAvailability;
  availabilityStatus: ItemAvailabilityStatus;
  sourceHints: ItemSourceHint[];
  availabilityCopy: string;
}

export interface DiaryRequirementEvaluation {
  region: string;
  tier: DiaryTier;
  accountType: PlannerAccountType | null;
  readinessStatus: DiaryReadinessStatus;
  skillRequirements: EvaluatedDiarySkillRequirement[];
  questRequirements: EvaluatedDiaryQuestRequirement[];
  itemRequirements: EvaluatedDiaryItemRequirement[];
  taskRequirements: string[];
  activityRequirements: string[];
  combatRequirements: string[];
  minigameRequirements: string[];
  tierDependencies: Array<{ tier: DiaryTier; met: boolean }>;
  completedRequirements: string[];
  missingRequirements: string[];
  tasksLeft: string[];
  payoff: string;
  stopPoint: string;
  bank: {
    checked: boolean;
    notApplicable: boolean;
    owned: EvaluatedDiaryItemRequirement[];
    missing: EvaluatedDiaryItemRequirement[];
  };
  accountWarnings: string[];
}

export interface DiaryRequirementContext {
  skills?: HiscoreSkill[];
  completedQuests?: Iterable<string>;
  completedDiaryTiers?: Iterable<string | { region: string; tier: DiaryTier | string }>;
  bankItems?: QuestBankItem[];
  accountType?: PlannerAccountType | null;
}

interface DiaryTierOverride {
  questRequirements?: string[];
  itemRequirements?: DiaryItemRequirement[];
  taskRequirements?: string[];
  activityRequirements?: string[];
  combatRequirements?: string[];
  minigameRequirements?: string[];
  payoff: string;
  stopPoint: string;
}

const DIARY_TIERS_ORDER: DiaryTier[] = ["Easy", "Medium", "Hard", "Elite"];

const DEFAULT_TIER_PAYOFF: Record<DiaryTier, string> = {
  Easy: "First diary reward tier and a cleaner regional route.",
  Medium: "Medium diary utility and progress toward the hard-tier unlock.",
  Hard: "Hard diary perk with route and teleport value.",
  Elite: "Top-tier diary reward and long-term account utility."
};

const DIARY_TIER_OVERRIDES: Record<string, DiaryTierOverride> = {
  "Ardougne:Medium": {
    questRequirements: ["Biohazard"],
    itemRequirements: [
      { id: "rope", name: "Rope", quantity: 1, alternatives: [] },
      { id: "plank", name: "Plank", quantity: 2, alternatives: [] },
      { id: "mith-grapple", name: "Mith grapple", quantity: 1, alternatives: [{ name: "Mith grapple tip", quantity: 1 }] }
    ],
    taskRequirements: ["Clear the Ardougne city, market and monastery task sweep."],
    minigameRequirements: ["Castle Wars / Fishing Trawler style regional checks may need manual task confirmation."],
    payoff: "Ardougne cloak teleport and a better pickpocket route.",
    stopPoint: "Finish Biohazard or train the closest missing skill."
  },
  "Kandarin:Hard": {
    itemRequirements: [
      { id: "mith-grapple", name: "Mith grapple", quantity: 1, alternatives: [{ name: "Mith grapple tip", quantity: 1 }] },
      { id: "rune-crossbow", name: "Rune crossbow", quantity: 1, alternatives: [] }
    ],
    taskRequirements: ["Clear the Seers, Catherby and Barbarian Outpost tasks in one route."],
    activityRequirements: ["Barbarian Assault and regional travel tasks may still need manual task checks."],
    minigameRequirements: ["Barbarian Assault task access and Kandarin regional travel checks."],
    payoff: "Kandarin headgear perks and stronger Seers' Village utility.",
    stopPoint: "Train the closest missing skill or finish the grapple/crossbow task sweep."
  },
  "Falador:Medium": {
    itemRequirements: [
      { id: "mith-grapple", name: "Mith grapple", quantity: 1, alternatives: [{ name: "Mith grapple tip", quantity: 1 }] }
    ],
    taskRequirements: ["Route the Mining Guild, Falador farm and grapple tasks together."],
    combatRequirements: ["Mole and shield utility checks become more valuable after this tier."],
    payoff: "Falador shield utility and a stronger Mole/prayer restore route.",
    stopPoint: "Clear the grapple task or the closest skill blocker."
  },
  "Western Provinces:Hard": {
    questRequirements: ["Regicide"],
    itemRequirements: [
      { id: "rune-crossbow", name: "Rune crossbow", quantity: 1, alternatives: [] },
      { id: "mith-grapple", name: "Mith grapple", quantity: 1, alternatives: [{ name: "Mith grapple tip", quantity: 1 }] }
    ],
    taskRequirements: ["Route Pest Control, elf lands and the Western hard task sweep together."],
    activityRequirements: ["Pest Control, elf lands and regional combat tasks may still need manual task checks."],
    minigameRequirements: ["Pest Control and elf lands tasks are part of the tier route."],
    combatRequirements: ["Chompy, elf and regional combat tasks should be checked before leaving."],
    payoff: "Western banner perks and stronger Elite Void route planning.",
    stopPoint: "Finish Regicide or clear the closest skill/item blocker."
  },
  "Lumbridge & Draynor:Medium": {
    questRequirements: ["Lost City"],
    taskRequirements: ["Route Draynor, Lumbridge Swamp and Zanaris-adjacent tasks together."],
    payoff: "Explorer's ring utility and better early account transport.",
    stopPoint: "Finish Lost City or clear the closest skill blocker."
  },
  "Karamja:Easy": {
    taskRequirements: ["Finish the quick Karamja task sweep and claim Karamja gloves 1."],
    payoff: "Karamja gloves start the diary reward chain.",
    stopPoint: "Claim the gloves and re-sync the completed tier."
  },
  "Karamja:Medium": {
    itemRequirements: [
      { id: "rope", name: "Rope", quantity: 1, alternatives: [] },
      { id: "coins", name: "Coins", quantity: 30, alternatives: [] }
    ],
    taskRequirements: ["Route Brimhaven, Musa Point and Karamja Volcano tasks together."],
    minigameRequirements: ["Brimhaven Agility Arena checks may need manual task confirmation."],
    payoff: "Karamja gloves 2 improve Karamja utility and move the gloves route forward.",
    stopPoint: "Finish the Brimhaven/Karamja sweep or pull the missing travel item."
  },
  "Karamja:Hard": {
    questRequirements: ["Shilo Village"],
    itemRequirements: [
      { id: "karamja-gloves", name: "Karamja gloves", quantity: 1, alternatives: [{ name: "Karamja gloves 2", quantity: 1 }] }
    ],
    taskRequirements: ["Clear Shilo, Brimhaven and Tai Bwo Wannai tasks as one gloves route."],
    combatRequirements: ["Check any combat diary-style Karamja tasks before committing supplies."],
    payoff: "Karamja gloves 3 unlock stronger Karamja teleports and shop utility.",
    stopPoint: "Finish Shilo Village or claim the next gloves tier."
  },
  "Karamja:Elite": {
    questRequirements: ["Tai Bwo Wannai Trio"],
    itemRequirements: [
      { id: "karamja-gloves-3", name: "Karamja gloves 3", quantity: 1, alternatives: [] }
    ],
    taskRequirements: ["Finish the final Karamja task sweep and claim Karamja gloves 4."],
    combatRequirements: ["High-level Karamja combat/resource tasks should be checked before the trip."],
    payoff: "Karamja gloves 4 completes the Karamja diary reward route.",
    stopPoint: "Claim Karamja gloves 4 and re-sync so the route disappears from /next."
  }
};

export function diaryTierKey(region: string, tier: DiaryTier | string): string {
  return `${region}:${tier}`;
}

function cleanName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singular(value: string): string {
  return value.replace(/\b([a-z]{3,})s\b/g, "$1");
}

function normalizedItemName(value: string): string {
  return singular(cleanName(value));
}

function itemNamesMatch(requiredName: string, bankName: string): boolean {
  const required = normalizedItemName(requiredName);
  const owned = normalizedItemName(bankName);
  if (!required || !owned) return false;
  if (required === owned) return true;
  if (owned.endsWith(` ${required}`)) return true;
  if (required.length >= 5 && owned.includes(required)) return true;
  return false;
}

function quantityFor(item: QuestBankItem): number {
  return Math.max(1, Math.floor(item.quantity ?? 1));
}

function skillLevel(skills: HiscoreSkill[] | undefined, skill: string): number {
  return skills?.find((row) => row.name.toLowerCase() === skill.toLowerCase())?.level ?? 1;
}

function completedQuestSet(completedQuests: Iterable<string> | undefined): Set<string> {
  return new Set(Array.from(completedQuests ?? []).map((quest) => cleanName(quest)));
}

function completedDiarySet(completedDiaryTiers: DiaryRequirementContext["completedDiaryTiers"]): Set<string> {
  const out = new Set<string>();
  for (const entry of completedDiaryTiers ?? []) {
    if (typeof entry === "string") {
      out.add(entry);
    } else {
      out.add(diaryTierKey(entry.region, entry.tier));
    }
  }
  return out;
}

function previousTiers(tier: DiaryTier): DiaryTier[] {
  const index = DIARY_TIERS_ORDER.indexOf(tier);
  return index <= 0 ? [] : DIARY_TIERS_ORDER.slice(0, index);
}

function requirementSummary(label: string, met: boolean, completed: string[], missing: string[]): void {
  if (met) completed.push(label);
  else missing.push(label);
}

function findOwnedItem(
  req: Pick<DiaryItemRequirement, "name" | "quantity" | "alternatives">,
  bankItems: QuestBankItem[]
): { name: string; quantity: number; requiredQuantity: number } | null {
  const candidates = [
    { name: req.name, quantity: req.quantity },
    ...req.alternatives.map((alt) => ({ name: alt.name, quantity: alt.quantity }))
  ];
  let partial: { name: string; quantity: number; requiredQuantity: number } | null = null;

  for (const candidate of candidates) {
    let quantity = 0;
    let ownedName: string | null = null;
    for (const item of bankItems) {
      if (!itemNamesMatch(candidate.name, item.name)) continue;
      quantity += quantityFor(item);
      ownedName = ownedName ?? item.name;
    }
    if (quantity >= candidate.quantity && ownedName) {
      return { name: ownedName, quantity, requiredQuantity: candidate.quantity };
    }
    if (quantity > 0 && ownedName && (!partial || quantity > partial.quantity)) {
      partial = { name: ownedName, quantity, requiredQuantity: candidate.quantity };
    }
  }

  return partial;
}

function evaluateItemRequirement(
  req: DiaryItemRequirement,
  bankItems: QuestBankItem[],
  bankChecked: boolean,
  accountType: PlannerAccountType | null,
  completed: string[],
  missing: string[]
): EvaluatedDiaryItemRequirement {
  const owned = bankChecked ? findOwnedItem(req, bankItems) : null;
  const ownedQuantity = owned?.quantity ?? 0;
  const requiredQuantity = owned?.requiredQuantity ?? req.quantity;
  const met = bankChecked && ownedQuantity >= requiredQuantity;
  const availability = evaluateItemAvailability({
    name: req.name,
    quantity: req.quantity,
    ownedInBank: met,
    ownedName: owned?.name ?? null,
    ownedQuantity,
    accountType
  });
  const evaluated: EvaluatedDiaryItemRequirement = {
    ...req,
    met,
    ownedInBank: met,
    ownedName: owned?.name ?? null,
    ownedQuantity,
    missingQuantity: Math.max(0, requiredQuantity - ownedQuantity),
    availability,
    availabilityStatus: availability.status,
    sourceHints: availability.sourceHints,
    availabilityCopy: availability.copy
  };
  const label = `${req.quantity > 1 ? `${req.quantity}x ` : ""}${req.name}`;
  if (bankChecked) requirementSummary(label, met, completed, missing);
  else missing.push(label);
  return evaluated;
}

function readinessStatus(input: {
  completed: boolean;
  skills: EvaluatedDiarySkillRequirement[];
  quests: EvaluatedDiaryQuestRequirement[];
  items: EvaluatedDiaryItemRequirement[];
  bankChecked: boolean;
  bankNotApplicable: boolean;
  tierDependencies: Array<{ tier: DiaryTier; met: boolean }>;
}): DiaryReadinessStatus {
  if (input.completed) return "completed";
  if (input.skills.some((req) => !req.met)) return "missing-skill-levels";
  if (input.tierDependencies.some((req) => !req.met) || input.quests.some((req) => !req.met)) return "missing-quests";
  if (input.bankNotApplicable && input.items.length > 0) return "partially-ready";
  if (!input.bankChecked && input.items.length > 0) return "partially-ready";
  if (input.items.some((req) => !req.met)) return "missing-items";
  return "ready";
}

function warningsFor(accountType: PlannerAccountType | null, hasItemRequirements: boolean): string[] {
  if (!accountType) return [];
  if (isUltimatePlannerAccount(accountType)) {
    return [`Ultimate Ironman: ${accountModeSourceCopy(accountType)}; normal bank-ready does not apply.`];
  }
  if (accountType === "group" && hasItemRequirements) {
    return [`Group Ironman: ${accountModeSourceCopy(accountType)}.`];
  }
  if (accountType === "hardcore") {
    return [`Hardcore Ironman: ${accountModeSourceCopy(accountType)}; route combat or Wilderness diary tasks conservatively.`];
  }
  if (isIronPlannerAccount(accountType) && hasItemRequirements) {
    return [`${plannerAccountTypeLabel(accountType)}: ${accountModeSourceCopy(accountType)}; Grand Exchange buying is not assumed.`];
  }
  return [];
}

export function diaryReadinessLabel(status: DiaryReadinessStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "missing-skill-levels":
      return "Missing skills";
    case "missing-quests":
      return "Missing quests";
    case "missing-items":
      return "Missing items";
    case "completed":
      return "Completed";
    case "partially-ready":
    default:
      return "Partially ready";
  }
}

function itemRequirementLabel(req: EvaluatedDiaryItemRequirement): string {
  return `${req.quantity > 1 ? `${req.quantity}x ` : ""}${req.name}`;
}

export function diaryCompletedRequirementLines(evaluation: DiaryRequirementEvaluation): string[] {
  if (evaluation.readinessStatus === "completed") return [`${evaluation.region} ${evaluation.tier} completed`];

  const skills = evaluation.skillRequirements
    .filter((req) => req.met)
    .map((req) => `${req.skill} ${req.level} met`);
  const tiers = evaluation.tierDependencies
    .filter((req) => req.met)
    .map((req) => `${evaluation.region} ${req.tier} diary done`);
  const quests = evaluation.questRequirements
    .filter((req) => req.met)
    .map((req) => `${req.name} done`);
  const items = evaluation.itemRequirements
    .filter((req) => req.ownedInBank)
    .map((req) => req.ownedName && req.ownedName !== req.name
      ? `${req.ownedName} in bank for ${req.name}`
      : `${itemRequirementLabel(req)} in bank`);

  return [...skills, ...tiers, ...quests, ...items];
}

export function diaryMissingRequirementLines(evaluation: DiaryRequirementEvaluation): string[] {
  if (evaluation.readinessStatus === "completed") return [];

  const skills = evaluation.skillRequirements
    .filter((req) => !req.met)
    .map((req) => `${req.level} ${req.skill} needed, you have ${req.currentLevel}`);
  const tiers = evaluation.tierDependencies
    .filter((req) => !req.met)
    .map((req) => `${evaluation.region} ${req.tier} diary missing`);
  const quests = evaluation.questRequirements
    .filter((req) => !req.met)
    .map((req) => `${req.name} missing`);
  const items = (evaluation.bank.notApplicable ? evaluation.itemRequirements : evaluation.bank.missing)
    .filter((req) => !req.ownedInBank || evaluation.bank.notApplicable)
    .map((req) => {
      const label = itemRequirementLabel(req);
      if (evaluation.bank.notApplicable) return `${label}: stage/carry before starting`;
      if (req.ownedQuantity > 0) return `${label} missing, ${req.ownedQuantity} in bank`;
      return `${label} missing`;
    });

  return [...skills, ...tiers, ...quests, ...items];
}

export function diaryTaskRequirementLines(evaluation: DiaryRequirementEvaluation): string[] {
  if (evaluation.readinessStatus === "completed") return [];
  return [
    ...evaluation.taskRequirements,
    ...evaluation.activityRequirements,
    ...evaluation.combatRequirements,
    ...evaluation.minigameRequirements
  ];
}

export function diaryBlockerCount(evaluation: DiaryRequirementEvaluation): number {
  return diaryMissingRequirementLines(evaluation).length;
}

export function diaryReadinessSummary(evaluation: DiaryRequirementEvaluation): string {
  if (evaluation.readinessStatus === "completed") {
    return `${evaluation.region} ${evaluation.tier} is already complete.`;
  }
  const blockers = diaryBlockerCount(evaluation);
  if (blockers === 0) {
    return `${evaluation.region} ${evaluation.tier} is ready; run the task sweep and claim the reward.`;
  }
  return `${evaluation.region} ${evaluation.tier} is ${blockers} blocker${blockers === 1 ? "" : "s"} away.`;
}

function diaryOwnedItemLine(req: EvaluatedDiaryItemRequirement): string {
  const name = req.ownedName ?? req.name;
  if (req.ownedQuantity > 1) return `${req.ownedQuantity}x ${name} is in bank`;
  return `${name} is in bank`;
}

function diaryMissingItemLine(req: EvaluatedDiaryItemRequirement, bankNotApplicable: boolean): string {
  const label = itemRequirementLabel(req);
  if (bankNotApplicable) return `${label}: stage this before starting`;
  if (req.ownedQuantity > 0) return `${label} missing; ${req.ownedQuantity} in bank`;
  return `${label} missing`;
}

export function diaryTripDecision(evaluation: DiaryRequirementEvaluation): RequirementTripDecision {
  const skillGaps = evaluation.skillRequirements
    .filter((req) => !req.met)
    .map((req) => `Train ${req.skill} ${req.currentLevel} -> ${req.level}`);
  const tierGaps = evaluation.tierDependencies
    .filter((req) => !req.met)
    .map((req) => `Claim ${evaluation.region} ${req.tier} first`);
  const questGaps = evaluation.questRequirements
    .filter((req) => !req.met)
    .map((req) => `Finish ${req.name}`);
  const itemGaps = (evaluation.bank.notApplicable ? evaluation.itemRequirements : evaluation.bank.missing)
    .filter((req) => !req.ownedInBank || evaluation.bank.notApplicable)
    .map((req) => diaryMissingItemLine(req, evaluation.bank.notApplicable));
  const taskGaps = diaryTaskRequirementLines(evaluation).slice(0, 2);
  const ownedItems = evaluation.itemRequirements
    .filter((req) => req.ownedInBank)
    .map(diaryOwnedItemLine);
  const sourceLines = evaluation.itemRequirements
    .filter((req) => !req.ownedInBank && req.availability.shortCopy)
    .map((req) => req.availability.shortCopy);
  const riskLines = evaluation.accountWarnings
    .filter((warning) => /Hardcore|risky|risk|Wilderness/i.test(warning))
    .slice(0, 1);
  const missing = [...skillGaps, ...tierGaps, ...questGaps, ...itemGaps, ...taskGaps];
  const blockerCount = diaryBlockerCount(evaluation);
  const verdict: RequirementTripDecision["verdict"] = evaluation.readinessStatus === "completed"
    ? "Completed"
    : evaluation.bank.notApplicable && evaluation.itemRequirements.length > 0
      ? "Stage for UIM"
      : skillGaps.length > 0
        ? "Train first"
        : itemGaps.length > 0
          ? "Items missing"
          : evaluation.readinessStatus === "ready"
            ? "Ready to start"
            : "Need things first";

  return {
    verdict,
    title: verdict === "Completed"
      ? "Already complete"
      : verdict === "Ready to start"
        ? "Ready to start"
        : verdict === "Train first"
          ? "Train first"
          : verdict === "Items missing"
            ? "Items missing"
            : verdict === "Stage for UIM"
              ? "Stage for UIM"
              : `Need ${blockerCount || missing.length} thing${(blockerCount || missing.length) === 1 ? "" : "s"} first`,
    beforeYouGo: [...ownedItems, ...sourceLines, ...riskLines]
      .filter((line, index, lines) => lines.indexOf(line) === index)
      .slice(0, 5),
    stillMissing: missing.length > 0 ? missing : ["Nothing obvious missing."],
    finishAfter: evaluation.readinessStatus === "completed"
      ? `${evaluation.region} ${evaluation.tier} is already claimed.`
      : evaluation.stopPoint
  };
}

export function evaluateDiaryTier(
  region: string,
  tier: DiaryTier,
  diary: DiaryRecord,
  context: DiaryRequirementContext = {}
): DiaryRequirementEvaluation {
  const completedRequirements: string[] = [];
  const missingRequirements: string[] = [];
  const completedQuests = completedQuestSet(context.completedQuests);
  const completedDiaries = completedDiarySet(context.completedDiaryTiers);
  const bankItems = normalizeQuestBankItems(context.bankItems);
  const bankChecked = bankItems.length > 0;
  const accountType = context.accountType ?? null;
  const bankNotApplicable = isUltimatePlannerAccount(accountType);
  const override = DIARY_TIER_OVERRIDES[diaryTierKey(region, tier)];
  const isCompleted = completedDiaries.has(diaryTierKey(region, tier));
  const hasExactDiaryCompletionData = context.completedDiaryTiers !== undefined;

  const skillRequirements = (diary.tiers[tier]?.skills ?? []).map((req) => {
    const currentLevel = skillLevel(context.skills, req.skill);
    const met = currentLevel >= req.level;
    requirementSummary(`${req.skill} ${req.level}`, met, completedRequirements, missingRequirements);
    return { ...req, currentLevel, met };
  });

  const tierDependencies = previousTiers(tier).map((previous) => {
    const met = !hasExactDiaryCompletionData || completedDiaries.has(diaryTierKey(region, previous));
    requirementSummary(`${region} ${previous} diary`, met, completedRequirements, missingRequirements);
    return { tier: previous, met };
  });

  const questRequirements = (override?.questRequirements ?? []).map((name) => {
    const met = completedQuests.has(cleanName(name));
    requirementSummary(name, met, completedRequirements, missingRequirements);
    return { name, met };
  });

  const itemRequirements = (override?.itemRequirements ?? []).map((req) =>
    evaluateItemRequirement(req, bankItems, bankChecked, accountType, completedRequirements, missingRequirements)
  );

  const taskRequirements = override?.taskRequirements ?? [
    `Run the ${region} ${tier} task checklist as a single regional sweep.`
  ];
  const activityRequirements = override?.activityRequirements ?? [];
  const combatRequirements = override?.combatRequirements ?? [];
  const minigameRequirements = override?.minigameRequirements ?? [];
  const tasksLeft = isCompleted ? [] : [
    ...taskRequirements,
    ...activityRequirements,
    ...combatRequirements,
    ...minigameRequirements
  ];
  const payoff = override?.payoff ?? DEFAULT_TIER_PAYOFF[tier];
  const stopPoint = override?.stopPoint ?? `Finish the closest ${region} ${tier} blocker or claim the diary reward.`;
  const accountWarnings = warningsFor(accountType, itemRequirements.length > 0);
  const status = readinessStatus({
    completed: isCompleted,
    skills: skillRequirements,
    quests: questRequirements,
    items: itemRequirements,
    bankChecked,
    bankNotApplicable,
    tierDependencies
  });

  return {
    region,
    tier,
    accountType,
    readinessStatus: status,
    skillRequirements,
    questRequirements,
    itemRequirements,
    taskRequirements,
    activityRequirements,
    combatRequirements,
    minigameRequirements,
    tierDependencies,
    completedRequirements,
    missingRequirements: isCompleted ? [] : missingRequirements,
    tasksLeft,
    payoff,
    stopPoint,
    bank: {
      checked: bankChecked,
      notApplicable: bankNotApplicable,
      owned: itemRequirements.filter((req) => req.ownedInBank),
      missing: itemRequirements.filter((req) => !req.ownedInBank)
    },
    accountWarnings
  };
}
