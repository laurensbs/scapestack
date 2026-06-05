// Bank snapshot history. Keeps timestamped snapshots so the player can compare
// current bank against arbitrary historical points ("a month ago"). We store
// both per-RSN histories and a local/global history for manual or no-RSN banks.
//
// Storage layout: a single key with shape
//   { [rsn]: BankSnapshot[] }  (newest last, max 10 per RSN)

import type { BankSnapshot } from "./diff";
import type { OrganizedTab } from "./organizer";
import { computeStackScore } from "./stack-score";
import { computeTips } from "./tips";

const KEY = "scapestack-bank:rsn-snapshots";
const LOCAL_KEY = "scapestack-bank:local-snapshots";
const MAX_PER_RSN = 10;

type Store = Record<string, BankSnapshot[]>;
type AppendSnapshotOptions = { forceNew?: boolean };

function loadStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Store;
  } catch {
    return {};
  }
}

function saveStore(s: Store): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

function normaliseRsn(rsn: string): string {
  return rsn.trim().toLowerCase().replace(/[_\s]+/g, " ");
}

function legacyRsnKey(rsn: string): string {
  return rsn.trim().toLowerCase();
}

function loadRsnSnapshotList(store: Store, rsn: string): BankSnapshot[] {
  const norm = normaliseRsn(rsn);
  const legacy = legacyRsnKey(rsn);
  const slug = norm.replace(/\s+/g, "_");
  return store[norm] || store[legacy] || store[slug] || [];
}

export function loadRsnSnapshots(rsn: string): BankSnapshot[] {
  if (!rsn) return [];
  const store = loadStore();
  return loadRsnSnapshotList(store, rsn);
}

export function loadLocalSnapshots(): BankSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isBankSnapshot) : [];
  } catch {
    return [];
  }
}

function saveLocalSnapshots(list: BankSnapshot[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(trimSnapshots(list))); } catch {}
}

// Append a new snapshot for this RSN. Dedupes if within 5 minutes of the most
// recent one (replaces it). Trims to max length.
export function appendRsnSnapshot(rsn: string, snap: BankSnapshot, options: AppendSnapshotOptions = {}): BankSnapshot[] {
  if (!rsn) return [];
  const norm = normaliseRsn(rsn);
  const store = loadStore();
  const list = loadRsnSnapshotList(store, rsn);
  if (options.forceNew) {
    list.push(snap);
    trimSnapshots(list);
  } else {
    appendOrReplace(list, snap);
  }
  store[norm] = list;
  saveStore(store);
  return list;
}

export function appendLocalSnapshot(snap: BankSnapshot, options: AppendSnapshotOptions = {}): BankSnapshot[] {
  const list = loadLocalSnapshots();
  if (options.forceNew) {
    list.push(snap);
    trimSnapshots(list);
  } else {
    appendOrReplace(list, snap);
  }
  saveLocalSnapshots(list);
  return trimSnapshots(list);
}

export function loadSnapshots(scope: string | null | undefined): BankSnapshot[] {
  return scope ? loadRsnSnapshots(scope) : loadLocalSnapshots();
}

export function appendSnapshot(scope: string | null | undefined, snap: BankSnapshot, options: AppendSnapshotOptions = {}): BankSnapshot[] {
  return scope ? appendRsnSnapshot(scope, snap, options) : appendLocalSnapshot(snap, options);
}

export function deleteSnapshot(scope: string | null | undefined, ts: number): BankSnapshot[] {
  if (scope) {
    const norm = normaliseRsn(scope);
    const store = loadStore();
    const list = loadRsnSnapshotList(store, scope).filter((snap) => snap.ts !== ts);
    store[norm] = list;
    saveStore(store);
    return list;
  }
  const list = loadLocalSnapshots().filter((snap) => snap.ts !== ts);
  saveLocalSnapshots(list);
  return list;
}

export function restoreDeletedSnapshot(scope: string | null | undefined, snap: BankSnapshot): BankSnapshot[] {
  if (scope) {
    const norm = normaliseRsn(scope);
    const store = loadStore();
    const list = restoreIntoList(loadRsnSnapshotList(store, scope), snap);
    store[norm] = list;
    saveStore(store);
    return list;
  }
  const list = restoreIntoList(loadLocalSnapshots(), snap);
  saveLocalSnapshots(list);
  return list;
}

export function latestSnapshot(scope: string | null | undefined): BankSnapshot | null {
  const list = loadSnapshots(scope);
  return list[list.length - 1] ?? null;
}

export interface SnapshotSummary {
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
  tipCount: number;
  stackScore: number;
  topItems: Array<{ id: number; name: string; quantity: number; stackValue: number }>;
}

export function summarizeTabsForSnapshot(tabs: OrganizedTab[]): SnapshotSummary {
  const items = tabs.flatMap((tab) => tab.items);
  const sorted = [...items].sort((a, b) => b.stackValue - a.stackValue);
  return {
    itemCount: items.length,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalValue: items.reduce((sum, item) => sum + item.stackValue, 0),
    tipCount: computeTips(tabs).length,
    stackScore: computeStackScore(tabs).total,
    topItems: sorted.slice(0, 5).map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      stackValue: item.stackValue
    }))
  };
}

export function clearRsnSnapshots(rsn: string): void {
  if (!rsn) return;
  const norm = normaliseRsn(rsn);
  const store = loadStore();
  delete store[norm];
  saveStore(store);
}

export function listKnownRsns(): string[] {
  const store = loadStore();
  return Object.keys(store);
}

function appendOrReplace(list: BankSnapshot[], snap: BankSnapshot): void {
  const last = list[list.length - 1];
  if (last && snap.ts - last.ts < 5 * 60 * 1000) {
    list[list.length - 1] = snap;
  } else {
    list.push(snap);
  }
  trimSnapshots(list);
}

function trimSnapshots(list: BankSnapshot[]): BankSnapshot[] {
  while (list.length > MAX_PER_RSN) list.shift();
  return list;
}

function restoreIntoList(list: BankSnapshot[], snap: BankSnapshot): BankSnapshot[] {
  const deduped = list.filter((entry) => entry.ts !== snap.ts);
  deduped.push(snap);
  deduped.sort((a, b) => a.ts - b.ts);
  return trimSnapshots(deduped);
}

function isBankSnapshot(value: unknown): value is BankSnapshot {
  if (!value || typeof value !== "object") return false;
  const snap = value as Partial<BankSnapshot>;
  return typeof snap.ts === "number"
    && Number.isFinite(snap.ts)
    && Array.isArray(snap.items);
}
