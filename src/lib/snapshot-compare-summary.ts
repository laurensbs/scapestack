import type { BankDiff } from "./diff";
import { formatGp } from "./utils";

export interface SnapshotCompareSummary {
  headline: string;
  detail: string;
  tone: "good" | "danger" | "neutral";
}

export interface SnapshotCompareAction {
  label: string;
  body: string;
  searchQuery?: string;
}

type SnapshotImpact = {
  kind: "added" | "removed" | "changed";
  id: number;
  name: string;
  value: number;
  quantity: number;
};

function isSnapshotImpact(value: SnapshotImpact | undefined): value is SnapshotImpact {
  return Boolean(value);
}

function strongestSnapshotImpact(diff: BankDiff): SnapshotImpact | undefined {
  const mostValuableAdded = diff.added.slice().sort((left, right) => right.stackValue - left.stackValue)[0];
  const mostValuableRemoved = diff.removed.slice().sort((left, right) => right.stackValue - left.stackValue)[0];
  const biggestQuantityMove = diff.changedQuantity
    .slice()
    .sort((left, right) => Math.abs(right.deltaValue) - Math.abs(left.deltaValue))[0];

  return ([
    mostValuableAdded && {
      kind: "added" as const,
      id: mostValuableAdded.id,
      name: mostValuableAdded.name,
      value: mostValuableAdded.stackValue,
      quantity: mostValuableAdded.quantity
    },
    mostValuableRemoved && {
      kind: "removed" as const,
      id: mostValuableRemoved.id,
      name: mostValuableRemoved.name,
      value: -mostValuableRemoved.stackValue,
      quantity: mostValuableRemoved.quantity
    },
    biggestQuantityMove && {
      kind: "changed" as const,
      id: biggestQuantityMove.id,
      name: biggestQuantityMove.name,
      value: biggestQuantityMove.deltaValue,
      quantity: biggestQuantityMove.delta
    }
  ] satisfies Array<SnapshotImpact | undefined>)
    .filter(isSnapshotImpact)
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))[0];
}

export function summarizeSnapshotCompare(diff: BankDiff): SnapshotCompareSummary {
  const valueDelta = diff.totalValueAfter - diff.totalValueBefore;
  const impact = strongestSnapshotImpact(diff);

  const valuePhrase = valueDelta === 0
    ? "Bank value is flat"
    : `Bank value ${valueDelta > 0 ? "up" : "down"} ${formatGp(Math.abs(valueDelta))}`;

  if (!impact) {
    return {
      headline: valuePhrase,
      detail: "No item-level changes found; this comparison is mostly price movement.",
      tone: valueDelta > 0 ? "good" : valueDelta < 0 ? "danger" : "neutral"
    };
  }

  if (impact.kind === "added") {
    const quantityLabel = impact.quantity > 0 ? `+${impact.quantity.toLocaleString()} ` : "";
    return {
      headline: `${valuePhrase}: ${impact.name} entered the bank`,
      detail: `Largest positive item move: ${quantityLabel}${impact.name} worth ${formatGp(Math.abs(impact.value))} gp.`,
      tone: valueDelta >= 0 ? "good" : "neutral"
    };
  }

  if (impact.kind === "removed") {
    const quantityLabel = impact.quantity > 0 ? `-${impact.quantity.toLocaleString()} ` : "";
    return {
      headline: `${valuePhrase}: ${impact.name} left the bank`,
      detail: `Largest negative item move: ${quantityLabel}${impact.name} worth ${formatGp(Math.abs(impact.value))} gp.`,
      tone: "danger"
    };
  }

  return {
    headline: `${valuePhrase}: ${impact.name} moved most`,
    detail: `Quantity changed by ${impact.quantity > 0 ? "+" : ""}${impact.quantity.toLocaleString()} for roughly ${formatGp(Math.abs(impact.value))} gp.`,
    tone: impact.value > 0 ? "good" : impact.value < 0 ? "danger" : "neutral"
  };
}

export function recommendSnapshotCompareActions(diff: BankDiff): SnapshotCompareAction[] {
  const valueDelta = diff.totalValueAfter - diff.totalValueBefore;
  const impact = strongestSnapshotImpact(diff);
  const actions: SnapshotCompareAction[] = [];

  if (valueDelta > 0) {
    actions.push({
      label: "Re-plan upgrades",
      body: `Bank gained ${formatGp(valueDelta)}. Open /next before that GP turns into idle cash.`
    });
  } else if (valueDelta < 0) {
    actions.push({
      label: "Audit the spend",
      body: `Bank lost ${formatGp(Math.abs(valueDelta))}. Confirm it became gear, supplies, construction or a goal.`
    });
  } else {
    actions.push({
      label: "Check item churn",
      body: "Value is flat, so the useful signal is which items entered, left or moved."
    });
  }

  if (!impact) {
    actions.push({
      label: "Refresh prices",
      body: "No item-level movement was found. Re-import after GE changes or save a new baseline."
    });
    return actions;
  }

  if (impact.kind === "added") {
    actions.push({
      label: "Inspect new item",
      body: `${impact.name} is the strongest new item move. Keep it if it unlocks a setup; sell it if it blocks the next upgrade.`,
      searchQuery: `#${impact.id}`
    });
  } else if (impact.kind === "removed") {
    actions.push({
      label: "Verify missing item",
      body: `${impact.name} left the bank. Buy back or restore it if it belonged to a PvM, clue or skilling setup.`,
      searchQuery: `#${impact.id}`
    });
  } else {
    actions.push({
      label: impact.quantity > 0 ? "Confirm restock" : "Confirm burn rate",
      body: `${impact.name} moved by ${impact.quantity > 0 ? "+" : ""}${impact.quantity.toLocaleString()}. Check whether that matches the session you just ran.`,
      searchQuery: `#${impact.id}`
    });
  }

  return actions;
}

export function buildSnapshotCompareShareText(diff: BankDiff): string {
  const summary = summarizeSnapshotCompare(diff);
  const actions = recommendSnapshotCompareActions(diff);
  const valueDelta = diff.totalValueAfter - diff.totalValueBefore;
  const valueLabel = valueDelta === 0
    ? "Value flat"
    : `Value ${valueDelta > 0 ? "+" : "-"}${formatGp(Math.abs(valueDelta))}`;

  return [
    "Scapestack bank compare",
    summary.headline,
    summary.detail,
    `Added ${diff.added.length} · Removed ${diff.removed.length} · Qty changed ${diff.changedQuantity.length} · ${valueLabel}`,
    "Next actions:",
    ...actions.map((action) => `- ${action.label}: ${action.body}`)
  ].join("\n");
}
