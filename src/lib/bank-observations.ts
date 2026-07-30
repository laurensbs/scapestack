import type { AccountSnapshotDelta, BankItemMovement } from "./account-snapshot-delta";
import type { BankSnapshot } from "./diff";

export type BankObservationKind = "dead-stock" | "real-habit" | "price-movement" | "bought-unused";

export interface BankObservation {
  id: string;
  kind: BankObservationKind;
  sentence: string;
  /** Higher numbers render first. This is deliberately about what a player
   * can act on, not which calculation looks most novel. */
  actionability: number;
  /** The operands behind the sentence. No observation exists without these. */
  arithmetic: Record<string, string | number>;
}

export interface BankObservationSnapshot {
  checksum?: string;
  capturedAt: string;
  delta: AccountSnapshotDelta | null;
}

export interface BankObservationResult {
  state: "ready" | "series-too-short";
  explanation: string | null;
  observations: BankObservation[];
}

export interface SyncedBankObservationInput {
  currentBank: Array<{ id: number; name: string; quantity: number }>;
  snapshots: BankObservationSnapshot[];
}

const DAY_MS = 24 * 60 * 60 * 1_000;
const DEAD_STOCK_DAYS = 21;
const DEAD_STOCK_MIN_SCALES = 1_000;

function validTimestamp(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function chronological(snapshots: BankObservationSnapshot[]): BankObservationSnapshot[] {
  return snapshots
    .map((snapshot) => ({ snapshot, timestamp: validTimestamp(snapshot.capturedAt) }))
    .filter((entry): entry is { snapshot: BankObservationSnapshot; timestamp: number } => entry.timestamp !== null)
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((entry) => entry.snapshot);
}

function comparativeDeltas(snapshots: BankObservationSnapshot[]): AccountSnapshotDelta[] {
  const deltas: AccountSnapshotDelta[] = [];
  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1];
    const delta = snapshots[index].delta;
    if (!delta?.fromChecksum) continue;
    // A limited history query can begin in the middle of the ledger. Never
    // count the first returned row's delta: its "before" snapshot is outside
    // the measured window. When checksums are present, also refuse gaps.
    if (previous.checksum && delta.fromChecksum !== previous.checksum) continue;
    deltas.push(delta);
  }
  return deltas;
}

function movements(delta: AccountSnapshotDelta): BankItemMovement[] {
  return [...delta.bank.added, ...delta.bank.removed, ...delta.bank.quantityChanged];
}

function integer(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function compactGp(value: number): string {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1_000_000_000) return `${sign}${trimDecimal(absolute / 1_000_000_000)}b`;
  if (absolute >= 1_000_000) return `${sign}${trimDecimal(absolute / 1_000_000)}m`;
  if (absolute >= 1_000) return `${sign}${trimDecimal(absolute / 1_000)}k`;
  return `${sign}${Math.round(absolute).toLocaleString("en-US")}`;
}

function trimDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function percentLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function smallNumber(value: number): string {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][value]
    ?? integer(value);
}

function sinceLabel(capturedAt: string): string {
  const timestamp = validTimestamp(capturedAt);
  if (timestamp === null) return "the first snapshot";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(timestamp);
}

function playerItemName(name: string): string {
  if (/^ranarr(?: weed)?$/i.test(name.trim())) return "ranarr";
  return name.trim().replace(/^./, (letter) => letter.toLowerCase());
}

function buildHabitObservation(
  deltas: AccountSnapshotDelta[],
  baselineCapturedAt: string
): BankObservation | null {
  const totals = new Map<number, {
    id: number;
    name: string;
    beforeQuantity: number;
    afterQuantity: number;
    quantityChange: number;
  }>();

  for (const delta of deltas) {
    if (delta.bank.status !== "changed") continue;
    for (const movement of movements(delta)) {
      const previous = totals.get(movement.id);
      totals.set(movement.id, {
        id: movement.id,
        name: movement.name,
        beforeQuantity: previous?.beforeQuantity ?? movement.beforeQuantity,
        afterQuantity: movement.afterQuantity,
        quantityChange: (previous?.quantityChange ?? 0) + movement.delta
      });
    }
  }

  const strongestDrop = [...totals.values()]
    .filter((item) => item.quantityChange < 0)
    .sort((left, right) => left.quantityChange - right.quantityChange)[0];
  if (!strongestDrop) return null;

  const since = sinceLabel(baselineCapturedAt);
  return {
    id: `habit:${strongestDrop.id}`,
    kind: "real-habit",
    sentence: `Your ${playerItemName(strongestDrop.name)} stock dropped ${integer(Math.abs(strongestDrop.quantityChange))} since ${since}.`,
    actionability: 80,
    arithmetic: {
      itemId: strongestDrop.id,
      beforeQuantity: strongestDrop.beforeQuantity,
      afterQuantity: strongestDrop.afterQuantity,
      quantityChange: strongestDrop.quantityChange,
      since
    }
  };
}

