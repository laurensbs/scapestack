// Persists the last N Stack Score values + timestamps so the bank result
// can draw a sparkline of how the player's bank has trended.

const KEY = "scapestack-bank:score-history";
const MAX_POINTS = 30;

export interface ScorePoint {
  t: number;     // unix ms
  s: number;     // score
}

export function loadScoreHistory(): ScorePoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p): p is ScorePoint =>
        typeof p === "object" && p !== null &&
        typeof (p as ScorePoint).t === "number" &&
        typeof (p as ScorePoint).s === "number"
      )
      .slice(-MAX_POINTS);
  } catch {
    return [];
  }
}

export function pushScorePoint(score: number, now = Date.now()): ScorePoint[] {
  if (typeof window === "undefined") return [];
  const hist = loadScoreHistory();
  // Dedupe: if the most recent entry is within 30 seconds, replace it instead
  // of stacking a new point (avoids spamming on rapid re-organizes).
  const last = hist[hist.length - 1];
  if (last && now - last.t < 30_000) {
    hist[hist.length - 1] = { t: now, s: score };
  } else {
    hist.push({ t: now, s: score });
  }
  const trimmed = hist.slice(-MAX_POINTS);
  try { localStorage.setItem(KEY, JSON.stringify(trimmed)); } catch {}
  return trimmed;
}
