import { isIronPlannerAccount } from "./account-type";
import type { SkillRoute } from "./skill-routes";

export type CalculableRouteStepKind = "source" | "buy" | "process" | "stop";
export type CalculableRouteStepState = "done" | "active" | "available" | "blocked";
export type CalculableRouteSupplyDecision =
  | "owned"
  | "buyable"
  | "source-yourself"
  | "one-session-only"
  | "unknown";

export interface CalculableRouteStep {
  id: string;
  kind: CalculableRouteStepKind;
  title: string;
  detail: string;
  dependsOn: string[];
  requiredQuantity: number | null;
  ownedQuantity: number | null;
  missingQuantity: number | null;
  requiredXp: number | null;
  estimatedMinutes: number | null;
  state: CalculableRouteStepState;
}

export interface CalculableRoute {
  id: string;
  skill: string;
  currentLevel: number;
  targetLevel: number;
  requiredXp: number;
  sessionXp: number;
  bankCoveredXp: number;
  remainingSessionXp: number;
  estimatedSessions: number;
  supplyDecision: CalculableRouteSupplyDecision;
  bankSummary: string;
  nextReplanPoint: string;
  steps: CalculableRouteStep[];
}

export interface CalculableRouteProgress {
  completedStepIds: string[];
  activeStepId: string | null;
}

export interface CalculableRouteSelection {
  accepted: boolean;
  progress: CalculableRouteProgress;
  blockerId: string | null;
}

function quantityLabel(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString("en-US");
}

function initialStep(
  step: Omit<CalculableRouteStep, "state">
): CalculableRouteStep {
  return { ...step, state: "available" };
}

function materialUnitXp(route: SkillRoute): number | null {
  const material = route.bankedXpEstimate.materials[0];
  if (!material || material.quantity <= 0 || material.xpHigh <= 0) return null;
  return material.xpHigh / material.quantity;
}

function sessionQuantity(route: SkillRoute): {
  material: string | null;
  required: number | null;
  owned: number | null;
  missing: number | null;
} {
  const material = route.bankedXpEstimate.materials[0] ?? null;
  const unitXp = materialUnitXp(route);
  if (!material || !unitXp) {
    return { material: null, required: null, owned: null, missing: null };
  }
  const required = Math.max(1, Math.ceil(route.shortSession.xp / unitXp));
  const owned = Math.min(material.quantity, required);
  return {
    material: material.name,
    required,
    owned,
    missing: Math.max(0, required - owned)
  };
}

function routeSupplyDecision(route: SkillRoute, needsPrep: boolean): CalculableRouteSupplyDecision {
  if (route.bankedXpEstimate.status === "unknown") return "unknown";
  if (!needsPrep) return "owned";
  if (isIronPlannerAccount(route.accountType)) return "source-yourself";
  if (route.accountType === "regular") {
    return Math.ceil(route.xpRemaining / Math.max(1, route.shortSession.xp)) > 12
      ? "one-session-only"
      : "buyable";
  }
  return "unknown";
}

