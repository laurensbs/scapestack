import type { HoursToMaxSummary } from "@/lib/hours-to-max";
import type { Recommendation } from "@/lib/next-up";
import type { BankHandoffItem } from "@/lib/next-bank-handoff";
import {
  BANKED_XP_SKILL_DESCRIPTORS,
  estimateBankedXp,
  formatXpRange,
  type BankedXpSkillDescriptor
} from "@/lib/banked-xp";

export type RecommendationPlanSurface = "combat" | "slayer" | "skilling" | "afk" | "unlock" | "gp" | "chill";

export type MakePlanSmarterCopy = {
  title: string;
  helper: string;
  bankLabel: string;
  loadedHelper: string;
  emptyHelper: string;
  bankCta: string;
};

export type SkillingBankSummary = {
  skill: string;
  xpRemaining: number | null;
  bankXp: number;
  bankXpRangeLabel: string;
  bankItemsLabel: string;
  hasBankMatch: boolean;
  suppliesLabel: string;
  actionVerb: string;
  bringHint: string;
  remainingAfterBank: number | null;
  neededAfterBankLabel: string | null;
  bankCoversTarget: boolean;
};

export function recommendationPlanSurface(rec: Pick<Recommendation, "kind" | "routeTags"> | null): RecommendationPlanSurface {
  if (!rec) return "chill";
  if (rec.kind === "slayer") return "slayer";
  if (rec.kind === "boss" || rec.kind === "kc") return "combat";
  if (rec.kind === "money") return "gp";
  if (rec.kind === "skill") {
    return rec.routeTags?.includes("afk") ? "afk" : "skilling";
  }
  if (rec.kind === "quest" || rec.kind === "diary" || rec.kind === "goal" || rec.kind === "milestone") {
    return "unlock";
  }
  return "chill";
}

export function makePlanSmarterCopy(rec: Pick<Recommendation, "kind" | "routeTags"> | null): MakePlanSmarterCopy {
  switch (recommendationPlanSurface(rec)) {
    case "combat":
      return {
        title: "Add bank",
        helper: "Gear, food and teleports can change the trip.",
        bankLabel: "Bank",
        loadedHelper: "Your bank can shape this boss pick.",
        emptyHelper: "Use it when PvM supplies matter.",
        bankCta: "Add bank"
      };
    case "slayer":
      return {
        title: "Add bank",
        helper: "Task gear, supplies and teleports can change the route.",
        bankLabel: "Bank",
        loadedHelper: "Your bank can shape the task plan.",
        emptyHelper: "Use it when task setup matters.",
        bankCta: "Add bank"
      };
    case "gp":
      return {
        title: "Add GP check",
        helper: "Cash, supplies and items can change the money-maker.",
        bankLabel: "Bank/GP",
        loadedHelper: "Cash stack and items can shape this GP pick.",
        emptyHelper: "Use it when profit or supplies matter.",
        bankCta: "Add GP"
      };
    case "unlock":
      return {
        title: "Add quest items",
        helper: "Items and teleports can change the unlock route.",
        bankLabel: "Items",
        loadedHelper: "Quest items and teleports can shape this unlock.",
        emptyHelper: "Use it when required items matter.",
        bankCta: "Add items"
      };
    case "afk":
    case "skilling":
      return {
        title: "Want a sharper pick?",
        helper: "Add bank only when GP, gear or items should change the method.",
        bankLabel: "Bank",
        loadedHelper: "Your bank can shape this skilling pick.",
        emptyHelper: "Skip this for simple level pushes.",
        bankCta: "Add bank"
      };
    case "chill":
    default:
      return {
        title: "Add details later",
        helper: "Use gear or RuneLite only when the plan feels off.",
        bankLabel: "Bank",
        loadedHelper: "Your bank can shape the next pick.",
        emptyHelper: "Optional for lighter sessions.",
        bankCta: "Add bank"
      };
  }
}

export function formatPlanXp(value: number): string {
  return `${Math.round(value).toLocaleString()} XP`;
}

export function skillBankConfigForSkill(skill: string): BankedXpSkillDescriptor | null {
  return BANKED_XP_SKILL_DESCRIPTORS.find((config) => config.skill.toLowerCase() === skill.toLowerCase()) ?? null;
}

export function skillingBankSummaryForSkill(
  skillName: string,
  bankItems: BankHandoffItem[],
  maxEstimate: HoursToMaxSummary | null
): SkillingBankSummary | null {
  const config = skillBankConfigForSkill(skillName);
  if (!config) return null;
  if (bankItems.length === 0) return null;

  const skillEstimate = maxEstimate?.perSkill.find((entry) => entry.skill.toLowerCase() === config.skill.toLowerCase()) ?? null;
  const xpRemaining = skillEstimate?.xpRemaining ?? null;
  const bankEstimate = estimateBankedXp({
    skill: config.skill,
    bank: bankItems.length > 0 ? bankItems : undefined,
    currentLevel: skillEstimate?.currentLevel,
    xpRemaining
  });
  const bestMaterial = bankEstimate.materials[0] ?? null;
  const supportingItems = bankItems
    .filter((item) => config.keywords.some((keyword) => item.name.toLowerCase().includes(keyword.toLowerCase())))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3);
  const bankItemsLabel = bankEstimate.materials.length
    ? bankEstimate.materials.map((item) => `${item.quantity.toLocaleString()} ${item.name}`).join(", ")
    : supportingItems.length
      ? supportingItems.map((item) => `${item.quantity.toLocaleString()} ${item.name.toLowerCase()}`).join(", ")
      : "This bank does not cover the chosen skilling method yet";
  const remainingAfterBank = bankEstimate.remainingXpHigh;
  const xpPerBestMaterial = bestMaterial && bestMaterial.quantity > 0
    ? bestMaterial.xpHigh / bestMaterial.quantity
    : null;
  const neededAfterBankLabel = remainingAfterBank && remainingAfterBank > 0 && xpPerBestMaterial
    ? `Need about ${Math.ceil(remainingAfterBank / xpPerBestMaterial).toLocaleString()} more ${bestMaterial.name} if you keep this method.`
    : null;

  return {
    skill: config.skill,
    xpRemaining,
    bankXp: bankEstimate.coveredXpHigh,
    bankXpRangeLabel: formatXpRange(bankEstimate.coveredXpLow, bankEstimate.coveredXpHigh),
    bankItemsLabel,
    hasBankMatch: bankEstimate.status === "estimated" || supportingItems.length > 0,
    suppliesLabel: config.suppliesLabel,
    actionVerb: config.actionVerb,
    bringHint: config.bringHint,
    remainingAfterBank,
    neededAfterBankLabel,
    bankCoversTarget: xpRemaining !== null && bankEstimate.coveredXpLow >= xpRemaining && xpRemaining > 0
  };
}

export function skillingLevelGapLine(summary: SkillingBankSummary | null): string | null {
  if (!summary) return null;
  if (summary.xpRemaining === null) return `${summary.actionVerb} the banked stack first, then re-check your ${summary.skill} gap.`;
  if (summary.xpRemaining <= 0) return `${summary.skill} is already 99; pick a different maxing lane.`;
  return `${summary.skill}: ${formatPlanXp(summary.xpRemaining)} left for 99.`;
}
