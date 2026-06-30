import { rsnSlug } from "./hiscores";
import type { Mood, TimeBudget } from "./mood";

export const ACCOUNT_STORE_KEY = "scapestack:accounts:v1";
export const ACCOUNT_EVENT = "scapestack:account-change";

export interface ScapestackAccount {
  rsn: string;
  id: string;
  createdAt: number;
  lastUsedAt: number;
  bankSavedAt?: number;
  runeliteCheckedAt?: number;
  preferredMood?: Mood;
  preferredMinutes?: TimeBudget;
}

export interface ScapestackAccountStore {
  version: 1;
  activeId: string | null;
  accounts: ScapestackAccount[];
}

function emptyStore(): ScapestackAccountStore {
  return { version: 1, activeId: null, accounts: [] };
}

function now(): number {
  return Date.now();
}

function normalizeRsn(rsn: string): string {
  return rsn.trim().replace(/\s+/g, " ").slice(0, 12);
}

export function accountIdForRsn(rsn: string): string {
  return rsnSlug(normalizeRsn(rsn));
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function notifyAccountChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT));
}

function isAccount(value: unknown): value is ScapestackAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Record<string, unknown>;
  return typeof account.rsn === "string"
    && typeof account.id === "string"
    && typeof account.createdAt === "number"
    && typeof account.lastUsedAt === "number";
}

export function loadAccountStore(): ScapestackAccountStore {
  if (!canUseStorage()) return emptyStore();
  try {
    const raw = localStorage.getItem(ACCOUNT_STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<ScapestackAccountStore>;
    if (parsed.version !== 1 || !Array.isArray(parsed.accounts)) return emptyStore();
    const accounts = parsed.accounts.filter(isAccount);
    const activeId = typeof parsed.activeId === "string" && accounts.some((account) => account.id === parsed.activeId)
      ? parsed.activeId
      : accounts[0]?.id ?? null;
    return { version: 1, activeId, accounts };
  } catch {
    return emptyStore();
  }
}

export function saveAccountStore(store: ScapestackAccountStore): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(ACCOUNT_STORE_KEY, JSON.stringify(store));
    notifyAccountChange();
  } catch {
  }
}

export function getActiveAccount(): ScapestackAccount | null {
  const store = loadAccountStore();
  return store.accounts.find((account) => account.id === store.activeId) ?? null;
}

export function upsertAccount(rsn: string, patch: Partial<Omit<ScapestackAccount, "id" | "rsn" | "createdAt">> = {}): ScapestackAccount | null {
  const clean = normalizeRsn(rsn);
  if (!clean) return null;
  const id = accountIdForRsn(clean);
  const store = loadAccountStore();
  const existing = store.accounts.find((account) => account.id === id);
  const timestamp = now();
  const nextAccount: ScapestackAccount = {
    id,
    rsn: clean,
    createdAt: existing?.createdAt ?? timestamp,
    lastUsedAt: timestamp,
    bankSavedAt: existing?.bankSavedAt,
    runeliteCheckedAt: existing?.runeliteCheckedAt,
    preferredMood: existing?.preferredMood,
    preferredMinutes: existing?.preferredMinutes,
    ...patch
  };
  const accounts = [
    nextAccount,
    ...store.accounts.filter((account) => account.id !== id)
  ].slice(0, 8);
  saveAccountStore({ version: 1, activeId: id, accounts });
  return nextAccount;
}

export function setActiveAccount(rsn: string): ScapestackAccount | null {
  return upsertAccount(rsn);
}

export function clearActiveAccount(): void {
  const store = loadAccountStore();
  saveAccountStore({ ...store, activeId: null });
}

export function removeAccount(rsn: string): void {
  const id = accountIdForRsn(rsn);
  const store = loadAccountStore();
  const accounts = store.accounts.filter((account) => account.id !== id);
  const activeId = store.activeId === id
    ? accounts[0]?.id ?? null
    : store.activeId;
  saveAccountStore({ version: 1, activeId, accounts });
}

export function markActiveAccountBankSaved(savedAt: number = now()): void {
  const active = getActiveAccount();
  if (!active) return;
  markAccountBankSaved(active.rsn, savedAt);
}

export function markAccountBankSaved(rsn: string, savedAt: number = now()): void {
  upsertAccount(rsn, { bankSavedAt: savedAt });
}

export function markRuneliteChecked(rsn: string, checkedAt: number = now()): void {
  upsertAccount(rsn, { runeliteCheckedAt: checkedAt });
}

export function markAccountMood(rsn: string, mood: Mood, minutes: TimeBudget): void {
  upsertAccount(rsn, { preferredMood: mood, preferredMinutes: minutes });
}

export function markActiveAccountMood(mood: Mood, minutes: TimeBudget): void {
  const active = getActiveAccount();
  if (!active) return;
  markAccountMood(active.rsn, mood, minutes);
}
