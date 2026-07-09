export const SCAPESTACK_ACCOUNT_TYPES = [
  "normal",
  "ironman",
  "hardcore_ironman",
  "ultimate_ironman",
  "group_ironman",
  "hardcore_group_ironman"
] as const;

export type ScapestackAccountType = typeof SCAPESTACK_ACCOUNT_TYPES[number];
export type PlannerAccountType = "regular" | "ironman" | "hardcore" | "ultimate" | "group" | "skiller" | "pure";
export type AccountModeConfidence = "detected" | "inferred" | "unknown";
export type AccountModeSource = "scapestack-sync" | "wom" | "unknown";

export interface AccountModeAssessment {
  type: PlannerAccountType | null;
  confidence: AccountModeConfidence;
  source: AccountModeSource;
  label: string;
  badgeLabel: string;
  planningNote: string;
}

export type AccountModeTone = "neutral" | "iron" | "hardcore" | "ultimate" | "group" | "unknown";

export interface AccountModeVisual {
  label: string;
  badgeLabel: string;
  shortLabel: string;
  iconItemId: number | null;
  tone: AccountModeTone;
  sourceCopy: string;
  bankCopy: string;
  planningNote: string;
}

// IDs verified against local data/items.json on 2026-07-08:
// 12810 Ironman helm, 20792 Hardcore ironman helm,
// 12813 Ultimate ironman helm, 26156 Group ironman helm.
// Normal/unknown intentionally use no item sprite so the iron helmets stay meaningful.
export const ACCOUNT_MODE_ICON_ITEM_IDS: Partial<Record<PlannerAccountType, number>> = {
  ironman: 12810,
  hardcore: 20792,
  ultimate: 12813,
  group: 26156
};

export function normalizeScapestackAccountType(value: unknown): ScapestackAccountType {
  return SCAPESTACK_ACCOUNT_TYPES.includes(value as ScapestackAccountType)
    ? value as ScapestackAccountType
    : "normal";
}

export function scapestackAccountTypeLabel(type: ScapestackAccountType): string {
  switch (type) {
    case "ironman":
      return "Ironman";
    case "hardcore_ironman":
      return "Hardcore Ironman";
    case "ultimate_ironman":
      return "Ultimate Ironman";
    case "group_ironman":
      return "Group Ironman";
    case "hardcore_group_ironman":
      return "Hardcore Group Ironman";
    case "normal":
    default:
      return "Normal";
  }
}

export function scapestackAccountTypeToPlannerType(
  type: ScapestackAccountType
): PlannerAccountType {
  switch (type) {
    case "ironman":
      return "ironman";
    case "hardcore_ironman":
      return "hardcore";
    case "ultimate_ironman":
      return "ultimate";
    case "group_ironman":
    case "hardcore_group_ironman":
      return "group";
    case "normal":
    default:
      return "regular";
  }
}

export function plannerAccountTypeLabel(type: PlannerAccountType): string {
  switch (type) {
    case "ironman":
      return "Ironman";
    case "hardcore":
      return "Hardcore Ironman";
    case "ultimate":
      return "Ultimate Ironman";
    case "group":
      return "Group Ironman";
    case "skiller":
      return "Skiller";
    case "pure":
      return "Pure";
    case "regular":
    default:
      return "Normal";
  }
}

export function isIronPlannerAccount(type: PlannerAccountType | null | undefined): boolean {
  return type === "ironman" || type === "hardcore" || type === "ultimate" || type === "group";
}

export function isUltimatePlannerAccount(type: PlannerAccountType | null | undefined): boolean {
  return type === "ultimate";
}

export function accountModeImpactNote(type: PlannerAccountType | null | undefined): string {
  switch (type) {
    case "ironman":
      return "Self-source item blockers; Grand Exchange buying is not assumed.";
    case "hardcore":
      return "Risky combat is weighted down unless the unlock payoff is strong.";
    case "ultimate":
      return "Use staging, carried items and storage unlocks; bank-ready is not normal readiness.";
    case "group":
      return "Own bank is checked; group storage is not assumed unless it is explicitly synced.";
    case "regular":
      return "Normal account: bank checks and buyable item prep can be treated normally.";
    case "skiller":
      return "Skiller mode: combat-heavy routes stay conservative.";
    case "pure":
      return "Pure mode: defence-sensitive routes stay conservative.";
    default:
      return "Account mode unknown: item availability stays conservative and bank readiness only counts when real bank data exists.";
  }
}

