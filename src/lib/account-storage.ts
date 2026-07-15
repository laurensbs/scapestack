import { rsnSlug } from "./hiscores";
import type { Mood, TimeBudget } from "./mood";
import type { PluginBankStatus } from "./plugin-bank-status";
import type { RuneliteProgressMemory } from "./runelite-progress-memory";

export const ACCOUNT_STORE_KEY = "scapestack:accounts:v1";
export const ACCOUNT_EVENT = "scapestack:account-change";
const LEGACY_BANK_KEY = "scapestack:saved-bank:v1";
const accountBankKeyForId = (id: string) => `scapestack:saved-bank:${id}:v1`;

export interface ScapestackAccount {
  rsn: string;
  id: string;
  serverAccountId?: string;
  connectedAt?: number;
  createdAt: number;
  lastUsedAt: number;
  bankSavedAt?: number;
  pluginBankItemCount?: number;
  pluginBankCapturedAt?: string;
  runeliteCheckedAt?: number;
  preferredMood?: Mood;
  preferredMinutes?: TimeBudget;
  lastHeadlineId?: string;
  lastHeadlineTitle?: string;
  lastHeadlineSavedAt?: number;
  runeliteProgressTitle?: string;
  runeliteProgressLead?: string;
  runeliteProgressLines?: string[];
  runeliteProgressSyncedAt?: string | null;
  runeliteProgressSavedAt?: number;
  recentTrips?: AccountTripMemory[];
  firstSetupCompletedAt?: number;
}

export type AccountTripAction = "started" | "done" | "skipped";

export interface AccountTripMemory {
  id: string;
  kind: string;
  title: string;
  action: AccountTripAction;
  savedAt: number;
  mood?: string;
  routeLens?: string;
  stopPoint?: string;
}

type AccountPatch = Partial<Omit<ScapestackAccount, "id" | "rsn" | "createdAt">>;

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

function isAccountTripMemory(value: unknown): value is AccountTripMemory {
  if (!value || typeof value !== "object") return false;
  const trip = value as Partial<AccountTripMemory>;
  return typeof trip.id === "string"
    && typeof trip.kind === "string"
    && typeof trip.title === "string"
    && (trip.action === "started" || trip.action === "done" || trip.action === "skipped")
    && typeof trip.savedAt === "number";
}