export function buildCalculableSkillRoute(route: SkillRoute): CalculableRoute | null {
  if (route.maxed || !route.recommended || route.shortSession.xp <= 0) return null;

  const sessionXp = Math.min(route.xpRemaining, route.shortSession.xp);
  const bankCoveredXp = Math.min(sessionXp, route.bankedXpEstimate.coveredXpHigh);
  const remainingSessionXp = Math.max(0, sessionXp - bankCoveredXp);
  const quantity = sessionQuantity(route);
  const supplyRoute = route.supplyRoute;
  const hasKnownBank = route.bankedXpEstimate.status !== "unknown";
  const needsPrep = remainingSessionXp > 0 && hasKnownBank;
  const supplyDecision = routeSupplyDecision(route, needsPrep);
  const steps: CalculableRouteStep[] = [];
  let dependencyId: string | null = null;

  if (supplyRoute) {
    const sourceId = `${route.skill.toLowerCase()}:source:${supplyRoute.id}`;
    const amount = supplyRoute.amountTargetLow === supplyRoute.amountTargetHigh
      ? quantityLabel(supplyRoute.amountTargetHigh)
      : `${quantityLabel(supplyRoute.amountTargetLow)}-${quantityLabel(supplyRoute.amountTargetHigh)}`;
    const unmet = supplyRoute.requirements.filter((requirement) => requirement.met === false);
    steps.push(initialStep({
      id: sourceId,
      kind: "source",
      title: `Source ${amount} ${supplyRoute.material}`,
      detail: unmet.length > 0
        ? `First unlock ${unmet.map((requirement) => requirement.label).join(" and ")}.`
        : `${supplyRoute.sourceActivity} · about ${supplyRoute.estimatedMinutesLow}-${supplyRoute.estimatedMinutesHigh} min.`,
      dependsOn: [],
      requiredQuantity: supplyRoute.amountTargetHigh,
      ownedQuantity: 0,
      missingQuantity: supplyRoute.amountTargetHigh,
      requiredXp: remainingSessionXp,
      estimatedMinutes: supplyRoute.estimatedMinutesHigh
    }));
    dependencyId = sourceId;
  } else if (needsPrep && isIronPlannerAccount(route.accountType)) {
    const sourceId = `${route.skill.toLowerCase()}:source:supplies`;
    const supplies = route.recommended.supplies.map((supply) => supply.name.toLowerCase()).join(" and ") || "one usable stack";
    steps.push(initialStep({
      id: sourceId,
      kind: "source",
      title: `Source ${supplies}`,
      detail: `The bank is ${quantityLabel(remainingSessionXp)} XP short for this session. Gather one bounded stack, not the full grind.`,
      dependsOn: [],
      requiredQuantity: quantity.required,
      ownedQuantity: quantity.owned,
      missingQuantity: quantity.missing,
      requiredXp: remainingSessionXp,
      estimatedMinutes: null
    }));
    dependencyId = sourceId;
  } else if (needsPrep && route.accountType === "regular") {
    const buyId = `${route.skill.toLowerCase()}:buy:supplies`;
    const material = quantity.material ?? route.recommended.supplies[0]?.name.toLowerCase() ?? "method supplies";
    const amount = quantity.missing && quantity.missing > 0 ? `${quantityLabel(quantity.missing)} ` : "";
    const oneSessionOnly = supplyDecision === "one-session-only";
    steps.push(initialStep({
      id: buyId,
      kind: "buy",
      title: `Buy ${amount}${material}`,
      detail: oneSessionOnly
        ? "Buy one session only. Pricing the full long grind now is not worth the commitment."
        : `Only cover the ${quantityLabel(remainingSessionXp)} XP gap for this session.`,
      dependsOn: [],
      requiredQuantity: quantity.required,
      ownedQuantity: quantity.owned,
      missingQuantity: quantity.missing,
      requiredXp: remainingSessionXp,
      estimatedMinutes: null
    }));
    dependencyId = buyId;
  }

  const processId = `${route.skill.toLowerCase()}:process`;
  const processTitle = (supplyRoute?.processActivity ?? route.recommended.method.name)
    .replace(/\bbanked\b\s*/gi, dependencyId ? "" : "$&")
    .replace(/\s+already available\b/gi, dependencyId ? "" : "$&")
    .replace(/\s+/g, " ")
    .trim();
  const bankLine = route.bankedXpEstimate.status === "estimated"
    ? `${quantityLabel(route.bankedXpEstimate.totalQuantity)} banked items cover about ${quantityLabel(bankCoveredXp)} XP this session.`
    : route.bankedXpEstimate.status === "known-empty"
      ? "No usable supplies were found in this bank."
      : "Bank quantities are not known yet.";
  steps.push(initialStep({
    id: processId,
    kind: "process",
    title: processTitle,
    detail: dependencyId
      ? `After the first step, train for ${route.shortSession.minutes} min or until level ${route.targetLevel}.`
      : `${bankLine} Train for ${route.shortSession.minutes} min or until level ${route.targetLevel}.`,
    dependsOn: dependencyId ? [dependencyId] : [],
    requiredQuantity: quantity.required,
    ownedQuantity: quantity.owned,
    missingQuantity: quantity.missing,
    requiredXp: sessionXp,
    estimatedMinutes: route.shortSession.minutes
  }));

  const stopId = `${route.skill.toLowerCase()}:stop`;
  steps.push(initialStep({
    id: stopId,
    kind: "stop",
    title: `Stop after ${quantityLabel(sessionXp)} ${route.skill} XP`,
    detail: `Or stop when level ${route.targetLevel} lands, whichever comes first. Sync again so the next route uses the new XP and bank.`,
    dependsOn: [processId],
    requiredQuantity: null,
    ownedQuantity: null,
    missingQuantity: null,
    requiredXp: sessionXp,
    estimatedMinutes: null
  }));

  const initialProgress = resolveCalculableRouteProgress({
    id: `skill:${route.skill}:${route.targetLevel}`,
    skill: route.skill,
    currentLevel: route.currentLevel,
    targetLevel: route.targetLevel,
    requiredXp: route.xpRemaining,
    sessionXp,
    bankCoveredXp,
    remainingSessionXp,
    estimatedSessions: Math.max(1, Math.ceil(route.xpRemaining / Math.max(1, sessionXp))),
    supplyDecision,
    bankSummary: bankLine,
    nextReplanPoint: `After ${quantityLabel(sessionXp)} XP or level ${route.targetLevel}; sync before choosing the next block.`,
    steps
  }, { completedStepIds: [], activeStepId: null });

  return initialProgress;
}