export function accountModeSourceCopy(type: PlannerAccountType | null | undefined): string {
  switch (type) {
    case "regular":
    case "skiller":
    case "pure":
      return "Buy or grab";
    case "ironman":
      return "Source yourself";
    case "hardcore":
      return "Avoid risky source unless payoff is worth it";
    case "ultimate":
      return "Stage/carry before starting";
    case "group":
      return "Own bank checked; group storage not verified";
    default:
      return "Account mode unknown";
  }
}

export function accountModeBankCopy(type: PlannerAccountType | null | undefined): string {
  switch (type) {
    case "ultimate":
      return "Staging checklist; normal bank-ready does not apply.";
    case "group":
      return "Own bank checked; group storage not verified.";
    case "ironman":
      return "Bank items count, missing items need self-sourcing.";
    case "hardcore":
      return "Bank items count, risky sources stay conservative.";
    case "regular":
    case "skiller":
    case "pure":
      return "Bank checks and buyable prep can be treated normally.";
    default:
      return "Bank readiness only counts when real bank data exists.";
  }
}

export function accountModeTone(type: PlannerAccountType | null | undefined): AccountModeTone {
  switch (type) {
    case "ironman":
      return "iron";
    case "hardcore":
      return "hardcore";
    case "ultimate":
      return "ultimate";
    case "group":
      return "group";
    case "regular":
    case "skiller":
    case "pure":
      return "neutral";
    default:
      return "unknown";
  }
}

export function accountModeVisual(
  type: PlannerAccountType | null | undefined,
  confidence: AccountModeConfidence = type ? "inferred" : "unknown"
): AccountModeVisual {
  const resolvedType = confidence === "unknown" ? null : type ?? null;
  const label = resolvedType ? plannerAccountTypeLabel(resolvedType) : "Unknown mode";
  return {
    label,
    badgeLabel: accountModeBadgeLabel(resolvedType, confidence),
    shortLabel: resolvedType === "hardcore"
      ? "HCIM"
      : resolvedType === "ultimate"
        ? "UIM"
        : resolvedType === "group"
          ? "GIM"
          : resolvedType === "ironman"
            ? "Ironman"
            : resolvedType === "regular"
              ? "Normal"
              : label,
    iconItemId: resolvedType ? ACCOUNT_MODE_ICON_ITEM_IDS[resolvedType] ?? null : null,
    tone: accountModeTone(resolvedType),
    sourceCopy: accountModeSourceCopy(resolvedType),
    bankCopy: accountModeBankCopy(resolvedType),
    planningNote: accountModeImpactNote(resolvedType)
  };
}

export function accountModeBadgeLabel(
  type: PlannerAccountType | null | undefined,
  confidence: AccountModeConfidence
): string {
  if (!type || confidence === "unknown") return "Account mode unknown";
  if (type === "regular") return "Normal account";
  const label = plannerAccountTypeLabel(type);
  return confidence === "detected" ? `${label} detected` : `${label} inferred`;
}

export function resolveAccountMode(input: {
  scapestackAccountType?: unknown;
  plannerAccountType?: PlannerAccountType | null;
}): AccountModeAssessment {
  if (typeof input.scapestackAccountType === "string") {
    const normalized = normalizeScapestackAccountType(input.scapestackAccountType);
    const type = scapestackAccountTypeToPlannerType(normalized);
    return {
      type,
      confidence: "detected",
      source: "scapestack-sync",
      label: plannerAccountTypeLabel(type),
      badgeLabel: accountModeBadgeLabel(type, "detected"),
      planningNote: accountModeImpactNote(type)
    };
  }

  if (input.plannerAccountType) {
    const type = input.plannerAccountType;
    return {
      type,
      confidence: "inferred",
      source: "wom",
      label: plannerAccountTypeLabel(type),
      badgeLabel: accountModeBadgeLabel(type, "inferred"),
      planningNote: accountModeImpactNote(type)
    };
  }

  return {
    type: null,
    confidence: "unknown",
    source: "unknown",
    label: "Unknown mode",
    badgeLabel: "Account mode unknown",
    planningNote: accountModeImpactNote(null)
  };
}
