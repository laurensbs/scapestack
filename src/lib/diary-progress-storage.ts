import { accountIdForRsn } from "./account-storage";

export const DIARY_PROGRESS_EVENT = "scapestack:diary-progress-change";
const KEY = (rsn: string) => `scapestack:diary-progress:${accountIdForRsn(rsn)}:v1`;

interface StoredDiaryProgress {
  version: 1;
  checkedTaskIds: string[];
  updatedAt: number;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DIARY_PROGRESS_EVENT));
}

export function loadDiaryTaskChecks(rsn: string): Set<string> {
  if (!canUseStorage() || !rsn.trim()) return new Set();
  try {
    const raw = localStorage.getItem(KEY(rsn));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Partial<StoredDiaryProgress>;
    if (parsed.version !== 1 || !Array.isArray(parsed.checkedTaskIds)) return new Set();
    return new Set(parsed.checkedTaskIds.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function setDiaryTaskChecked(rsn: string, taskId: string, checked: boolean): Set<string> {
  const next = loadDiaryTaskChecks(rsn);
  if (!canUseStorage() || !rsn.trim() || !taskId) return next;
  if (checked) next.add(taskId);
  else next.delete(taskId);
  const payload: StoredDiaryProgress = {
    version: 1,
    checkedTaskIds: [...next].sort(),
    updatedAt: Date.now()
  };
  try {
    localStorage.setItem(KEY(rsn), JSON.stringify(payload));
    notify();
  } catch {
  }
  return next;
}

export function clearDiaryTierChecks(rsn: string, taskIds: Iterable<string>): Set<string> {
  const next = loadDiaryTaskChecks(rsn);
  for (const taskId of taskIds) next.delete(taskId);
  if (!canUseStorage() || !rsn.trim()) return next;
  try {
    localStorage.setItem(KEY(rsn), JSON.stringify({
      version: 1,
      checkedTaskIds: [...next].sort(),
      updatedAt: Date.now()
    } satisfies StoredDiaryProgress));
    notify();
  } catch {
  }
  return next;
}