export function loadAccountStore(): ScapestackAccountStore {
  if (!canUseStorage()) return emptyStore();
  try {
    const raw = localStorage.getItem(ACCOUNT_STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<ScapestackAccountStore>;
    if (parsed.version !== 1 || !Array.isArray(parsed.accounts)) return emptyStore();
    const accounts = parsed.accounts.filter(isAccount);
    const activeId = parsed.activeId === null
      ? null
      : typeof parsed.activeId === "string" && accounts.some((account) => account.id === parsed.activeId)
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

export function upsertAccount(rsn: string, patch: AccountPatch = {}): ScapestackAccount | null {
  const clean = normalizeRsn(rsn);
  if (!clean) return null;
  const id = accountIdForRsn(clean);
  const store = loadAccountStore();
  const existing = store.accounts.find((account) => account.id === id);
  const timestamp = now();
  const nextAccount: ScapestackAccount = {
    id,
    rsn: clean,
    serverAccountId: existing?.serverAccountId,
    connectedAt: existing?.connectedAt,
    createdAt: existing?.createdAt ?? timestamp,
    lastUsedAt: timestamp,
    bankSavedAt: existing?.bankSavedAt,
    pluginBankItemCount: existing?.pluginBankItemCount,
    pluginBankCapturedAt: existing?.pluginBankCapturedAt,
    runeliteCheckedAt: existing?.runeliteCheckedAt,
    preferredMood: existing?.preferredMood,
    preferredMinutes: existing?.preferredMinutes,
    lastHeadlineId: existing?.lastHeadlineId,
    lastHeadlineTitle: existing?.lastHeadlineTitle,
    lastHeadlineSavedAt: existing?.lastHeadlineSavedAt,
    runeliteProgressTitle: existing?.runeliteProgressTitle,
    runeliteProgressLead: existing?.runeliteProgressLead,
    runeliteProgressLines: existing?.runeliteProgressLines,
    runeliteProgressSyncedAt: existing?.runeliteProgressSyncedAt,
    runeliteProgressSavedAt: existing?.runeliteProgressSavedAt,
    recentTrips: existing?.recentTrips?.filter(isAccountTripMemory).slice(-6),
    firstSetupCompletedAt: existing?.firstSetupCompletedAt,
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
  const removingActive = store.activeId === id;
  const accounts = store.accounts.filter((account) => account.id !== id);
  const activeId = removingActive ? null : store.activeId;
  if (canUseStorage()) {
    try {
      localStorage.removeItem(accountBankKeyForId(id));
      if (removingActive) localStorage.removeItem(LEGACY_BANK_KEY);
    } catch {
    }
  }
  saveAccountStore({ version: 1, activeId, accounts });
}

export interface ServerAccountLink {
  accountId: string;
  rsn: string;
  displayName: string;
}

/**
 * Upgrades an existing RSN-first browser profile after RuneLite proves control.
 * The stable server ID lets a renamed display name reuse the same local mood,
 * trip history and bank attachment instead of creating a duplicate profile.
 */
export function linkServerAccount(
  link: ServerAccountLink,
  previousRsn?: string | null,
  connectedAt: number = now()
): ScapestackAccount | null {
  const displayName = normalizeRsn(link.displayName || link.rsn);
  if (!displayName || !link.accountId) return null;
  const store = loadAccountStore();
  const destinationId = accountIdForRsn(displayName);
  const previousId = previousRsn ? accountIdForRsn(previousRsn) : null;
  const source = store.accounts.find((account) => account.serverAccountId === link.accountId)
    ?? (previousId ? store.accounts.find((account) => account.id === previousId) : null)
    ?? store.accounts.find((account) => account.id === store.activeId)
    ?? null;
  const destination = store.accounts.find((account) => account.id === destinationId) ?? null;
  const merged: ScapestackAccount = {
    ...(source ?? destination ?? {
      id: destinationId,
      rsn: displayName,
      createdAt: connectedAt,
      lastUsedAt: connectedAt
    }),
    ...(destination ?? {}),
    id: destinationId,
    rsn: displayName,
    serverAccountId: link.accountId,
    connectedAt,
    lastUsedAt: connectedAt
  };

  if (canUseStorage() && source && source.id !== destinationId) {
    try {
      const sourceKey = accountBankKeyForId(source.id);
      const destinationKey = accountBankKeyForId(destinationId);
      const saved = localStorage.getItem(sourceKey);
      if (saved && !localStorage.getItem(destinationKey)) localStorage.setItem(destinationKey, saved);
      localStorage.removeItem(sourceKey);
    } catch {
    }
  }

  const replacedIds = new Set([destinationId, source?.id].filter((value): value is string => Boolean(value)));
  saveAccountStore({
    version: 1,
    activeId: destinationId,
    accounts: [merged, ...store.accounts.filter((account) => !replacedIds.has(account.id))].slice(0, 8)
  });
  return merged;
}

export function unlinkServerAccount(rsn: string): void {
  const id = accountIdForRsn(rsn);
  const store = loadAccountStore();
  const account = store.accounts.find((entry) => entry.id === id);
  if (!account) return;
  const next = { ...account };
  delete next.serverAccountId;
  delete next.connectedAt;
  saveAccountStore({
    ...store,
    accounts: store.accounts.map((entry) => entry.id === id ? next : entry)
  });
}

export function markActiveAccountBankSaved(savedAt: number = now()): void {
  const active = getActiveAccount();
  if (!active) return;
  markAccountBankSaved(active.rsn, savedAt);
}

export function markAccountBankSaved(rsn: string, savedAt: number = now()): void {
  upsertAccount(rsn, { bankSavedAt: savedAt });
}

export function clearAccountBankSaved(rsn: string): void {
  upsertAccount(rsn, { bankSavedAt: undefined });
}

export function accountHasBankContext(account: ScapestackAccount | null | undefined, savedBank?: unknown): boolean {
  return Boolean(account?.bankSavedAt || (account?.pluginBankItemCount ?? 0) > 0 || savedBank);
}

export function markAccountPluginBankStatus(rsn: string, status: PluginBankStatus | null | undefined): void {
  if (status?.enabled && status.itemCount > 0) {
    upsertAccount(rsn, {
      pluginBankItemCount: status.itemCount,
      pluginBankCapturedAt: status.capturedAt ?? new Date().toISOString()
    });
    return;
  }
  upsertAccount(rsn, {
    pluginBankItemCount: undefined,
    pluginBankCapturedAt: undefined
  });
}

export function markRuneliteChecked(rsn: string, checkedAt: number = now()): void {
  upsertAccount(rsn, { runeliteCheckedAt: checkedAt });
}

export function clearRuneliteChecked(rsn: string): void {
  upsertAccount(rsn, { runeliteCheckedAt: undefined });
}

export function markAccountRuneliteProgress(rsn: string, progress: RuneliteProgressMemory | null | undefined): void {
  if (!progress || progress.lines.length === 0) return;
  upsertAccount(rsn, {
    runeliteProgressTitle: progress.title,
    runeliteProgressLead: progress.lead,
    runeliteProgressLines: progress.lines,
    runeliteProgressSyncedAt: progress.syncedAt,
    runeliteProgressSavedAt: progress.savedAt
  });
}

export function markAccountTrip(
  rsn: string,
  trip: Omit<AccountTripMemory, "savedAt"> & { savedAt?: number }
): void {
  const id = accountIdForRsn(rsn);
  const account = loadAccountStore().accounts.find((entry) => entry.id === id);
  const nextTrip: AccountTripMemory = {
    ...trip,
    savedAt: trip.savedAt ?? now()
  };
  const recentTrips = [
    ...(account?.recentTrips?.filter(isAccountTripMemory) ?? []),
    nextTrip
  ].slice(-6);
  upsertAccount(rsn, { recentTrips });
}

export function markAccountMood(
  rsn: string,
  mood: Mood,
  minutes: TimeBudget,
  route?: { lastHeadlineId?: string; lastHeadlineTitle?: string; savedAt?: number }
): void {
  const patch: AccountPatch = { preferredMood: mood, preferredMinutes: minutes };
  if (route?.lastHeadlineId || route?.lastHeadlineTitle) {
    patch.lastHeadlineId = route.lastHeadlineId;
    patch.lastHeadlineTitle = route.lastHeadlineTitle;
    patch.lastHeadlineSavedAt = route.savedAt ?? now();
  }
  upsertAccount(rsn, patch);
}

export function markActiveAccountMood(mood: Mood, minutes: TimeBudget): void {
  const active = getActiveAccount();
  if (!active) return;
  markAccountMood(active.rsn, mood, minutes);
}

export function markAccountFirstSetupSeen(rsn: string, seenAt: number = now()): void {
  upsertAccount(rsn, { firstSetupCompletedAt: seenAt });
}

export function hasAccountFirstSetupSeen(rsn: string): boolean {
  const id = accountIdForRsn(rsn);
  const store = loadAccountStore();
  return Boolean(store.accounts.find((account) => account.id === id)?.firstSetupCompletedAt);
}
