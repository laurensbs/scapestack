// Per-RSN snapshot history. Keeps up to 10 timestamped snapshots so the player
// can compare current bank against arbitrary historical points ("a month ago").
//
// Storage layout: a single key with shape
//   { [rsn]: BankSnapshot[] }  (newest last, max 10 per RSN)

import type { BankSnapshot } from "./diff";

const KEY = "scapestack-bank:rsn-snapshots";
const MAX_PER_RSN = 10;

type Store = Record<string, BankSnapshot[]>;

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
  return rsn.trim().toLowerCase();
}

export function loadRsnSnapshots(rsn: string): BankSnapshot[] {
  if (!rsn) return [];
  const store = loadStore();
  return store[normaliseRsn(rsn)] || [];
}

// Append a new snapshot for this RSN. Dedupes if within 5 minutes of the most
// recent one (replaces it). Trims to max length.
export function appendRsnSnapshot(rsn: string, snap: BankSnapshot): BankSnapshot[] {
  if (!rsn) return [];
  const norm = normaliseRsn(rsn);
  const store = loadStore();
  const list = store[norm] || [];
  const last = list[list.length - 1];
  if (last && snap.ts - last.ts < 5 * 60 * 1000) {
    list[list.length - 1] = snap;
  } else {
    list.push(snap);
  }
  while (list.length > MAX_PER_RSN) list.shift();
  store[norm] = list;
  saveStore(store);
  return list;
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
