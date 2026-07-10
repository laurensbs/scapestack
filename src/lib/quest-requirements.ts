import type { HiscoreSkill } from "./hiscores";
import type { PlannerAccountType } from "./account-type";
import { accountModeSourceCopy, isIronPlannerAccount, isUltimatePlannerAccount, plannerAccountTypeLabel } from "./account-type";
import {
  evaluateItemAvailability,
  type ItemAvailability,
  type ItemAvailabilityStatus,
  type ItemSourceHint
} from "./item-availability";
import type { QuestItemAlternative, QuestItemReq, QuestRecord, QuestSkillReq } from "./quest-db";

export interface QuestBankItem {
  id?: number;
  name: string;
  quantity?: number;
}

export type QuestReadinessStatus =
  | "ready-to-start"
  | "missing-skill-levels"
  | "missing-prerequisite-quests"
  | "missing-bank-items"
  | "partially-ready";

export interface EvaluatedSkillRequirement extends QuestSkillReq {
  currentLevel: number;
  met: boolean;
}

export interface EvaluatedQuestRequirement {
  name: string;
  met: boolean;
}

export interface EvaluatedItemRequirement {
  id: string;
  name: string;
  quantity: number;
  note?: string;
  alternatives: QuestItemAlternative[];
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

export interface QuestRequirementEvaluation {
  questName: string;
  accountType: PlannerAccountType | null;
  readinessStatus: QuestReadinessStatus;
  skillRequirements: EvaluatedSkillRequirement[];
  questRequirements: EvaluatedQuestRequirement[];
  itemRequirements: EvaluatedItemRequirement[];
  completedRequirements: string[];
  missingRequirements: string[];
  bank: {
    checked: boolean;
    notApplicable: boolean;
    owned: EvaluatedItemRequirement[];
    missing: EvaluatedItemRequirement[];
  };
  accountWarnings: string[];
}

export interface QuestRequirementContext {
  skills?: HiscoreSkill[];
  completedQuests?: Iterable<string>;
  bankItems?: QuestBankItem[];
  accountType?: PlannerAccountType | null;
}

export interface RequirementTripDecision {
  verdict: "Ready to start" | "Need things first" | "Train first" | "Items missing" | "Stage for UIM" | "Completed";
  title: string;
  beforeYouGo: string[];
  bringItems: string[];
  stillMissing: string[];
  finishAfter: string;
  syncAfter: string;
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

export function normalizeQuestBankItems(items: QuestBankItem[] | undefined): QuestBankItem[] {
  const byId = new Map<number, QuestBankItem>();
  const byName = new Map<string, QuestBankItem>();

  for (const item of items ?? []) {
    const name = item.name.trim();
    if (!name) continue;

    const quantity = quantityFor(item);
    if (item.id && Number.isFinite(item.id) && item.id > 0) {
      const existing = byId.get(item.id);
      byId.set(item.id, {
        id: item.id,
        name: existing?.name ?? name,
        quantity: (existing?.quantity ?? 0) + quantity
      });
      continue;
    }

    const key = normalizedItemName(name);
    if (!key) continue;
    const existing = byName.get(key);
    byName.set(key, {
      name: existing?.name ?? name,
      quantity: (existing?.quantity ?? 0) + quantity
    });
  }

  return [...byId.values(), ...byName.values()];
}

function findOwnedItem(
  req: Pick<QuestItemReq, "name" | "quantity" | "alternatives">,
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

function skillLevel(skills: HiscoreSkill[] | undefined, skill: string): number {
  return skills?.find((row) => row.name.toLowerCase() === skill.toLowerCase())?.level ?? 1;
}

function completedQuestSet(completedQuests: Iterable<string> | undefined): Set<string> {
  return new Set(Array.from(completedQuests ?? []).map((quest) => cleanName(quest)));
}

function requirementSummary(label: string, met: boolean, completed: string[], missing: string[]): void {
  if (met) completed.push(label);
  else missing.push(label);
}

function accountWarningsFor(
  quest: QuestRecord,
  accountType: PlannerAccountType | null,
  hasItemRequirements: boolean
): string[] {
  if (!accountType) return [];
  const warnings: string[] = [];
  if (isUltimatePlannerAccount(accountType)) {
    warnings.push(`Ultimate Ironman: ${accountModeSourceCopy(accountType)}; bank-ready checks are informational only.`);
  } else if (accountType === "group" && hasItemRequirements) {
    warnings.push(`Group Ironman: ${accountModeSourceCopy(accountType)}.`);
  } else if (accountType === "hardcore" && hasItemRequirements) {
    warnings.push(`Hardcore Ironman: ${accountModeSourceCopy(accountType)}; self-source items safely.`);
  } else if (isIronPlannerAccount(accountType) && hasItemRequirements) {
    warnings.push(`${plannerAccountTypeLabel(accountType)}: ${accountModeSourceCopy(accountType)}; Grand Exchange buying is not assumed.`);
  }
  for (const note of quest.ironmanNotes.slice(0, 6)) {
    warnings.push(`Ironman note: ${note}`);
  }
  return warnings;
}

function questReadinessStatus({
  skillRequirements,
  questRequirements,
  itemRequirements,
  bankChecked,
  bankNotApplicable
}: {
  skillRequirements: EvaluatedSkillRequirement[];
  questRequirements: EvaluatedQuestRequirement[];
  itemRequirements: EvaluatedItemRequirement[];
  bankChecked: boolean;
  bankNotApplicable: boolean;
}): QuestReadinessStatus {
  if (skillRequirements.some((req) => !req.met)) return "missing-skill-levels";
  if (questRequirements.some((req) => !req.met)) return "missing-prerequisite-quests";
  if (bankNotApplicable && itemRequirements.length > 0) return "partially-ready";
  if (!bankChecked && itemRequirements.length > 0) return "partially-ready";
  if (itemRequirements.some((req) => !req.met)) return "missing-bank-items";
  return "ready-to-start";
}

export function questReadinessLabel(status: QuestReadinessStatus): string {
  switch (status) {
    case "ready-to-start":
      return "Ready to start";
    case "missing-skill-levels":
      return "Missing skill levels";
    case "missing-prerequisite-quests":
      return "Missing prerequisite quests";
    case "missing-bank-items":
      return "Missing bank items";
    case "partially-ready":
    default:
      return "Partially ready";
  }
}

function itemRequirementText(req: EvaluatedItemRequirement): string {
  return req.quantity > 1 ? `${req.quantity}x ${req.name}` : req.name;
}

function itemBringLine(req: EvaluatedItemRequirement): string {
  const name = req.ownedName ?? req.name;
  return req.quantity > 1 ? `${req.quantity}x ${name}` : name;
}

function itemMissingLine(req: EvaluatedItemRequirement, bankNotApplicable: boolean): string {
  const label = itemRequirementText(req);
  if (bankNotApplicable) return `${label}: stage this before starting`;
  if (req.ownedQuantity > 0) return `${label} missing; ${req.ownedQuantity} in bank`;
  return `${label} missing`;
}

function questBlockerCount(evaluation: QuestRequirementEvaluation): number {
  return evaluation.skillRequirements.filter((req) => !req.met).length
    + evaluation.questRequirements.filter((req) => !req.met).length
    + evaluation.itemRequirements.filter((req) => !req.met || evaluation.bank.notApplicable).length;
}

function questFirstStepLine({
  evaluation,
  skillGaps,
  questGaps,
  itemGaps
}: {
  evaluation: QuestRequirementEvaluation;
  skillGaps: string[];
  questGaps: string[];
  itemGaps: string[];
}): string {
  if (skillGaps.length > 0) return `${skillGaps[0]} before starting ${evaluation.questName}.`;
  if (questGaps.length > 0) return `${questGaps[0]} before opening ${evaluation.questName}.`;
  if (itemGaps.length > 0) return `Clear the missing quest prep before starting ${evaluation.questName}.`;
  return `Start ${evaluation.questName} and follow the quest steps.`;
}

export function questTripDecision(evaluation: QuestRequirementEvaluation): RequirementTripDecision {
  const skillGaps = evaluation.skillRequirements
    .filter((req) => !req.met)
    .map((req) => `Train ${req.skill} ${req.currentLevel} -> ${req.level}`);
  const questGaps = evaluation.questRequirements
    .filter((req) => !req.met)
    .map((req) => `Finish ${req.name}`);
  const itemGaps = (evaluation.bank.notApplicable ? evaluation.itemRequirements : evaluation.bank.missing)
    .filter((req) => !req.ownedInBank || evaluation.bank.notApplicable)
    .map((req) => itemMissingLine(req, evaluation.bank.notApplicable));
  const bringItems = evaluation.itemRequirements
    .filter((req) => req.ownedInBank)
    .map(itemBringLine);
  const sourceLines = evaluation.itemRequirements
    .filter((req) => !req.ownedInBank && req.availability.shortCopy)
    .map((req) => req.availability.shortCopy);
  const riskLines = evaluation.accountWarnings
    .filter((warning) => /Hardcore|risky|risk/i.test(warning))
    .slice(0, 1);
  const missing = [...skillGaps, ...questGaps, ...itemGaps];
  const blockerCount = missing.length;
  const firstStep = questFirstStepLine({ evaluation, skillGaps, questGaps, itemGaps });
  const beforeYouGo = [
    firstStep,
    ...sourceLines,
    ...riskLines
  ].filter((line, index, lines) => lines.indexOf(line) === index).slice(0, 5);
  const verdict: RequirementTripDecision["verdict"] = evaluation.bank.notApplicable && evaluation.itemRequirements.length > 0
    ? "Stage for UIM"
    : skillGaps.length > 0
      ? "Train first"
      : itemGaps.length > 0
        ? "Items missing"
        : evaluation.readinessStatus === "ready-to-start"
          ? "Ready to start"
          : "Need things first";

  return {
    verdict,
    title: verdict === "Ready to start"
      ? "Ready to start"
      : verdict === "Train first"
        ? "Train first"
        : verdict === "Items missing"
          ? "Items missing"
          : verdict === "Stage for UIM"
            ? "Stage for UIM"
            : `Need ${blockerCount || questBlockerCount(evaluation)} thing${(blockerCount || questBlockerCount(evaluation)) === 1 ? "" : "s"} first`,
    beforeYouGo: beforeYouGo.length > 0
      ? beforeYouGo
      : evaluation.itemRequirements.length > 0
        ? ["Open your bank once so item checks can confirm the prep."]
        : ["No item prep listed for this quest."],
    bringItems,
    stillMissing: missing.length > 0 ? missing : ["Nothing obvious missing."],
    finishAfter: `Finish ${evaluation.questName} and claim the unlock.`,
    syncAfter: `Sync RuneLite after ${evaluation.questName} so the quest disappears from your next trip.`
  };
}

export function evaluateQuestRequirements(
  quest: QuestRecord,
  context: QuestRequirementContext = {}
): QuestRequirementEvaluation {
  const completed: string[] = [];
  const missing: string[] = [];
  const completedQuests = completedQuestSet(context.completedQuests);
  const bankItems = normalizeQuestBankItems(context.bankItems);
  const bankChecked = bankItems.length > 0;
  const accountType = context.accountType ?? null;
  const bankNotApplicable = isUltimatePlannerAccount(accountType);

  const skillRequirements = quest.skillReqs.map((req) => {
    const currentLevel = skillLevel(context.skills, req.skill);
    const met = currentLevel >= req.level;
    requirementSummary(`${req.skill} ${req.level}`, met, completed, missing);
    return { ...req, currentLevel, met };
  });

  const questRequirements = quest.questReqs.map((name) => {
    const met = completedQuests.has(cleanName(name));
    requirementSummary(name, met, completed, missing);
    return { name, met };
  });

  const itemRequirements = quest.itemReqs.map((req) => {
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
    const evaluated: EvaluatedItemRequirement = {
      id: req.id,
      name: req.name,
      quantity: req.quantity,
      note: req.note,
      alternatives: req.alternatives,
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
    if (bankChecked) {
      requirementSummary(`${req.quantity}x ${req.name}`, met, completed, missing);
    } else {
      missing.push(`${req.quantity}x ${req.name}`);
    }
    return evaluated;
  });

  return {
    questName: quest.name,
    accountType,
    readinessStatus: questReadinessStatus({
      skillRequirements,
      questRequirements,
      itemRequirements,
      bankChecked,
      bankNotApplicable
    }),
    skillRequirements,
    questRequirements,
    itemRequirements,
    completedRequirements: completed,
    missingRequirements: missing,
    bank: {
      checked: bankChecked,
      notApplicable: bankNotApplicable,
      owned: itemRequirements.filter((req) => req.ownedInBank),
      missing: itemRequirements.filter((req) => !req.ownedInBank)
    },
    accountWarnings: accountWarningsFor(quest, accountType, itemRequirements.length > 0)
  };
}
