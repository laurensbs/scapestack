import type { PlannerAccountType } from "./account-type";
import { isUltimatePlannerAccount } from "./account-type";

export type ItemAvailabilityStatus =
  | "owned"
  | "missing-buyable"
  | "missing-source-needed"
  | "missing-quest-locked"
  | "missing-shop-source"
  | "missing-minigame-source"
  | "uim-stage-manually";

export type ItemSourceKind =
  | "ge"
  | "shop"
  | "monster-drop"
  | "skilling"
  | "crafting"
  | "quest-reward"
  | "minigame";

export interface ItemSourceHint {
  kind: ItemSourceKind;
  label: string;
  detail?: string;
}

export interface ItemAvailabilityInput {
  name: string;
  quantity: number;
  ownedInBank: boolean;
  ownedQuantity?: number;
  ownedName?: string | null;
  accountType?: PlannerAccountType | null;
  sourceHints?: ItemSourceHint[];
}

export interface ItemAvailability {
  status: ItemAvailabilityStatus;
  sourceHints: ItemSourceHint[];
  copy: string;
  shortCopy: string;
  blockerCopy: string;
}

const ITEM_SOURCE_HINTS: Array<{ match: RegExp; hints: ItemSourceHint[] }> = [
  {
    match: /^planks?$/i,
    hints: [
      { kind: "shop", label: "Sawmill operator", detail: "sawmill/Construction route" },
      { kind: "skilling", label: "Construction supply route" }
    ]
  },
  {
    match: /^rope$/i,
    hints: [
      { kind: "shop", label: "General stores / Ned in Draynor" }
    ]
  },
  {
    match: /^mith grapple(?: tip)?$/i,
    hints: [
      { kind: "crafting", label: "Smithing/Fletching route" },
      { kind: "monster-drop", label: "Grapple-capable monster drops" }
    ]
  },
  {
    match: /^rune crossbow$/i,
    hints: [
      { kind: "monster-drop", label: "Ironman drop route" },
      { kind: "crafting", label: "Fletching route" }
    ]
  },
  {
    match: /^mithril axe$/i,
    hints: [
      { kind: "shop", label: "Woodcutting Guild / axe shops" },
      { kind: "skilling", label: "Smithing route" }
    ]
  },
  {
    match: /^iron bars?$/i,
    hints: [
      { kind: "skilling", label: "Mine and smelt iron ore" }
    ]
  },
  {
    match: /^bucket(?: of milk)?$/i,
    hints: [
      { kind: "shop", label: "General store bucket" },
      { kind: "skilling", label: "Milk a dairy cow" }
    ]
  },
  {
    match: /^pot of flour$/i,
    hints: [
      { kind: "shop", label: "Food/general stores" },
      { kind: "skilling", label: "Mill grain into flour" }
    ]
  },
  {
    match: /^egg$/i,
    hints: [
      { kind: "skilling", label: "Collect near chickens" }
    ]
  },
  {
    match: /^(hammer|spade)$/i,
    hints: [
      { kind: "shop", label: "General store / tool shop" }
    ]
  },
  {
    match: /^logs?$/i,
    hints: [
      { kind: "skilling", label: "Cut normal trees" }
    ]
  }
];

function sourceHintsForName(name: string): ItemSourceHint[] {
  return ITEM_SOURCE_HINTS.find((entry) => entry.match.test(name.trim()))?.hints ?? [];
}

export function itemSourceHints(name: string, extraHints: ItemSourceHint[] = []): ItemSourceHint[] {
  const hints = [...extraHints, ...sourceHintsForName(name)];
  const seen = new Set<string>();
  return hints.filter((hint) => {
    const key = `${hint.kind}:${hint.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pluralizeItemName(name: string, quantity: number): string {
  const cleaned = name.trim().toLowerCase();
  if (quantity === 1) return cleaned;
  if (cleaned.endsWith("s")) return cleaned;
  if (cleaned.endsWith("y")) return `${cleaned.slice(0, -1)}ies`;
  return `${cleaned}s`;
}

function itemStack(quantity: number, name: string): string {
  return `${Math.max(1, quantity)} ${pluralizeItemName(name, quantity)}`;
}

function primarySourceRoute(hints: ItemSourceHint[]): string {
  const preferred = hints.find((hint) => hint.kind === "shop")
    ?? hints.find((hint) => hint.kind === "minigame")
    ?? hints.find((hint) => hint.kind === "quest-reward")
    ?? hints.find((hint) => hint.kind === "crafting")
    ?? hints.find((hint) => hint.kind === "skilling")
    ?? hints[0];
  return preferred?.detail ?? preferred?.label ?? "self-source route";
}

function missingStatus(accountType: PlannerAccountType | null, hints: ItemSourceHint[]): ItemAvailabilityStatus {
  if (isUltimatePlannerAccount(accountType)) return "uim-stage-manually";
  if (hints.some((hint) => hint.kind === "quest-reward")) return "missing-quest-locked";
  if (hints.some((hint) => hint.kind === "minigame")) return "missing-minigame-source";
  if (accountType === "regular" || accountType === "skiller" || accountType === "pure") return "missing-buyable";
  if (hints.some((hint) => hint.kind === "shop")) return "missing-shop-source";
  return "missing-source-needed";
}

export function evaluateItemAvailability(input: ItemAvailabilityInput): ItemAvailability {
  const accountType = input.accountType ?? null;
  const sourceHints = itemSourceHints(input.name, input.sourceHints);
  const stack = itemStack(input.quantity, input.name);
  const ownedQuantity = Math.max(0, Math.floor(input.ownedQuantity ?? 0));
  const ownedName = input.ownedName ?? input.name;

  if (input.ownedInBank) {
    const ownedStack = itemStack(ownedQuantity || input.quantity, ownedName);
    return {
      status: "owned",
      sourceHints,
      copy: `In bank: ${ownedStack}.`,
      shortCopy: `In bank: ${ownedStack}`,
      blockerCopy: `${ownedStack} already owned`
    };
  }

  const status = missingStatus(accountType, sourceHints);
  const route = primarySourceRoute(sourceHints);

  if (status === "uim-stage-manually") {
    return {
      status,
      sourceHints,
      copy: `Stage/carry ${stack} before starting.`,
      shortCopy: `Stage/carry ${stack}`,
      blockerCopy: `Stage/carry ${stack} before starting`
    };
  }

  if (accountType === "group") {
    return {
      status,
      sourceHints,
      copy: `Check own bank; group storage not verified for ${stack}.`,
      shortCopy: `Own bank only: ${stack}`,
      blockerCopy: `Check own bank; group storage not verified for ${stack}`
    };
  }

  if (accountType === "hardcore") {
    return {
      status,
      sourceHints,
      copy: `Avoid risky source unless needed; source ${stack} yourself via ${route}.`,
      shortCopy: `Source ${stack} safely`,
      blockerCopy: `Avoid risky source unless needed for ${stack}`
    };
  }

  if (accountType === "ironman") {
    return {
      status,
      sourceHints,
      copy: `Source ${stack} yourself; ${route}.`,
      shortCopy: `Source ${stack}`,
      blockerCopy: `Source ${stack} yourself`
    };
  }

  if (accountType === null) {
    return {
      status,
      sourceHints,
      copy: `Source or verify ${stack}; account mode is unknown.`,
      shortCopy: `Verify ${stack}`,
      blockerCopy: `Source or verify ${stack}`
    };
  }

  return {
    status,
    sourceHints,
    copy: `Buy or grab ${stack}.`,
    shortCopy: `Buy or grab ${stack}`,
    blockerCopy: `Buy or grab ${stack}`
  };
}
