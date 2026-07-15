import {
  accountHasBankContext,
  accountIdForRsn,
  getActiveAccount,
  loadAccountStore,
  type ScapestackAccount
} from "./account-storage";
import { MOOD_LABEL, type Mood, type TimeBudget } from "./mood";
import { loadMood } from "./mood-storage";
import { describeSavedAt, loadSavedBank, loadSavedRsn, type SavedBank } from "./saved-bank";

export interface AccountSnapshot {
  rsn: string;
  account: ScapestackAccount | null;
  savedBank: SavedBank | null;
  hasBankContext: boolean;
  bankSavedAt: number | null;
  pluginBankItemCount: number;
  pluginBankCapturedAt: string | null;
  bankLabel: string;
  bankDetail: string;
  runeliteCheckedAt: number | null;
  hasRunelite: boolean;
  runeliteNeedsRefresh: boolean;
  runeliteLabel: string;
  runeliteDetail: string;
  mood: Mood | null;
  minutes: TimeBudget | null;
  moodLabel: string;
  lastHeadlineId: string | null;
  lastHeadlineTitle: string | null;
  lastHeadlineSavedAt: number | null;
  runeliteProgressTitle: string | null;
  runeliteProgressLead: string | null;
  runeliteProgressLines: string[];
  runeliteProgressSyncedAt: string | null;
  runeliteProgressSavedAt: number | null;
  planHref: string;
  bankHref: string;
  pluginHref: string;
  dpsHref: string;
}

const RUNELITE_REFRESH_MS = 24 * 60 * 60 * 1000;

function cleanRsn(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function findAccount(rsn: string): ScapestackAccount | null {
  if (!rsn) return getActiveAccount();
  const id = accountIdForRsn(rsn);
  return loadAccountStore().accounts.find((account) => account.id === id) ?? null;
}

function formatRuneliteAge(value: number | null): string {
  if (!value) return "RuneLite later";
  const ageMs = Math.max(0, Date.now() - value);
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "Last scan just now";
  if (minutes < 60) return `Last scan ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last scan ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Last scan ${days}d ago`;
}

function bankLabelFor(snapshot: {
  hasBankContext: boolean;
  hasRunelite: boolean;
  pluginBankItemCount: number;
}): string {
  if (snapshot.pluginBankItemCount > 0) return "Bank ready";
  if (snapshot.hasBankContext) return "Bank added";
  return snapshot.hasRunelite ? "Open bank" : "Add bank";
}

function bankDetailFor(input: {
  bankSavedAt: number | null;
  pluginBankItemCount: number;
  bankLabel: string;
}): string {
  if (input.pluginBankItemCount > 0) return `RuneLite bank: ${input.pluginBankItemCount.toLocaleString()} stacks`;
  if (input.bankSavedAt) return `Bank saved ${describeSavedAt(input.bankSavedAt)}`;
  return input.bankLabel;
}

function withRsn(path: string, rsn: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (rsn) params.set("rsn", rsn);
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function loadAccountSnapshot(rsn?: string | null): AccountSnapshot {
  const explicitRsn = cleanRsn(rsn);
  const account = explicitRsn ? findAccount(explicitRsn) : getActiveAccount();
  const resolvedRsn = explicitRsn || account?.rsn || loadSavedRsn() || "";
  const resolvedAccount = account ?? findAccount(resolvedRsn);
  const savedBank = loadSavedBank(resolvedRsn);
  const runeliteCheckedAt = resolvedAccount?.runeliteCheckedAt ?? null;
  const pluginBankItemCount = resolvedAccount?.pluginBankItemCount ?? 0;
  const bankSavedAt = resolvedAccount?.bankSavedAt ?? savedBank?.savedAt ?? null;
  const hasRunelite = Boolean(runeliteCheckedAt);
  const hasBankContext = accountHasBankContext(resolvedAccount, savedBank);
  const bankLabel = bankLabelFor({ hasBankContext, hasRunelite, pluginBankItemCount });
  const moodSession = loadMood(resolvedRsn);
  const mood = moodSession?.mood ?? null;
  const minutes = moodSession?.minutes ?? null;
  const encodedFrom = "account";

  return {
    rsn: resolvedRsn,
    account: resolvedAccount,
    savedBank,
    hasBankContext,
    bankSavedAt,
    pluginBankItemCount,
    pluginBankCapturedAt: resolvedAccount?.pluginBankCapturedAt ?? null,
    bankLabel,
    bankDetail: bankDetailFor({ bankSavedAt, pluginBankItemCount, bankLabel }),
    runeliteCheckedAt,
    hasRunelite,
    runeliteNeedsRefresh: Boolean(runeliteCheckedAt && Date.now() - runeliteCheckedAt > RUNELITE_REFRESH_MS),
    runeliteLabel: hasRunelite ? "Refresh RuneLite" : "Add RuneLite",
    runeliteDetail: formatRuneliteAge(runeliteCheckedAt),
    mood,
    minutes,
    moodLabel: mood ? MOOD_LABEL[mood].name : "Best now",
    lastHeadlineId: moodSession?.lastHeadlineId ?? null,
    lastHeadlineTitle: moodSession?.lastHeadlineTitle ?? null,
    lastHeadlineSavedAt: moodSession?.lastHeadlineTitle ? moodSession.savedAt : null,
    runeliteProgressTitle: resolvedAccount?.runeliteProgressTitle ?? null,
    runeliteProgressLead: resolvedAccount?.runeliteProgressLead ?? null,
    runeliteProgressLines: resolvedAccount?.runeliteProgressLines ?? [],
    runeliteProgressSyncedAt: resolvedAccount?.runeliteProgressSyncedAt ?? null,
    runeliteProgressSavedAt: resolvedAccount?.runeliteProgressSavedAt ?? null,
    planHref: withRsn("/next", resolvedRsn, mood && minutes ? { intent: mood, time: String(minutes) } : undefined),
    bankHref: withRsn("/bank", resolvedRsn, { from: encodedFrom }),
    pluginHref: `${withRsn("/plugin", resolvedRsn, { from: encodedFrom })}#verify-sync`,
    dpsHref: withRsn("/dps", resolvedRsn, { from: encodedFrom })
  };
}