function buildDeadStockObservation(
  currentBank: SyncedBankObservationInput["currentBank"],
  snapshots: BankObservationSnapshot[],
  deltas: AccountSnapshotDelta[]
): BankObservation | null {
  const scales = currentBank.find((item) => /^zulrah's scales$/i.test(item.name.trim()));
  if (!scales || scales.quantity < DEAD_STOCK_MIN_SCALES) return null;
  if (deltas.some((delta) => delta.bank.status === "unknown" || delta.bank.status === "unavailable" || delta.bank.truncated)) {
    return null;
  }
  if (deltas.some((delta) => movements(delta).some((item) => item.id === scales.id))) return null;

  const first = validTimestamp(snapshots[0]?.capturedAt ?? "");
  const last = validTimestamp(snapshots.at(-1)?.capturedAt ?? "");
  if (first === null || last === null || last <= first) return null;
  const untouchedDays = Math.floor((last - first) / DAY_MS);
  if (untouchedDays < DEAD_STOCK_DAYS) return null;
  const untouchedWeeks = Math.floor(untouchedDays / 7);

  return {
    id: `dead-stock:${scales.id}`,
    kind: "dead-stock",
    sentence: `${integer(scales.quantity)} ${scales.name}, untouched for ${smallNumber(untouchedWeeks)} ${untouchedWeeks === 1 ? "week" : "weeks"}. That is a blowpipe you have not made.`,
    actionability: 100,
    arithmetic: {
      itemId: scales.id,
      quantity: scales.quantity,
      untouchedDays,
      untouchedWeeks
    }
  };
}

function isVorkathSupply(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return [
    /^(extended )?(super )?antifire/,
    /^ranging potion/,
    /^super combat potion/,
    /^prayer potion/,
    /^super restore/,
    /^(shark|manta ray|anglerfish|cooked karambwan)$/,
    /^(ruby|diamond|dragon|broad) bolts?/
  ].some((pattern) => pattern.test(normalized));
}

function buildBoughtUnusedObservation(deltas: AccountSnapshotDelta[]): BankObservation | null {
  let purchaseEvents = 0;
  let purchasedQuantity = 0;
  let kcGained = 0;

  for (const delta of deltas) {
    const supplyIncreases = movements(delta).filter((item) => item.delta > 0 && isVorkathSupply(item.name));
    if (supplyIncreases.length > 0) {
      purchaseEvents += 1;
      purchasedQuantity += supplyIncreases.reduce((total, item) => total + item.delta, 0);
    }

    const vorkath = delta.bossKc.find((boss) => boss.boss.trim().toLowerCase() === "vorkath");
    // "No KC" is only knowable when every interval carries an observed
    // Vorkath counter. Missing or regressed boss data is not zero.
    if (!vorkath?.movement || vorkath.movement.confidence !== "observed") return null;
    kcGained += Math.max(0, vorkath.movement.delta);
  }

  if (purchaseEvents === 0 || kcGained !== 0) return null;
  return {
    id: "bought-unused:vorkath",
    kind: "bought-unused",
    sentence: `You bought Vorkath supplies ${smallNumber(purchaseEvents)} ${purchaseEvents === 1 ? "time" : "times"} and gained no KC.`,
    actionability: 95,
    arithmetic: { purchaseEvents, purchasedQuantity, kcGained }
  };
}

function ranked(observations: Array<BankObservation | null>): BankObservation[] {
  return observations
    .filter((observation): observation is BankObservation => observation !== null)
    .sort((left, right) => right.actionability - left.actionability || left.id.localeCompare(right.id));
}

export function buildSyncedBankObservations(input: SyncedBankObservationInput): BankObservationResult {
  const snapshots = chronological(input.snapshots);
  const deltas = comparativeDeltas(snapshots);
  if (snapshots.length < 2 || deltas.length < 1) {
    return {
      state: "series-too-short",
      explanation: "Bank observations need at least two snapshots. This first sync is only the baseline.",
      observations: []
    };
  }

  return {
    state: "ready",
    explanation: null,
    observations: ranked([
      buildDeadStockObservation(input.currentBank, snapshots, deltas),
      buildBoughtUnusedObservation(deltas),
      buildHabitObservation(deltas, snapshots[0].capturedAt)
    ])
  };
}

/**
 * `/bank` snapshots and their prices live in localStorage. This function is
 * intentionally pure and browser-safe: callers pass already-local snapshots;
 * no bank IDs or quantities are posted back to the server for pricing.
 */
export function buildLocalBankPriceObservations(snapshots: BankSnapshot[]): BankObservationResult {
  const ordered = snapshots
    .filter((snapshot) => Number.isFinite(snapshot.ts))
    .slice()
    .sort((left, right) => left.ts - right.ts);
  if (ordered.length < 2) {
    return {
      state: "series-too-short",
      explanation: "Price movement needs two snapshots. Save one more bank on this device.",
      observations: []
    };
  }

  const before = ordered[0];
  const after = ordered.at(-1)!;
  if (after.ts <= before.ts) return { state: "ready", explanation: null, observations: [] };
  const beforeById = new Map(before.items.map((item) => [Math.abs(item.id), item]));
  let itemCount = 0;
  let valueBefore = 0;
  let valueAfter = 0;

  for (const item of after.items) {
    const previous = beforeById.get(Math.abs(item.id));
    if (!previous || previous.quantity <= 0 || item.quantity !== previous.quantity) continue;
    if (previous.stackValue <= 0 || item.stackValue <= 0 || previous.stackValue === item.stackValue) continue;
    itemCount += 1;
    valueBefore += previous.stackValue;
    valueAfter += item.stackValue;
  }

  const valueChange = valueAfter - valueBefore;
  if (itemCount === 0 || valueBefore <= 0 || valueChange === 0) {
    return { state: "ready", explanation: null, observations: [] };
  }
  const percentChange = Number(((valueChange / valueBefore) * 100).toFixed(1));
  const direction = valueChange > 0 ? "up" : "down";
  const sentence = `${integer(itemCount)} ${itemCount === 1 ? "item" : "items"} in your bank moved ${direction} ${percentLabel(Math.abs(percentChange))}% while you were away: ${compactGp(Math.abs(valueChange))}.`;

  return {
    state: "ready",
    explanation: null,
    observations: [{
      id: `price:${before.ts}:${after.ts}`,
      kind: "price-movement",
      sentence,
      actionability: 40,
      arithmetic: {
        itemCount,
        valueBefore,
        valueAfter,
        valueChange,
        percentChange,
        fromTimestamp: before.ts,
        toTimestamp: after.ts
      }
    }]
  };
}
