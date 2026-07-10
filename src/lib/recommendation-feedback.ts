// Local feedback loop for /next recommendations. This is deliberately
// localStorage-only for v1: no account, no auth, no server profile needed.

const KEY = "scapestack:recommendation-feedback:v1";
const MAX_RECENT_MEMORY = 40;
const RECENT_MEMORY_WINDOW_MS = 6 * 60 * 60 * 1000;

export type RecommendationFeedbackReason =
  | "not_today"
  | "already_done"
  | "not_my_style"
  | "too_hard"
  | "too_boring";

export type RecommendationMemoryAction = RecommendationFeedbackReason | "try_another" | "started";

export interface RecommendationFeedback {
  version: 1;
  suppressed: Record<string, RecommendationFeedbackEntry>;
  recent: RecommendationMemoryEntry[];
}

export interface RecommendationFeedbackEntry {
    id: string;
    kind: string;
    title?: string;
    reason: RecommendationFeedbackReason;
    savedAt: number;
}

export interface RecommendationMemoryEntry {
  id: string;
  kind: string;
  title?: string;
  action: RecommendationMemoryAction;
  savedAt: number;
  mood?: string;
  routeLens?: string;
  rsnKey?: string;
}

const EMPTY: RecommendationFeedback = { version: 1, suppressed: {}, recent: [] };

export function loadRecommendationFeedback(): RecommendationFeedback {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidFeedback(parsed)) return EMPTY;
    return normalizeFeedback(parsed);
  } catch {
    return EMPTY;
  }
}

export function suppressRecommendation(input: {
  id: string;
  kind: string;
  title?: string;
  reason: RecommendationFeedbackReason;
}): RecommendationFeedback {
  const current = loadRecommendationFeedback();
  const savedAt = Date.now();
  const next: RecommendationFeedback = {
    version: 1,
    suppressed: {
      ...current.suppressed,
      [input.id]: { ...input, savedAt }
    },
    recent: appendRecommendationMemory(current.recent, {
      ...input,
      action: input.reason,
      savedAt
    })
  };
  saveRecommendationFeedback(next);
  return next;
}

export function restoreRecommendation(id: string): RecommendationFeedback {
  const current = loadRecommendationFeedback();
  const nextSuppressed = { ...current.suppressed };
  delete nextSuppressed[id];
  const next: RecommendationFeedback = {
    version: 1,
    suppressed: nextSuppressed,
    recent: current.recent.filter((entry) => entry.id !== id)
  };
  saveRecommendationFeedback(next);
  return next;
}

export function clearRecommendationFeedback(): RecommendationFeedback {
  saveRecommendationFeedback(EMPTY);
  return EMPTY;
}

export function recordRecommendationMemory(input: {
  id: string;
  kind: string;
  title?: string;
  action: RecommendationMemoryAction;
  mood?: string;
  routeLens?: string;
  rsn?: string;
}): RecommendationFeedback {
  const current = loadRecommendationFeedback();
  const next: RecommendationFeedback = {
    version: 1,
    suppressed: current.suppressed,
    recent: appendRecommendationMemory(current.recent, {
      id: input.id,
      kind: input.kind,
      title: input.title,
      action: input.action,
      mood: input.mood,
      routeLens: input.routeLens,
      rsnKey: normalizeRsnKey(input.rsn),
      savedAt: Date.now()
    })
  };
  saveRecommendationFeedback(next);
  return next;
}

export function isRecommendationSuppressed(id: string, feedback = loadRecommendationFeedback()): boolean {
  return Boolean(feedback.suppressed[id]);
}

export function latestRecommendationFeedback(
  feedback = loadRecommendationFeedback()
): RecommendationFeedbackEntry | null {
  return Object.values(feedback.suppressed)
    .sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}

export function latestRecommendationMemory(
  feedback = loadRecommendationFeedback(),
  options: { rsn?: string; maxAgeMs?: number } = {}
): RecommendationMemoryEntry | null {
  const rsnKey = normalizeRsnKey(options.rsn);
  const cutoff = Date.now() - (options.maxAgeMs ?? RECENT_MEMORY_WINDOW_MS);
  return feedback.recent
    .filter((entry) => entry.savedAt >= cutoff)
    .filter((entry) => matchesRsnKey(entry, rsnKey))
    .sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}

export function latestStartedRecommendationMemory(
  feedback = loadRecommendationFeedback(),
  options: { rsn?: string; maxAgeMs?: number } = {}
): RecommendationMemoryEntry | null {
  const rsnKey = normalizeRsnKey(options.rsn);
  const cutoff = Date.now() - (options.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000);
  return feedback.recent
    .filter((entry) => entry.action === "started")
    .filter((entry) => entry.savedAt >= cutoff)
    .filter((entry) => matchesRsnKey(entry, rsnKey))
    .sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}

export function recommendationMemoryCounts(
  feedback = loadRecommendationFeedback(),
  options: { rsn?: string; maxAgeMs?: number } = {}
): Record<string, number> {
  const rsnKey = normalizeRsnKey(options.rsn);
  const cutoff = Date.now() - (options.maxAgeMs ?? RECENT_MEMORY_WINDOW_MS);
  const counts: Record<string, number> = {};
  for (const entry of feedback.recent) {
    if (entry.savedAt < cutoff || !matchesRsnKey(entry, rsnKey)) continue;
    const weight = memoryActionWeight(entry.action);
    if (weight <= 0) continue;
    counts[entry.id] = Math.min(5, (counts[entry.id] ?? 0) + weight);
  }
  return counts;
}

function saveRecommendationFeedback(feedback: RecommendationFeedback): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(feedback)); } catch {}
}

function isValidFeedback(value: unknown): value is Partial<RecommendationFeedback> {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<RecommendationFeedback>;
  return record.version === 1
    && !!record.suppressed
    && typeof record.suppressed === "object";
}

function normalizeFeedback(value: Partial<RecommendationFeedback>): RecommendationFeedback {
  return {
    version: 1,
    suppressed: value.suppressed ?? {},
    recent: Array.isArray(value.recent)
      ? value.recent.filter(isValidMemoryEntry).slice(-MAX_RECENT_MEMORY)
      : []
  };
}

function appendRecommendationMemory(
  current: RecommendationMemoryEntry[],
  entry: RecommendationMemoryEntry
): RecommendationMemoryEntry[] {
  return [...current, entry].filter(isValidMemoryEntry).slice(-MAX_RECENT_MEMORY);
}

function isValidMemoryEntry(value: unknown): value is RecommendationMemoryEntry {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<RecommendationMemoryEntry>;
  return typeof record.id === "string"
    && typeof record.kind === "string"
    && typeof record.action === "string"
    && typeof record.savedAt === "number";
}

function normalizeRsnKey(rsn?: string): string | undefined {
  const trimmed = rsn?.trim().toLowerCase();
  return trimmed || undefined;
}

function matchesRsnKey(entry: RecommendationMemoryEntry, rsnKey?: string): boolean {
  if (!rsnKey || !entry.rsnKey) return true;
  return entry.rsnKey === rsnKey;
}

function memoryActionWeight(action: RecommendationMemoryAction): number {
  if (action === "started") return 0;
  if (action === "already_done") return 5;
  if (action === "too_hard" || action === "not_my_style") return 3;
  if (action === "not_today" || action === "too_boring") return 2;
  return 1;
}
