// Local feedback loop for /next recommendations. This is deliberately
// localStorage-only for v1: no account, no auth, no server profile needed.

const KEY = "scapestack:recommendation-feedback:v1";

export type RecommendationFeedbackReason =
  | "not_today"
  | "already_done"
  | "not_my_style"
  | "too_hard"
  | "too_boring";

export interface RecommendationFeedback {
  version: 1;
  suppressed: Record<string, {
    id: string;
    kind: string;
    reason: RecommendationFeedbackReason;
    savedAt: number;
  }>;
}

const EMPTY: RecommendationFeedback = { version: 1, suppressed: {} };

export function loadRecommendationFeedback(): RecommendationFeedback {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidFeedback(parsed)) return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

export function suppressRecommendation(input: {
  id: string;
  kind: string;
  reason: RecommendationFeedbackReason;
}): RecommendationFeedback {
  const current = loadRecommendationFeedback();
  const next: RecommendationFeedback = {
    version: 1,
    suppressed: {
      ...current.suppressed,
      [input.id]: { ...input, savedAt: Date.now() }
    }
  };
  saveRecommendationFeedback(next);
  return next;
}

export function restoreRecommendation(id: string): RecommendationFeedback {
  const current = loadRecommendationFeedback();
  const nextSuppressed = { ...current.suppressed };
  delete nextSuppressed[id];
  const next: RecommendationFeedback = { version: 1, suppressed: nextSuppressed };
  saveRecommendationFeedback(next);
  return next;
}

export function clearRecommendationFeedback(): RecommendationFeedback {
  saveRecommendationFeedback(EMPTY);
  return EMPTY;
}

export function isRecommendationSuppressed(id: string, feedback = loadRecommendationFeedback()): boolean {
  return Boolean(feedback.suppressed[id]);
}

function saveRecommendationFeedback(feedback: RecommendationFeedback): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(feedback)); } catch {}
}

function isValidFeedback(value: unknown): value is RecommendationFeedback {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<RecommendationFeedback>;
  return record.version === 1
    && !!record.suppressed
    && typeof record.suppressed === "object";
}
