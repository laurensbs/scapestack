// Per-item activity ledger. For each item id we track:
//   firstSeen: when it first appeared in the bank
//   lastChanged: when its quantity last changed (added, removed, or qty-shift)
//
// "Bank diet" uses lastChanged to surface items that have been sitting
// untouched for a long time — likely dead weight.

import type { BankSnapshot } from "./diff";

const KEY = "scapestack-bank:item-history";

export interface ItemActivity {
  firstSeen: number;
  lastChanged: number;
  lastQty: number;
}

export type ItemHistory = Record<number, ItemActivity>;

export function loadItemHistory(): ItemHistory {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as ItemHistory;
  } catch {
    return {};
  }
}

export function saveItemHistory(h: ItemHistory): void {
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch {}
}

// Update the ledger using the current snapshot. Returns the updated ledger.
export function recordSnapshot(snap: BankSnapshot, now = Date.now()): ItemHistory {
  const hist = loadItemHistory();
  const seen = new Set<number>();
  for (const it of snap.items) {
    seen.add(it.id);
    const prev = hist[it.id];
    if (!prev) {
      hist[it.id] = { firstSeen: now, lastChanged: now, lastQty: it.quantity };
    } else if (prev.lastQty !== it.quantity) {
      prev.lastChanged = now;
      prev.lastQty = it.quantity;
    }
  }
  // Drop entries for items that are no longer in the bank — keep storage lean.
  for (const id of Object.keys(hist)) {
    if (!seen.has(Number(id))) delete hist[Number(id)];
  }
  saveItemHistory(hist);
  return hist;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSinceChanged(activity: ItemActivity | undefined, now = Date.now()): number | null {
  if (!activity) return null;
  return Math.floor((now - activity.lastChanged) / DAY_MS);
}

// Items idle for 30+ days, AND not a single-stack tool, are candidates for
// "bank diet" review. Caller filters further (e.g. exclude untradeables).
export function isStale(activity: ItemActivity | undefined, thresholdDays = 30, now = Date.now()): boolean {
  const d = daysSinceChanged(activity, now);
  return d !== null && d >= thresholdDays;
}