export function resolveCalculableRouteProgress(
  route: CalculableRoute,
  progress: CalculableRouteProgress
): CalculableRoute {
  const completed = new Set(progress.completedStepIds);
  const isAvailable = (step: CalculableRouteStep) => step.dependsOn.every((id) => completed.has(id));
  const requested = route.steps.find((step) => step.id === progress.activeStepId && !completed.has(step.id) && isAvailable(step));
  const active = requested ?? route.steps.find((step) => !completed.has(step.id) && isAvailable(step)) ?? null;

  return {
    ...route,
    steps: route.steps.map((step) => ({
      ...step,
      state: completed.has(step.id)
        ? "done"
        : active?.id === step.id
          ? "active"
          : isAvailable(step)
            ? "available"
            : "blocked"
    }))
  };
}

export function selectCalculableRouteStep(
  route: CalculableRoute,
  progress: CalculableRouteProgress,
  requestedStepId: string
): CalculableRouteSelection {
  const resolved = resolveCalculableRouteProgress(route, progress);
  const requested = resolved.steps.find((step) => step.id === requestedStepId);
  if (!requested || requested.state === "blocked") {
    const blockerId = requested?.dependsOn.find((id) => !progress.completedStepIds.includes(id)) ?? null;
    return { accepted: false, progress, blockerId };
  }
  return {
    accepted: true,
    progress: { ...progress, activeStepId: requestedStepId },
    blockerId: null
  };
}

export function completeCalculableRouteStep(
  route: CalculableRoute,
  progress: CalculableRouteProgress,
  stepId: string
): CalculableRouteProgress {
  const resolved = resolveCalculableRouteProgress(route, progress);
  const step = resolved.steps.find((candidate) => candidate.id === stepId);
  if (!step || step.state === "blocked") return progress;
  const completedStepIds = [...new Set([...progress.completedStepIds, stepId])];
  const next = resolveCalculableRouteProgress(route, { completedStepIds, activeStepId: null })
    .steps.find((candidate) => candidate.state === "active");
  return { completedStepIds, activeStepId: next?.id ?? null };
}
