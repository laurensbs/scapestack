// Compare two bank snapshots and surface what changed: new items, removed
// items, and quantity shifts. Used to show "Welcome back, here's what's
// different since last time" on a follow-up organize.

import type { OrganizedItem } from "./organizer";

export interface BankSnapshot {
  ts: number;             // timestamp
  items: Array<{ id: number; name: string; quantity: number; stackValue: number }>;
}

export interface BankDiff {
  added: Array<{ id: number; name: string; quantity: number; stackValue: number }>;
  removed: Array<{ id: number; name: string; quantity: number; stackValue: number }>;
  changedQuantity: Array<{
    id: number;
    name: string;
    before: number;
    after: number;
    delta: number;
    deltaValue: number;     // stackValue of the change
  }>;
  totalValueBefore: number;
  totalValueAfter: number;
  daysSince: number;
}

export function snapshotBank(tabs: Array<{ items: OrganizedItem[] }>): BankSnapshot {
  const items: BankSnapshot["items"] = [];
  for (const tab of tabs) {
    for (const it of tab.items) {
      items.push({ id: it.id, name: it.name, quantity: it.quantity, stackValue: it.stackValue });
    }
  }
  return { ts: Date.now(), items };
}

export function diffSnapshots(prev: BankSnapshot, next: BankSnapshot): BankDiff {
  const prevById = new Map(prev.items.map((it) => [it.id, it]));
  const nextById = new Map(next.items.map((it) => [it.id, it]));

  const added: BankDiff["added"] = [];
  const removed: BankDiff["removed"] = [];
  const changedQuantity: BankDiff["changedQuantity"] = [];

  for (const it of next.items) {
    const before = prevById.get(it.id);
    if (!before) {
      added.push(it);
    } else if (before.quantity !== it.quantity) {
      const delta = it.quantity - before.quantity;
      const unitPrice = it.quantity > 0 ? it.stackValue / it.quantity : 0;
      changedQuantity.push({
        id: it.id,
        name: it.name,
        before: before.quantity,
        after: it.quantity,
        delta,
        deltaValue: Math.round(unitPrice * delta)
      });
    }
  }

  for (const it of prev.items) {
    if (!nextById.has(it.id)) removed.push(it);
  }

  return {
    added,
    removed,
    changedQuantity,
    totalValueBefore: prev.items.reduce((s, it) => s + it.stackValue, 0),
    totalValueAfter: next.items.reduce((s, it) => s + it.stackValue, 0),
    daysSince: Math.max(0, Math.round((next.ts - prev.ts) / (1000 * 60 * 60 * 24)))
  };
}

export const SNAPSHOT_KEY = "scapestack-bank:last-snapshot";

export function saveSnapshot(snap: BankSnapshot): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  } catch {}
}

export function loadSnapshot(): BankSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.items || !parsed.ts) return null;
    return parsed as BankSnapshot;
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {}
}
